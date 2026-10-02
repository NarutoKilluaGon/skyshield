/**
 * SKYSHIELD — Domain model
 * Mirrors the planned Django REST API resource shapes. Field names are
 * snake_case-free (camelCase) on the client; the API client layer maps
 * to/from the serializer naming convention.
 */

/* ------------------------------------------------------------------ enums */

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'negligible'

export type Likelihood = 1 | 2 | 3 | 4 | 5

export type IncidentStatus =
  'draft' | 'reported' | 'investigation' | 'rca_pending' | 'capa' | 'closed'

export type OperationalPhase =
  | 'gate'
  | 'pushback'
  | 'taxi'
  | 'takeoff'
  | 'climb'
  | 'cruise'
  | 'descent'
  | 'approach'
  | 'landing'
  | 'maintenance'
  | 'ground_ops'

export type IncidentCategory =
  | 'engine_issue'
  | 'bird_strike'
  | 'runway_excursion'
  | 'cabin_issue'
  | 'hydraulic_failure'
  | 'avionics_fault'
  | 'fuel_system'
  | 'tire_brake'
  | 'pressurisation'
  | 'ground_damage'
  | 'fatigue_risk'
  | 'near_miss'

export type InvestigationStage =
  | 'incident_reported'
  | 'initial_assessment'
  | 'investigation'
  | 'evidence_collection'
  | 'root_cause_analysis'
  | 'corrective_action'
  | 'verification'
  | 'closed'

export type CapaStatus = 'open' | 'in_progress' | 'due_soon' | 'overdue' | 'completed' | 'verified'

export type CapaPriority = 'critical' | 'high' | 'medium' | 'low'

export type CapaType = 'corrective' | 'preventive'

export type ComplianceStatus =
  'compliant' | 'partially_compliant' | 'non_compliant' | 'under_review'

export type NotificationSeverity = 'critical' | 'warning' | 'info' | 'success'

export type UserRole = 'safety_manager' | 'investigator' | 'safety_officer' | 'auditor' | 'admin'

/* ------------------------------------------------------------------ types */

export interface User {
  id: string
  name: string
  initials: string
  role: UserRole
  title: string
  email: string
  base: string
  phone?: string
  licenseNumber?: string
  avatarTone: 'brand' | 'violet' | 'amber' | 'teal' | 'rose'
  active: boolean
  lastActiveAt: string
}

export interface Aircraft {
  id: string
  registration: string
  type: string
  manufacturer: string
  model: string
  operator: string
  yearOfDelivery: number
  totalCycles: number
  totalHours: number
  base: string
  status: 'in_service' | 'maintenance' | 'grounded'
  lastMaintenanceAt: string
  nextInspectionAt: string
}

export interface Flight {
  id: string
  flightNumber: string
  aircraftId: string
  origin: string
  destination: string
  scheduledDeparture: string
  actualDeparture?: string
  flightType: 'scheduled' | 'charter' | 'cargo' | 'ferry' | 'test'
  pax: number
  sector: string
}

export interface Location {
  airport: string
  iata: string
  city: string
  country: string
  specific: string
  latitude: number
  longitude: number
}

export interface RiskAssessment {
  severity: Severity
  likelihood: Likelihood
  /** severity(1..5) x likelihood(1..5) */
  score: number
  level: 'low' | 'moderate' | 'high' | 'critical'
  assessedBy: string
  assessedAt: string
  notes?: string
}

export interface EvidenceItem {
  id: string
  name: string
  kind: 'image' | 'pdf' | 'document' | 'video' | 'log'
  sizeKb: number
  uploadedBy: string
  uploadedAt: string
  hash: string
  verified: boolean
  /** Real uploads (M4): MIME type + authenticated download route. */
  contentType?: string
  url?: string
}

export interface TimelineEvent {
  id: string
  at: string
  actor: string
  title: string
  detail: string
  kind: 'report' | 'assignment' | 'status' | 'evidence' | 'rca' | 'capa' | 'system' | 'note'
}

export interface Incident {
  id: string
  ref: string
  /** Optimistic-locking counter bumped by every write; clients echo it back. */
  version?: number
  /** Reporter identity on a restricted record has been formally revealed (audited). */
  reporterRevealed?: boolean
  reportedAt: string
  occurredAt: string
  closedAt?: string
  title: string
  description: string
  category: IncidentCategory
  status: IncidentStatus
  risk: RiskAssessment
  aircraftId: string
  flight?: Flight
  location: Location
  phase: OperationalPhase
  reporterId: string
  investigatorId?: string
  crew: string[]
  department: string
  operator: string
  immediateActions: string
  injuries: number
  damageCategory: 'none' | 'minor' | 'substantial' | 'major'
  investigationId?: string
  rcaId?: string
  capaIds: string[]
  evidenceCount: number
  confidentiality: 'internal' | 'restricted' | 'open'
  occurrenceCategory: string
  regulatoryNotification: boolean
  notifiedAuthority?: string
}

export interface Investigation {
  id: string
  incidentId: string
  name: string
  stage: InvestigationStage
  progress: number
  leadInvestigatorId: string
  teamMemberIds: string[]
  openedAt: string
  dueAt: string
  priority: CapaPriority
  stageHistory: { stage: InvestigationStage; at: string; by: string; note?: string }[]
  findings: string[]
  interviews: { name: string; role: string; at: string; summary: string }[]
  openQuestions: string[]
}

export interface FiveWhys {
  id: string
  /** Owning analysis. */
  rcaId: string
  problem: string
  whys: { id: string; question: string; answer: string }[]
  rootCause: string
  category: 'human' | 'technical' | 'environmental' | 'organizational' | 'procedural'
  authorId: string
  updatedAt: string
  status: 'draft' | 'in_review' | 'accepted'
}

