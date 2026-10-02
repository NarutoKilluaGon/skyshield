import { useState } from 'react'
import {
  Bell,
  Database,
  KeyRound,
  Palette,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { Card } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { Switch, Separator, Tip } from '@/components/ui/primitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { db, resetDemoData, STORE_KEY } from '@/services/store'
import { requestInvite } from '@/services/auth'
import { readPref, writePref, PREF_KEYS } from '@/lib/prefs'
import { Avatar } from '@/components/common/avatar'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth'
import { CURRENT_USER_ID, USERS, userById } from '@/data/users'
import { fmtDateTime, fmtRelative } from '@/lib/format'
import type { UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  safety_manager: 'Safety Manager',
  investigator: 'Investigator',
  safety_officer: 'Safety Officer',
  auditor: 'Auditor',
  admin: 'Administrator',
}

const NAV_TABS = [
  { value: 'profile', label: 'Profile', icon: UserRound },
  { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'access', label: 'Access & roles', icon: KeyRound },
  { value: 'system', label: 'System', icon: Database },
] as const

export default function SettingsPage() {
  const [tab, setTab] = useState<string>(
    () => new URLSearchParams(window.location.search).get('tab') ?? 'profile',
  )
  const [resetOpen, setResetOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invName, setInvName] = useState('')
  const [invEmail, setInvEmail] = useState('')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const { choice, setChoice } = useTheme()
  const { user: authUser } = useAuth()
  const me = authUser ?? userById(CURRENT_USER_ID)

  // The one real device preference: table density. Applied to <html> so the
  // CSS token layer can tighten every table at once; persisted via lib/prefs.
  const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
  const [compactTables, setCompactTables] = useState(() =>
    readPref(PREF_KEYS.uiCompactTables, false, isBool),
  )
  const setCompact = (v: boolean) => {
    setCompactTables(v)
    writePref(PREF_KEYS.uiCompactTables, v)
    document.documentElement.dataset.density = v ? 'compact' : 'comfortable'
  }

  // Second real preference: which representation record surfaces lead with.
  const isTimeMode = (v: unknown): v is 'utc' | 'local' => v === 'utc' || v === 'local'
  const [timeDisplay, setTimeDisplayState] = useState<'utc' | 'local'>(() =>
    readPref(PREF_KEYS.uiTimeMode, 'utc', isTimeMode),
  )
  const setTimeDisplay = (v: string) => {
    setTimeDisplayState(v as 'utc' | 'local')
    writePref(PREF_KEYS.uiTimeMode, v)
  }

  const [invitePending, setInvitePending] = useState(false)
  const sendInvite = async () => {
    if (!invName.trim() || !invEmail.trim() || invitePending) return
    setInvitePending(true)
    setInviteError(null)
    try {
      const token = await requestInvite(invEmail.trim(), invName.trim())
      setInviteLink(`${window.location.origin}/invite/${token}`)
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'The invite could not be created.')
    } finally {
      setInvitePending(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Changes apply immediately and persist on this device."
      />

      <div className="mt-6 flex flex-col gap-6 md:flex-row">
        <nav aria-label="Settings sections" className="w-full shrink-0 md:w-56">
          <ul className="space-y-0.5">
            {NAV_TABS.map((t) => (
              <li key={t.value}>
                <button
                  type="button"
                  onClick={() => setTab(t.value)}
                  aria-current={tab === t.value ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-120',
                    tab === t.value
                      ? 'bg-surface-3 text-ink'
                      : 'text-ink-soft hover:bg-surface-3 hover:text-ink',
                  )}
                >
                  <t.icon className="size-4" aria-hidden="true" />
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 flex-1">
        {/* ------------------------------------------------ profile */}
        {tab === 'profile' && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-1">
              <div className="flex flex-col items-center text-center">
                <Avatar user={me} size="xl" showStatus />
                <p className="mt-3 text-md font-semibold text-ink">Captain {me?.name}</p>
                <p className="text-sm text-ink-muted">{me?.title}</p>
                <Badge size="sm" tone="brand" className="mt-2">
                  {ROLE_LABEL[me?.role ?? 'safety_manager']}
                </Badge>
                <Separator className="my-4 w-full" />
                <dl className="w-full space-y-2 text-left text-sm">
                  {[
                    ['Email', me?.email],
                    ['Base', me?.base],
                    ['Licence', me?.licenseNumber],
                    ['Phone', me?.phone],
                    ['Last active', fmtRelative(me?.lastActiveAt)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-ink-muted">{k}</dt>
                      <dd className="truncate font-mono text-xs text-ink-soft">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>

            <Card className="p-4 lg:col-span-2">
              <h2 className="text-base font-semibold text-ink">Account details</h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                Identity fields are maintained by the platform administrator. Contact the SMS
                administrator to amend a licence number or base.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Full name">
                  <Input defaultValue={`Captain ${me?.name}`} />
                </Field>
                <Field label="Role">
                  <Input defaultValue={me?.title} readOnly className="text-ink-muted" />
                </Field>
                <Field label="Email">
                  <Input defaultValue={me?.email} type="email" />
                </Field>
                <Field label="Phone">
                  <Input defaultValue={me?.phone} />
                </Field>
                <Field label="Base">
                  <Input defaultValue={me?.base} />
                </Field>
                <Field label="Licence number">
                  <Input defaultValue={me?.licenseNumber} readOnly className="text-ink-muted" />
                </Field>
              </div>
              <Separator className="my-4" />
              <h3 className="text-sm font-semibold text-ink">Signature</h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Your e-signature is applied to incident submissions, investigation reports and CAPA
                closures.
              </p>
              <div className="mt-3 rounded-lg border border-dashed border-line-strong bg-canvas-deep/50 p-4">
                <p className="font-mono text-lg italic text-ink-soft">J. Miller</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Signed in as {me?.email} · {fmtDateTime(me?.lastActiveAt)}
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------------------------ preferences */}
        {tab === 'preferences' && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
                <Palette className="size-4 text-ink-muted" />
                Interface
              </h2>
              <div className="mt-4 space-y-3.5">
                <Field label="Theme" hint="Applies across the app and persists on this device.">
                  <Select value={choice} onValueChange={(v) => setChoice(v as 'light' | 'dark' | 'system')}>
                    <SelectTrigger aria-label="Theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Time display"
                  hint="Timestamps are stored in UTC. Choose what record surfaces lead with — the other representation stays in the tooltip. Applies on next page load."
                >
                  <Select value={timeDisplay} onValueChange={setTimeDisplay}>
                    <SelectTrigger aria-label="Time display">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="utc">UTC — 14:32Z</SelectItem>
                      <SelectItem value="local">Local time — with UTC tooltip</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Toggle
                  label="Compact table density"
                  hint="Reduce row height in data tables to show more records per screen. Applies immediately, on every table."
                  checked={compactTables}
                  onChange={setCompact}
                />
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
                <Settings2 className="size-3.5 text-ink-muted" />
                Regional
              </h2>
              <div className="mt-4 space-y-3.5">
                <Field label="Date format">
                  <Input value="DD/MM/YYYY" readOnly className="text-ink-muted" />
                </Field>
                <Field
                  label="Time zone"
                  hint="All timestamps are stored and displayed in UTC. Local-time display and per-user landing pages arrive with backend account profiles."
                >
                  <Input value="UTC — Coordinated Universal Time" readOnly className="text-ink-muted" />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {/* ------------------------------------------------ notifications */}
        {tab === 'notifications' && (
          <Card className="max-w-2xl p-4">
            <h2 className="text-base font-semibold text-ink">Notification routing</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Every kind below is delivered in-app; safety-critical alerts can never be suppressed.
              Email routing becomes configurable once notification preferences live on the backend
              account profile.
            </p>
            <div className="mt-4 space-y-3.5">
              {(
                [
                  ['criticalIncident', 'Critical incident reported', 'Never suppressed. In-app and email.', true],
                  ['capaDeadline', 'CAPA deadline approaching', 'Sent 72 hours before the committed date.', false],
                  ['capaOverdue', 'CAPA overdue', 'Sent daily until the action is rescheduled.', false],
                  ['rcaOverdue', 'RCA overdue', 'Sent when the analysis passes its target date.', false],
                  ['investigationAssigned', 'Investigation assigned to me', 'Includes team membership changes.', false],
                  ['complianceReview', 'Compliance review due', 'Sent 30 days before the next review date.', false],
                  ['weeklyDigest', 'Weekly safety digest', 'Monday 06:00 local — summary of the prior week.', false],
                ] as const
              ).map(([key, label, hint, locked]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-ink-soft">
                      {label}
                      {locked && (
                        <Tip label="Safety-critical alerts cannot be disabled">
                          <ShieldCheck className="size-3 text-ok" />
                        </Tip>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{hint}</p>
                  </div>
                  <span
                    className={
                      locked
                        ? 'flex shrink-0 items-center gap-1 rounded-badge bg-ok-wash px-2 py-0.5 text-xs font-medium text-ok-ink'
                        : 'flex shrink-0 items-center rounded-badge bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-muted'
                    }
                  >
                    {locked ? 'Always on' : 'In-app'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ------------------------------------------------ access */}
        {tab === 'access' && (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Users and roles</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Role assignment is controlled by the platform administrator and audited on every
                  change.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                data-invite-user
                onClick={() => {
                  setInvName('')
                  setInvEmail('')
                  setInviteLink(null)
                  setInviteOpen(true)
                }}
              >
                Invite user
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {['User', 'Role', 'Base', 'Last active', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-xs font-semibold text-ink-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {USERS.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2/70"
                    >
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <Avatar user={u} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-ink-soft">{u.name}</span>
                            <span className="block truncate text-xs text-ink-muted">{u.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge size="sm" tone={u.role === 'admin' ? 'red' : u.role === 'auditor' ? 'amber' : 'brand'}>
                          {ROLE_LABEL[u.role]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-sm text-ink-muted">{u.base}</td>
                      <td className="px-3 py-2.5 text-sm text-ink-muted tnum">
                        {fmtRelative(u.lastActiveAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge size="sm" tone={u.active ? 'green' : 'neutral'}>
                          <Dot className={u.active ? 'bg-ok' : 'bg-ink-faint'} />
                          {u.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ------------------------------------------------ system */}
        {tab === 'system' && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
                  <Database className="size-4 text-ink-muted" />
                  Platform services
                </h2>
                <Badge size="sm" tone="green">
                  <Dot className="bg-ok" />
                  Operational
                </Badge>
              </div>
              <ul className="mt-4 space-y-2">
                {[
                  ['API gateway', '99.98%', '18 ms'],
                  ['Relational database', '99.99%', '4 ms'],
                  ['Reporting warehouse', '99.95%', '—'],
                  ['Evidence object store', '100%', '42 ms'],
                  ['Notification dispatcher', '99.9%', '210 ms'],
                ].map(([name, up, lat]) => (
                  <li
                    key={name}
                    className="flex items-center gap-2.5 rounded-md border border-line-soft bg-surface-2/40 px-2.5 py-2"
                  >
                    <Dot className="bg-ok" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{name}</span>
                    <span className="text-xs text-ink-muted tnum">{up}</span>
                    <span className="w-14 text-right font-mono text-xs text-ink-muted">{lat}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4">
              <h2 className="text-base font-semibold text-ink">Environment</h2>
              <dl className="mt-4 space-y-2 text-sm">
                {(
                  [
                    ['Platform', 'SkyShield SMS v2.4.1'],
                    ['API endpoint', '/api/v1'],
                    ['Database', 'PostgreSQL 15.4'],
                    ['Cache', 'Redis 7.2'],
                    ['Data residency', 'India — ap-south-1'],
                    ['Last deploy', '2026-09-24T06:00:00Z'],
                    ['Retention policy', '7 years (CAR 5.12)'],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-ink-muted">{k}</dt>
                    <dd className="truncate text-right font-mono text-xs text-ink-soft">{v}</dd>
                  </div>
                ))}
              </dl>
              <Separator className="my-4" />
              <p className="text-xs leading-relaxed text-ink-muted">
                This frontend runs against a mock service layer. Set{' '}
                <code className="rounded border border-line bg-canvas-deep px-1 font-mono text-xs">
                  VITE_API_BASE_URL
                </code>{' '}
                and{' '}
                <code className="rounded border border-line bg-canvas-deep px-1 font-mono text-xs">
                  VITE_USE_MOCK=false
                </code>{' '}
                to point at the Django REST backend.
              </p>
            </Card>

            {/* demo data — the persisted store (S11) */}
            <Card className="p-4 lg:col-span-2" data-demo-data>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
                    <Database className="size-4 text-ink-muted" />
                    Demo data
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
                    This demo persists to{' '}
                    <code className="rounded border border-line bg-canvas-deep px-1 font-mono text-xs">
                      {STORE_KEY}
                    </code>
                    : filed reports, RCA edits, completed actions and read notifications survive a
                    reload. Seed dates are rebased to today (shifted {db.offsetDays} day
                    {db.offsetDays === 1 ? '' : 's'}) — currently {db.incidents.length} incidents,{' '}
                    {db.capas.length} actions and {db.rcas.length} analyses. Resetting restores the
                    pristine seed.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                  data-reset-demo
                  onClick={() => setResetOpen(true)}
                >
                  Reset demo data
                </Button>
              </div>
            </Card>
          </div>
        )}

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Invite a team member</DialogTitle>
              <DialogDescription>
                Creates an invite link for this demo organisation. Opening the link lets the invitee
                set a password and create their account.
              </DialogDescription>
            </DialogHeader>
            {inviteLink ? (
              <div className="space-y-3 px-5 pb-5">
                <p className="text-xs text-ink-muted">Share this link with the invitee:</p>
                <Input readOnly value={inviteLink} className="font-mono text-xs" aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setInviteOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3 px-5 pb-1">
                  {inviteError && (
                    <div
                      role="alert"
                      className="rounded-md border border-crit/30 bg-crit-wash px-3 py-2 text-sm text-crit-ink"
                    >
                      {inviteError}
                    </div>
                  )}
                  <Field label="Full name">
                    <Input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="e.g. S. Banerjee" aria-label="Invitee name" />
                  </Field>
                  <Field label="Work email">
                    <Input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} placeholder="name@operator.aero" aria-label="Invitee email" />
                  </Field>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void sendInvite()} disabled={!invName.trim() || !invEmail.trim() || invitePending}>
                    {invitePending ? 'Creating…' : 'Create invite link'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Reset demo data?</DialogTitle>
              <DialogDescription>
                Everything filed or edited in this browser — reports, RCA changes, action
                completions, read states — is discarded and the seed register is restored with
                dates rebased to today. The page reloads afterwards.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  resetDemoData()
                  window.location.reload()
                }}
              >
                Reset and reload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', checked ? 'text-ink-soft' : 'text-ink-muted')}>
          {label}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}
