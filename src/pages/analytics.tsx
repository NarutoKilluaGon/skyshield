import { useEffect, useMemo, useState } from 'react'
import { Download, FileSpreadsheet, Layers, Printer } from 'lucide-react'
import { PageHeader } from '@/components/layout/app-shell'
import { ChartCard } from '@/components/charts/chart-card'
import { StatCard } from '@/components/dashboard/stat-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/primitives'
import { downloadCsv, getAllIncidents } from '@/services/incidents'
import { getAnalytics, getCAPAs, getRCAs } from '@/services/operations'
import { api } from '@/services/client'
import { COMPLIANCE_TREND } from '@/data/dashboard'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  PHASE_LABEL,
  RISK_BANDS,
  SEVERITY_HEX,
  SEVERITY_ORDER,
  SEVERITY_TONE,
  riskBand,
} from '@/lib/domain'
import { fmtNumber } from '@/lib/format'
import { escapeHtml } from '@/lib/sanitize'
import { AIRCRAFT, aircraftById } from '@/data/aircraft'
import type {
  AnalyticsPayload,
  CAPA,
  Incident,
  KpiMetric,
  OperationalPhase,
  RCA,
  Severity,
} from '@/types'
import type { ReportPeriod } from '@/pages/reports'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  CHART_X_BASELINE,
} from '@/components/charts/chart-theme'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * M6: in network mode every figure on this page comes from the server
 * aggregation (GET /analytics/ — core/analytics.py). The client-side maths
 * below is the mock-mode twin; the two must agree figure for figure.
 */
const NETWORK = !api.enabled

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
const delta = (cur: number, prev: number) =>
  prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100)

const startOfWeek = (d: Date) => {
  const t = new Date(d)
  t.setHours(0, 0, 0, 0)
  t.setDate(t.getDate() - ((t.getDay() + 6) % 7)) // Monday
  return t
}

