import { ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { CapaStatusBadge, PriorityBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { CAPA_STATUS } from '@/lib/domain'
import { fmtDate } from '@/lib/format'
import { userById, userName } from '@/data/users'
import { EmptyState, type DetailData } from '../shared'

/** CAPA — corrective and preventive actions linked to this occurrence. */
export function CapaTab({ d }: { d: DetailData }) {
  const { capas } = d
  if (!capas.length)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No corrective actions raised"
        body="Actions are raised from investigation findings. Once raised they appear here and are tracked to effectiveness verification."
      />
    )

  return (
    <ul className="space-y-2.5">
      {capas.map((c) => {
        const t = CAPA_STATUS[c.status]
        return (
          <li key={c.id}>
            <div className="rounded-lg border border-line bg-surface-2/40 p-3.5 transition-colors hover:bg-surface-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs text-ink-muted">{c.ref}</span>
                    <CapaStatusBadge status={c.status} size="sm" />
                    <PriorityBadge priority={c.priority} />
                    <Badge size="sm" tone="outline">
                      {c.type}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-ink-soft">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{c.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5 sm:flex-col sm:items-end">
                  <span className="text-sm font-semibold text-ink tnum">{c.progress}%</span>
                  <span className="text-xs text-ink-muted">due {fmtDate(c.dueDate)}</span>
                </div>
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-canvas-deep">
                <div className={cn('h-full rounded-full', t.bar)} style={{ width: `${c.progress}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                <span className="flex items-center gap-1">
                  <Avatar user={userById(c.ownerId)} size="xs" /> {userName(c.ownerId)}
                </span>
                <span>Linked finding: {c.linkedFinding}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
