import { Check, CircleDot, Clock } from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { INVESTIGATION_STAGES } from '@/lib/domain'
import type { InvestigationStage } from '@/types'
import { Tip } from '@/components/ui/primitives'
import { Avatar } from '@/components/common/avatar'
import { Badge } from '@/components/ui/badge'
import { fmtDateLong, daysUntil } from '@/lib/format'
import { userById } from '@/data/users'
import { storeIncidentById } from '@/services/store'
import { aircraftById } from '@/data/aircraft'
import type { Investigation } from '@/types'

const stageIndex = (s: InvestigationStage) => INVESTIGATION_STAGES.findIndex((x) => x.id === s)

/* ------------------------------------------------- horizontal workflow */

export function RCAWorkflow({
  stage,
  className,
  compact = false,
}: {
  stage: InvestigationStage
  className?: string
  compact?: boolean
}) {
  const current = stageIndex(stage)

  return (
    <ol
      className={cn('flex w-full items-start', className)}
      aria-label="Investigation workflow"
    >
      {INVESTIGATION_STAGES.map((s, i) => {
        const done = i < current
        const active = i === current
        const pct = Math.round(((i + 1) / INVESTIGATION_STAGES.length) * 100)

        return (
          <li key={s.id} className="relative flex min-w-0 flex-1 flex-col items-center">
            {i > 0 && (
              <span
                className="absolute left-1/2 top-[9px] h-px w-full"
                style={{
                  background: done || active ? 'var(--color-brand)' : 'var(--color-line)',
                  opacity: done || active ? 0.5 : 1,
                }}
                aria-hidden="true"
              />
            )}
            <Tip label={`${s.label} — ${s.hint}`}>
              <span
                className={cn(
                  'relative z-10 flex size-[19px] items-center justify-center rounded-full border transition-colors duration-200',
                  done && 'border-brand/60 bg-brand/20 text-brand',
                  active && 'border-brand bg-brand text-on-brand',
                  !done && !active && 'border-line-strong bg-surface text-ink-muted',
                )}
              >
                {done ? (
                  <Check className="size-2.5" strokeWidth={3} />
                ) : active ? (
                  <CircleDot className="size-2.5" />
                ) : (
                  <span className="size-1 rounded-full bg-current" />
                )}
              </span>
            </Tip>
            {!compact && (
              <span
                className={cn(
                  'mt-1.5 max-w-full px-1 text-center text-xs font-medium leading-tight transition-colors',
                  active ? 'text-brand' : done ? 'text-ink-soft' : 'text-ink-muted',
                )}
              >
                {s.short}
              </span>
            )}
            <span className="sr-only">
              {s.label}: {done ? 'complete' : active ? 'in progress' : 'not started'}
            </span>
            <span className="sr-only">{pct}% of workflow</span>
          </li>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------- progress per case */

export function ProgressTimeline({
  investigations,
  className,
  limit,
}: {
  investigations: Investigation[]
  className?: string
  limit?: number
}) {
  const rows = limit ? investigations.slice(0, limit) : investigations
  if (!rows.length)
    return (
      <p className="px-1 py-6 text-center text-sm text-ink-muted">
        No investigations in progress.
      </p>
    )

  return (
    <ul className={cn('divide-y divide-line-soft', className)}>
      {rows.map((inv) => {
        const inc = storeIncidentById(inv.incidentId)
        const lead = userById(inv.leadInvestigatorId)
        const ac = inc ? aircraftById(inc.aircraftId) : undefined
        const days = daysUntil(inv.dueAt)
        const late = days !== null && days < 0
        const soon = days !== null && days >= 0 && days <= 4
        const tone = inv.progress >= 80 ? 'var(--color-ok)' : inv.progress >= 45 ? 'var(--color-brand)' : 'var(--color-warn)'

        return (
          <li key={inv.id} className="px-4 py-3 transition-colors hover:bg-surface-2/50">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium text-ink">{inv.name}</p>
                  <Badge size="sm" tone="outline" className="shrink-0 text-ink-muted">
                    {INVESTIGATION_STAGES.find((s) => s.id === inv.stage)?.short}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {inc ? (
                    <>
                      <span className="font-mono">{inc.ref}</span>
                      {' · '}
                      {ac?.registration} {inc.location.iata}
                      {' · '}
                      opened {fmtDateLong(inv.openedAt)}
                    </>
                  ) : (
                    'Linked incident unavailable'
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="hidden items-center gap-1.5 sm:flex">
                  {inv.teamMemberIds.slice(0, 3).map((id) => (
                    <Avatar key={id} user={userById(id)} size="xs" />
                  ))}
                </div>
                <span className="w-[38px] text-right text-sm font-semibold text-ink tnum">
                  {inv.progress}%
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2.5">
              <ProgressBar progress={inv.progress} color={tone} />
              <span
                className={cn(
                  'flex shrink-0 items-center gap-1 text-xs tnum',
                  late ? 'text-crit-ink' : soon ? 'text-warn-ink' : 'text-ink-muted',
                )}
              >
                <Clock className="size-2.5" />
                {late ? `${Math.abs(days!)}d over` : `due in ${days}d`}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              Lead: <span className="text-ink-muted">{lead?.name ?? 'Unassigned'}</span>
              {inv.openQuestions.length > 0 && (
                <> · {inv.openQuestions.length} open question{inv.openQuestions.length > 1 ? 's' : ''}</>
              )}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/** Bar rendered separately so the gradient can be applied cleanly. */
function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div className="h-1 w-full min-w-0 flex-1 overflow-hidden rounded-full bg-canvas-deep" aria-hidden="true">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${alpha(color, 67)}, ${color})` }}
      />
    </div>
  )
}
