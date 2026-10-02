import { cn } from '@/lib/utils'
import { Badge, Dot } from '@/components/ui/badge'
import {
  CAPA_PRIORITY,
  CAPA_STATUS,
  COMPLIANCE_STATUS,
  INCIDENT_STATUS,
  SEVERITY_TONE,
  riskBand,
} from '@/lib/domain'
import type {
  CapaPriority,
  CapaStatus,
  ComplianceStatus,
  IncidentStatus,
  Severity,
} from '@/types'

/* ------------------------------------------------------------- severity */

export function SeverityBadge({
  severity,
  size = 'md',
  className,
}: {
  severity: Severity
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const t = SEVERITY_TONE[severity]
  return (
    <Badge
      size={size}
      tone="outline"
      className={cn(t.text, t.bg, t.border, className)}
      aria-label={`Severity ${t.label}`}
    >
      {t.label}
    </Badge>
  )
}

/** Colour-keyed square used in dense tables where a word is too wide. */
export function SeverityChip({ severity, className }: { severity: Severity; className?: string }) {
  const t = SEVERITY_TONE[severity]
  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded text-xs font-semibold tnum',
        t.bg,
        t.text,
        className,
      )}
      title={`Severity ${t.label}`}
      aria-label={`Severity ${t.label}`}
    >
      {severity === 'critical' ? 'C' : severity === 'high' ? 'H' : severity === 'medium' ? 'M' : severity === 'low' ? 'L' : 'N'}
    </span>
  )
}

/* --------------------------------------------------------------- status */

export function StatusBadge({
  status,
  size = 'md',
  className,
  showDot = true,
}: {
  status: IncidentStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showDot?: boolean
}) {
  const t = INCIDENT_STATUS[status]
  return (
    <Badge size={size} tone="outline" className={cn(t.text, t.bg, t.border, className)}>
      {showDot && <Dot className={t.dot} />}
      {t.label}
    </Badge>
  )
}

/* ------------------------------------------------------------ risk score */

export function RiskBadge({
  score,
  size = 'md',
  showBand = true,
  className,
}: {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showBand?: boolean
  className?: string
}) {
  const band = riskBand(score)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border-transparent font-semibold tnum',
        size === 'sm' && 'h-5 px-1.5 text-xs',
        size === 'md' && 'h-5 px-2 text-xs',
        size === 'lg' && 'h-6 px-2.5 text-sm',
        className,
      )}
      style={{ color: `var(--color-${band.level === 'low' ? 'ok' : band.level === 'moderate' ? 'warn' : band.level === 'high' ? 'alert' : 'crit'}-ink)`, background: band.wash }}
      title={`Risk score ${score} — ${band.label}`}
    >
      {score}
      {showBand && <span className="font-medium">{band.label}</span>}
    </span>
  )
}

/** Square gauge used where a numeric + colour is enough. */
export function RiskPip({ score, className }: { score: number; className?: string }) {
  const band = riskBand(score)
  return (
    <span
      className={cn('inline-flex size-5 items-center justify-center rounded text-xs font-semibold tnum', className)}
      style={{ color: `var(--color-${band.level === 'low' ? 'ok' : band.level === 'moderate' ? 'warn' : band.level === 'high' ? 'alert' : 'crit'}-ink)`, background: band.wash }}
      title={`Risk ${score} · ${band.label}`}
    >
      {score}
    </span>
  )
}

/* ----------------------------------------------------------------- CAPA */

export function CapaStatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: CapaStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const t = CAPA_STATUS[status]
  return (
    <Badge size={size} tone="outline" className={cn(t.text, t.bg, t.border, className)}>
      <Dot className={t.dot} />
      {t.label}
    </Badge>
  )
}

export function PriorityBadge({ priority, className }: { priority: CapaPriority; className?: string }) {
  const t = CAPA_PRIORITY[priority]
  return (
    <Badge size="md" tone="outline" className={cn(t.text, t.bg, t.border, className)}>
      {t.label}
    </Badge>
  )
}

/* ----------------------------------------------------------- compliance */

export function ComplianceStatusBadge({
  status,
  size = 'md',
  className,
}: {
  status: ComplianceStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const t = COMPLIANCE_STATUS[status]
  return (
    <Badge size={size} tone="outline" className={cn(t.text, t.bg, t.border, className)}>
      <Dot className={t.dot} />
      {t.label}
    </Badge>
  )
}