export default function AnalyticsPage({ period = '12m' }: { period?: ReportPeriod }) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [rcas, setRcas] = useState<RCA[]>([])
  const [server, setServer] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [aircraftFilter, setAircraftFilter] = useState('all')

  useEffect(() => {
    if (NETWORK) return // the server payload below replaces the collection fetch
    Promise.all([getAllIncidents(), getCAPAs(), getRCAs()])
      .then(([i, c, r]) => {
        setIncidents(i)
        setCapas(c)
        setRcas(r)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!NETWORK) return
    let cancelled = false
    getAnalytics({ period, severity: severityFilter, type: typeFilter, aircraft: aircraftFilter })
      .then((payload) => {
        if (!cancelled && payload) setServer(payload)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [period, severityFilter, typeFilter, aircraftFilter])

  /* ---------------------------------------------------- window + filters */

  const yearStart = new Date(new Date().getFullYear(), 0, 1)
  const windowDays =
    period === '12w'
      ? 84
      : period === '6m'
        ? 182
        : period === '12m'
          ? 365
          : Math.max(1, Math.ceil((Date.now() - yearStart.getTime()) / 86400000))
  const since = period === 'ytd' ? yearStart : new Date(Date.now() - windowDays * 86400000)
  const prevSince = new Date(since.getTime() - windowDays * 86400000)
  const sinceIso = since.toISOString()
  const prevSinceIso = prevSince.toISOString()

  const attrMatch = useMemo(
    () => (i: Incident) =>
      (severityFilter === 'all' || i.risk.severity === severityFilter) &&
      (typeFilter === 'all' || i.category === typeFilter) &&
      (aircraftFilter === 'all' || aircraftById(i.aircraftId)?.registration === aircraftFilter),
    [severityFilter, typeFilter, aircraftFilter],
  )

  const rows = useMemo(
    () => incidents.filter((i) => attrMatch(i) && i.occurredAt >= sinceIso),
    [incidents, attrMatch, sinceIso],
  )
  const prevRows = useMemo(
    () =>
      incidents.filter(
        (i) => attrMatch(i) && i.occurredAt >= prevSinceIso && i.occurredAt < sinceIso,
      ),
    [incidents, attrMatch, prevSinceIso, sinceIso],
  )

  /* ------------------------------------------------------------ buckets */

  const weeklyClient = useMemo(() => {
    const out: {
      key: string
      label: string
      reported: number
      closed: number
      highSeverity: number
    }[] = []
    const idx = new Map<string, number>()
    for (let d = startOfWeek(since); d.getTime() <= Date.now(); d.setDate(d.getDate() + 7)) {
      const key = d.toISOString().slice(0, 10)
      idx.set(
        key,
        out.push({
          key,
          label: `${d.getDate()} ${MON[d.getMonth()]}`,
          reported: 0,
          closed: 0,
          highSeverity: 0,
        }) - 1,
      )
    }
    const weekKey = (iso?: string) => {
      if (!iso) return null
      const t = new Date(iso)
      if (Number.isNaN(t.getTime())) return null
      return startOfWeek(t).toISOString().slice(0, 10)
    }
    for (const i of rows) {
      const k = weekKey(i.occurredAt)
      const r = k ? out[idx.get(k) ?? -1] : undefined
      if (!r) continue
      r.reported += 1
      if (i.risk.severity === 'critical' || i.risk.severity === 'high') r.highSeverity += 1
      const ck = weekKey(i.closedAt)
      if (ck) {
        const c = out[idx.get(ck) ?? -1]
        if (c) c.closed += 1
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, period])

  const monthlyClient = useMemo(() => {
    const map = new Map<string, { month: string; reported: number; closed: number }>()
    for (const i of rows) {
      const d = new Date(i.occurredAt)
      if (Number.isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const e = map.get(key) ?? { month: MON[d.getMonth()], reported: 0, closed: 0 }
      e.reported += 1
      map.set(key, e)
      if (i.closedAt) {
        const cd = new Date(i.closedAt)
        if (Number.isNaN(cd.getTime())) continue
        const ckey = `${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}`
        const ce = map.get(ckey) ?? { month: MON[cd.getMonth()], reported: 0, closed: 0 }
        ce.closed += 1
        map.set(ckey, ce)
      }
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
  }, [rows])

  const severityDataClient = useMemo(
    () =>
      SEVERITY_ORDER.map((s) => ({
        name: SEVERITY_TONE[s].label,
        key: s as Severity,
        value: rows.filter((i) => i.risk.severity === s).length,
        color: SEVERITY_HEX[s],
      })).filter((d) => d.value > 0),
    [rows],
  )

  const riskDistClient = useMemo(
    () =>
      RISK_BANDS.map((b) => ({
        label: b.label,
        bucket: b.level,
        count: rows.filter((i) => i.status !== 'draft' && riskBand(i.risk.score).level === b.level)
          .length,
        color: b.color,
      })),
    [rows],
  )

  const typeDataClient = useMemo(
    () =>
      CATEGORY_ORDER.map((c) => ({
        name: CATEGORY_LABEL[c],
        value: rows.filter((i) => i.category === c).length,
      }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [rows],
  )

  const aircraftDataClient = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of rows) {
      const t = aircraftById(i.aircraftId)?.type ?? 'Unknown'
      map.set(t, (map.get(t) ?? 0) + 1)
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [rows])

  const airportDataClient = useMemo(() => {
    const map = new Map<string, { name: string; city: string; value: number }>()
    for (const i of rows) {
      const e = map.get(i.location.iata) ?? {
        name: i.location.iata,
        city: i.location.city,
        value: 0,
      }
      e.value += 1
      map.set(i.location.iata, e)
    }
    return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 8)
  }, [rows])

  const phaseDataClient = useMemo(
    () =>
      (Object.keys(PHASE_LABEL) as OperationalPhase[])
        .map((p) => ({ name: PHASE_LABEL[p], value: rows.filter((i) => i.phase === p).length }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [rows],
  )

  /* -------------------------------------------- scoped CAPA + RCA rates */

  const rowIds = useMemo(() => new Set(rows.map((i) => i.id)), [rows])
  const scopedCapas = useMemo(() => capas.filter((c) => rowIds.has(c.incidentId)), [capas, rowIds])
  const openCapas = scopedCapas.filter((c) => !['completed', 'verified'].includes(c.status))

  const monthEnds = useMemo(() => {
    const out: { label: string; end: Date }[] = []
    const now = new Date()
    for (let k = 5; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k + 1, 0) // last day of that month
      out.push({ label: MON[d.getMonth()], end: d })
    }
    return out
  }, [])

  const cumulativeRate = (
    items: { createdAt: string; completedAt?: string }[],
    isDone: (x: { createdAt: string; completedAt?: string }, end: Date) => boolean,
  ) =>
    monthEnds.map(({ label, end }) => {
      const opened = items.filter((x) => new Date(x.createdAt) <= end).length
      const done = items.filter((x) => new Date(x.createdAt) <= end && isDone(x, end)).length
      return { month: label, rate: pct(done, opened), done, opened }
    })

  const rcaSeriesClient = useMemo(
    () =>
      cumulativeRate(
        rcas.map((r) => ({ createdAt: r.createdAt, completedAt: r.completedAt })),
        (x, end) => !!x.completedAt && new Date(x.completedAt) <= end,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rcas, monthEnds],
  )
  const capaSeriesClient = useMemo(
    () =>
      cumulativeRate(
        scopedCapas.map((c) => ({
          createdAt: c.openedAt,
          completedAt: c.completedAt ?? c.verifiedAt,
        })),
        (x, end) => !!x.completedAt && new Date(x.completedAt) <= end,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scopedCapas, monthEnds],
  )

  /* --------------------------------------------- effective (server-first) */

  const weekly = server?.weekly ?? weeklyClient
  const monthly = server?.monthly ?? monthlyClient
  const severityData = server?.severity ?? severityDataClient
  const riskDist = server?.riskDist ?? riskDistClient
  const typeData = server?.types ?? typeDataClient
  const aircraftData = server?.aircraft ?? aircraftDataClient
  const airportData = server?.airports ?? airportDataClient
  const phaseData = server?.phases ?? phaseDataClient
  const rcaSeries = server?.rcaSeries ?? rcaSeriesClient
  const capaSeries = server?.capaSeries ?? capaSeriesClient
  const rowsCount = server ? server.counts.rows : rows.length
  const scopedCapaCount = server ? server.counts.capaTotal : scopedCapas.length
  const capaRows = server
    ? server.scopedCapas
    : scopedCapas.map((c) => ({
        ref: c.ref,
        status: c.status as string,
        dueDate: c.dueDate,
        progress: c.progress,
      }))

  const trendPoints = period === '12w' ? 3 : period === '6m' ? 6 : 12
  const complianceTrend = server?.complianceTrend ?? COMPLIANCE_TREND.slice(-trendPoints)

  /* ---------------------------------------------------------------- KPIs */

  const closedN = rows.filter((i) => i.status === 'closed').length
  const prevClosedN = prevRows.filter((i) => i.status === 'closed').length
  const meanScore = rows.length ? rows.reduce((a, i) => a + i.risk.score, 0) / rows.length : 0
  const prevMean = prevRows.length
    ? prevRows.reduce((a, i) => a + i.risk.score, 0) / prevRows.length
    : 0

  const kpisClient: KpiMetric[] = [
    {
      id: 'a_total',
      label: 'Occurrences',
      value: rows.length,
      delta: delta(rows.length, prevRows.length),
      deltaLabel: 'vs prior window',
      accent: 'blue',
      series: weeklyClient.map((w) => w.reported),
      footnote: 'Filtered register count',
    },
    {
      id: 'a_closure',
      label: 'Closure rate',
      value: pct(closedN, rows.length),
      unit: '%',
      delta: pct(closedN, rows.length) - pct(prevClosedN, prevRows.length),
      deltaLabel: 'pts vs prior window',
      accent: 'green',
      series: weeklyClient.map((w) => w.closed),
      footnote: 'Closed ÷ filtered occurrences',
    },
    {
      id: 'a_risk',
      label: 'Mean risk score',
      value: Number(meanScore.toFixed(1)),
      delta: Number((meanScore - prevMean).toFixed(1)),
      deltaLabel: 'pts vs prior window',
      accent: meanScore >= 10 ? 'red' : 'amber',
      series: weeklyClient.map((w) => (w.reported ? w.highSeverity : 0)),
      footnote: 'Severity × likelihood, filtered mean',
    },
    {
      id: 'a_capa',
      label: 'Open CAPAs',
      value: openCapas.length,
      delta: 0,
      deltaLabel: 'current',
      accent: openCapas.length > 0 ? 'orange' : 'green',
      series: capaSeriesClient.map((c) => c.opened - c.done),
      footnote: 'Linked to filtered occurrences',
    },
  ]

  /* ---------------------------------------------------------- takeaways */

  const weeksOver = weekly.filter((w) => w.reported > w.closed).length
  const peakMonth = monthly.reduce((a, b) => (b.reported > (a?.reported ?? -1) ? b : a), monthly[0])
  const highCrit = severityData
    .filter((d) => d.key === 'high' || d.key === 'critical')
    .reduce((a, d) => a + d.value, 0)
  const atOrAbove = server ? server.counts.atOrAbove : rows.filter((i) => i.risk.score >= 15).length
  const topType = typeData[0]
  const topFleet = aircraftData[0]
  const topStation = airportData[0]
  const topPhase = phaseData[0]
  const rcaDone = server
    ? server.counts.rcaDone
    : rcas.filter((r) => r.status === 'completed').length
  const rcaTotal = server ? server.counts.rcaTotal : rcas.length
  const rcaPctV = pct(rcaDone, rcaTotal)
  const capaClosedN = server
    ? server.counts.capaClosed
    : scopedCapas.filter((c) => ['completed', 'verified'].includes(c.status)).length
  const capaOverdue = server
    ? server.counts.capaOverdue
    : scopedCapas.filter(
        (c) => new Date(c.dueDate) < new Date() && !['completed', 'verified'].includes(c.status),
      ).length
  const kpis = server?.kpis ?? kpisClient

  const compFirst = complianceTrend[0]?.score ?? 0
  const compLast = complianceTrend[complianceTrend.length - 1]?.score ?? 0
  const compDelta = compLast - compFirst

  /* ------------------------------------------------------------ exports */

  const exportCsv = () => {
    const csv = [
      ['Report', 'SkyShield Analytics Export'],
      ['Generated', new Date().toISOString()],
      ['Period (days)', String(windowDays)],
      ['Severity filter', severityFilter],
      ['Type filter', typeFilter],
      ['Aircraft filter', aircraftFilter],
      ['Occurrences in window', String(rowsCount)],
      [],
      ['Month', 'Reported', 'Closed'],
      ...monthly.map((m) => [m.month, m.reported, m.closed].join(',')),
      [],
      ['Severity', 'Count'],
      ...severityData.map((d) => [d.name, d.value].join(',')),
      [],
      ['Type', 'Count'],
      ...typeData.map((t) => [`"${t.name}"`, t.value].join(',')),
      [],
      ['Airport', 'City', 'Count'],
      ...airportData.map((a) => [a.name, `"${a.city}"`, a.value].join(',')),
      [],
      ['CAPA (scoped)', 'Status', 'Due', 'Progress'],
      ...capaRows.map((c) => [c.ref, c.status, c.dueDate.slice(0, 10), `${c.progress}%`].join(',')),
    ].join('\n')
    downloadCsv('skyshield-analytics-export.csv', csv)
  }

  const printReport = () => {
    const w = window.open('', '_blank', 'width=980,height=720')
    if (!w) return
    w.document.write(`
      <html><head><title>SkyShield Analytics Report</title>
      <style>
        body{font:13px/1.6 -apple-system,Segoe UI,sans-serif;margin:40px;color:#111}
        h1{font-size:20px;margin:0 0 4px}h2{font-size:13px;margin:24px 0 8px;letter-spacing:.08em;color:#555}
        table{border-collapse:collapse;width:100%;font-size:12px}
        th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}th{background:#f4f6f8}
        .muted{color:#666;font-size:11px}.take{color:#333;font-size:12px;margin:2px 0 10px}
      </style></head><body>
      <h1>SkyShield — Safety Analytics Report</h1>
      <p class="muted">Last ${windowDays} days · filters: ${escapeHtml(severityFilter)} / ${escapeHtml(typeFilter)} / ${escapeHtml(aircraftFilter)} · generated ${escapeHtml(new Date().toLocaleString())}</p>
      <h2>Headline indicators</h2>
      <table><tr><th>Indicator</th><th>Value</th><th>Change</th></tr>
      ${kpis.map((k) => `<tr><td>${escapeHtml(k.label)}</td><td>${escapeHtml(k.value)}${escapeHtml(k.unit ?? '')}</td><td>${k.delta > 0 ? '+' : ''}${escapeHtml(k.delta)} ${escapeHtml(k.deltaLabel)}</td></tr>`).join('')}
      </table>
      <h2>Takeaways</h2>
      <p class="take">• Reported outpaced closed in ${weeksOver} of ${weekly.length} weeks.</p>
      <p class="take">• High and critical severities are ${pct(highCrit, rows.length)}% of the window.</p>
      <p class="take">• ${atOrAbove} occurrence(s) at or above tolerance (score ≥ 15).</p>
      <p class="take">• RCA completion ${rcaPctV}% against the 80% target; scoped CAPA closure ${pct(capaClosedN, scopedCapaCount)}% with ${capaOverdue} overdue.</p>
      <p class="take">• ${escapeHtml(topStation ? `${topStation.name} (${topStation.city}) leads the stations` : 'No station data')}.</p>
      <h2>Incidents by month</h2>
      <table><tr><th>Month</th><th>Reported</th><th>Closed</th></tr>
      ${monthly.map((m) => `<tr><td>${escapeHtml(m.month)}</td><td>${escapeHtml(m.reported)}</td><td>${escapeHtml(m.closed)}</td></tr>`).join('')}
      </table>
      <h2>Incidents by airport</h2>
      <table><tr><th>Airport</th><th>City</th><th>Count</th></tr>
      ${airportData.map((a) => `<tr><td>${escapeHtml(a.name)}</td><td>${escapeHtml(a.city)}</td><td>${escapeHtml(a.value)}</td></tr>`).join('')}
      </table>
      </body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[280px]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px]" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    )

  const empty = rowsCount === 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics & Reports"
        subtitle="Trend analysis across occurrences, investigations, corrective actions and regulatory performance — every figure computed from the register."
        actions={
          <>
            <Button variant="outline" onClick={printReport} className="gap-1.5">
              <Printer className="size-3.5" /> Print report
            </Button>
            <Button onClick={exportCsv} className="gap-1.5">
              <FileSpreadsheet className="size-3.5" /> Export CSV
            </Button>
          </>
        }
      />

      {/* real filters — they scope every chart and export below */}
      <Card className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
        <span className="flex items-center gap-1.5 px-1.5 text-xs font-semibold text-ink-muted">
          <Layers className="size-3" /> Filters
        </span>
        <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger size="sm" aria-label="Severity">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITY_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {SEVERITY_TONE[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm" aria-label="Incident type">
              <SelectValue placeholder="Incident type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All incident types</SelectItem>
              {CATEGORY_ORDER.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
            <SelectTrigger size="sm" aria-label="Aircraft">
              <SelectValue placeholder="Aircraft" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All aircraft</SelectItem>
              {AIRCRAFT.map((a) => (
                <SelectItem key={a.id} value={a.registration}>
                  {a.registration} — {a.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge size="md" tone="brand" className="justify-center sm:px-3">
          {fmtNumber(rowsCount)} occurrences
        </Badge>
      </Card>

      {empty && (
        <Card className="p-6 text-center text-sm text-ink-muted">
          No occurrences match the current period and filters. Widen the window or clear a filter.
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.id} metric={k} variant={k.id === 'a_capa' ? 'bar' : 'line'} />
        ))}
      </div>

      {/* trend */}
      <ChartCard
        className="xl:col-span-2"
        title="Incident Trends Over Time"
        subtitle="Weekly reported, closed and high-severity occurrences in the window"
        takeaway={`Reported outpaced closed in ${weeksOver} of ${weekly.length} weeks; high-severity events peaked at ${Math.max(0, ...weekly.map((w) => w.highSeverity))} per week.`}
        table={{
          columns: ['Week of', 'Reported', 'Closed', 'High severity'],
          rows: weekly.map((w) => [w.label, w.reported, w.closed, w.highSeverity]),
        }}
      >
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weekly} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="label"
                tick={CHART_AXIS_TICK}
                axisLine={{ stroke: CHART_X_BASELINE }}
                tickLine={false}
                minTickGap={24}
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
              <Area
                type="monotone"
                dataKey="reported"
                name="Reported"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="var(--chart-1)"
                fillOpacity={0.12}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="closed"
                name="Closed"
                stroke="var(--chart-3)"
                strokeWidth={2}
                fill="var(--chart-3)"
                fillOpacity={0.1}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="highSeverity"
                name="High severity"
                stroke="var(--color-crit)"
                strokeWidth={2}
                fill="var(--color-crit)"
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          title="Monthly Volume"
          subtitle="Reported against closed"
          dense
          takeaway={
            peakMonth
              ? `${peakMonth.month} was the peak month with ${peakMonth.reported} reports; closure tracked ${pct(
                  monthly.reduce((a, m) => a + m.closed, 0),
                  monthly.reduce((a, m) => a + m.reported, 0),
                )}% of volume.`
              : 'No data in window.'
          }
          table={{
            columns: ['Month', 'Reported', 'Closed'],
            rows: monthly.map((m) => [m.month, m.reported, m.closed]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2}>
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
                  dataKey="reported"
                  name="Reported"
                  fill="var(--chart-1)"
                  maxBarSize={20}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="closed"
                  name="Closed"
                  fill="var(--chart-3)"
                  maxBarSize={20}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Incidents by Severity"
          subtitle="Share of the filtered window"
          dense
          takeaway={`High and critical make up ${pct(highCrit, rowsCount)}% of the ${rowsCount} filtered occurrence${rowsCount === 1 ? '' : 's'}.`}
          table={{
            columns: ['Severity', 'Incidents'],
            rows: severityData.map((d) => [d.name, d.value]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  isAnimationActive={false}
                  data={severityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                  strokeWidth={1.5}
                >
                  {severityData.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <RTooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Risk Distribution"
          subtitle="Occurrences by assessed band"
          dense
          takeaway={`${atOrAbove} occurrence${atOrAbove === 1 ? '' : 's'} sit at or above tolerance (score ≥ 15); ${riskDist[0]?.count ?? 0} in the low band.`}
          table={{
            columns: ['Risk band', 'Occurrences'],
            rows: riskDist.map((d) => [d.label, d.count]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={riskDist}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke={CHART_GRID_STROKE} horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                  width={64}
                />
                <RTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  cursor={{ fill: 'var(--color-surface-3)' }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="count"
                  name="Occurrences"
                  maxBarSize={20}
                  radius={[0, 4, 4, 0]}
                >
                  {riskDist.map((d) => (
                    <Cell key={d.bucket} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          title="Severity Profile"
          subtitle="Against the window maximum"
          dense
          table={{
            columns: ['Severity', 'Incidents'],
            rows: severityData.map((d) => [d.name, d.value]),
          }}
        >
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={severityData.map((d) => ({
                  subject: d.name,
                  value: d.value,
                  fullMark: Math.max(1, ...severityData.map((x) => x.value)),
                }))}
                outerRadius="72%"
              >
                <PolarGrid stroke={CHART_GRID_STROKE} />
                <PolarAngleAxis dataKey="subject" tick={CHART_AXIS_TICK} />
                <Radar
                  dataKey="value"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.22}
                  isAnimationActive={false}
                />
                <RTooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Incidents by Type"
          subtitle="Occurrence classification"
          dense
          takeaway={
            topType
              ? `${topType.name} leads the register at ${pct(topType.value, rowsCount)}% of filtered occurrences.`
              : 'No data in window.'
          }
          table={{ columns: ['Type', 'Incidents'], rows: typeData.map((t) => [t.name, t.value]) }}
        >
          <ul className="space-y-2">
            {typeData.map((t) => (
              <li key={t.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-soft">{t.name}</span>
                  <span className="text-ink-muted tnum">{t.value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-deep">
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-700"
                    style={{ width: `${pct(t.value, typeData[0]?.value ?? 1)}%` }}
                  />
                </div>
              </li>
            ))}
            {!typeData.length && (
              <li className="py-6 text-center text-xs text-ink-muted">No occurrences in window.</li>
            )}
          </ul>
        </ChartCard>

        <ChartCard
          title="Incidents by Aircraft"
          subtitle="By fleet type"
          dense
          takeaway={
            topFleet
              ? `${topFleet.name} fleets account for ${pct(topFleet.value, rowsCount)}% of filtered occurrences.`
              : 'No data in window.'
          }
          table={{
            columns: ['Aircraft type', 'Incidents'],
            rows: aircraftData.map((d) => [d.name, d.value]),
          }}
        >
          <ul className="space-y-2">
            {aircraftData.map((t) => (
              <li key={t.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-soft">{t.name}</span>
                  <span className="text-ink-muted tnum">{t.value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-deep">
                  <div
                    className="h-full rounded-full transition-[width] duration-700"
                    style={{
                      width: `${pct(t.value, aircraftData[0]?.value ?? 1)}%`,
                      background: 'var(--chart-2)',
                    }}
                  />
                </div>
              </li>
            ))}
            {!aircraftData.length && (
              <li className="py-6 text-center text-xs text-ink-muted">No occurrences in window.</li>
            )}
          </ul>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <ChartCard
          title="Incidents by Airport"
          subtitle="Reporting station"
          dense
          takeaway={
            topStation
              ? `${topStation.name} (${topStation.city}) is the most frequent station with ${topStation.value} occurrence${topStation.value === 1 ? '' : 's'}.`
              : 'No data in window.'
          }
          table={{
            columns: ['Airport', 'City', 'Incidents'],
            rows: airportData.map((a) => [a.name, a.city, a.value]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={airportData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="name"
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
                  dataKey="value"
                  name="Incidents"
                  fill="var(--chart-1)"
                  maxBarSize={20}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Incidents by Operational Phase"
          subtitle="Flight phase during the event"
          dense
          takeaway={
            topPhase
              ? `${topPhase.name} is the most exposed phase at ${pct(topPhase.value, rowsCount)}% of filtered occurrences.`
              : 'No data in window.'
          }
          table={{ columns: ['Phase', 'Incidents'], rows: phaseData.map((d) => [d.name, d.value]) }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={phaseData}
                layout="vertical"
                margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
              >
                <CartesianGrid stroke={CHART_GRID_STROKE} horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                  width={80}
                />
                <RTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  cursor={{ fill: 'var(--color-surface-3)' }}
                />
                <Bar
                  isAnimationActive={false}
                  dataKey="value"
                  name="Incidents"
                  fill="var(--chart-2)"
                  maxBarSize={20}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Regulatory Compliance Trend"
          subtitle="Compliance-module feed, overall score by month"
          dense
          takeaway={`Score moved ${compDelta >= 0 ? '+' : ''}${compDelta.toFixed(1)} points from ${complianceTrend[0]?.month ?? '—'} to ${complianceTrend[complianceTrend.length - 1]?.month ?? '—'} (${compLast.toFixed(1)}%).`}
          table={{
            columns: ['Month', 'Score'],
            rows: complianceTrend.map((d) => [d.month, d.score]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                />
                <YAxis
                  domain={[60, 100]}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Score"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <ChartCard
          title="RCA Completion Rate"
          subtitle="Rolling six months against the 80% target · register-wide"
          dense
          takeaway={`${rcaDone} of ${rcaTotal} analyses completed (${rcaPctV}%) — ${rcaPctV >= 80 ? 'at or above' : 'below'} the 80% target.`}
          table={{
            columns: ['Month', 'Rate %', 'Completed', 'Opened'],
            rows: rcaSeries.map((r) => [r.month, r.rate, r.done, r.opened]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rcaSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                />
                <ReferenceLine
                  y={80}
                  stroke="var(--color-warn)"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Target 80%',
                    fill: 'var(--color-warn-ink)',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Completion %"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="CAPA Completion Rate"
          subtitle="Closure against committed date · scoped to filtered occurrences"
          dense
          takeaway={`${capaClosedN} of ${scopedCapaCount} scoped actions closed or verified (${pct(capaClosedN, scopedCapaCount)}%); ${capaOverdue} overdue today.`}
          table={{
            columns: ['Month', 'Rate %', 'Closed', 'Opened'],
            rows: capaSeries.map((c) => [c.month, c.rate, c.done, c.opened]),
          }}
        >
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={capaSeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={CHART_AXIS_TICK}
                  axisLine={{ stroke: CHART_X_BASELINE }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={CHART_AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RTooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL}
                  cursor={{ stroke: 'var(--color-line-strong)' }}
                />
                <ReferenceLine
                  y={80}
                  stroke="var(--color-warn)"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Target 80%',
                    fill: 'var(--color-warn-ink)',
                    fontSize: 10,
                    position: 'insideTopRight',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Closure %"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <p className="text-center text-xs text-ink-muted">
        Every figure on this page is computed from the incident, CAPA and RCA registers for the
        selected window — <Download className="inline size-3" /> exports carry the same filtered
        set.
      </p>
    </div>
  )
}
