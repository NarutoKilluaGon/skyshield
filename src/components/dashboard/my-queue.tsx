import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { daysUntil } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import type { CAPA, Incident, Investigation, User } from '@/types'

export function dueLabel(iso: string): string {
  const d = daysUntil(iso)
  if (d === null) return 'No due date'
  if (d < 0) return `${-d} day${-d === 1 ? '' : 's'} overdue`
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  return `Due in ${d} days`
}

interface QueueItem {
  id: string
  ref: string
  title: string
  due: string
  overdue: boolean
  kind: 'Incident' | 'Investigation' | 'Action'
  to: string
}

/** Work assigned to the signed-in user, across incidents, investigations and CAPAs. */
export function MyQueue({
  user,
  incidents,
  investigations,
  capas,
}: {
  user: User | null
  incidents: Incident[]
  investigations: Investigation[]
  capas: CAPA[]
}) {
  const navigate = useNavigate()
  const items = useMemo<QueueItem[]>(() => {
    if (!user) return []
    const inv = investigations
      .filter((v) => v.leadInvestigatorId === user.id && v.stage !== 'closed')
      .map<QueueItem>((v) => ({
        id: v.id,
        ref: v.incidentId,
        title: v.name,
        due: dueLabel(v.dueAt),
        overdue: (daysUntil(v.dueAt) ?? 0) < 0,
        kind: 'Investigation',
        to: '/investigations',
      }))
    const cap = capas
      .filter((c) => c.ownerId === user.id && c.status !== 'completed')
      .map<QueueItem>((c) => ({
        id: c.id,
        ref: c.ref,
        title: c.title,
        due: dueLabel(c.dueDate),
        overdue: (daysUntil(c.dueDate) ?? 0) < 0,
        kind: 'Action',
        to: '/actions',
      }))
    const inc = incidents
      .filter((i) => i.investigatorId === user.id && i.status !== 'closed')
      .map<QueueItem>((i) => ({
        id: i.id,
        ref: i.ref,
        title: i.title,
        due: i.investigationId ? 'In investigation' : 'Needs investigation',
        overdue: false,
        kind: 'Incident',
        to: `/incidents/${i.id}`,
      }))
    return [...inv, ...cap, ...inc].slice(0, 7)
  }, [user, incidents, investigations, capas])

  return (
    <section aria-label="My queue" className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-base font-semibold text-ink">My queue</h2>
        <span className="text-xs text-ink-muted">{items.length ? `${items.length} assigned to you` : ''}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">Nothing assigned to you right now.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {items.map((q) => (
            <li key={`${q.kind}-${q.id}`}>
              <button
                type="button"
                onClick={() => navigate(q.to)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs text-ink-muted">{q.ref}</span>
                  <span className="block truncate text-sm text-ink-soft">{q.title}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-xs tnum ${q.overdue ? 'text-crit-ink' : 'text-ink-muted'}`}>{q.due}</span>
                  <Badge size="sm" tone="neutral" className="mt-1">{q.kind}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
