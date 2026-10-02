import type { Incident, IncidentFilters, Paginated, SortState, Severity, Likelihood } from '@/types'
import { riskLevel, riskScore } from '@/lib/domain'
import { api, delay, ENDPOINTS, HttpError } from './client'
import { AIRCRAFT } from '@/data/aircraft'
import { CATEGORY_LABEL, INCIDENT_STATUS_ORDER, SEVERITY_ORDER } from '@/lib/domain'
import { userName } from '@/data/users'
import {
  cacheIncident,
  cacheIncidentList,
  db,
  newId,
  nextIncidentRef,
  persist,
  storeInvestigationByIncident,
} from './store'
import { canTransition, type TransitionContext } from '@/lib/workflow'
import { INCIDENT_STATUS } from '@/lib/domain'
import { userById } from '@/data/users'
import type { IncidentStatus } from '@/types'

/** A workflow rule refused the move; `message` is the human-readable reason. */
export class WorkflowError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'WorkflowError'
  }
}

/** Optimistic-locking conflict: the record moved since the client last read it. */
export class ConflictError extends Error {
  readonly status = 409
  constructor(id: string) {
    super(`Incident ${id} was modified by someone else; reload and try again.`)
    this.name = 'ConflictError'
  }
}

/**
 * Map a server refusal onto the same errors the mock transport throws:
 * 422 {reason} → WorkflowError, 409 → ConflictError, {message} → Error.
 */
function incidentError(e: unknown, id: string): Error {
  if (e instanceof HttpError) {
    const detail = e.detail as { reason?: unknown; message?: unknown } | null | undefined
    if (e.status === 422 && detail && typeof detail.reason === 'string')
      return new WorkflowError(detail.reason)
    if (e.status === 409) return new ConflictError(id)
    if (detail && typeof detail.message === 'string' && detail.message)
      return new Error(detail.message)
  }
  return e instanceof Error ? e : new Error(String(e))
}

/* --------------------------------------------------------- stateful store */

// `db` is the persisted demo store (skyshield.store.v1); every mutation below
// writes through `persist()` so created and edited records survive reloads.

/* ------------------------------------------------------------------ queries */

const matches = (i: Incident, f: IncidentFilters): boolean => {
  if (f.search) {
    const q = f.search.toLowerCase()
    const hay = [
      i.ref,
      i.title,
      i.description,
      i.flight?.flightNumber ?? '',
      i.location.iata,
      i.location.city,
      i.location.airport,
      userName(i.investigatorId),
      userName(i.reporterId),
      CATEGORY_LABEL[i.category],
    ]
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (f.severity.length && !f.severity.includes(i.risk.severity)) return false
  if (f.status.length && !f.status.includes(i.status)) return false
  if (f.category.length && !f.category.includes(i.category)) return false
  if (f.investigator.length && (!i.investigatorId || !f.investigator.includes(i.investigatorId)))
    return false
  if (f.airport.length && !f.airport.includes(i.location.iata)) return false
  if (f.aircraft.length) {
    const reg = AIRCRAFT.find((a) => a.id === i.aircraftId)?.registration ?? ''
    if (!f.aircraft.includes(reg)) return false
  }
  if (f.dateFrom && i.occurredAt < f.dateFrom) return false
  if (f.dateTo && i.occurredAt > `${f.dateTo}T23:59:59Z`) return false
  if (f.riskMin !== undefined && i.risk.score < f.riskMin) return false
  if (f.riskMax !== undefined && i.risk.score > f.riskMax) return false
  return true
}

const sortValue = (i: Incident, key: string): string | number => {
  switch (key) {
    case 'ref':
      return i.ref
    case 'occurredAt':
      return i.occurredAt
    case 'reportedAt':
      return i.reportedAt
    case 'severity':
      return SEVERITY_ORDER.indexOf(i.risk.severity) * -1
    case 'score':
    case 'risk':
      return i.risk.score
    case 'status':
      return INCIDENT_STATUS_ORDER.indexOf(i.status)
    case 'investigator':
      return userName(i.investigatorId)
    case 'flight':
      return i.flight?.flightNumber ?? ''
    case 'aircraft':
      return AIRCRAFT.find((a) => a.id === i.aircraftId)?.registration ?? ''
    case 'airport':
      return i.location.iata
    case 'category':
      return CATEGORY_LABEL[i.category]
    default:
      return String((i as unknown as Record<string, unknown>)[key] ?? '')
  }
}

export interface IncidentQuery {
  filters?: Partial<IncidentFilters>
  sort?: SortState
  page?: number
  pageSize?: number
}

/**
 * Flatten the register query into the wire contract of IncidentListView:
 * scalar params, comma-joined multi-selects, sort → `sort` + `dir`.
 */
function buildIncidentQuery(query: IncidentQuery): string {
  const params = new URLSearchParams()
  const f = query.filters ?? {}
  if (f.search) params.set('search', f.search)
  const multi: [string, string[] | undefined][] = [
    ['severity', f.severity],
    ['status', f.status],
    ['category', f.category],
    ['investigator', f.investigator],
    ['airport', f.airport],
    ['aircraft', f.aircraft],
  ]
  for (const [key, values] of multi) {
    if (values?.length) params.set(key, values.join(','))
  }
  if (f.dateFrom) params.set('dateFrom', f.dateFrom)
  if (f.dateTo) params.set('dateTo', f.dateTo)
  if (f.riskMin !== undefined) params.set('riskMin', String(f.riskMin))
  if (f.riskMax !== undefined) params.set('riskMax', String(f.riskMax))
  if (query.sort) {
    params.set('sort', query.sort.key)
    params.set('dir', query.sort.direction)
  }
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize))
  return params.toString()
}

