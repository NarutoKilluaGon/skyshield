import {
  Camera,
  CircleCheckBig,
  ClipboardCheck,
  FileText,
  GitBranch,
  MessageSquare,
  Send,
  Settings2,
  UserRoundCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/common/avatar'
import { fmtDateTime, fmtRelative } from '@/lib/format'
import { USERS, userById } from '@/data/users'
import type { TimelineEvent } from '@/types'

const KIND = {
  report: { icon: Send, color: 'var(--color-brand)', label: 'Report' },
  assignment: { icon: UserRoundCheck, color: 'var(--color-brand)', label: 'Assignment' },
  status: { icon: CircleCheckBig, color: 'var(--color-ok)', label: 'Status' },
  evidence: { icon: Camera, color: 'var(--color-neutral)', label: 'Evidence' },
  rca: { icon: GitBranch, color: 'var(--color-warn)', label: 'Root cause' },
  capa: { icon: ClipboardCheck, color: 'var(--color-alert)', label: 'Corrective action' },
  system: { icon: Settings2, color: 'var(--color-neutral)', label: 'System' },
  note: { icon: MessageSquare, color: 'var(--color-neutral)', label: 'Note' },
} as const

export function IncidentTimeline({
  events,
  className,
  dense = false,
}: {
  events: TimelineEvent[]
  className?: string
  dense?: boolean
}) {
  if (!events.length)
    return (
      <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
        <FileText className="size-4 text-ink-muted" />
        <p className="text-sm text-ink-soft">No recorded activity yet</p>
        <p className="text-xs text-ink-muted">
          Timeline entries appear as the incident progresses through the workflow.
        </p>
      </div>
    )

  return (
    <ol className={cn('relative', className)}>
      {events.map((e, i) => {
        const k = KIND[e.kind]
        const Icon = k.icon
        const u = userById(
          USERS.find((x) => e.actor.split(' ').some((part) => x.name.includes(part)))?.id,
        )
        const last = i === events.length - 1

        return (
          <li key={e.id} className="relative flex gap-3 pl-0.5">
            {/* rail */}
            {!last && (
              <span
                className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px"
                style={{ background: 'var(--color-line-soft)' }}
                aria-hidden="true"
              />
            )}
            <span
              className="relative z-10 mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-transparent bg-surface-3 text-ink-soft"
            >
              <Icon className="size-3" />
            </span>

            <div className={cn('min-w-0 flex-1', dense ? 'pb-3' : 'pb-4')}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-ink">{e.title}</p>
                <time
                  className="text-xs text-ink-muted tnum"
                  dateTime={e.at}
                  title={fmtDateTime(e.at)}
                >
                  {fmtRelative(e.at)}
                </time>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{e.detail}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {u ? (
                  <Avatar user={u} size="xs" />
                ) : (
                  <span className="flex size-5 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink-muted">
                    {e.actor
                      .split(' ')
                      .slice(0, 2)
                      .map((p) => p[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                )}
                <span className="truncate text-xs text-ink-muted">{e.actor}</span>
                <span className="rounded bg-surface-3 px-1.5 py-px text-xs font-medium text-ink-soft">
                  {k.label}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
