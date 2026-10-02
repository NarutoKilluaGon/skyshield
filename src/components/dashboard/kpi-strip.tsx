import { cn } from '@/lib/utils'

export interface KpiCell {
  label: string
  value: number
  delta: string
  /** render the number in crit ink (only used for overdue CAPAs, only above zero) */
  alarm?: boolean
}

/** One panel, four cells divided by vertical rules. Numbers are the single large number on the page. */
export function KpiStrip({ cells }: { cells: KpiCell[] }) {
  return (
    <section aria-label="Key figures" className="rounded-card border border-line bg-surface">
      <div className="grid grid-cols-2 divide-line-soft max-sm:divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {cells.map((c) => (
          <div key={c.label} className="px-5 py-4">
            <p className="text-xs font-medium text-ink-muted">{c.label}</p>
            <p
              className={cn(
                'mt-1.5 font-condensed text-2xl leading-none font-semibold tnum tabular-nums',
                c.alarm && c.value > 0 ? 'text-crit-ink' : 'text-ink',
              )}
            >
              {c.value}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">{c.delta}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