export async function getIncidents(query: IncidentQuery = {}): Promise<Paginated<Incident>> {
  if (!api.enabled) {
    return api.get<Paginated<Incident>>(`${ENDPOINTS.incidents}?${buildIncidentQuery(query)}`)
  }
  await delay(140)
  const filters = query.filters ?? {}
  const { page = 1, pageSize = 10, sort } = query

  let rows = db.incidents.filter((i) => matches(i, filters as IncidentFilters))

  if (sort) {
    const dir = sort.direction === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }

  const total = rows.length
  const start = (page - 1) * pageSize
  return { items: rows.slice(start, start + pageSize), total, page, pageSize }
}

export async function getIncident(id: string): Promise<Incident> {
  if (!api.enabled) {
    const found = await api.get<Incident>(ENDPOINTS.incident(id))
    cacheIncident(found)
    return found
  }
  await delay(90)
  const found = db.incidents.find((i) => i.id === id || i.ref === id)
  if (!found) throw new Error(`Incident ${id} not found`)
  return found
}

export async function createIncident(
  payload: Partial<Incident>,
  opts?: { idempotencyKey?: string },
): Promise<Incident> {
  if (!api.enabled) {
    try {
      const created = await api.post<Incident>(ENDPOINTS.incidents, payload, opts)
      cacheIncident(created)
      return created
    } catch (e) {
      throw incidentError(e, payload.id ?? 'new incident')
    }
  }
  await delay(320)
  const created: Incident = {
    ...(db.incidents[0] as Incident),
    ...payload,
    id: newId('inc'),
    ref: nextIncidentRef(),
    reportedAt: new Date().toISOString(),
    capaIds: [],
    evidenceCount: payload.evidenceCount ?? 0,
  }
  db.incidents = [created, ...db.incidents]
  persist()
  return created
}

export async function updateIncident(id: string, payload: Partial<Incident>): Promise<Incident> {
  if (!api.enabled) {
    try {
      const updated = await api.patch<Incident>(ENDPOINTS.incident(id), payload)
      cacheIncident(updated)
      return updated
    } catch (e) {
      throw incidentError(e, id)
    }
  }
  await delay(220)
  const idx = db.incidents.findIndex((i) => i.id === id)
  if (idx < 0) throw new Error(`Incident ${id} not found`)
  const next = { ...db.incidents[idx], ...payload, version: (db.incidents[idx].version ?? 0) + 1 }
  db.incidents = db.incidents.map((i, n) => (n === idx ? next : i))
  persist()
  return next
}

/* ------------------------------------------------- anonymous intake (5.5) */

