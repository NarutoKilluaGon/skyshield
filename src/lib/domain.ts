import type {
  CapaStatus,
  ComplianceStatus,
  IncidentCategory,
  IncidentStatus,
  InvestigationStage,
  Likelihood,
  OperationalPhase,
  Severity,
} from '@/types'

/* ------------------------------------------------------------------ risk */

export const SEVERITY_VALUE: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  negligible: 1,
}

export const SEVERITY_ORDER: Severity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'negligible',
]

export const LIKELIHOOD_LABEL: Record<Likelihood, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
}

export const LIKELIHOOD_SHORT: Record<Likelihood, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Certain',
}

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical'

export const RISK_BANDS: { max: number; level: RiskLevel; label: string; color: string; dim: string; wash: string; ink: string }[] = [
  { max: 4, level: 'low', label: 'Low', color: 'var(--color-ok)', dim: 'var(--color-ok-wash)', wash: 'var(--color-ok-wash)', ink: 'var(--color-ok-ink)' },
  { max: 9, level: 'moderate', label: 'Moderate', color: 'var(--color-warn)', dim: 'var(--color-warn-wash)', wash: 'var(--color-warn-wash)', ink: 'var(--color-warn-ink)' },
  { max: 14, level: 'high', label: 'High', color: 'var(--color-alert)', dim: 'var(--color-alert-wash)', wash: 'var(--color-alert-wash)', ink: 'var(--color-alert-ink)' },
  { max: 25, level: 'critical', label: 'Critical', color: 'var(--color-crit)', dim: 'var(--color-crit-wash)', wash: 'var(--color-crit-wash)', ink: 'var(--color-crit-ink)' },
]

export function riskLevel(score: number): RiskLevel {
  return RISK_BANDS.find((b) => score <= b.max)?.level ?? 'critical'
}

export function riskBand(score: number) {
  return RISK_BANDS.find((b) => score <= b.max) ?? RISK_BANDS[RISK_BANDS.length - 1]
}

export const riskScore = (severity: Severity, likelihood: Likelihood) =>
  SEVERITY_VALUE[severity] * likelihood

/* -------------------------------------------------------------- severity */

type Tone = {
  label: string
  text: string
  bg: string
  border: string
  dot: string
  bar: string
}

export const SEVERITY_TONE: Record<Severity, Tone> = {
  critical: {
    label: 'Critical',
    text: 'text-crit-ink',
    bg: 'bg-crit-wash',
    border: 'border-transparent',
    dot: 'bg-crit',
    bar: 'bg-crit',
  },
  high: {
    label: 'High',
    text: 'text-alert-ink',
    bg: 'bg-alert-wash',
    border: 'border-transparent',
    dot: 'bg-alert',
    bar: 'bg-alert',
  },
  medium: {
    label: 'Medium',
    text: 'text-warn-ink',
    bg: 'bg-warn-wash',
    border: 'border-transparent',
    dot: 'bg-warn',
    bar: 'bg-warn',
  },
  low: {
    label: 'Low',
    text: 'text-ok-ink',
    bg: 'bg-ok-wash',
    border: 'border-transparent',
    dot: 'bg-ok',
    bar: 'bg-ok',
  },
  negligible: {
    label: 'Negligible',
    text: 'text-ink-soft',
    bg: 'bg-surface-3',
    border: 'border-transparent',
    dot: 'bg-ink-faint',
    bar: 'bg-ink-faint',
  },
}

/**
 * Token-driven fills for SVG markers. Dots/bars read `var(--color-*)` so both
 * themes work; severity colours only mean severity.
 */
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: 'var(--color-crit)',
  high: 'var(--color-alert)',
  medium: 'var(--color-warn)',
  low: 'var(--color-ok)',
  negligible: 'var(--color-neutral)',
}

/* ---------------------------------------------------------------- status */

/* Status badges use wash backgrounds with ink text and no border. Only the
   single accent (brand) and status colours appear: neutral for drafts,
   brand for active work, warn/alert for pending action, ok for closed. */
export const INCIDENT_STATUS: Record<
  IncidentStatus,
  { label: string; short: string; text: string; bg: string; border: string; dot: string }
