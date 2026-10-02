import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Gauge, Layers, Plane, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { RiskMatrix } from '@/components/dashboard/risk-matrix'
import { ChartCard } from '@/components/charts/chart-card'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/primitives'
import { SeverityBadge, StatusBadge } from '@/components/common/badges'
import { getAllIncidents, downloadCsv, toCsv } from '@/services/incidents'
import { getCAPAs } from '@/services/operations'
import {
  CATEGORY_LABEL,
  INCIDENT_STATUS,
  LIKELIHOOD_LABEL,
  RISK_BANDS,
  SEVERITY_VALUE,
  riskBand,
  riskLevel,
  riskScore,
} from '@/lib/domain'
import { fmtDate } from '@/lib/format'
import { aircraftById } from '@/data/aircraft'
import { userName } from '@/data/users'
import type { CAPA, Incident, Likelihood } from '@/types'

const BANDS = [
  { key: 'low', label: 'Low', range: '1 – 4', action: 'Managed by line operations. Trended monthly.' },
  { key: 'moderate', label: 'Moderate', range: '5 – 9', action: 'Investigation required. Safety Manager notified.' },
  { key: 'high', label: 'High', range: '10 – 14', action: 'Formal investigation, RCA and CAPA mandatory.' },
  { key: 'critical', label: 'Critical', range: '15 – 25', action: 'Authority notified within 1 hour. Executive review.' },
] as const

const CLOSED_CAPA = new Set(['completed', 'verified'])