const THROTTLE_KEY = 'skyshield.anon.throttle'
const THROTTLE_WINDOW_MS = 2 * 60 * 1000 // one report per 2 minutes…
const THROTTLE_DAILY_MAX = 10 // …and at most 10 per day per browser

export class ThrottleError extends Error {
  constructor(readonlyMs: number) {
    super(
      `Too many reports from this browser. Try again in ${Math.ceil(readonlyMs / 60000)} minute(s).`,
    )
    this.name = 'ThrottleError'
  }
}

interface ThrottleState {
  last: number
  day: string
  count: number
}

function readThrottle(): ThrottleState {
  try {
    const raw = window.localStorage.getItem(THROTTLE_KEY)
    if (raw) return JSON.parse(raw) as ThrottleState
  } catch {
    /* fall through */
  }
  return { last: 0, day: '', count: 0 }
}

function checkThrottle(): void {
  const t = readThrottle()
  const now = Date.now()
  if (t.last && now - t.last < THROTTLE_WINDOW_MS)
    throw new ThrottleError(THROTTLE_WINDOW_MS - (now - t.last))
  const today = new Date().toISOString().slice(0, 10)
  if (t.day === today && t.count >= THROTTLE_DAILY_MAX)
    throw new ThrottleError(24 * 60 * 60 * 1000 - (now - t.last))
}

function recordThrottle(): void {
  const t = readThrottle()
  const today = new Date().toISOString().slice(0, 10)
  try {
    window.localStorage.setItem(
      THROTTLE_KEY,
      JSON.stringify({ last: Date.now(), day: today, count: t.day === today ? t.count + 1 : 1 }),
    )
  } catch {
    /* storage unavailable — throttle degrades open, honeypot still guards */
  }
}

export interface AnonymousReportInput {
  whatHappened: string
  where: string
  when: string
  contact?: string
  /** Honeypot field — a filled value means bot; the submission is silently dropped. */
  honeypot?: string
}

/**
 * File an anonymous occurrence (master 5.5): throttled, honeypot-guarded,
 * and real — the report enters the register as an untriaged record
 * ("Anonymous reporter", near-miss category, provisional risk flagged for
 * triage) and raises a notification for the safety desk.
 *
 * Network mode: the server owns throttle (429 → ThrottleError), honeypot
 * drop and validation; the local counter is mirrored on accepted reports so
 * both transports degrade identically.
 */
