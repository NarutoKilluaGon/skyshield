import type { AnalyticsPayload, CAPA, DashboardMetrics, Investigation, RCA } from '@/types'
import { api, delay, ENDPOINTS } from './client'
import { DASHBOARD_METRICS, CAPA_SLA_SERIES } from '@/data/dashboard'
import { COMPLIANCE_SUMMARY } from '@/data/compliance'
import { AIRCRAFT } from '@/data/aircraft'
import { sha256Hex } from '@/lib/hash'
import {
  cacheCapa,
  cacheCompliance,
  cacheInvestigation,
  cacheRca,
  db,
  newId,
  persist,
  storeCapaById,
  storeIncidentById,
  storeInvestigationByIncident,
  storeRcaByIncident,
  storeRcaById,
} from './store'
import { nextSequentialRef } from './store-pure'
import type {
  Aircraft,
  AuditLog,
  ComplianceRequirement,
  EvidenceItem,
  TimelineEvent,
} from '@/types'

/* --------------------------------------------------------- dashboard */

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (!api.enabled) return api.get<DashboardMetrics>(ENDPOINTS.dashboard)
  await delay(120)
  return DASHBOARD_METRICS
}

/* ------------------------------------------------------ investigations */

export async function getInvestigations(): Promise<Investigation[]> {
  if (!api.enabled) return api.get<Investigation[]>(ENDPOINTS.investigations)
  await delay(130)
  return db.investigations
}

export async function getInvestigation(id: string): Promise<Investigation> {
  if (!api.enabled) return api.get<Investigation>(ENDPOINTS.investigation(id))
  await delay(90)
  const found = db.investigations.find((v) => v.id === id)
  if (!found) throw new Error(`Investigation ${id} not found`)
  return found
}

export async function getInvestigationForIncident(incidentId: string) {
  if (!api.enabled) {
    const rows = await api.get<Investigation[]>(
      `${ENDPOINTS.investigations}?incidentId=${encodeURIComponent(incidentId)}`,
    )
    for (const row of rows) cacheInvestigation(row)
    return rows[0]
  }
  await delay(70)
  return storeInvestigationByIncident(incidentId)
}

export async function updateInvestigation(id: string, payload: Partial<Investigation>) {
  if (!api.enabled) {
    const updated = await api.patch<Investigation>(ENDPOINTS.investigation(id), payload)
    cacheInvestigation(updated)
    return updated
  }
  await delay(180)
  const found = db.investigations.find((v) => v.id === id)
  if (!found) throw new Error(`Investigation ${id} not found`)
  Object.assign(found, payload)
  persist()
  return found
}

export async function getEvidence(incidentId: string): Promise<EvidenceItem[]> {
  if (!api.enabled) return api.get<EvidenceItem[]>(`${ENDPOINTS.incident(incidentId)}evidence/`)
  await delay(80)
  return db.evidence[incidentId] ?? []
}

export async function getTimeline(incidentId: string): Promise<TimelineEvent[]> {
  if (!api.enabled) return api.get<TimelineEvent[]>(`${ENDPOINTS.incident(incidentId)}timeline/`)
  await delay(80)
  return db.timeline[incidentId] ?? []
}

/* --------------------------------------------------------- media (M4) */

/** Server answer of POST /media/: the registered item + the updated entity. */
export interface MediaUploadResponse {
  media: EvidenceItem
  requirement?: ComplianceRequirement
  capa?: CAPA
}

/** The server's kind mapping (core/views.kind_of), mirrored for mock mode. */
export function kindOfFile(file: File): EvidenceItem['kind'] {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.includes('pdf')) return 'pdf'
  if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.log')) return 'log'
  return 'document'
}

/**
 * Register a real evidence upload against an incident. Network mode streams
 * the bytes to POST /media/ (server-side SHA-256 + storage); mock mode hashes
 * in the browser and keeps a session-local blob URL so downloads still work.
 */
export async function uploadEvidence(
  incidentId: string,
  file: File,
  uploadedBy = 'usr_001',
): Promise<EvidenceItem> {
  if (!api.enabled) {
    const form = new FormData()
    form.set('file', file)
    form.set('incidentId', incidentId)
    const data = await api.upload<MediaUploadResponse>(ENDPOINTS.media, form)
    return data.media
  }
  await delay(260)
  const item: EvidenceItem = {
    id: newId('ev'),
    name: file.name,
    kind: kindOfFile(file),
    sizeKb: Math.max(1, Math.round(file.size / 1024)),
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    hash: await sha256Hex(file),
    verified: true,
    contentType: file.type || undefined,
    url: URL.createObjectURL(file),
  }
  db.evidence[incidentId] = [...(db.evidence[incidentId] ?? []), item]
  const incident = db.incidents.find((i) => i.id === incidentId)
  if (incident) incident.evidenceCount = (incident.evidenceCount ?? 0) + 1
  persist()
  return item
}

