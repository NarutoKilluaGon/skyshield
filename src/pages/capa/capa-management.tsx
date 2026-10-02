import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Paperclip,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { ChartCard } from '@/components/charts/chart-card'
import { ChartLegend } from '@/components/charts/chart-legend'
import { FilterBar, MultiSelectFilter, SearchBar } from '@/components/data/filters'
import { Pagination } from '@/components/data/data-table'
import { CapaStatusBadge, PriorityBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/input'
import { Progress, Separator, Skeleton, Tip } from '@/components/ui/primitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getCAPAs, getCapaSlaSeries, updateCAPA, uploadCapaAttachment } from '@/services/operations'
import { downloadCsv } from '@/services/incidents'
import { CAPA_PRIORITY, CAPA_STATUS, CAPA_STATUS_ORDER } from '@/lib/domain'
import { daysUntil, fmtDate, fmtDaysUntil } from '@/lib/format'
import { can } from '@/lib/permissions'
import { useAuth } from '@/lib/auth'
import { userById, userName } from '@/data/users'
import { storeIncidentById } from '@/services/store'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CAPA, CapaStatus, DashboardMetrics } from '@/types'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_X_BASELINE,
} from '@/components/charts/chart-theme'

const STATUS_COLOR: Record<CapaStatus, string> = {
  open: 'var(--color-brand)',
  in_progress: 'var(--color-brand)',
  due_soon: 'var(--color-warn)',
  overdue: 'var(--color-crit)',
  completed: 'var(--color-ok)',
  verified: 'var(--color-ok)',
}

const CLOSED: CapaStatus[] = ['completed', 'verified']
const OPEN_STATES: CapaStatus[] = ['open', 'in_progress', 'due_soon', 'overdue']