export async function submitAnonymousReport(
  input: AnonymousReportInput,
): Promise<{ id: string; ref: string }> {
  if (!api.enabled) {
    try {
      const res = await api.post<{ id: string; ref: string }>(ENDPOINTS.incidentsAnonymous, input)
      if (res.id !== 'dropped') recordThrottle()
      return res
    } catch (e) {
      if (e instanceof HttpError && e.status === 429)
        throw new ThrottleError((e.retryAfterSeconds ?? THROTTLE_WINDOW_MS / 1000) * 1000)
      const detail = e instanceof HttpError ? (e.detail as { message?: unknown } | null) : null
      if (detail && typeof detail.message === 'string' && detail.message)
        throw new Error(detail.message)
      throw e instanceof Error ? e : new Error(String(e))
    }
  }
  checkThrottle()
  if (input.honeypot && input.honeypot.trim()) {
    // Bots get a convincing success and no record.
    await delay(400)
    return { id: 'dropped', ref: `ANON-${Date.now().toString(36).toUpperCase()}` }
  }
  if (input.whatHappened.trim().length < 20)
    throw new Error('Please describe what happened in at least 20 characters.')

  const severity: Severity = 'medium'
  const likelihood: Likelihood = 2
  const score = riskScore(severity, likelihood)
  const id = newId('inc')
  const ref = nextIncidentRef()
  const now = new Date().toISOString()

  const created: Incident = {
    ...(db.incidents[0] as Incident),
    id,
    ref,
    title: input.whatHappened.trim().slice(0, 90),
    description: `${input.whatHappened.trim()}\n\nLocation: ${input.where || 'not stated'}\nOccurred: ${input.when || 'not stated'}${input.contact ? `\nContact offered: ${input.contact}` : '\nNo contact offered — fully anonymous.'}`,
    category: 'near_miss',
    status: 'reported',
    risk: {
      severity,
      likelihood,
      score,
      level: riskLevel(score),
      assessedBy: 'anonymous',
      assessedAt: now,
      notes: 'Provisional grading — anonymous intake, awaiting safety-desk triage.',
    },
    aircraftId: db.incidents[0]?.aircraftId ?? 'ac_001',
    flight: undefined,
    location: {
      airport: (input.where || 'Not stated').slice(0, 48),
      iata: '—',
      city: '—',
      country: '—',
      specific: input.where || 'Not stated',
      latitude: 0,
      longitude: 0,
    },
    phase: db.incidents[0]?.phase ?? 'cruise',
    reporterId: 'anonymous',
    crew: [],
    department: 'Anonymous intake',
    operator: db.incidents[0]?.operator ?? 'Skyline Air',
    immediateActions: 'None recorded — anonymous intake.',
    injuries: 0,
    damageCategory: 'none',
    capaIds: [],
    evidenceCount: 0,
    confidentiality: 'restricted',
    occurrenceCategory: 'GI',
    regulatoryNotification: false,
    reportedAt: now,
    occurredAt: input.when ? new Date(input.when).toISOString() : now,
    version: 1,
  }
  db.incidents = [created, ...db.incidents]

  // Real event → real notification for the safety desk.
  db.notifications = [
    {
      id: newId('ntf'),
      title: 'Anonymous report needs triage',
      body: `${ref} — ${input.whatHappened.trim().slice(0, 90)}`,
      severity: 'warning',
      category: 'incident',
      at: now,
      read: false,
      link: `/incidents/${id}`,
      actor: 'Anonymous intake',
    },
    ...db.notifications,
  ]

  db.auditLog.unshift({
    id: newId('aud'),
    at: now,
    actorId: 'anonymous',
    entity: 'incident',
    entityId: id,
    action: 'Anonymous report accepted (needs triage)',
    ip: 'public-intake',
  })

  recordThrottle()
  persist()
  return { id, ref }
}

/** Bulk status transition, e.g. from the table's bulk action bar. */
export async function bulkUpdateStatus(ids: string[], status: Incident['status']): Promise<number> {
  if (!api.enabled) {
    return bulkPatch(ids, { status })
  }
  await delay(260)
  const set = new Set(ids)
  db.incidents = db.incidents.map((i) => (set.has(i.id) ? { ...i, status } : i))
  persist()
  return ids.length
}

export async function bulkAssign(ids: string[], investigatorId: string): Promise<number> {
  if (!api.enabled) {
    return bulkPatch(ids, { investigatorId })
  }
  await delay(260)
  const set = new Set(ids)
  db.incidents = db.incidents.map((i) => (set.has(i.id) ? { ...i, investigatorId } : i))
  persist()
  return ids.length
}

/**
 * Per-row PATCH fan-out with server-side guards: accepted rows are mirrored
 * into the store and counted; if nothing was accepted the first refusal
 * (workflow reason / conflict / message) surfaces to the caller.
 */
async function bulkPatch(ids: string[], payload: Partial<Incident>): Promise<number> {
  const settled = await Promise.allSettled(
    ids.map((id) => api.patch<Incident>(ENDPOINTS.incident(id), payload)),
  )
  let accepted = 0
  let firstError: unknown = null
  settled.forEach((r, n) => {
    if (r.status === 'fulfilled') {
      accepted += 1
      cacheIncident(r.value)
    } else if (firstError === null) {
      firstError = incidentError(r.reason, ids[n])
    }
  })
  if (accepted === 0 && firstError) throw firstError
  return accepted
}

/**
 * Guarded status transition (master 5.3): validates the move against the
 * workflow rules for the actor's role, checks `expectedVersion` for optimistic
 * locking (409 on drift), then applies the status change AND writes the audit
 * entry in the same store transaction.
 */