> = {
  draft: {
    label: 'Draft',
    short: 'DFT',
    text: 'text-ink-soft',
    bg: 'bg-surface-3',
    border: 'border-transparent',
    dot: 'bg-ink-faint',
  },
  reported: {
    label: 'Reported',
    short: 'RPT',
    text: 'text-brand',
    bg: 'bg-brand-wash',
    border: 'border-transparent',
    dot: 'bg-brand',
  },
  investigation: {
    label: 'Investigation',
    short: 'INV',
    text: 'text-brand',
    bg: 'bg-brand-wash',
    border: 'border-transparent',
    dot: 'bg-brand',
  },
  rca_pending: {
    label: 'RCA Pending',
    short: 'RCA',
    text: 'text-warn-ink',
    bg: 'bg-warn-wash',
    border: 'border-transparent',
    dot: 'bg-warn',
  },
  capa: {
    label: 'CAPA',
    short: 'CAP',
    text: 'text-alert-ink',
    bg: 'bg-alert-wash',
    border: 'border-transparent',
    dot: 'bg-alert',
  },
  closed: {
    label: 'Closed',
    short: 'CLS',
    text: 'text-ok-ink',
    bg: 'bg-ok-wash',
    border: 'border-transparent',
    dot: 'bg-ok',
  },
}

export const INCIDENT_STATUS_ORDER: IncidentStatus[] = [
  'draft',
  'reported',
  'investigation',
  'rca_pending',
  'capa',
  'closed',
]

/* ------------------------------------------------------- investigation flow */

export const INVESTIGATION_STAGES: {
  id: InvestigationStage
  label: string
  short: string
  hint: string
}[] = [
  { id: 'incident_reported', label: 'Incident Reported', short: 'Report', hint: 'Occurrence logged in SMS' },
  { id: 'initial_assessment', label: 'Initial Assessment', short: 'Assess', hint: 'Risk graded, triage' },
  { id: 'investigation', label: 'Investigation', short: 'Investigate', hint: 'Fact gathering' },
  { id: 'evidence_collection', label: 'Evidence Collection', short: 'Evidence', hint: 'Docs, data, interviews' },
  { id: 'root_cause_analysis', label: 'Root Cause Analysis', short: 'RCA', hint: '5 Whys / causal chain' },
  { id: 'corrective_action', label: 'Corrective Action', short: 'CAPA', hint: 'Actions assigned' },
  { id: 'verification', label: 'Verification', short: 'Verify', hint: 'Effectiveness check' },
  { id: 'closed', label: 'Closed', short: 'Close', hint: 'Findings signed off' },
]

/* ------------------------------------------------------------------ CAPA */

export const CAPA_STATUS: Record<
  CapaStatus,
  { label: string; text: string; bg: string; border: string; dot: string; bar: string }
> = {
  open: {
    label: 'Open',
    text: 'text-brand',
    bg: 'bg-brand-wash',
    border: 'border-transparent',
    dot: 'bg-brand',
    bar: 'bg-brand',
  },
  in_progress: {
    label: 'In Progress',
    text: 'text-brand',
    bg: 'bg-brand-wash',
    border: 'border-transparent',
    dot: 'bg-brand',
    bar: 'bg-brand',
  },
  due_soon: {
    label: 'Due Soon',
    text: 'text-warn-ink',
    bg: 'bg-warn-wash',
    border: 'border-transparent',
    dot: 'bg-warn',
    bar: 'bg-warn',
  },
  overdue: {
    label: 'Overdue',
    text: 'text-crit-ink',
    bg: 'bg-crit-wash',
    border: 'border-transparent',
    dot: 'bg-crit',
    bar: 'bg-crit',
  },
  completed: {
    label: 'Completed',
    text: 'text-ok-ink',
    bg: 'bg-ok-wash',
    border: 'border-transparent',
    dot: 'bg-ok',
    bar: 'bg-ok',
  },
  verified: {
    label: 'Verified',
    text: 'text-ok-ink',
    bg: 'bg-ok-wash',
    border: 'border-transparent',
    dot: 'bg-ok',
    bar: 'bg-ok',
  },
}

export const CAPA_STATUS_ORDER: CapaStatus[] = [
  'overdue',
  'due_soon',
  'open',
  'in_progress',
  'completed',
  'verified',
]

