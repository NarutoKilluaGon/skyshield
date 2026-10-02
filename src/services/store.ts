/**
 * Stateful demo store — `skyshield.store.v1` (master 5.1).
 *
 * One persisted, mutable copy of every demo collection. Seeded from the
 * fixtures with all dates rebased so the register always looks live
 * (newest occurrence ≈ today), then kept in localStorage: created reports,
 * RCA edits, CAPA completions and read notifications survive a reload.
 * "Reset demo data" (Settings → System) restores the seed exactly.
 *
 * Services mutate `db` and call `persist()`. Pages that previously read
 * fixtures directly use the synchronous accessors below, so created records
 * appear everywhere without a TanStack Query cache (S11b).
 */
import { INCIDENTS } from '@/data/incidents'
import { INVESTIGATIONS, EVIDENCE, TIMELINE } from '@/data/investigations'
import { RCAS } from '@/data/rca'
import { CAPAS } from '@/data/capas'
import { NOTIFICATIONS } from '@/data/notifications'
import { AUDIT_LOG, COMPLIANCE_REQUIREMENTS } from '@/data/compliance'
import type {
  AppNotification,
  AuditLog,
  CAPA,
  ComplianceRequirement,
  EvidenceItem,
  Incident,
  IncidentComment,
  Investigation,
  RCA,
  TimelineEvent,
} from '@/types'
import { maxIso, newUuid, nextSequentialRef, rebaseDays, shiftIsoDates } from './store-pure'

export const STORE_KEY = 'skyshield.store.v1'
const STORE_VERSION = 2

export interface StoreShape {
  version: number
  seededAt: string
  /** Days the seed dates were shifted by, recorded for honest display. */
  offsetDays: number
  incidents: Incident[]
  investigations: Investigation[]
  evidence: Record<string, EvidenceItem[]>
  timeline: Record<string, TimelineEvent[]>
  rcas: RCA[]
  capas: CAPA[]
  notifications: AppNotification[]
  auditLog: AuditLog[]
  compliance: ComplianceRequirement[]
  comments: IncidentComment[]
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

function buildSeed(now = new Date()): StoreShape {
  const anchor = maxIso(INCIDENTS.map((i) => i.occurredAt)) ?? now.toISOString()
  const offsetDays = rebaseDays(anchor, now)
  const shift = <T>(x: T): T => shiftIsoDates(clone(x), offsetDays)
  return {
    version: STORE_VERSION,
    seededAt: now.toISOString(),
    offsetDays,
    incidents: shift(INCIDENTS),
    investigations: shift(INVESTIGATIONS),
    evidence: shift(EVIDENCE),
    timeline: shift(TIMELINE),
    rcas: shift(RCAS),
    capas: shift(CAPAS),
    notifications: shift(NOTIFICATIONS),
    auditLog: shift(AUDIT_LOG),
    compliance: shift(COMPLIANCE_REQUIREMENTS),
    comments: [],
  }
}

function persistShape(shape: StoreShape): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(shape))
  } catch {
    /* storage unavailable — the session stays in-memory only */
  }
}

function load(): StoreShape {
  if (typeof window === 'undefined') return buildSeed()
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoreShape
      if (parsed?.version === STORE_VERSION && Array.isArray(parsed.incidents)) {
        // blob: URLs from mock evidence uploads (M4) do not survive a reload —
        // strip them so the UI only offers downloads that really work.
        for (const items of Object.values(parsed.evidence ?? {})) {
          for (const item of items) {
            if (typeof item?.url === 'string' && item.url.startsWith('blob:')) delete item.url
          }
        }
        return parsed
      }
    }
  } catch {
    /* corrupt or schema-drifted — reseed below */
  }
  const seeded = buildSeed()
  persistShape(seeded)
  return seeded
}

/** The live store object. Mutate its collections, then call `persist()`. */
export const db: StoreShape = load()

export function persist(): void {
  persistShape(db)
}

/** Restore the pristine seed (relative to today) and persist it. */
export function resetDemoData(): void {
  Object.assign(db, buildSeed())
  persist()
}

/* ------------------------------------------------------- sync accessors */

export const storeIncidentById = (id?: string | null): Incident | undefined =>
  id ? db.incidents.find((i) => i.id === id || i.ref === id) : undefined

export const storeRcaById = (id?: string | null): RCA | undefined =>
  id ? db.rcas.find((r) => r.id === id) : undefined

export const storeRcaByIncident = (incidentId: string): RCA | undefined =>
  db.rcas.find((r) => r.incidentId === incidentId)

export const storeInvestigationByIncident = (incidentId: string): Investigation | undefined =>
  db.investigations.find((v) => v.incidentId === incidentId)

export const storeCapaById = (id?: string | null): CAPA | undefined =>
  id ? db.capas.find((c) => c.id === id) : undefined

/** Next per-org sequential incident reference (P_006-259, 260, …). */
export const nextIncidentRef = (): string =>
  nextSequentialRef(
    db.incidents.map((i) => i.ref),
    'P_006',
  )

/** Prefixed crypto.randomUUID identifier for new records. */
export const newId = (prefix: string): string => `${prefix}_${newUuid()}`

/* ---------------------------------------------------- network-mode mirror */

// With VITE_USE_MOCK=false the server owns the data, but the synchronous
// accessors above still back instant reads (detail tabs, sidebar counts,
// palette). Every service therefore writes server responses back through
// these helpers: the store is a mirror, never the source of truth.

/** Replace-in-place or prepend a server record; returns the next list. */
export function cacheUpsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx < 0) return [item, ...list]
  const next = list.slice()
  next[idx] = { ...next[idx], ...item }
  return next
}

export function cacheIncident(incident: Incident): void {
  db.incidents = cacheUpsert(db.incidents, incident)
  persist()
}

/** Mirror a full server list (getAllIncidents) — order included. */
export function cacheIncidentList(items: Incident[]): void {
  db.incidents = items.slice()
  persist()
}

export function cacheInvestigation(investigation: Investigation): void {
  db.investigations = cacheUpsert(db.investigations, investigation)
  persist()
}

export function cacheRca(rca: RCA): void {
  db.rcas = cacheUpsert(db.rcas, rca)
  persist()
}

export function cacheCapa(capa: CAPA): void {
  db.capas = cacheUpsert(db.capas, capa)
  persist()
}

export function cacheCompliance(requirement: ComplianceRequirement): void {
  db.compliance = cacheUpsert(db.compliance, requirement)
  persist()
}