/**
 * Mock-only: register evidence metadata that has no live File (e.g. a draft
 * restored from localStorage — the bytes are gone, the hash record is not).
 */
export function registerEvidenceLocal(incidentId: string, items: EvidenceItem[]): void {
  if (!api.enabled || !items.length) return
  db.evidence[incidentId] = [
    ...(db.evidence[incidentId] ?? []),
    ...items.map((i) => ({ ...i, verified: true })),
  ]
  const incident = db.incidents.find((i) => i.id === incidentId)
  if (incident) incident.evidenceCount = (incident.evidenceCount ?? 0) + items.length
  persist()
}

/** Attach a real file to a compliance requirement (S9 evidence register). */
export async function uploadComplianceAttachment(
  requirementId: string,
  file: File,
  by: string,
): Promise<ComplianceRequirement> {
  if (!api.enabled) {
    const form = new FormData()
    form.set('file', file)
    form.set('entityType', 'compliance')
    form.set('entityId', requirementId)
    const data = await api.upload<MediaUploadResponse>(ENDPOINTS.media, form)
    if (!data.requirement) throw new Error('Server did not return the updated requirement')
    cacheCompliance(data.requirement)
    return data.requirement
  }
  await delay(240)
  const found = db.compliance.find((r) => r.id === requirementId)
  if (!found) throw new Error(`Requirement ${requirementId} not found`)
  found.attachments = [
    ...(found.attachments ?? []),
    {
      name: file.name,
      at: new Date().toISOString(),
      by,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      hash: await sha256Hex(file),
      mediaId: newId('ev'),
    },
  ]
  persist()
  return found
}

/** Attach a real completion-proof file to a CAPA. */
export async function uploadCapaAttachment(capaId: string, file: File, by: string): Promise<CAPA> {
  if (!api.enabled) {
    const form = new FormData()
    form.set('file', file)
    form.set('entityType', 'capa')
    form.set('entityId', capaId)
    const data = await api.upload<MediaUploadResponse>(ENDPOINTS.media, form)
    if (!data.capa) throw new Error('Server did not return the updated CAPA')
    cacheCapa(data.capa)
    return data.capa
  }
  await delay(240)
  const found = db.capas.find((c) => c.id === capaId)
  if (!found) throw new Error(`CAPA ${capaId} not found`)
  found.attachments = [
    ...(found.attachments ?? []),
    {
      name: file.name,
      at: new Date().toISOString(),
      by,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      hash: await sha256Hex(file),
      mediaId: newId('ev'),
    },
  ]
  persist()
  return found
}

/* ----------------------------------------------------- analytics (M6) */

export interface AnalyticsQuery {
  period: string
  severity: string
  type: string
  aircraft: string
}

/**
 * Server-computed analytics aggregation. Returns null in mock mode — the
 * analytics page then computes the same figures from the local store, which
 * is exactly the client-side twin the server replaces in network mode.
 */
export async function getAnalytics(query: AnalyticsQuery): Promise<AnalyticsPayload | null> {
  if (!api.enabled) {
    const qs = new URLSearchParams(Object.entries(query)).toString()
    return api.get<AnalyticsPayload>(`${ENDPOINTS.analytics}?${qs}`)
  }
  return null
}

/** CAPA status mix by month for the dashboard + CAPA pages. */
export async function getCapaSlaSeries(): Promise<DashboardMetrics['capaSlaSeries']> {
  if (!api.enabled) return (await api.get<DashboardMetrics>(ENDPOINTS.dashboard)).capaSlaSeries
  await delay(90)
  return CAPA_SLA_SERIES
}

/* -------------------------------------------------------------- RCA */

export async function getRCA(id?: string): Promise<RCA | undefined> {
  // No id → no record: the mock answers `undefined` without a lookup, so the
  // network branch must not fetch the collection either.
  if (!id) return undefined
  if (!api.enabled) {
    const found = await api.get<RCA>(ENDPOINTS.rcaById(id))
    cacheRca(found)
    return found
  }
  await delay(90)
  return storeRcaById(id)
}

export async function getRCAs(): Promise<RCA[]> {
  if (!api.enabled) return api.get<RCA[]>(ENDPOINTS.rca)
  await delay(110)
  return db.rcas
}

