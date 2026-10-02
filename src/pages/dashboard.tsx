import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  MoreHorizontal,
  Plus,
  Printer,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { RiskMatrix } from '@/components/dashboard/risk-matrix'
import { NeedsAttention } from '@/components/dashboard/needs-attention'
import { KpiStrip } from '@/components/dashboard/kpi-strip'
import { MyQueue } from '@/components/dashboard/my-queue'
import { ChartCard } from '@/components/charts/chart-card'
import { ChartLegend } from '@/components/charts/chart-legend'
import { IncidentTable } from '@/components/incidents/incident-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getCAPAs, getDashboardMetrics, getInvestigations, getRCAs } from '@/services/operations'
import { getActiveIncidents, downloadCsv, toCsv } from '@/services/incidents'
import { useAuth } from '@/lib/auth'
import { fmtTime } from '@/lib/format'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CAPA, DashboardMetrics, Incident, Investigation, RCA } from '@/types'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_X_BASELINE,
  CHART_EMPHASIS,
  CHART_COMPARE,
} from '@/components/charts/chart-theme'

const RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last quarter' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Rolling 12 months' },
]

const STAGE_LABEL: Record<string, string> = {
  incident_reported: 'Reported',
  initial_assessment: 'Initial assessment',
  investigation: 'Investigation',
  evidence_collection: 'Evidence collection',
  root_cause_analysis: 'Root cause analysis',
  corrective_action: 'Corrective action',
  verification: 'Verification',
  closed: 'Closed',
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [showFirstRun, setShowFirstRun] = useState(
    () =>
      searchParams.get('firstRun') === '1' ||
      (typeof window !== 'undefined' && localStorage.getItem('skyshield.first_run') === '1'),
  )
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [rcas, setRcas] = useState<RCA[]>([])
  const [range, setRange] = useState('90d')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getDashboardMetrics(),
      getActiveIncidents(),
      getInvestigations(),
      getCAPAs(),
      getRCAs(),
    ]).then(([m, i, v, c, r]) => {
      setMetrics(m)
      setIncidents(i)
      setInvestigations(v)
      setCapas(c)
      setRcas(r)
      setUpdatedAt(fmtTime(new Date().toISOString()))
    })
  }, [])

  const now = new Date()
  const openCapas = useMemo(() => capas.filter((c) => c.status !== 'completed'), [capas])
  const overdueCapas = useMemo(
    () => openCapas.filter((c) => new Date(c.dueDate) < now),
    [openCapas, now],
  )
  const activeInvestigations = useMemo(
    () =>
      investigations.filter((i) => i.stage !== 'closed').sort((a, b) => b.progress - a.progress),
    [investigations],
  )
  const rcasInProgress = useMemo(
    () => rcas.filter((r) => r.status === 'in_progress' || r.status === 'in_review'),
    [rcas],
  )

  const trend = metrics?.trend ?? []
  const capaSla = metrics?.capaSlaSeries ?? []
  const last = trend[trend.length - 1]
  const prev = trend[trend.length - 2]
  const reportedDelta = last && prev ? last.reported - prev.reported : 0
  const awaitingVerification = activeInvestigations.filter((v) => v.stage === 'verification').length
  const rcasInReview = rcasInProgress.filter((r) => r.status === 'in_review').length

  const kpiCells = [
    {
      label: 'Open incidents',
      value: incidents.length,
      delta:
        reportedDelta === 0
          ? 'same as last month'
          : `${Math.abs(reportedDelta)} ${reportedDelta > 0 ? 'more' : 'fewer'} reported than last month`,
    },
    {
      label: 'Active investigations',
      value: activeInvestigations.length,
      delta: awaitingVerification
        ? `${awaitingVerification} awaiting verification`
        : 'none awaiting verification',
    },
    {
      label: 'RCAs in progress',
      value: rcasInProgress.length,
      delta: rcasInReview ? `${rcasInReview} in review` : 'none in review',
    },
    {
      label: 'Overdue CAPAs',
      value: overdueCapas.length,
      delta: overdueCapas.length
        ? `${overdueCapas.length} past ${overdueCapas.length === 1 ? 'its' : 'their'} due date`
        : 'all actions within due dates',
      alarm: true,
    },
  ]

  const capaCounts = {
    total: capas.length,
    completed: capas.filter((c) => c.status === 'completed').length,
    pending: openCapas.length,
    overdue: overdueCapas.length,
  }

  const exportCsv = () => downloadCsv('skyshield-incidents.csv', toCsv(incidents))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        meta={
          updatedAt ? (
            <span className="text-xs text-ink-muted">Updated {updatedAt}</span>
          ) : undefined
        }
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[150px]" aria-label="Date range">
                <CalendarDays className="size-3.5 shrink-0 text-ink-muted" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[212px]">
                <DropdownMenuLabel>Export</DropdownMenuLabel>
                <DropdownMenuItem onSelect={exportCsv}>
                  <Download /> Download incidents (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => window.print()}>
                  <Printer /> Print summary
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="default"
              className="gap-1.5"
              onClick={() => navigate('/incidents/report')}
            >
              <Plus className="size-3.5" />
              Report incident
            </Button>
          </>
        }
      />

      {showFirstRun && (
        <div className="flex flex-col gap-4 rounded-lg border border-brand/40 bg-brand-wash/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Welcome to SkyShield</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Your account is ready. Get started by reporting an occurrence or inviting your safety
              team.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" onClick={() => navigate('/incidents/report')}>
              Report your first incident
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings?tab=team')}>
              Invite your team
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setShowFirstRun(false)
                localStorage.setItem('skyshield.first_run', 'false')
              }}
              aria-label="Dismiss guide"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <NeedsAttention incidents={incidents} investigations={investigations} capas={capas} />

      <KpiStrip cells={kpiCells} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <RiskMatrix
          incidents={incidents}
          className="xl:col-span-2"
          title="Risk matrix"
          subtitle="Active incidents by severity and likelihood. Select a cell to open the filtered list."
          showLegend
          onCellClick={() => navigate('/incidents')}
        />
        <MyQueue user={user} incidents={incidents} investigations={investigations} capas={capas} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Reported vs closed"
          subtitle="Incidents per month, rolling 12 months"
          actions={
            <ChartLegend
              items={[
                { label: 'Reported', color: CHART_EMPHASIS },
                { label: 'Closed', color: CHART_COMPARE },
              ]}
            />
          }
          table={{
            columns: ['Month', 'Reported', 'Closed'],
            rows: trend.map((t) => [t.month, t.reported, t.closed]),
          }}
        >
          <div className="h-[188px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                  interval="preserveStartEnd"
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
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="reported"
                  name="Reported"
                  stroke="var(--color-brand)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'var(--color-brand)',
                    stroke: 'var(--color-surface)',
                    strokeWidth: 2,
                  }}
                />
                <Line
                  isAnimationActive={false}
                  type="monotone"
                  dataKey="closed"
                  name="Closed"
                  stroke="var(--color-ok)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'var(--chart-2)',
                    stroke: 'var(--color-surface)',
                    strokeWidth: 2,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Incidents by type" subtitle="Distribution across the reporting period">
          <div className="space-y-2">
            {(metrics?.typeMix ?? []).map((t) => {
              const max = Math.max(...(metrics?.typeMix ?? []).map((x) => x.value), 1)
              return (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="w-[86px] shrink-0 truncate text-xs text-ink-soft">{t.name}</span>
                  <div className="h-4 min-w-0 flex-1 overflow-hidden rounded bg-canvas-deep">
                    <div
                      className="flex h-full items-center justify-end rounded bg-brand px-1.5"
                      style={{ width: `${(t.value / max) * 100}%` }}
                    >
                      <span className="text-xs font-semibold text-on-brand tnum">{t.value}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>
      </div>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">Recent incidents</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate('/incidents')}>
            View all
            <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
        <IncidentTable
          data={incidents.slice(0, 6)}
          onRowClick={(r) => navigate(`/incidents/${r.id}`)}
          sort={{ key: 'occurredAt', direction: 'desc' }}
          dense
        />
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <section className="overflow-hidden rounded-card border border-line bg-surface xl:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-base font-semibold text-ink">Investigation progress</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/investigations')}>
              All investigations
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-xs font-medium text-ink-muted">
                <th className="px-4 py-2 font-medium">Investigation</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="w-[120px] px-4 py-2 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {activeInvestigations.slice(0, 5).map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-surface-3">
                  <td className="max-w-0 truncate px-4 py-2 text-ink-soft">{v.name}</td>
                  <td className="px-4 py-2 text-xs text-ink-muted">
                    {STAGE_LABEL[v.stage] ?? v.stage}
                  </td>
                  <td className="px-4 py-2">
                    <span className="block h-1 overflow-hidden rounded-full bg-canvas-deep">
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${v.progress}%` }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
              {activeInvestigations.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-sm text-ink-muted">
                    No open investigations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <ChartCard
          className="xl:col-span-2"
          title="CAPA status"
          subtitle={`${capaCounts.total} total, ${capaCounts.completed} completed, ${capaCounts.pending} pending, ${capaCounts.overdue} overdue`}
          actions={
            <ChartLegend
              items={[
                { label: 'Completed', color: 'var(--chart-3)' },
                { label: 'Open', color: CHART_EMPHASIS },
                { label: 'Due soon', color: 'var(--color-warn)' },
                { label: 'Overdue', color: 'var(--color-crit)' },
              ]}
            />
          }
          table={{
            columns: ['Month', 'Completed', 'Open', 'Due soon', 'Overdue'],
            rows: capaSla.map((s2) => [s2.month, s2.completed, s2.open, s2.dueSoon, s2.overdue]),
          }}
        >
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={capaSla} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2}>
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
                  fill="var(--color-brand)"
                  maxBarSize={20}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="dueSoon"
                  name="Due soon"
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
      </div>
    </div>
  )
}
