import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bell,
  ClipboardCheck,
  Command,
  CornerDownLeft,
  GitBranch,
  Globe,
  HelpCircle,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Search,
  Siren,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationPanel, useNotifications } from './notification-panel'
import { Avatar } from '@/components/common/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth'
import { getAllIncidents } from '@/services/incidents'
import { getCAPAs, getRCAs } from '@/services/operations'
import { CATEGORY_LABEL } from '@/lib/domain'
import { fmtDate } from '@/lib/format'
import { aircraftById } from '@/data/aircraft'
import type { CAPA, Incident, RCA } from '@/types'

const ROLE_LABEL: Record<string, string> = {
  safety_manager: 'Safety Manager',
  investigator: 'Investigator',
  safety_officer: 'Safety Officer',
  auditor: 'Auditor',
  admin: 'Administrator',
}

/* -------------------------------------------------------------- search */

interface Hit {
  group: string
  id: string
  label: string
  meta: string
  to: string
  icon: typeof Siren
}

function GlobalSearch({ onNavigate, className }: { onNavigate?: () => void; className?: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [rcas, setRcas] = useState<RCA[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    getAllIncidents().then(setIncidents)
    getCAPAs().then(setCapas)
    getRCAs().then(setRcas)
  }, [])

  useEffect(() => {
    // ⌘K / Ctrl-K belongs to the command palette (AppShell); this inline
    // search only needs Escape to dismiss its dropdown.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase()
    if (term.length < 2) return []

    const inc: Hit[] = incidents
      .filter((i) =>
        [i.ref, i.title, i.flight?.flightNumber ?? '', i.location.iata, CATEGORY_LABEL[i.category]]
          .join(' ')
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 5)
      .map((i) => ({
        group: 'Incidents',
        id: i.id,
        label: `${i.ref} — ${i.title}`,
        meta: `${fmtDate(i.occurredAt)} · ${aircraftById(i.aircraftId)?.registration ?? ''} · ${i.location.iata}`,
        to: `/incidents/${i.id}`,
        icon: Siren,
      }))

    const cap: Hit[] = capas
      .filter((c) => [c.ref, c.title].join(' ').toLowerCase().includes(term))
      .slice(0, 3)
      .map((c) => ({
        group: 'CAPA',
        id: c.id,
        label: `${c.ref} — ${c.title}`,
        meta: c.status.replace('_', ' '),
        to: '/capa',
        icon: ClipboardCheck,
      }))

    const rc: Hit[] = rcas
      .filter((r) => [r.title, r.id].join(' ').toLowerCase().includes(term))
      .slice(0, 3)
      .map((r) => ({
        group: 'RCA',
        id: r.id,
        label: r.title,
        meta: r.status.replace('_', ' '),
        to: `/rca/${r.incidentId}`,
        icon: GitBranch,
      }))

    return [...inc, ...cap, ...rc]
  }, [q, incidents, capas, rcas])

  useEffect(() => setCursor(0), [q])

  const go = (h: Hit) => {
    navigate(h.to)
    setQ('')
    setOpen(false)
    onNavigate?.()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hits.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (c + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (c - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(hits[cursor])
    }
  }

  const groups = [...new Set(hits.map((h) => h.group))]

  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Search incidents, aircraft, CAPA…"
        aria-label="Global search"
        role="combobox"
        aria-expanded={open && hits.length > 0}
        className="h-8 border-line bg-canvas-deep pl-8 pr-14"
        suffix={
          <kbd className="flex items-center gap-0.5 rounded border border-line bg-surface-2 px-1 font-mono text-xs text-ink-muted">
            <Command className="size-2.5" />K
          </kbd>
        }
      />

      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-line-strong bg-surface-2 pop-shadow animate-fade-in">
          {hits.length === 0 ? (
            <p className="px-3.5 py-4 text-center text-sm text-ink-muted">
              No matches for “{q}”. Try an incident ID, flight number or airport code.
            </p>
          ) : (
            <div className="max-h-[340px] overflow-y-auto py-1">
              {groups.map((g) => (
                <div key={g}>
                  <p className="px-2.5 pb-1 pt-1.5 text-xs font-semibold text-ink-muted">
                    {g}
                  </p>
                  {hits.map((h, i) =>
                    h.group === g ? (
                      <button
                        key={h.id}
                        type="button"
                        onMouseEnter={() => setCursor(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(h)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors',
                          i === cursor ? 'bg-surface-3' : 'hover:bg-surface-3/60',
                        )}
                      >
                        <h.icon
                          className={cn('size-3.5 shrink-0', i === cursor ? 'text-brand' : 'text-ink-muted')}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-ink-soft">{h.label}</span>
                          <span className="block truncate text-xs text-ink-muted">{h.meta}</span>
                        </span>
                        {i === cursor && <CornerDownLeft className="size-3 shrink-0 text-ink-muted" />}
                      </button>
                    ) : null,
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------- topbar */

export function Topbar({
  onOpenMobileNav,
  onOpenCommand,
  className,
}: {
  onOpenMobileNav: () => void
  onOpenCommand?: () => void
  className?: string
}) {
  const { unreadCount, critical } = useNotifications()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { choice, setChoice, resolved } = useTheme()
  const ThemeIcon = resolved === 'dark' ? Moon : resolved === 'light' ? Sun : Monitor

  const handleSignOut = () => {
    signOut()
    window.location.href = '/'
  }

  return (
    <header
      className={cn(
        'flex h-12 shrink-0 items-center gap-2 border-b border-line bg-canvas px-3 md:px-4',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenMobileNav}
        className="lg:hidden"
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <GlobalSearch className="hidden w-[228px] md:block xl:w-[290px]" />

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpenCommand}
          className="md:hidden"
          aria-label="Search"
        >
          <Search />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Theme, currently ${choice}`}
            >
              <ThemeIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setChoice('light')}>
              <Sun /> Light{choice === 'light' ? ' ✓' : ''}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setChoice('dark')}>
              <Moon /> Dark{choice === 'dark' ? ' ✓' : ''}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setChoice('system')}>
              <Monitor /> System{choice === 'system' ? ' ✓' : ''}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="relative"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell />
              {unreadCount > 0 && (
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-xs font-semibold tnum ring-2 ring-canvas',
                    critical.length > 0 ? 'bg-crit text-white' : 'bg-brand text-on-brand',
                  )}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] p-0">
            <NotificationPanel compact />
          </PopoverContent>
        </Popover>

        <div className="mx-0.5 hidden h-5 w-px bg-line sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md p-1 pr-1.5 transition-colors duration-120 hover:bg-surface-3 focus-visible:outline-none"
              aria-label="User menu"
            >
              <Avatar user={user ?? undefined} size="md" showStatus />
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-[112px] truncate text-sm font-medium text-ink">
                  {user?.name ?? 'J. Miller'}
                </span>
                <span className="block max-w-[112px] truncate text-xs text-ink-muted">
                  {ROLE_LABEL[user?.role ?? ''] ?? user?.title}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[212px]">
            <DropdownMenuLabel>Signed in as {user?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">
                <Globe /> Back to website
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/settings?tab=profile')}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/settings?tab=preferences')}>
              Preferences
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="mailto:support@skyshield.aero?subject=SkyShield%20Support">
                <HelpCircle /> Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleSignOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

export { GlobalSearch, ROLE_LABEL }