export default function CAPAManagementPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [capas, setCapas] = useState<CAPA[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<CapaStatus[]>([])
  const [priority, setPriority] = useState<string[]>([])
  const [sla, setSla] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)

  // complete-with-evidence dialog
  const [completeTarget, setCompleteTarget] = useState<CAPA | null>(null)
  const [evidence, setEvidence] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  // M6: the SLA chart series is computed server-side in network mode.
  const [slaSeries, setSlaSeries] = useState<DashboardMetrics['capaSlaSeries']>([])

  useEffect(() => {
    getCAPAs()
      .then(setCapas)
      .finally(() => setLoading(false))
    void getCapaSlaSeries().then(setSlaSeries)
  }, [])

  const isOverdue = (c: CAPA) => (daysUntil(c.dueDate) ?? 0) < 0 && !CLOSED.includes(c.status)
  const isDueWeek = (c: CAPA) => {
    const d = daysUntil(c.dueDate) ?? 99
    return d >= 0 && d <= 7 && !CLOSED.includes(c.status)
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return capas
      .filter((c) => (status.length ? status.includes(c.status) : true))
      .filter((c) => (priority.length ? priority.includes(c.priority) : true))
      .filter((c) => {
        if (sla === 'overdue') return isOverdue(c)
        if (sla === 'week') return isDueWeek(c)
        if (sla === 'open') return !CLOSED.includes(c.status)
        return true
      })
      .filter((c) => {
        if (!term) return true
        const inc = storeIncidentById(c.incidentId)
        return [c.ref, c.title, c.description, c.linkedFinding, userName(c.ownerId), inc?.ref ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [capas, q, status, priority, sla])

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  const counts = useMemo(() => {
    const c: Record<CapaStatus, number> = {
      open: 0,
      in_progress: 0,
      due_soon: 0,
      overdue: 0,
      completed: 0,
      verified: 0,
    }
    for (const x of capas) c[x.status]++
    return c
  }, [capas])

  const overdueN = useMemo(() => capas.filter(isOverdue).length, [capas])
  const dueWeekN = useMemo(() => capas.filter(isDueWeek).length, [capas])
  const overdueDays = useMemo(
    () => capas.filter(isOverdue).reduce((a, c) => a + Math.abs(daysUntil(c.dueDate) ?? 0), 0),
    [capas],
  )

  const pie = useMemo(
    () =>
      CAPA_STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => ({
        name: CAPA_STATUS[s].label,
        value: counts[s],
        color: STATUS_COLOR[s],
      })),
    [counts],
  )

  const activeFilterCount =
    (q ? 1 : 0) + (status.length ? 1 : 0) + (priority.length ? 1 : 0) + (sla !== 'all' ? 1 : 0)

  const exportRows = () => {
    const csv = [
      [
        'CAPA ID',
        'Incident',
        'Action',
        'Type',
        'Owner',
        'Priority',
        'Due Date',
        'SLA',
        'Status',
        'Progress',
      ].join(','),
      ...filtered.map((c) =>
        [
          c.ref,
          storeIncidentById(c.incidentId)?.ref ?? '',
          `"${c.title.replace(/"/g, '""')}"`,
          c.type,
          userName(c.ownerId),
          c.priority,
          c.dueDate.slice(0, 10),
          String(daysUntil(c.dueDate) ?? ''),
          c.status,
          `${c.progress}%`,
        ].join(','),
      ),
    ].join('\n')
    downloadCsv('skyshield-capa-register.csv', csv)
  }

  /* ------------------------------------------------- complete / verify */

  const openComplete = (c: CAPA) => {
    setCompleteTarget(c)
    setEvidence('')
    setEvidenceFiles([])
  }

  const confirmComplete = async () => {
    if (!completeTarget || evidence.trim().length < 10) return
    setBusyId(completeTarget.id)
    try {
      let updated = await updateCAPA(completeTarget.id, {
        status: 'completed',
        progress: 100,
        completedAt: new Date().toISOString(),
        effectivenessCheck: 'pending',
        completionEvidence: evidence.trim(),
      })
      // M4: attached proof files become real, hash-registered uploads.
      for (const file of evidenceFiles) {
        updated = await uploadCapaAttachment(completeTarget.id, file, user?.id ?? 'usr_001')
      }
      setCapas((prev) => prev.map((c) => (c.id === updated.id ? { ...updated } : c)))
      setCompleteTarget(null)
    } finally {
      setBusyId(null)
    }
  }

  const verify = async (c: CAPA) => {
    setBusyId(c.id)
    try {
      const updated = await updateCAPA(c.id, {
        status: 'verified',
        progress: 100,
        verifiedAt: new Date().toISOString(),
        effectivenessCheck: 'passed',
      })
      setCapas((prev) => prev.map((x) => (x.id === updated.id ? { ...updated } : x)))
    } finally {
      setBusyId(null)
    }
  }

  const rowActions = (c: CAPA) => {
    if (OPEN_STATES.includes(c.status) && can(user, 'capa.edit'))
      return (
        <Button
          variant="secondary"
          size="xs"
          data-mark-complete={c.id}
          onClick={() => openComplete(c)}
          className="gap-1 whitespace-nowrap"
        >
          <CheckCircle2 className="size-3" /> Mark complete
        </Button>
      )
    if (c.status === 'completed' && can(user, 'capa.verify'))
      return (
        <Tip label="Confirm the effectiveness check passed and seal the action">
          <Button
            size="xs"
            data-verify={c.id}
            disabled={busyId === c.id}
            onClick={() => verify(c)}
            className="gap-1 whitespace-nowrap bg-ok text-white hover:bg-ok/85"
          >
            {busyId === c.id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <ShieldCheck className="size-3" />
            )}
            Verify
          </Button>
        </Tip>
      )
    if (c.status === 'verified')
      return (
        <span className="flex items-center gap-1 whitespace-nowrap text-xs text-ok-ink">
          <CheckCircle2 className="size-3" />
          {c.verifiedAt ? fmtDate(c.verifiedAt) : 'Verified'}
        </span>
      )
    return null
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="CAPA Management"
        subtitle="Corrective and preventive actions raised from investigation findings, tracked to a documented effectiveness check."
        actions={
          <Button variant="outline" onClick={exportRows} className="gap-1.5">
            <Download className="size-3.5" /> Export
          </Button>
        }
      />

      {/* summary line — every figure computed from the register */}
      <Card
        className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2.5 text-sm text-ink-soft"
        data-capa-summary
      >
        <span className="font-medium text-ink tnum">{capas.length}</span> actions in the register —
        <span className="tnum">{counts.open}</span> open,
        <span className="tnum">{counts.in_progress}</span> in progress,
        <button
          type="button"
          onClick={() => {
            setSla(sla === 'overdue' ? 'all' : 'overdue')
            setPage(1)
          }}
          className={cn(
            'rounded-badge px-1.5 py-0.5 font-medium tnum transition-colors',
            overdueN > 0
              ? 'bg-crit-wash text-crit-ink hover:bg-crit/20'
              : 'bg-surface-3 text-ink-muted',
            sla === 'overdue' && 'ring-1 ring-crit/50',
          )}
        >
          {overdueN} overdue
          {overdueN === 1 && overdueDays > 0
            ? ` by ${overdueDays} day${overdueDays === 1 ? '' : 's'}`
            : overdueN > 1 && overdueDays > 0
              ? ` by ${overdueDays} days combined`
              : ''}
        </button>
        ,
        <button
          type="button"
          onClick={() => {
            setSla(sla === 'week' ? 'all' : 'week')
            setPage(1)
          }}
          className={cn(
            'rounded-badge px-1.5 py-0.5 font-medium tnum transition-colors',
            dueWeekN > 0
              ? 'bg-warn-wash text-warn-ink hover:bg-warn/20'
              : 'bg-surface-3 text-ink-muted',
            sla === 'week' && 'ring-1 ring-warn/50',
          )}
        >
          {dueWeekN} due within 7 days
        </button>
        , <span className="tnum">{counts.completed}</span> completed awaiting verification and
        <span className="tnum">{counts.verified}</span> verified.
      </Card>

      {/* ---------------- table first ---------------- */}
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <FilterBar
          activeCount={activeFilterCount}
          onClear={() => {
            setQ('')
            setStatus([])
            setPriority([])
            setSla('all')
            setPage(1)
          }}
          right={
            <span className="text-xs text-ink-muted">
              {loading ? 'Loading…' : `${filtered.length} actions`}
            </span>
          }
        >
          <SearchBar
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            placeholder="Search CAPA ID, action, owner or linked finding…"
            className="w-full min-w-[220px] sm:w-[300px]"
          />
          <MultiSelectFilter
            label="Status"
            options={CAPA_STATUS_ORDER.map((s) => ({
              value: s,
              label: CAPA_STATUS[s].label,
              hint: String(counts[s]),
            }))}
            selected={status}
            onChange={(v) => {
              setStatus(v as CapaStatus[])
              setPage(1)
            }}
          />
          <MultiSelectFilter
            label="Priority"
            options={Object.keys(CAPA_PRIORITY).map((p) => ({
              value: p,
              label: CAPA_PRIORITY[p].label,
            }))}
            selected={priority}
            onChange={(v) => {
              setPriority(v)
              setPage(1)
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-ink-muted">SLA</span>
            <Select
              value={sla}
              onValueChange={(v) => {
                setSla(v)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-[116px]" aria-label="SLA window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open work</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="week">Due in 7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        {loading ? (
          <div className="space-y-2 p-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <ClipboardCheck className="size-4 text-ink-muted" />
            <p className="text-base font-medium text-ink-soft">No actions match</p>
            <p className="max-w-sm text-xs text-ink-muted">
              Clear a filter or widen the search to see the full corrective action register.
            </p>
          </div>
        ) : (
          <>
            {/* desktop table */}
            <div data-table-scroll className="hidden max-h-[70vh] overflow-auto lg:block">
              <table className="w-full min-w-[1180px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {[
                      'CAPA ID',
                      'Incident',
                      'Action',
                      'Owner',
                      'Priority',
                      'Due',
                      'SLA',
                      'Status',
                      'Progress',
                      '',
                    ].map((h) => (
                      <th
                        key={h}
                        className="sticky top-0 z-20 border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c) => {
                    const inc = storeIncidentById(c.incidentId)
                    const overdue = isOverdue(c)
                    return (
                      <tr
                        key={c.id}
                        data-capa-row={c.id}
                        className={cn(
                          'border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2/70',
                          overdue && 'bg-crit-wash/60',
                        )}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-brand">
                            {c.ref}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-muted">{c.type}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/incidents/${c.incidentId}`)}
                            className="rounded font-mono text-xs text-ink-muted underline-offset-2 transition-colors hover:text-brand hover:underline"
                          >
                            {inc?.ref ?? '—'}
                          </button>
                        </td>
                        <td className="max-w-[280px] px-4 py-3">
                          <p className="truncate text-sm text-ink-soft" title={c.title}>
                            {c.title}
                          </p>
                          <p className="truncate text-xs text-ink-muted">{c.linkedFinding}</p>
                          {c.completionEvidence && (
                            <p
                              className="mt-0.5 flex items-center gap-1 truncate text-xs text-ok-ink"
                              title={c.completionEvidence}
                            >
                              <Paperclip className="size-3 shrink-0" />
                              {c.completionEvidence}
                            </p>
                          )}
                          {(c.attachments?.length ?? 0) > 0 && (
                            <p
                              className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-muted"
                              title={(c.attachments ?? []).map((a) => a.name).join(', ')}
                            >
                              <Paperclip className="size-3 shrink-0" />
                              {c.attachments!.length} file{c.attachments!.length === 1 ? '' : 's'}{' '}
                              attached
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <Avatar user={userById(c.ownerId)} size="xs" />
                            <span className="truncate text-sm text-ink-soft">
                              {userName(c.ownerId)}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={c.priority} />
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-muted tnum">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3 text-ink-muted" />
                            {fmtDate(c.dueDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium tnum',
                              overdue
                                ? 'text-crit-ink'
                                : (daysUntil(c.dueDate) ?? 0) <= 3
                                  ? 'text-warn-ink'
                                  : 'text-ink-muted',
                            )}
                          >
                            <span
                              className={cn(
                                'size-1.5 rounded-full',
                                overdue
                                  ? 'bg-crit'
                                  : (daysUntil(c.dueDate) ?? 0) <= 3
                                    ? 'bg-warn'
                                    : 'bg-ok',
                              )}
                            />
                            {CLOSED.includes(c.status)
                              ? fmtDate(c.dueDate).slice(0, 6)
                              : fmtDaysUntil(c.dueDate)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <CapaStatusBadge status={c.status} size="sm" />
                        </td>
                        <td className="w-[110px] px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={c.progress}
                              variant="bar"
                              className="flex-1"
                              indicatorClassName={CAPA_STATUS[c.status].bar}
                            />
                            <span className="w-8 shrink-0 text-right text-xs text-ink-muted tnum">
                              {c.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">{rowActions(c)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="divide-y divide-line-soft lg:hidden">
              {paged.map((c) => {
                const inc = storeIncidentById(c.incidentId)
                const overdue = isOverdue(c)
                return (
                  <div
                    key={c.id}
                    data-capa-row={c.id}
                    className={cn('p-3.5', overdue && 'bg-crit-wash/60')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-brand">
                            {c.ref}
                          </span>
                          <CapaStatusBadge status={c.status} size="sm" />
                          <PriorityBadge priority={c.priority} />
                        </div>
                        <p className="mt-1.5 text-sm text-ink-soft">{c.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {inc?.ref} · {userName(c.ownerId)} · {c.type}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 text-xs font-medium tnum',
                          overdue ? 'text-crit-ink' : 'text-ink-muted',
                        )}
                      >
                        {fmtDaysUntil(c.dueDate)}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <Progress
                        value={c.progress}
                        variant="bar"
                        className="flex-1"
                        indicatorClassName={CAPA_STATUS[c.status].bar}
                      />
                      <span className="text-xs text-ink-muted tnum">{c.progress}%</span>
                    </div>
                    {rowActions(c) && (
                      <div className="mt-2.5 flex justify-end">{rowActions(c)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPage={setPage}
          onPageSize={(s) => {
            setPageSize(s)
            setPage(1)
          }}
          pageSizes={[12, 25, 50]}
        />
      </div>

      {/* ---------------- charts, below the register ---------------- */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="CAPA SLA Monitoring"
          subtitle="Actions by status against committed closure date, last 6 months"
          info="Overdue is derived from the due date against today, excluding closed and verified actions."
          actions={
            <ChartLegend
              items={[
                { label: 'Completed', color: 'var(--chart-3)' },
                { label: 'Open', color: 'var(--chart-1)' },
                { label: 'Due soon', color: 'var(--color-warn)' },
                { label: 'Overdue', color: 'var(--color-crit)' },
              ]}
            />
          }
          table={{
            columns: ['Month', 'Completed', 'Open', 'Due soon', 'Overdue'],
            rows: slaSeries.map((d) => [d.month, d.completed, d.open, d.dueSoon, d.overdue]),
          }}
        >
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={slaSeries}
                margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                barGap={2}
              >
                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={26}
                />
                <RTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  cursor={{ fill: 'var(--color-surface-3)' }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="completed"
                  name="Completed"
                  stackId="a"
                  fill="var(--color-ok)"
                  maxBarSize={20}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="open"
                  name="Open"
                  stackId="a"
                  fill="var(--chart-1)"
                  maxBarSize={20}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="dueSoon"
                  name="Due Soon"
                  stackId="a"
                  fill="var(--color-warn)"
                  maxBarSize={20}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="overdue"
                  name="Overdue"
                  stackId="a"
                  fill="var(--color-crit)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Action Status Mix"
          subtitle="Share of the register"
          dense
          table={{ columns: ['Status', 'Actions'], rows: pie.map((d) => [d.name, d.value]) }}
        >
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={pie}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={64}
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                  strokeWidth={1.5}
                >
                  {pie.map((p) => (
                    <Cell key={p.name} fill={p.color} />
                  ))}
                </Pie>
                <RTooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1">
            {pie.map((p) => (
              <li key={p.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
                  {p.name}
                </span>
                <span className="font-medium text-ink-soft tnum">
                  {p.value} · {Math.round((p.value / (capas.length || 1)) * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-ink-muted">Verified</p>
              <p className="mt-0.5 text-md font-semibold text-ok-ink tnum">
                {counts.verified + counts.completed}
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-muted">Open work</p>
              <p className="mt-0.5 text-md font-semibold text-brand tnum">
                {counts.open + counts.in_progress + counts.due_soon + counts.overdue}
              </p>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* effectiveness note */}
      <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-px size-4 shrink-0 text-brand" />
          <div>
            <p className="text-sm font-medium text-ink">Effectiveness verification</p>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-muted">
              An action may only move to <span className="text-ok-ink">Verified</span> after a
              documented effectiveness check, sampled independently of the action owner. CAR 8.4
              requires the check to confirm the original finding no longer recurs.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tip label="Actions closed with a passed effectiveness check">
            <span className="flex items-center gap-1.5 rounded-md border border-ok/25 bg-ok/[0.07] px-2.5 py-1.5 text-xs text-ok-ink">
              <CheckCircle2 className="size-3.5" />
              {counts.verified} verified
            </span>
          </Tip>
          <Tip label="Actions awaiting verification">
            <span className="flex items-center gap-1.5 rounded-md border border-warn/25 bg-warn/[0.07] px-2.5 py-1.5 text-xs text-warn-ink">
              <Timer className="size-3.5" />
              {counts.completed} pending check
            </span>
          </Tip>
        </div>
      </Card>

      {/* complete-with-evidence dialog */}
      <Dialog open={completeTarget !== null} onOpenChange={(o) => !o && setCompleteTarget(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Mark action complete</DialogTitle>
            <DialogDescription>
              {completeTarget?.ref} — completion requires evidence. The action moves to Completed
              and awaits an independent effectiveness check.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 pb-1">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Evidence of completion <span className="text-crit-ink">*</span>
              </span>
              <Textarea
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="What was done, when, and what proves it — work order refs, measurements, training records…"
                aria-label="Evidence of completion"
                className="text-sm"
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Minimum 10 characters. Stored on the action and shown in the register.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink-soft">
                Attachments (optional)
              </span>
              <input
                type="file"
                multiple
                onChange={(e) => setEvidenceFiles(Array.from(e.target.files ?? []))}
                className="block w-full text-xs text-ink-muted file:mr-2 file:rounded file:border file:border-line-strong file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:text-ink-soft"
                aria-label="Evidence attachments"
              />
              {evidenceFiles.length > 0 && (
                <span className="mt-1 block truncate font-mono text-xs text-ink-muted">
                  {evidenceFiles.map((f) => f.name).join(', ')}
                </span>
              )}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmComplete}
              disabled={evidence.trim().length < 10 || busyId !== null}
              className="gap-1.5"
              data-confirm-complete
            >
              <CheckCircle2 className="size-3.5" /> Complete with evidence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
