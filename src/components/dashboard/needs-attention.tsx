import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, Timer, UserX } from 'lucide-react'
import type { CAPA, Incident, Investigation } from '@/types'

export interface AttentionRow {
  id: string
  weight: number
  icon: typeof AlertTriangle
  text: string
  meta: string
  to: string
}

const OPEN_CAPA = (c: CAPA) => c.status !== 'completed'

/** Builds the "Needs attention" hero list from the data layer (max 5 rows, severity-sorted). */
export function computeNeedsAttention(
  incidents: Incident[],
  investigations: Investigation[],
  capas: CAPA[],
  now = new Date(),
): AttentionRow[] {
  const rows: AttentionRow[] = []
  const in48h = (iso: string) => {
    const ms = new Date(iso).getTime() - now.getTime()
    return ms > 0 && ms < 48 * 3600 * 1000
  }
  const overdue = capas.filter((c) => OPEN_CAPA(c) && new Date(c.dueDate) < now)
  if (overdue.length)
    rows.push({
      id: 'capa-overdue',
      weight: 1,
      icon: Timer,
      text: `${overdue.length} corrective action${overdue.length === 1 ? '' : 's'} past ${overdue.length === 1 ? 'its' : 'their'} due date`,
      meta: overdue.map((c) => c.ref).slice(0, 3).join(', '),
      to: '/actions',
    })
  const unassigned = incidents.filter(
    (i) => i.risk.severity === 'critical' && !i.investigatorId && i.status !== 'closed',
  )
  if (unassigned.length)
    rows.push({
      id: 'crit-unassigned',
      weight: 0,
      icon: UserX,
      text: `${unassigned.length} critical incident${unassigned.length === 1 ? '' : 's'} with no investigator assigned`,
      meta: unassigned.map((i) => i.ref).slice(0, 3).join(', '),
      to: '/incidents',
    })
  const awaiting = investigations.filter((v) => v.stage === 'verification')
  if (awaiting.length)
    rows.push({
      id: 'inv-review',
      weight: 2,
      icon: ClipboardList,
      text: `${awaiting.length} investigation${awaiting.length === 1 ? '' : 's'} awaiting verification review`,
      meta: awaiting.map((v) => v.name).slice(0, 2).join(', '),
      to: '/investigations',
    })
  const breachingInv = investigations.filter((v) => v.stage !== 'closed' && in48h(v.dueAt))
  const breachingCapa = capas.filter((c) => OPEN_CAPA(c) && in48h(c.dueDate))
  const breaching = breachingInv.length + breachingCapa.length
  if (breaching)
    rows.push({
      id: 'sla-48',
      weight: 3,
      icon: AlertTriangle,
      text: `${breaching} SLA${breaching === 1 ? '' : 's'} breaching within 48 hours`,
      meta: [...breachingInv.map((v) => v.name), ...breachingCapa.map((c) => c.ref)].slice(0, 3).join(', '),
      to: '/actions',
    })
  return rows.sort((a, b) => a.weight - b.weight).slice(0, 5)
}

export function NeedsAttention({
  incidents,
  investigations,
  capas,
}: {
  incidents: Incident[]
  investigations: Investigation[]
  capas: CAPA[]
}) {
  const navigate = useNavigate()
  const rows = useMemo(
    () => computeNeedsAttention(incidents, investigations, capas),
    [incidents, investigations, capas],
  )
  return (
    <section aria-label="Needs attention" className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">Needs attention</h2>
        <span className="text-xs text-ink-muted">{rows.length ? `${rows.length} item${rows.length === 1 ? '' : 's'} today` : ''}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">Nothing needs attention.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => navigate(r.to)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-3"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-line-strong bg-surface-2 text-ink-soft">
                  <r.icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{r.text}</span>
                <span className="hidden shrink-0 font-mono text-xs text-ink-muted sm:block">{r.meta}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
