import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Check,
  CheckCheck,
  ClipboardCheck,
  FileWarning,
  GitBranch,
  Inbox,
  Settings2,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, Dot } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications'
import { useAuth } from '@/lib/auth'
import { fmtDateLong, fmtRelative } from '@/lib/format'
import type { AppNotification, NotificationSeverity } from '@/types'

const SEV: Record<
  NotificationSeverity,
  { icon: typeof Bell; ring: string; bg: string; text: string; label: string }
> = {
  critical: { icon: ShieldAlert, ring: 'border-transparent', bg: 'bg-crit-wash', text: 'text-crit-ink', label: 'Critical' },
  warning: { icon: FileWarning, ring: 'border-transparent', bg: 'bg-warn-wash', text: 'text-warn-ink', label: 'Warning' },
  info: { icon: UserCheck, ring: 'border-transparent', bg: 'bg-brand-wash', text: 'text-brand', label: 'Info' },
  success: { icon: Check, ring: 'border-transparent', bg: 'bg-ok-wash', text: 'text-ok-ink', label: 'Resolved' },
}

const CATEGORY_ICON: Record<AppNotification['category'], typeof Bell> = {
  incident: FileWarning,
  capa: ClipboardCheck,
  rca: GitBranch,
  compliance: ShieldAlert,
  assignment: UserCheck,
  system: Settings2,
}

interface NotificationsValue {
  items: AppNotification[]
  unread: AppNotification[]
  critical: AppNotification[]
  loading: boolean
  error: string | null
  markRead: (id: string) => void
  markAll: () => void
  unreadCount: number
}

const NotificationsContext = createContext<NotificationsValue | null>(null)

/**
 * One notifications store for the whole shell (master 4.8): the topbar badge,
 * the bell popover and the notification centre all read the same state, so the
 * unread count is real and consistent everywhere.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [all, setAll] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Targeted notifications (forUserId, e.g. @mentions) are only visible to
  // the user they concern; everything else is org-wide.
  const items = useMemo(
    () => all.filter((n) => !n.forUserId || n.forUserId === user?.id),
    [all, user?.id],
  )

  useEffect(() => {
    let live = true
    getNotifications()
      .then((n) => live && setAll(n))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Notification service unreachable'))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [])

  const unread = useMemo(() => items.filter((n) => !n.read), [items])
  const critical = useMemo(() => items.filter((n) => n.severity === 'critical' && !n.read), [items])

  const markRead = (id: string) => {
    setAll((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    void markNotificationRead(id)
  }

  const markAll = () => {
    setAll((prev) => prev.map((n) => (n.forUserId && n.forUserId !== user?.id ? n : { ...n, read: true })))
    void markAllNotificationsRead()
  }

  const value = useMemo(
    () => ({ items, unread, critical, loading, error, markRead, markAll, unreadCount: unread.length }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, loading, error, unread, critical],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

/** Reads the shared shell store; falls back to a private instance when standalone. */
export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext)
  return ctx ?? standaloneFallback
}

const standaloneFallback: NotificationsValue = {
  items: [],
  unread: [],
  critical: [],
  loading: false,
  error: null,
  markRead: () => {},
  markAll: () => {},
  unreadCount: 0,
}

/* ------------------------------------------------------- day grouping */

const dayLabel = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Earlier'
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return fmtDateLong(iso)
}

/** Group notifications into Today / Yesterday / date buckets, newest first. */
export function groupByDay(items: AppNotification[]): { label: string; items: AppNotification[] }[] {
  const out: { label: string; items: AppNotification[] }[] = []
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at))
  for (const n of sorted) {
    const label = dayLabel(n.at)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(n)
    else out.push({ label, items: [n] })
  }
  return out
}

