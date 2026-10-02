import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/primitives'
import { riskBand } from '@/lib/domain'
import type {
  Aircraft,
  CAPA,
  EvidenceItem,
  Incident,
  Investigation,
  RCA,
  TimelineEvent,
} from '@/types'

/** Everything the detail tabs render, loaded once by the page shell. */
export interface DetailData {
  incident: Incident
  ac: Aircraft | undefined
  inv: Investigation | undefined
  rca: RCA | undefined
  /** CAPAs linked to this incident. */
  capas: CAPA[]
  evidence: EvidenceItem[]
  timeline: TimelineEvent[]
  band: ReturnType<typeof riskBand>
  /** Audited reveal of the reporter identity on restricted records. */
  onRevealReporter?: () => void
  revealing?: boolean
}

export const OCCURRENCE: Record<string, { label: string; color: string }> = {
  AC: { label: 'Accident', color: 'var(--color-crit)' },
  SI: { label: 'Serious Incident', color: 'var(--color-alert)' },
  GI: { label: 'General Incident', color: 'var(--color-warn)' },
  NM: { label: 'Near Miss', color: 'var(--color-brand)' },
  NC: { label: 'Non-Compliant Practice', color: 'var(--color-neutral)' },
}

export function InfoCard({
  icon: Icon,
  title,
  rows,
}: {
  icon: LucideIcon
  title: string
  rows: [string, string][]
}) {
  return (
    <Card className="p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Icon className="size-3.5 text-ink-muted" />
        {title}
      </h3>
      <dl className="mt-3 space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-xs text-ink-muted">{k}</dt>
            <dd className="truncate text-right font-mono text-xs text-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <div className="flex size-10 items-center justify-center rounded-card border border-line bg-surface-2">
        <Icon className="size-4 text-ink-muted" />
      </div>
      <p className="text-base font-medium text-ink-soft">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{body}</p>
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-4 w-[520px] max-w-full" />
      <Skeleton className="h-[420px]" />
    </div>
  )
}