export interface ContributingFactor {
  id: string
  rcaId: string
  category: 'human' | 'technical' | 'environmental' | 'organizational' | 'procedural'
  label: string
  detail: string
  weight: 'primary' | 'contributing' | 'latent'
}

export interface RCA {
  id: string
  incidentId: string
  title: string
  method: 'five_whys' | 'fishbone' | 'fault_tree' | 'bow_tie'
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed'
  fiveWhys?: FiveWhys
  factors: ContributingFactor[]
  identifiedRootCauses: string[]
  recommendations: string[]
  authorId: string
  reviewerId?: string
  createdAt: string
  completedAt?: string
}

export interface CAPA {
  id: string
  ref: string
  incidentId: string
  title: string
  description: string
  type: CapaType
  ownerId: string
  priority: CapaPriority
  status: CapaStatus
  dueDate: string
  openedAt: string
  completedAt?: string
  verifiedAt?: string
  progress: number
  effectivenessCheck?: 'pending' | 'passed' | 'failed'
  /** Free-text proof recorded when the owner marks the action complete. */
  completionEvidence?: string
  linkedFinding: string
  /** M4: files uploaded through POST /media/ with entityType=capa. */
  attachments?: ComplianceAttachment[]
}

/** A file attached as proof against a compliance requirement or CAPA. */
export interface ComplianceAttachment {
  name: string
  at: string
  by: string
  /** Present when the attachment is a real upload (M4): */
  sizeKb?: number
  hash?: string
  mediaId?: string
}

export interface ComplianceRequirement {
  id: string
  code: string
  title: string
  description: string
  authority: 'DGCA' | 'FAA' | 'EASA' | 'ICAO' | 'ISO 45001' | 'Internal SMS'
  category: 'safety_reporting' | 'investigation' | 'corrective_action' | 'documentation' | 'audit'
  status: ComplianceStatus
  score: number
  evidence: string
  /** Files attached as evidence (names + provenance; blobs live in the backend). */
  attachments?: ComplianceAttachment[]
  ownerId: string
  lastReviewAt: string
  nextReviewAt: string
}

export interface AuditLog {
  id: string
  at: string
  actorId: string
  entity: 'incident' | 'investigation' | 'rca' | 'capa' | 'compliance' | 'user' | 'system'
  entityId: string
  action: string
  field?: string
  from?: string
  to?: string
  ip: string
  note?: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  severity: NotificationSeverity
  category: 'incident' | 'capa' | 'rca' | 'compliance' | 'assignment' | 'system'
  at: string
  read: boolean
  link?: string
  actor?: string
  /** When set, only this user sees the notification (e.g. @mentions). */
  forUserId?: string
}

/** A comment on an incident record; @mentions resolve to user ids. */
export interface IncidentComment {
  id: string
  incidentId: string
  authorId: string
  at: string
  body: string
  mentions: string[]
}

/* -------------------------------------------------------------- analytics */

export interface KpiMetric {
  id: string
  label: string
  value: number
  unit?: string
  delta: number
  deltaLabel: string
  accent: 'orange' | 'blue' | 'amber' | 'red' | 'green'
  series: number[]
  footnote: string
}

export interface DashboardMetrics {
  kpis: KpiMetric[]
  trend: { month: string; reported: number; closed: number; capex: number }[]
  severityMix: { name: Severity; value: number; color: string }[]
  typeMix: { name: string; value: number }[]
  slaCompliance: number
  openCapas: number
  completedCapas: number
  overdueCapas: number
  dueSoonCapas: number
  totalCapas: number
  rcaCompletionRate: number
  capaCompletionRate: number
  systemStatus: 'operational' | 'degraded' | 'maintenance'
  lastSyncAt: string
  /** CAPA status mix by month — computed server-side (M6), static in mock mode. */
  capaSlaSeries: {
    month: string
    open: number
    completed: number
    overdue: number
    dueSoon: number
  }[]
}

/**
 * The /analytics/ aggregation payload (M6). In network mode every chart on
 * src/pages/analytics.tsx consumes these plain arrays; mock mode keeps the
 * client-side computation over the local store.
 */
export interface AnalyticsPayload {
  windowDays: number
  since: string
  prevSince: string
  counts: {
    rows: number
    atOrAbove: number
    rcaDone: number
    rcaTotal: number
    capaClosed: number
    capaTotal: number
    capaOverdue: number
  }
  weekly: { key: string; label: string; reported: number; closed: number; highSeverity: number }[]
  monthly: { month: string; reported: number; closed: number }[]
  severity: { name: string; key: Severity; value: number; color: string }[]
  riskDist: { label: string; bucket: string; count: number; color: string }[]
  types: { name: string; value: number }[]
  aircraft: { name: string; value: number }[]
  airports: { name: string; city: string; value: number }[]
  phases: { name: string; value: number }[]
  rcaSeries: { month: string; rate: number; done: number; opened: number }[]
  capaSeries: { month: string; rate: number; done: number; opened: number }[]
  kpis: KpiMetric[]
  scopedCapas: { ref: string; status: string; dueDate: string; progress: number }[]
  complianceTrend: { month: string; score: number }[]
}

export interface ChartSeries {
  key: string
  label: string
  color: string
}

/* ---------------------------------------------------------------- filters */

export interface IncidentFilters {
  search: string
  severity: Severity[]
  status: IncidentStatus[]
  category: IncidentCategory[]
  investigator: string[]
  aircraft: string[]
  airport: string[]
  dateFrom?: string
  dateTo?: string
  riskMin?: number
  riskMax?: number
}

export interface SortState {
  key: keyof Incident | string
  direction: 'asc' | 'desc'
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