export function NotificationRow({
  n,
  onOpen,
  compact = false,
}: {
  n: AppNotification
  onOpen: (n: AppNotification) => void
  compact?: boolean
}) {
  const sev = SEV[n.severity]
  const SevIcon = sev.icon
  const CatIcon = CATEGORY_ICON[n.category]

  return (
    <button
      type="button"
      onClick={() => onOpen(n)}
      className={cn(
        'group relative flex w-full items-start gap-2.5 border-b border-line-soft px-3.5 py-2.5 text-left transition-colors duration-120 last:border-0 hover:bg-surface-3',
        !n.read && 'bg-brand-wash/40',
        compact && 'py-2',
      )}
    >
      {!n.read && <span className="absolute left-1 top-3 size-1.5 rounded-full bg-brand" aria-hidden="true" />}

      <span
        className={cn(
          'mt-px flex size-[26px] shrink-0 items-center justify-center rounded-md border',
          sev.ring,
          sev.bg,
          sev.text,
        )}
      >
        <SevIcon className="size-3.5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-sm font-medium',
              n.read ? 'text-ink-soft' : 'text-ink',
            )}
          >
            {n.title}
          </span>
          <span className={cn('ml-auto shrink-0 text-xs text-ink-muted', n.read && 'opacity-70')}>
            {fmtRelative(n.at)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-muted">
          {n.body}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5">
          <Badge size="sm" tone="outline" className={cn(sev.ring, sev.bg, sev.text)}>
            {sev.label}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <CatIcon className="size-2.5" />
            {n.category}
          </span>
          {n.actor && <span className="truncate text-xs text-ink-muted">· {n.actor}</span>}
        </span>
      </span>
    </button>
  )
}

/** Bell trigger + popover list, used in the topbar. */
export function NotificationPanel({ compact = false }: { compact?: boolean }) {
  const { items, unreadCount, critical, loading, error, markRead, markAll } = useNotifications()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')

  const shown = tab === 'unread' ? items.filter((n) => !n.read) : items

  const open = (n: AppNotification) => {
    markRead(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-ink">Notifications</h2>
          {unreadCount > 0 && (
            <Badge size="sm" tone="brand">
              {unreadCount} new
            </Badge>
          )}
          {critical.length > 0 && (
            <Badge size="sm" tone="red">
              {critical.length} critical
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={markAll}
          disabled={unreadCount === 0}
          className="gap-1"
        >
          <CheckCheck /> Mark all read
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
        <TabsList className="px-3">
          <TabsTrigger value="all" className="px-2 text-sm">
            All <Badge size="sm" tone="outline" className="ml-1">{items.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="px-2 text-sm">
            Unread <Badge size="sm" tone="outline" className="ml-1">{unreadCount}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ScrollArea className="max-h-[420px] flex-1">
        {loading ? (
          <div className="space-y-2 p-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="size-[26px] animate-pulse rounded-md bg-surface-3" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-surface-3" />
                  <div className="h-2.5 w-full animate-pulse rounded bg-surface-3/70" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <FileWarning className="size-4 text-crit-ink" />
            <p className="text-sm text-ink-soft">Notifications unavailable</p>
            <p className="max-w-[240px] text-xs text-ink-muted">{error}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
            <Inbox className="size-4 text-ink-muted" />
            <p className="text-sm text-ink-soft">Nothing to review</p>
            <p className="text-xs text-ink-muted">
              {tab === 'unread' ? 'All notifications have been read.' : 'No notifications in the log.'}
            </p>
          </div>
        ) : (
          groupByDay(shown).map((group) => (
            <div key={group.label} data-day-group={group.label}>
              <p className="sticky top-0 z-[1] border-b border-line-soft bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-ink-muted">
                {group.label}
              </p>
              {group.items.map((n) => (
                <NotificationRow key={n.id} n={n} onOpen={open} compact={compact} />
              ))}
            </div>
          ))
        )}
      </ScrollArea>

      <div className="border-t border-line px-3.5 py-2">
        <p className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Dot className={cn('size-1.5', error ? 'bg-crit' : 'bg-ok')} />
          {error ? 'Notification service unreachable' : `Notification service healthy · ${unreadCount} unread`}
        </p>
      </div>
    </div>
  )
}

/** Standalone page route for the full notification centre. */
export function NotificationCenter() {
  const { items, markRead, markAll } = useNotifications()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'unread'>('all')
  const shown = tab === 'unread' ? items.filter((n) => !n.read) : items

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Notification Centre</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Safety alerts, assignment updates and compliance deadlines across the operator.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={markAll} className="gap-1.5">
          <CheckCheck /> Mark all read
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')} className="mt-5">
        <TabsList className="border-b border-line">
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({items.filter((n) => !n.read).length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        {groupByDay(shown).map((group) => (
          <div key={group.label} data-day-group={group.label}>
            <p className="border-b border-line-soft bg-surface-2/60 px-3.5 py-1.5 text-xs font-semibold text-ink-muted">
              {group.label}
            </p>
            {group.items.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={(x) => {
                  markRead(x.id)
                  if (x.link) navigate(x.link)
                }}
              />
            ))}
          </div>
        ))}
        {shown.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-14 text-center">
            <Inbox className="size-4 text-ink-muted" />
            <p className="text-sm text-ink-soft">Nothing to review</p>
          </div>
        )}
      </div>
    </div>
  )
}
