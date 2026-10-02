import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock,
  FileSearch,
  Search,
} from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { RCAWorkflow } from '@/components/dashboard/rca-workflow'
import { Card } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator, Skeleton, Tip } from '@/components/ui/primitives'
import { Avatar } from '@/components/common/avatar'
import { RiskBadge, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { getInvestigations } from '@/services/operations'
import { getAllIncidents } from '@/services/incidents'
import { INVESTIGATION_STAGES } from '@/lib/domain'
import { daysUntil, fmtDate, fmtDateLong } from '@/lib/format'
import { aircraftById } from '@/data/aircraft'
import { userById, userName } from '@/data/users'
import type { Incident, Investigation } from '@/types'

export default function ActiveInvestigationsPage() {
  const navigate = useNavigate()
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [stage, setStage] = useState('all')
  const [view, setView] = useState<'card' | 'workflow'>('card')

  useEffect(() => {
    Promise.all([getInvestigations(), getAllIncidents()])
      .then(([i, inc]) => {
        setInvestigations(i)
        setIncidents(inc)
      })
      .finally(() => setLoading(false))
  }, [])

  const byId = useMemo(() => new Map(incidents.map((i) => [i.id, i])), [incidents])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return investigations
      .filter((i) => i.stage !== 'closed')
      .filter((i) => (stage === 'all' ? true : i.stage === stage))
      .filter((i) => {
        if (!term) return true
        const inc = byId.get(i.incidentId)
        return [
          i.name,
          i.stage,
          userName(i.leadInvestigatorId),
          inc?.ref ?? '',
          inc?.title ?? '',
          aircraftById(inc?.aircraftId)?.registration ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  }, [investigations, byId, q, stage])

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const i of investigations) if (i.stage !== 'closed') c[i.stage] = (c[i.stage] ?? 0) + 1
    return c
  }, [investigations])

  const overdue = rows.filter((r) => (daysUntil(r.dueAt) ?? 0) < 0).length

  return (
    <div className="space-y-4">
      <PageHeader
        title="Active Investigations"
        subtitle="Every open investigation, its position in the eight-stage SMS workflow and its closure target."
        meta={
          <>
            <Badge size="md" tone="brand">
              <Dot className="bg-brand" /> {rows.length} open
            </Badge>
            {overdue > 0 && (
              <Badge size="md" tone="red">
                <Clock className="size-3" /> {overdue} past target
              </Badge>
            )}
            <Badge size="md" tone="neutral">
              {investigations.filter((i) => i.stage === 'closed').length} closed
            </Badge>
          </>
        }
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border border-line bg-canvas-deep p-0.5">
              {(['card', 'workflow'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                    view === v ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:text-ink-soft',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="outline" className="gap-1.5">
              <CalendarDays className="size-3.5" /> Schedule
            </Button>
          </>
        }
      />

      {/* stage summary */}
      <Card className="p-3.5">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          <button
            type="button"
            onClick={() => setStage('all')}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
              stage === 'all'
                ? 'border-brand/45 bg-brand/12 text-brand'
                : 'border-line bg-surface-2/40 text-ink-muted hover:bg-surface-2',
            )}
          >
            All stages
            <span className="ml-1.5 tnum">{rows.length}</span>
          </button>
          {INVESTIGATION_STAGES.filter((s) => s.id !== 'closed').map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(stage === s.id ? 'all' : s.id)}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                stage === s.id
                  ? 'border-brand/45 bg-brand/12 text-brand'
                  : 'border-line bg-surface-2/40 text-ink-muted hover:bg-surface-2',
              )}
            >
              {s.label}
              {stageCounts[s.id] ? (
                <span className="ml-1.5 tnum">{stageCounts[s.id]}</span>
              ) : null}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search investigations, incidents, investigators…"
          icon={<Search />}
          className="w-full sm:max-w-sm"
          aria-label="Search investigations"
        />
        <p className="text-xs text-ink-muted">
          {loading ? 'Loading…' : `${rows.length} investigation${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <Search className="size-5 text-ink-muted" />
          <p className="text-base font-medium text-ink-soft">No investigations match</p>
          <p className="text-xs text-ink-muted">
            Clear the search term or stage filter to see the full investigation register.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {rows.map((inv) => {
            const inc = byId.get(inv.incidentId)
            const ac = inc ? aircraftById(inc.aircraftId) : undefined
            const lead = userById(inv.leadInvestigatorId)
            const days = daysUntil(inv.dueAt)
            const late = days !== null && days < 0
            const tone =
              inv.progress >= 85 ? 'var(--color-ok)' : inv.progress >= 50 ? 'var(--color-brand)' : 'var(--color-warn)'

            return (
              <Card
                key={inv.id}
                className="flex flex-col overflow-hidden transition-colors hover:border-line-strong"
              >
                <div className="flex items-start gap-2.5 border-b border-line-soft px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {inc && (
                        <button
                          type="button"
                          onClick={() => navigate(`/incidents/${inc.id}`)}
                          className="rounded font-mono text-xs font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
                        >
                          {inc.ref}
                        </button>
                      )}
                      <StatusBadge status={inc?.status ?? 'investigation'} size="sm" />
                      {inc && <SeverityBadge severity={inc.risk.severity} size="sm" />}
                      {inc && <RiskBadge score={inc.risk.score} size="sm" showBand={false} />}
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-ink">{inv.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {inc ? (
                        <>
                          {ac?.registration} · {ac?.type} · {inc.location.iata} ·{' '}
                          {inc.flight?.flightNumber}
                        </>
                      ) : (
                        'Linked incident unavailable'
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-md font-semibold text-ink tnum">{inv.progress}%</p>
                    <p
                      className={cn(
                        'text-xs tnum',
                        late ? 'text-crit-ink' : (days ?? 0) <= 5 ? 'text-warn-ink' : 'text-ink-muted',
                      )}
                    >
                      {late ? `${Math.abs(days!)}d over` : `due in ${days}d`}
                    </p>
                  </div>
                </div>

                {view === 'workflow' && (
                  <div className="border-b border-line-soft bg-canvas-deep/40 px-3.5 py-3.5">
                    <RCAWorkflow stage={inv.stage} compact />
                  </div>
                )}

                <div className="px-3.5 py-3">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-canvas-deep"
                    role="progressbar"
                    aria-valuenow={inv.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${inv.name} progress`}
                  >
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${inv.progress}%`, background: `linear-gradient(90deg, ${alpha(tone, 60)}, ${tone})` }}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-2.5" /> Opened {fmtDate(inv.openedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-2.5" /> Target {fmtDateLong(inv.dueAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileSearch className="size-2.5" /> {inc?.evidenceCount ?? 0} evidence
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="size-2.5" /> {inv.findings.length} findings
                    </span>
                  </div>

                  {inv.openQuestions.length > 0 && (
                    <p className="mt-2.5 line-clamp-2 rounded-md border border-line-soft bg-surface-2/40 px-2.5 py-2 text-xs leading-relaxed text-ink-muted">
                      <span className="font-medium text-warn-ink">Open:</span>{' '}
                      {inv.openQuestions[0]}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="flex items-center gap-2 px-3.5 py-2.5">
                  <Tip label={`Lead investigator — ${lead?.title ?? ''}`}>
                    <span className="flex items-center gap-1.5">
                      <Avatar user={lead} size="xs" />
                      <span className="text-xs text-ink-soft">{lead?.name ?? 'Unassigned'}</span>
                    </span>
                  </Tip>
                  <div className="ml-auto flex items-center -space-x-1">
                    {inv.teamMemberIds.slice(0, 3).map((id) => (
                      <Avatar key={id} user={userById(id)} size="xs" className="ring-2 ring-surface" />
                    ))}
                    {inv.teamMemberIds.length > 3 && (
                      <span className="flex size-5 items-center justify-center rounded-full border border-line bg-surface-3 text-xs font-semibold text-ink-muted ring-2 ring-surface tnum">
                        +{inv.teamMemberIds.length - 3}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate(`/incidents/${inv.incidentId}`)}
                    className="gap-1 text-brand"
                  >
                    Open <ArrowUpRight className="size-3" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* stage reference */}
      <Card className="p-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <CircleDot className="size-3.5 text-ink-muted" />
          Investigation workflow reference
        </h3>
        <div
        className="mt-3 overflow-x-auto no-scrollbar"
        tabIndex={0}
        role="region"
        aria-label="Investigation timeline"
      >
          <div className="min-w-[720px]">
            <RCAWorkflow stage="initial_assessment" />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {INVESTIGATION_STAGES.map((s) => (
            <div key={s.id} className="rounded-md border border-line-soft bg-surface-2/40 px-2.5 py-2">
              <p className="text-xs font-medium text-ink-soft">{s.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-ink-muted">{s.hint}</p>
              <p className="mt-1 text-xs text-ink-muted tnum">
                {stageCounts[s.id] ?? 0} open
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}


