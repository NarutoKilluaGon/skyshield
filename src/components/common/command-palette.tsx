import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCheck,
  ClipboardCheck,
  FileSearch,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { getAllIncidents } from '@/services/incidents'
import { getCAPAs, getRCAs } from '@/services/operations'
import { useTheme } from '@/hooks/use-theme'
import { CATEGORY_LABEL } from '@/lib/domain'
import { userName } from '@/data/users'
import type { CAPA, Incident, RCA } from '@/types'

type ItemKind = 'action' | 'page' | 'incident' | 'capa' | 'rca'

interface PaletteItem {
  id: string
  kind: ItemKind
  label: string
  detail?: string
  icon: typeof Search
  run: () => void
}

const KIND_LABEL: Record<ItemKind, string> = {
  action: 'Actions',
  page: 'Pages',
  incident: 'Incidents',
  capa: 'Corrective actions',
  rca: 'Analyses',
}

/**
 * ⌘K / Ctrl-K command palette (master 4.8): actions, pages and live entities
 * (incidents, CAPAs, analyses) in one keyboard-first surface. Built on the
 * repo's Radix Dialog — no new dependencies.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onMarkAllNotificationsRead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMarkAllNotificationsRead?: () => void
}) {
  const navigate = useNavigate()
  const { resolved, setChoice } = useTheme()
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [rcas, setRcas] = useState<RCA[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)

  // Lazy-load the entity indexes the first time the palette opens.
  useEffect(() => {
    if (!open || loaded.current) return
    loaded.current = true
    getAllIncidents().then(setIncidents)
    getCAPAs().then(setCapas)
    getRCAs().then(setRcas)
  }, [open])

  // Global hotkey — the palette owns ⌘K / Ctrl-K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onOpenChange])

  useEffect(() => {
    if (open) {
      setQ('')
      setCursor(0)
    }
  }, [open])

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  const items = useMemo<PaletteItem[]>(() => {
    const term = q.trim().toLowerCase()
    const actions: PaletteItem[] = [
      {
        id: 'act-report',
        kind: 'action',
        label: 'Report an incident',
        detail: 'Quick report or guided wizard',
        icon: Plus,
        run: () => go('/incidents/report'),
      },
      {
        id: 'act-theme',
        kind: 'action',
        label: resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme',
        icon: resolved === 'dark' ? Sun : Moon,
        run: () => {
          setChoice(resolved === 'dark' ? 'light' : 'dark')
          onOpenChange(false)
        },
      },
      {
        id: 'act-mark-read',
        kind: 'action',
        label: 'Mark all notifications read',
        icon: CheckCheck,
        run: () => {
          onMarkAllNotificationsRead?.()
          onOpenChange(false)
        },
      },
    ]
    const pages: PaletteItem[] = [
      { id: 'pg-dashboard', kind: 'page', label: 'Dashboard', icon: LayoutDashboard, run: () => go('/dashboard') },
      { id: 'pg-incidents', kind: 'page', label: 'Incident register', icon: FileSearch, run: () => go('/incidents') },
      { id: 'pg-investigations', kind: 'page', label: 'Investigations', icon: Users, run: () => go('/investigations') },
      { id: 'pg-actions', kind: 'page', label: 'Actions / CAPA', icon: ClipboardCheck, run: () => go('/actions') },
      { id: 'pg-analytics', kind: 'page', label: 'Analytics', icon: BarChart3, run: () => go('/reports?tab=analytics') },
      { id: 'pg-matrix', kind: 'page', label: 'Risk matrix', icon: Gauge, run: () => go('/reports?tab=risk-matrix') },
      { id: 'pg-compliance', kind: 'page', label: 'Compliance', icon: ClipboardCheck, run: () => go('/reports?tab=compliance') },
      { id: 'pg-whys', kind: 'page', label: '5 Whys analyses', icon: GitBranch, run: () => go('/rca/five-whys') },
      { id: 'pg-notifications', kind: 'page', label: 'Notification centre', icon: Bell, run: () => go('/notifications') },
      { id: 'pg-settings', kind: 'page', label: 'Settings', icon: Settings, run: () => go('/settings') },
    ]

    if (!term) return [...actions, ...pages]

    const entityHits: PaletteItem[] = [
      ...incidents
        .filter((i) =>
          [i.ref, i.title, i.flight?.flightNumber ?? '', i.location.iata, CATEGORY_LABEL[i.category]]
            .join(' ')
            .toLowerCase()
            .includes(term),
        )
        .slice(0, 6)
        .map((i) => ({
          id: `inc-${i.id}`,
          kind: 'incident' as const,
          label: i.ref,
          detail: `${i.title.slice(0, 52)} · ${i.location.iata}`,
          icon: FileSearch,
          run: () => go(`/incidents/${i.id}`),
        })),
      ...capas
        .filter((c) => [c.ref, c.title, userName(c.ownerId)].join(' ').toLowerCase().includes(term))
        .slice(0, 4)
        .map((c) => ({
          id: `capa-${c.id}`,
          kind: 'capa' as const,
          label: c.ref,
          detail: c.title.slice(0, 52),
          icon: ClipboardCheck,
          run: () => go('/actions'),
        })),
      ...rcas
        .filter((r) => [r.title, r.id].join(' ').toLowerCase().includes(term))
        .slice(0, 4)
        .map((r) => ({
          id: `rca-${r.id}`,
          kind: 'rca' as const,
          label: r.title.slice(0, 52),
          detail: `Analysis · ${r.status.replace('_', ' ')}`,
          icon: GitBranch,
          run: () => go(`/rca/${r.incidentId}`),
        })),
    ]

    return [
      ...actions.filter((a) => a.label.toLowerCase().includes(term)),
      ...pages.filter((p) => p.label.toLowerCase().includes(term)),
      ...entityHits,
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, incidents, capas, rcas, resolved])

  useEffect(() => setCursor(0), [q])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[cursor]?.run()
    }
  }

  // Group in display order for headings.
  const groups = useMemo(() => {
    const out: { kind: ItemKind; items: PaletteItem[] }[] = []
    for (const it of items) {
      const last = out[out.length - 1]
      if (last && last.kind === it.kind) last.items.push(it)
      else out.push({ kind: it.kind, items: [it] })
    }
    return out
  }, [items])

  let flatIndex = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-command-palette
        aria-describedby={undefined}
        className="left-1/2 top-[14vh] w-[min(94vw,560px)] -translate-x-1/2 translate-y-0 rounded-panel p-0"
        onKeyDown={onKeyDown}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-ink-muted" />
          <input
            data-command-input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions, pages, incidents, CAPAs…"
            aria-label="Command palette search"
            className="h-12 w-full bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-muted sm:block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="no-scrollbar max-h-[52vh] overflow-y-auto p-1.5" role="listbox" aria-label="Command results">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-muted">
              Nothing matches “{q.trim()}”.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.kind} className="mb-1">
              <p className="px-2.5 pb-1 pt-2 text-xs font-semibold text-ink-muted">
                {KIND_LABEL[group.kind]}
              </p>
              {group.items.map((item) => {
                flatIndex += 1
                const idx = flatIndex
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={idx === cursor}
                    data-command-item={item.id}
                    onClick={item.run}
                    onMouseMove={() => setCursor(idx)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-100',
                      idx === cursor ? 'bg-surface-3' : 'hover:bg-surface-2',
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
                      {item.detail && (
                        <span className="block truncate text-xs text-ink-muted">{item.detail}</span>
                      )}
                    </span>
                    {idx === cursor && <ArrowRight className="size-3.5 shrink-0 text-ink-faint" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-muted">
          <span className="font-mono">↑↓ navigate · ⏎ open · esc close</span>
          <span className="tnum" aria-live="polite">
            {items.length} results
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
