import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { SparkBars, Sparkline } from '@/components/charts/sparkline'
import { Tip } from '@/components/ui/primitives'
import type { KpiMetric } from '@/types'

export const ACCENT = {
  orange: { line: 'var(--color-alert)', text: 'text-alert-ink', bg: 'bg-alert-wash' },
  blue: { line: 'var(--color-brand)', text: 'text-brand', bg: 'bg-brand-wash' },
  amber: { line: 'var(--color-warn)', text: 'text-warn-ink', bg: 'bg-warn-wash' },
  red: { line: 'var(--color-crit)', text: 'text-crit-ink', bg: 'bg-crit-wash' },
  green: { line: 'var(--color-ok)', text: 'text-ok-ink', bg: 'bg-ok-wash' },
} as const

export function StatCard({
  metric,
  to,
  variant = 'line',
  className,
}: {
  metric: KpiMetric
  to?: string
  variant?: 'line' | 'bar'
  className?: string
}) {
  const a = ACCENT[metric.accent]
  const rising = metric.delta > 0
  const flat = metric.delta === 0

  const DeltaIcon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight

  const body = (
    <Card
      className={cn(
        'group relative overflow-hidden transition-colors duration-120',
        className,
      )}
    >
      <div className="relative flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn('size-1.5 shrink-0 rounded-sm', a.bg)}
              aria-hidden="true"
            />
            <h3 className="truncate text-xs font-medium leading-tight text-ink-muted">
              {metric.label}
            </h3>
          </div>
          <div className="mt-1.5 flex items-end gap-2">
            <span
              className="text-xl font-semibold leading-none text-ink tnum"
            >
              {metric.value}
            </span>
            <span className={cn('mb-0.5 text-xs font-medium tnum', a.text)}>
              {flat ? '—' : `${rising ? '+' : ''}${metric.delta}%`}
            </span>
          </div>
        </div>
      </div>

      <div className="relative mt-1.5 flex items-end justify-between gap-2 px-4 pb-3 pt-0.5">
        <div className="min-w-0 flex-1">
          <div className={cn('flex items-center gap-1 text-xs font-medium', a.text)}>
            {metric.accent === 'red' && <TriangleAlert className="size-3 shrink-0" />}
            {!flat && (
              <Tip label={`${metric.deltaLabel}`}>
                <span className="inline-flex cursor-help items-center gap-0.5">
                  <DeltaIcon className="size-3" />
                  <span className="truncate">{metric.deltaLabel}</span>
                </span>
              </Tip>
            )}
            {flat && <span className="truncate">{metric.deltaLabel}</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{metric.footnote}</p>
        </div>
        <div className="shrink-0">
          {variant === 'bar' ? (
            <SparkBars data={metric.series} color={a.line} width={84} height={30} />
          ) : (
            <Sparkline data={metric.series} color={a.line} width={96} height={30} />
          )}
        </div>
      </div>
    </Card>
  )

  if (!to) return body
  return (
    <Link to={to} className="block rounded-card focus-visible:outline-none">
      {body}
    </Link>
  )
}