export async function transitionIncident(
  id: string,
  to: IncidentStatus,
  actorId: string,
  expectedVersion?: number,
): Promise<Incident> {
  if (!api.enabled) {
    try {
      const next = await api.post<Incident>(`${ENDPOINTS.incident(id)}transition/`, {
        to,
        expectedVersion,
      })
      cacheIncident(next)
      return next
    } catch (e) {
      throw incidentError(e, id)
    }
  }
  await delay(200)
  const idx = db.incidents.findIndex((i) => i.id === id)
  if (idx < 0) throw new Error(`Incident ${id} not found`)
  const inc = db.incidents[idx]

  const inv = storeInvestigationByIncident(id)
  const openCapas = db.capas.filter(
    (c) => inc.capaIds.includes(c.id) && !['completed', 'verified'].includes(c.status),
  ).length
  const ctx: TransitionContext = {
    status: inc.status,
    userRole: userById(actorId)?.role ?? null,
    openCapas,
    investigationProgress: inv ? inv.progress : null,
  }
  const verdict = canTransition(ctx, to)
  if (!verdict.ok) throw new WorkflowError(verdict.reason)

  const currentVersion = inc.version ?? 0
  if (expectedVersion !== undefined && expectedVersion !== currentVersion)
    throw new ConflictError(id)

  const next: Incident = {
    ...inc,
    status: to,
    version: currentVersion + 1,
    closedAt: to === 'closed' ? new Date().toISOString() : inc.closedAt,
  }
  db.incidents = db.incidents.map((x, n) => (n === idx ? next : x))
  db.auditLog.unshift({
    id: newId('aud'),
    at: new Date().toISOString(),
    actorId,
    entity: 'incident',
    entityId: id,
    action: `Status ${INCIDENT_STATUS[inc.status].label} → ${INCIDENT_STATUS[to].label}`,
    field: 'status',
    from: inc.status,
    to,
    ip: '10.24.2.19',
  })
  persist()
  return next
}

/**
 * Reveal the reporter identity on a confidential record (master 6): the act
 * is written to the audit log in the same transaction — privacy disclosure
 * is itself a tracked event.
 */
export async function revealReporter(id: string, actorId: string): Promise<Incident> {
  if (!api.enabled) {
    try {
      const next = await api.post<Incident>(`${ENDPOINTS.incident(id)}reveal-reporter/`, {})
      cacheIncident(next)
      return next
    } catch (e) {
      throw incidentError(e, id)
    }
  }
  await delay(160)
  const idx = db.incidents.findIndex((i) => i.id === id)
  if (idx < 0) throw new Error(`Incident ${id} not found`)
  const inc = db.incidents[idx]
  const next = { ...inc, reporterRevealed: true, version: (inc.version ?? 0) + 1 }
  db.incidents = db.incidents.map((x, n) => (n === idx ? next : x))
  db.auditLog.unshift({
    id: newId('aud'),
    at: new Date().toISOString(),
    actorId,
    entity: 'incident',
    entityId: id,
    action: 'Reporter identity revealed (confidential record)',
    field: 'reporterId',
    ip: '10.24.2.19',
  })
  persist()
  return next
}

export async function getAllIncidents(): Promise<Incident[]> {
  if (!api.enabled) {
    // The list endpoint speaks the register envelope; ask for one big page
    // (server cap 1000 — far above the demo register) and unwrap it.
    const res = await api.get<Paginated<Incident>>(`${ENDPOINTS.incidents}?pageSize=1000`)
    cacheIncidentList(res.items)
    return res.items
  }
  await delay(120)
  return db.incidents
}

/** Active (non-closed) incidents, used by the dashboard risk matrix. */
export async function getActiveIncidents(): Promise<Incident[]> {
  const all = await getAllIncidents()
  return all.filter((i) => i.status !== 'closed')
}

/** CSV export — client side for now; the backend will own this for large sets. */
export function toCsv(incidents: Incident[]): string {
  const headers = [
    'Incident ID',
    'Date',
    'Flight',
    'Aircraft',
    'Airport',
    'Type',
    'Severity',
    'Likelihood',
    'Risk Score',
    'Status',
    'Investigator',
  ]
  const rows = incidents.map((i) => [
    i.ref,
    i.occurredAt.slice(0, 10),
    i.flight?.flightNumber ?? '',
    AIRCRAFT.find((a) => a.id === i.aircraftId)?.registration ?? '',
    i.location.iata,
    CATEGORY_LABEL[i.category],
    i.risk.severity,
    String(i.risk.likelihood),
    String(i.risk.score),
    i.status,
    userName(i.investigatorId),
  ])
  return [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
