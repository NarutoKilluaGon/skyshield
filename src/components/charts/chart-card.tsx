import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { Tip } from '@/components/ui/primitives'

/**
 * Standard frame for every analytical panel: title, optional subtitle,
 * right-hand controls and a consistent body slot.
 */
export function ChartCard({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  info,
  dense = false,
  table,
  chartAriaLabel,
  takeaway,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  info?: string
  dense?: boolean
  /** Computed one-line conclusion drawn from the chart's own data (master 4.7). */
  takeaway?: React.ReactNode
  /** Tabular text alternative for the chart; enables the "View as table" toggle. */
  table?: { columns: string[]; rows: (string | number)[][] }
  chartAriaLabel?: string
}) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart')
  const aria =
    chartAriaLabel ??
    `${typeof title === 'string' ? title : 'Chart'}${typeof subtitle === 'string' ? `, ${subtitle}` : ''}`
  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      {(title || actions) && (
        <div
          className={cn(
            'flex shrink-0 items-start justify-between gap-3 border-b border-line-soft',
            dense ? 'px-3.5 py-2.5' : 'px-4 py-3',
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={cn(
                  'truncate font-semibold text-ink',
                  dense ? 'text-sm' : 'text-base',
                )}
              >
                {title}
              </h3>
              {info && (
                <Tip label={info}>
                  <Info className="size-3 shrink-0 cursor-help text-ink-muted" />
                </Tip>
              )}
            </div>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs leading-tight text-ink-muted">{subtitle}</p>
            )}
          </div>
          {(table || actions) && (
            <div className="flex shrink-0 items-center gap-1.5">
              {table && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
                >
                  {view === 'chart' ? 'View as table' : 'View as chart'}
                </Button>
              )}
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={cn('min-w-0 flex-1', dense ? 'p-3' : 'p-4', bodyClassName)}>
        {takeaway && (
          <p
            data-takeaway
            className="mb-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft"
          >
            <span aria-hidden="true" className="mt-[5px] size-1.5 shrink-0 rotate-45 bg-brand" />
            <span className="min-w-0">{takeaway}</span>
          </p>
        )}
        {table && view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{aria}</caption>
              <thead>
                <tr className="border-b border-line-soft text-left text-xs font-medium text-ink-muted">
                  {table.columns.map((c) => (
                    <th key={c} className="px-2 py-1.5 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} className={cn('px-2 py-1.5', j > 0 && 'tnum text-right')}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div role="img" aria-label={aria}>
            {children}
          </div>
        )}
      </div>
    </Card>
  )
}