export default function RiskMatrixPage() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [status, setStatus] = useState('active')
  const [view, setView] = useState<'assessed' | 'residual'>('assessed')
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getAllIncidents(), getCAPAs()]).then(([i, c]) => {
      setIncidents(i)
      setCapas(c)
    })
  }, [])

  const scoped = useMemo(
    () => (status === 'all' ? incidents : incidents.filter((i) => i.status !== 'closed')),
    [incidents, status],
  )

  /**
   * Residual (post-mitigation) risk, derived from the CAPA register rather
   * than invented: each completed/verified action on the record lowers the
   * likelihood one class (floor 1). Severity is a property of the outcome and
   * never changes. Assessed values are untouched — this is a view, not an edit.
   */
  const residualFor = useMemo(() => {
    const closedByIncident = new Map<string, number>()
    for (const c of capas) {
      if (!CLOSED_CAPA.has(c.status)) continue
      closedByIncident.set(c.incidentId, (closedByIncident.get(c.incidentId) ?? 0) + 1)
    }
    return (i: Incident): Incident => {
      const closed = closedByIncident.get(i.id) ?? 0
      if (!closed) return i
      const likelihood = Math.max(1, i.risk.likelihood - closed) as Likelihood
      const score = riskScore(i.risk.severity, likelihood)
      return { ...i, risk: { ...i.risk, likelihood, score, level: riskLevel(score) } }
    }
  }, [capas])

  const plotted = useMemo(
    () => (view === 'residual' ? scoped.map(residualFor) : scoped),
    [scoped, view, residualFor],
  )

  const table = useMemo(
    () => [...plotted].sort((a, b) => b.risk.score - a.risk.score).slice(0, 24),
    [plotted],
  )

  /** Distribution computed from the plotted set — no static fixture. */
  const distribution = useMemo(
    () =>
      RISK_BANDS.slice()
        .reverse()
        .map((b) => ({
          level: b.level,
          label: b.label,
          color: b.color,
          count: plotted.filter((i) => i.status !== 'closed' && i.status !== 'draft' && riskBand(i.risk.score).level === b.level).length,
        })),
    [plotted],
  )
  const distributionTotal = distribution.reduce((a, b) => a + b.count, 0) || 1

  const cellItems = useMemo(() => {
    if (!selectedCell) return []
    const [likS, sevS] = selectedCell.split('-')
    const lik = Number(likS)
    const sev = Number(sevS)
    return plotted
      .filter(
        (i) =>
          i.status !== 'closed' &&
          i.status !== 'draft' &&
          i.risk.likelihood === lik &&
          SEVERITY_VALUE[i.risk.severity] === sev,
      )
      .sort((a, b) => b.risk.score - a.risk.score)
  }, [selectedCell, plotted])

  const cellBand = selectedCell ? riskBand(Number(selectedCell.split('-')[0]) * Number(selectedCell.split('-')[1])) : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Risk Matrix"
        subtitle="Operator 5×5 risk assessment grid. Every occurrence is plotted by assessed severity and likelihood."
        meta={
          <>
            <Badge size="md" tone="neutral">
              {scoped.length} occurrences plotted
            </Badge>
            <Badge size="md" tone="red">
              {plotted.filter((i) => i.risk.level === 'critical' && i.status !== 'closed').length} critical
            </Badge>
          </>
        }
        actions={
          <>
            <div
              role="group"
              aria-label="Risk view"
              className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
            >
              {(
                [
                  ['assessed', 'Assessed'],
                  ['residual', 'Post-mitigation'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors duration-120',
                    view === id ? 'bg-surface-3 text-ink' : 'text-ink-muted hover:text-ink-soft',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px]" aria-label="Scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="all">All occurrences</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => downloadCsv('skyshield-risk-register.csv', toCsv(table))}
            >
              <Download className="size-3.5" /> Export
            </Button>
          </>
        }
      />

      {view === 'residual' && (
        <p className="flex items-start gap-2 rounded-md border border-line-soft bg-surface-2/50 px-3 py-2 text-xs leading-relaxed text-ink-muted">
          <Layers className="mt-px size-3.5 shrink-0 text-brand" />
          Post-mitigation view: likelihood drops one class per completed or verified CAPA on the
          record (floor 1); severity is unchanged. Assessed values are never modified.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <RiskMatrix
          incidents={plotted}
          className="xl:col-span-2"
          subtitle={
            view === 'residual'
              ? 'Residual position after completed/verified corrective actions'
              : 'Current active incidents classified by severity and likelihood'
          }
          onCellClick={(key) => setSelectedCell((c) => (c === key ? null : key))}
        />

        <div className="space-y-3">
          {/* cell side panel */}
          {selectedCell && cellBand && (
            <Card className="overflow-hidden" data-cell-panel>
              <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Likelihood {selectedCell.split('-')[0]} × Severity {selectedCell.split('-')[1]}
                  </h3>
                  <p className="text-xs" style={{ color: cellBand.ink }}>
                    Score {Number(selectedCell.split('-')[0]) * Number(selectedCell.split('-')[1])} ·{' '}
                    {cellBand.label} band · {cellItems.length} occurrence{cellItems.length === 1 ? '' : 's'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close cell detail"
                  onClick={() => setSelectedCell(null)}
                >
                  <X />
                </Button>
              </div>
              {cellItems.length ? (
                <ul className="divide-y divide-line-soft">
                  {cellItems.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/incidents/${i.id}`)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-xs font-semibold text-brand">{i.ref}</span>
                          <span className="block truncate text-xs text-ink-soft">{i.title}</span>
                          <span className="mt-0.5 block text-xs text-ink-muted">
                            {CATEGORY_LABEL[i.category]} · {userName(i.investigatorId)}
                          </span>
                        </span>
                        <StatusBadge status={i.status} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3.5 py-6 text-center text-xs text-ink-muted">
                  No active occurrences sit in this cell{view === 'residual' ? ' after mitigation' : ''}.
                </p>
              )}
            </Card>
          )}

          <ChartCard title="Risk Distribution" subtitle="Occurrences by band in the current view" dense>
            <ul className="space-y-2.5">
              {distribution.map((d) => {
                const pct = Math.round((d.count / distributionTotal) * 100)
                return (
                  <li key={d.level}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-[2px]" style={{ background: d.color }} />
                        <span className="font-medium text-ink-soft">{d.label}</span>
                      </span>
                      <span className="text-ink-muted tnum">{d.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-deep">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{ width: `${pct}%`, background: d.color }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            <Separator className="my-3" />
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Mean risk score</dt>
                <dd className="font-medium text-ink-soft tnum">
                  {(plotted.reduce((a, b) => a + b.risk.score, 0) / (plotted.length || 1)).toFixed(1)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Highest score</dt>
                <dd className="font-medium text-ink-soft tnum">
                  {plotted.length ? Math.max(...plotted.map((i) => i.risk.score)) : 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Above tolerance (≥15)</dt>
                <dd className="font-medium text-crit-ink tnum">
                  {plotted.filter((i) => i.risk.score >= 15).length}
                </dd>
              </div>
            </dl>
          </ChartCard>

          <Card className="p-3.5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Gauge className="size-3.5 text-ink-muted" />
              Risk acceptance criteria
            </h3>
            <ul className="mt-3 space-y-2">
              {BANDS.map((b) => {
                const band = riskBand(b.key === 'low' ? 2 : b.key === 'moderate' ? 7 : b.key === 'high' ? 12 : 20)
                return (
                  <li key={b.key} className="rounded-md border border-line-soft bg-surface-2/40 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px]" style={{ background: band.color }} />
                      <span className="text-sm font-semibold" style={{ color: band.ink }}>
                        {b.label}
                      </span>
                      <span className="ml-auto text-xs text-ink-muted tnum">{b.range}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">{b.action}</p>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 flex items-start gap-1.5 rounded-md border border-warn/25 bg-warn/[0.06] p-2.5 text-xs leading-relaxed text-ink-soft">
              <TriangleAlert className="mt-px size-3 shrink-0 text-warn" />
              Occurrences above the tolerance level require acceptance by the Accountable Manager before
              closure.
            </p>
          </Card>
        </div>
      </div>

      {/* ranked register */}
      <Card className="overflow-hidden">
        <div className="border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold text-ink">
            Occurrences by Risk Score{view === 'residual' ? ' (post-mitigation)' : ''}
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Top {table.length} by score. Select a row to open the record, or a matrix cell to inspect
            that band.
          </p>
        </div>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Occurrences by Risk Score table"
        >
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {['Rank', 'Incident', 'Type', 'Sev', 'Lik', 'Score', 'Band', 'Aircraft', 'Status', 'Investigator', ''].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 text-xs font-semibold text-ink-muted">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => {
                const band = riskBand(r.risk.score)
                const assessed = scoped.find((x) => x.id === r.id)
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/incidents/${r.id}`)}
                    className="cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2/70"
                  >
                    <td className="px-3 py-2.5 text-sm font-semibold text-ink-muted tnum">#{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-sm font-semibold text-brand">{r.ref}</span>
                      <span className="ml-2 text-xs text-ink-muted tnum">{fmtDate(r.occurredAt)}</span>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-sm text-ink-soft">
                      {CATEGORY_LABEL[r.category]}
                    </td>
                    <td className="px-3 py-2.5">
                      <SeverityBadge severity={r.risk.severity} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-ink-muted tnum">
                      {r.risk.likelihood}
                      <span className="ml-1 text-ink-muted">{LIKELIHOOD_LABEL[r.risk.likelihood]}</span>
                      {view === 'residual' && assessed && assessed.risk.likelihood !== r.risk.likelihood && (
                        <span className="ml-1 text-ok-ink">({assessed.risk.likelihood}→)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="inline-flex h-5 min-w-6 items-center justify-center rounded px-1.5 text-xs font-semibold tnum"
                        style={{ color: band.ink, background: band.wash }}
                      >
                        {r.risk.score}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium" style={{ color: band.ink }}>
                      {band.label}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-sm text-ink-soft">
                        <Plane className="size-3 text-ink-muted" />
                        {aircraftById(r.aircraftId)?.registration}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} size="sm" />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-ink-muted">{userName(r.investigatorId)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-ink-muted tnum">
                      {SEVERITY_VALUE[r.risk.severity]}×{r.risk.likelihood}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-center text-xs text-ink-muted">
        {INCIDENT_STATUS.investigation.label} and {INCIDENT_STATUS.rca_pending.label} occurrences
        require a documented investigation path. Hover any marker for the underlying record; click a
        cell to inspect its occurrences.
      </p>
    </div>
  )
}