export const CAPA_PRIORITY: Record<string, { label: string; text: string; bg: string; border: string }> = {
  critical: {
    label: 'Critical',
    text: 'text-crit-ink',
    bg: 'bg-crit-wash',
    border: 'border-transparent',
  },
  high: {
    label: 'High',
    text: 'text-alert-ink',
    bg: 'bg-alert-wash',
    border: 'border-transparent',
  },
  medium: {
    label: 'Medium',
    text: 'text-warn-ink',
    bg: 'bg-warn-wash',
    border: 'border-transparent',
  },
  low: {
    label: 'Low',
    text: 'text-ok-ink',
    bg: 'bg-ok-wash',
    border: 'border-transparent',
  },
}

/* ------------------------------------------------------------ compliance */

export const COMPLIANCE_STATUS: Record<
  ComplianceStatus,
  { label: string; text: string; bg: string; border: string; dot: string }
> = {
  compliant: {
    label: 'Compliant',
    text: 'text-ok-ink',
    bg: 'bg-ok-wash',
    border: 'border-transparent',
    dot: 'bg-ok',
  },
  partially_compliant: {
    label: 'Partially Compliant',
    text: 'text-warn-ink',
    bg: 'bg-warn-wash',
    border: 'border-transparent',
    dot: 'bg-warn',
  },
  non_compliant: {
    label: 'Non-Compliant',
    text: 'text-crit-ink',
    bg: 'bg-crit-wash',
    border: 'border-transparent',
    dot: 'bg-crit',
  },
  under_review: {
    label: 'Under Review',
    text: 'text-brand',
    bg: 'bg-brand-wash',
    border: 'border-transparent',
    dot: 'bg-brand',
  },
}

/* --------------------------------------------------------- classifications */

export const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  engine_issue: 'Engine Issue',
  bird_strike: 'Bird Strike',
  runway_excursion: 'Runway Excursion',
  cabin_issue: 'Cabin Issue',
  hydraulic_failure: 'Hydraulic Failure',
  avionics_fault: 'Avionics Fault',
  fuel_system: 'Fuel System',
  tire_brake: 'Tyre / Brake',
  pressurisation: 'Pressurisation',
  ground_damage: 'Ground Damage',
  fatigue_risk: 'Fatigue Risk',
  near_miss: 'Near Miss',
}

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as IncidentCategory[]

export const PHASE_LABEL: Record<OperationalPhase, string> = {
  gate: 'At Gate',
  pushback: 'Pushback',
  taxi: 'Taxi',
  takeoff: 'Take-off',
  climb: 'Climb',
  cruise: 'Cruise',
  descent: 'Descent',
  approach: 'Approach',
  landing: 'Landing',
  maintenance: 'Maintenance',
  ground_ops: 'Ground Operations',
}

export const OCCURRENCE_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'AC', label: 'Accident', color: 'var(--color-crit)' },
  { value: 'SI', label: 'Serious Incident', color: 'var(--color-alert)' },
  { value: 'GI', label: 'General Incident', color: 'var(--color-warn)' },
  { value: 'NM', label: 'Near Miss', color: 'var(--color-brand)' },
  { value: 'NC', label: 'Non-Compliant Practice', color: 'var(--color-neutral)' },
]

/* -------------------------------------------------------- factor taxonomy */

export const FACTOR_CATEGORIES = [
  {
    id: 'human',
    label: 'Human Factors',
    icon: 'user',
    color: 'var(--color-warn)',
    hint: 'Competency, fatigue, communication, workload',
  },
  {
    id: 'technical',
    label: 'Technical Factors',
    icon: 'cpu',
    color: 'var(--color-brand)',
    hint: 'Component condition, design, systems interface',
  },
  {
    id: 'environmental',
    label: 'Environmental Factors',
    icon: 'cloud',
    color: 'var(--color-ok)',
    hint: 'Weather, terrain, lighting, wildlife',
  },
  {
    id: 'organizational',
    label: 'Organizational Factors',
    icon: 'building',
    color: 'var(--color-brand)',
    hint: 'Policy, resources, culture, decision-making',
  },
  {
    id: 'procedural',
    label: 'Procedural Factors',
    icon: 'file',
    color: 'var(--color-neutral)',
    hint: 'SOPs, checklists, maintenance programmes',
  },
] as const

export type FactorCategoryId = (typeof FACTOR_CATEGORIES)[number]['id']