export async function getRCAForIncident(incidentId: string): Promise<RCA | undefined> {
  if (!api.enabled) {
    const rows = await api.get<RCA[]>(
      `${ENDPOINTS.rca}?incidentId=${encodeURIComponent(incidentId)}`,
    )
    for (const row of rows) cacheRca(row)
    return rows[0]
  }
  await delay(70)
  return storeRcaByIncident(incidentId)
}

export async function createRCA(payload: Partial<RCA>): Promise<RCA> {
  if (!api.enabled) {
    const created = await api.post<RCA>(ENDPOINTS.rca, payload)
    cacheRca(created)
    return created
  }
  await delay(300)
  const created = { ...(db.rcas[0] as RCA), ...payload, id: newId('rca') }
  db.rcas.unshift(created)
  persist()
  return created
}

/**
 * Create a draft five-whys analysis for an incident that has none. Explicit
 * empty collections override the `createRCA` template spread so a new record
 * never inherits another analysis' chain or factors.
 */
export async function startRCA(incidentId: string, authorId: string): Promise<RCA> {
  const inc = storeIncidentById(incidentId)
  return createRCA({
    incidentId,
    title: inc ? `${inc.ref} — root cause analysis` : 'Root cause analysis',
    method: 'five_whys',
    status: 'not_started',
    fiveWhys: undefined,
    factors: [],
    identifiedRootCauses: [],
    recommendations: [],
    authorId,
    reviewerId: undefined,
    createdAt: new Date().toISOString(),
    completedAt: undefined,
  })
}

export async function updateRCA(id: string, payload: Partial<RCA>): Promise<RCA> {
  if (!api.enabled) {
    const updated = await api.patch<RCA>(ENDPOINTS.rcaById(id), payload)
    cacheRca(updated)
    return updated
  }
  await delay(240)
  const found = storeRcaById(id)
  if (!found) throw new Error(`RCA ${id} not found`)
  Object.assign(found, payload)
  persist()
  return found
}

/* ------------------------------------------------------------- CAPA */

export async function updateCAPA(id: string, payload: Partial<CAPA>): Promise<CAPA> {
  if (!api.enabled) {
    const updated = await api.patch<CAPA>(ENDPOINTS.capaById(id), payload)
    cacheCapa(updated)
    return updated
  }
  await delay(220)
  const found = storeCapaById(id)
  if (!found) throw new Error(`CAPA ${id} not found`)
  Object.assign(found, payload)
  persist()
  return found
}

export async function getCAPAs(): Promise<CAPA[]> {
  if (!api.enabled) return api.get<CAPA[]>(ENDPOINTS.capas)
  await delay(120)
  return db.capas
}

export async function getCAPA(id: string): Promise<CAPA> {
  if (!api.enabled) {
    const found = await api.get<CAPA>(ENDPOINTS.capaById(id))
    cacheCapa(found)
    return found
  }
  await delay(80)
  const found = storeCapaById(id)
  if (!found) throw new Error(`CAPA ${id} not found`)
  return found
}

export async function createCAPA(payload: Partial<CAPA>): Promise<CAPA> {
  if (!api.enabled) {
    const created = await api.post<CAPA>(ENDPOINTS.capas, payload)
    cacheCapa(created)
    return created
  }
  await delay(280)
  const created: CAPA = {
    ...(db.capas[0] as CAPA),
    ...payload,
    id: newId('capa'),
    ref: nextSequentialRef(
      db.capas.map((c) => c.ref),
      'CAPA-2026',
    ),
  }
  db.capas.unshift(created)
  persist()
  return created
}

/* ------------------------------------------------------- compliance */

export async function getComplianceRequirements(): Promise<ComplianceRequirement[]> {
  if (!api.enabled) return api.get<ComplianceRequirement[]>(ENDPOINTS.compliance)
  await delay(120)
  return db.compliance
}

export async function getComplianceSummary() {
  if (!api.enabled) return api.get<typeof COMPLIANCE_SUMMARY>(ENDPOINTS.complianceSummary)
  await delay(80)
  return COMPLIANCE_SUMMARY
}

export async function getAuditLog(entityId?: string): Promise<AuditLog[]> {
  if (!api.enabled)
    return api.get<AuditLog[]>(
      entityId ? `${ENDPOINTS.audit}?entityId=${encodeURIComponent(entityId)}` : ENDPOINTS.audit,
    )
  await delay(110)
  return entityId ? db.auditLog.filter((l) => l.entityId === entityId) : db.auditLog
}

/* --------------------------------------------------------- reference */

export async function getAircraft(): Promise<Aircraft[]> {
  if (!api.enabled) return api.get<Aircraft[]>(ENDPOINTS.aircraft)
  await delay(80)
  return AIRCRAFT
}
