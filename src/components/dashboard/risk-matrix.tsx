import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plane, TriangleAlert, X } from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { ChartCard } from '@/components/charts/chart-card'
import { StatusBadge } from '@/components/common/badges'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LIKELIHOOD_LABEL, RISK_BANDS, SEVERITY_TONE, riskBand, SEVERITY_VALUE } from '@/lib/domain'
import { fmtDate } from '@/lib/format'
import { aircraftById } from '@/data/aircraft'
import type { Incident } from '@/types'

/** Aviation consequence classes, severity 5 (catastrophic) down to 1. */
const SEVERITY_AXIS = [
  { v: 5, label: 'Catastrophic', short: 'CATA' },
  { v: 4, label: 'Critical', short: 'CRIT' },
  { v: 3, label: 'Marginal', short: 'MARG' },
  { v: 2, label: 'Minor', short: 'MINR' },
  { v: 1, label: 'Negligible', short: 'NEGL' },
] as const

const LIKELIHOOD_AXIS = [
  { v: 1, label: 'Rare' },
  { v: 2, label: 'Unlikely' },
  { v: 3, label: 'Possible' },
  { v: 4, label: 'Likely' },
  { v: 5, label: 'Almost Certain' },
] as const

const BAND_ORDER = ['low', 'moderate', 'high', 'critical'] as const

export function RiskMatrix({
  incidents,
  className,
  title = '5×5 Risk Matrix',
  subtitle = 'Current active incidents classified by severity and likelihood',
  showHeader = true,
  height = 'h-auto',
  showLegend = false,
  onCellClick,
}: {
  incidents: Incident[]
  className?: string
  title?: string
  subtitle?: string
  showHeader?: boolean
  height?: string
  showLegend?: boolean
  onCellClick?: (cellKey: string) => void
}) {
  // The matrix is inherently wide. On narrow viewports fall back to a banded
  // list so the content stays legible instead of being scrolled or squashed.
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 560px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ inc: Incident; x: number; y: number } | null>(null)
  const [focused, setFocused] = useState<Incident | null>(null)
  const [band, setBand] = useState<string>('all')

  const active = useMemo(
    () => incidents.filter((i) => i.status !== 'closed' && i.status !== 'draft'),
    [incidents],
  )

  const filtered = useMemo(
    () => (band === 'all' ? active : active.filter((i) => i.risk.level === band)),
    [active, band],
  )

  /** cellKey -> incidents, so markers can be laid out without overlap */
  const cells = useMemo(() => {
    const map = new Map<string, Incident[]>()
    for (const i of filtered) {
      const key = `${i.risk.likelihood}-${SEVERITY_VALUE[i.risk.severity]}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(i)
    }
    return map
  }, [filtered])

  const counts = useMemo(() => {
    const c: Record<string, number> = { low: 0, moderate: 0, high: 0, critical: 0 }
    for (const i of active) c[i.risk.level] = (c[i.risk.level] ?? 0) + 1
    return c
  }, [active])

  const onEnter = (inc: Incident, e: React.MouseEvent) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    setHover({ inc, x: e.clientX - box.left, y: e.clientY - box.top })
  }

  const shown = hover ?? (focused ? { inc: focused, x: 0, y: 0 } : null)
  const detail = shown?.inc
  const detailBand = detail ? riskBand(detail.risk.score) : null

  if (narrow) {
    return (
      <ChartCard title={title} subtitle={subtitle} className={className}>
        <ul className="space-y-1.5">
          {BAND_ORDER.map((b) => {
            const items = filtered
              .filter((i) => i.risk.level === b)
              .sort((a, c) => c.risk.score - a.risk.score)
            if (!items.length) return null
            const bInfo = riskBand(b === 'low' ? 2 : b === 'moderate' ? 7 : b === 'high' ? 12 : 20)
            return (
              <li key={b}>
                <p className="flex items-center gap-1.5 py-1 text-xs">
                  <span
                    className="size-2 rounded-[2px]"
                    style={{ background: bInfo.dim, border: `1px solid ${alpha(bInfo.color, 40)}` }}
                  />
                  <span className="font-medium" style={{ color: bInfo.color }}>
                    {bInfo.label}
                  </span>
                  <span className="text-ink-muted tnum">({items.length})</span>
                </p>
                <ul className="mt-1 space-y-1">
                  {items.slice(0, 5).map((inc) => {
                    const sev = SEVERITY_TONE[inc.risk.severity]
                    return (
                      <li key={inc.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/incidents/${inc.id}`)}
                          className="flex w-full items-center gap-2 rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-left transition-colors active:bg-surface-3"
                        >
                          <span
                            className={cn(
                              'flex size-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold tnum',
                              sev.bg,
                              sev.text,
                              sev.border,
                            )}
                          >
                            {inc.risk.score}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-xs text-brand">
                              {inc.ref}
                            </span>
                            <span className="block truncate text-xs text-ink-muted">
                              {inc.title}
                            </span>
                          </span>
                          <Plane className="size-3 shrink-0 text-ink-muted" />
                        </button>
                      </li>
                    )
                  })}
                  {items.length > 5 && (
                    <li className="px-1 text-xs text-ink-muted tnum">
                      +{items.length - 5} more in this band
                    </li>
                  )}
                </ul>
              </li>
            )
          })}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-muted">
              No active incidents in the selected band.
            </p>
          )}
        </ul>
      </ChartCard>
    )
  }

  const body = (
    <div ref={wrapRef} className={cn('relative', height)}>
      <div className="flex gap-2">
        {/* ---- Y axis: severity ---- */}
        <div className="flex w-[62px] shrink-0 flex-col justify-between pb-[22px] pt-0.5">
          <span className="mb-1 text-center text-xs font-semibold text-ink-muted">
            Sev
          </span>
          {SEVERITY_AXIS.map((s) => (
            <div key={s.v} className="flex flex-1 flex-col items-center justify-center gap-0.5">
              <span className="text-xs font-semibold text-ink-soft tnum">{s.v}</span>
              <span className="text-xs leading-none text-ink-muted">
                {s.short}
              </span>
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
          <div className="min-w-[420px]">
            {/* ---- grid ---- */}
            <div className="grid w-full max-w-[328px] grid-cols-5 gap-[2px]">
              {SEVERITY_AXIS.map((s) =>
                LIKELIHOOD_AXIS.map((l) => {
                  const score = s.v * l.v
                  const b = riskBand(score)
                  const key = `${l.v}-${s.v}`
                  const items = cells.get(key) ?? []
                  const interactive = items.length > 0
                  return (
                    <div
                      key={key}
                      data-risk-cell={key}
                      role={interactive ? 'button' : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-label={
                        interactive
                          ? `Cell likelihood ${l.v}, severity ${s.v}: ${items.length} occurrence${items.length === 1 ? '' : 's'}, score ${score}, ${b.label} band. Activate to list them.`
                          : undefined
                      }
                      onClick={() => onCellClick?.(key)}
                      onKeyDown={
                        interactive
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                onCellClick?.(key)
                              }
                            }
                          : undefined
                      }
                      className="group/cell relative aspect-square overflow-hidden rounded-[6px] border transition-colors duration-150"
                      style={{
                        background: b.dim,
                        borderColor: alpha(b.color, 18),
                      }}
                    >
                      {/* band underlay for a readable grid without loud fills */}
                      <div
                        className="pointer-events-none absolute inset-0 opacity-[0.55]"
                        style={{
                          background: `linear-gradient(140deg, ${alpha(b.color, 13)}, transparent 70%)`,
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute right-1.5 top-1 text-xs font-semibold tnum opacity-45"
                        style={{ color: b.color }}
                      >
                        {score}
                      </span>

                      {/* one solid count circle per occupied cell */}
                      {items.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            type="button"
                            onMouseEnter={(e) => {
                              setFocused(null)
                              onEnter(items[0], e)
                            }}
                            onMouseMove={(e) => onEnter(items[0], e)}
                            onMouseLeave={() => setHover(null)}
                            onFocus={() => setFocused(items[0])}
                            onBlur={() => setFocused(null)}
                            onClick={() => navigate(`/incidents/${items[0].id}`)}
                            className={cn(
                              'flex size-6 items-center justify-center rounded-full border text-xs font-semibold tnum transition-all duration-150',
                              'hover:z-20 hover:scale-110 focus-visible:z-20 focus-visible:scale-110 focus-visible:outline-none',
                              (focused?.id === items[0].id || hover?.inc.id === items[0].id) &&
                                'z-20 scale-110 ring-2 ring-ink/60',
                            )}
                            style={{ background: b.color, borderColor: alpha(b.color, 70), color: b.ink }}
                            aria-label={`${items[0].ref}, risk ${items[0].risk.score}, ${items.length} in cell`}
                          >
                            {items.length}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                }),
              )}
            </div>

            {/* ---- X axis: likelihood ---- */}
            <div className="mt-1.5 grid w-full max-w-[328px] grid-cols-5 gap-[2px]">
              {LIKELIHOOD_AXIS.map((l) => (
                <div key={l.v} className="text-center">
                  <div className="text-xs font-semibold text-ink-soft tnum">{l.v}</div>
                  <div className="mt-0.5 text-xs leading-tight text-ink-muted">
                    {l.label === 'Almost Certain' ? 'Certain' : l.label}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1 text-center text-xs font-medium text-ink-muted">
              Likelihood
            </div>

            {showLegend && (
              <ul className="mt-4 space-y-1.5" aria-label="Risk bands and counts">
                {BAND_ORDER.map((level) => {
                  const band = RISK_BANDS.find((x) => x.level === level)
                  if (!band) return null
                  const count = incidents.filter(
                    (i) => riskBand(i.risk.score).level === level,
                  ).length
                  return (
                    <li key={level} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-ink-soft">
                        <span className="size-2 rounded-[2px]" style={{ background: band.color }} />
                        {band.label}
                      </span>
                      <span className="tnum text-ink-muted">{count}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ---- hover card ---- */}
      {detail && detailBand && (
        <div
          className="pointer-events-none absolute z-30 w-[212px] rounded-lg border border-line-strong bg-surface-2 p-2.5 pop-shadow animate-fade-in"
          style={{
            left: shown!.x > 240 ? shown!.x - 222 : shown!.x + 14,
            top: Math.max(0, shown!.y - 24),
          }}
          role="tooltip"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-ink">{detail.ref}</span>
            <span
              className="rounded px-1.5 py-px text-xs font-semibold tnum"
              style={{ color: detailBand.color, background: detailBand.dim }}
            >
              {detail.risk.score}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-ink-soft">{detail.title}</p>
          <dl className="mt-2 space-y-1 border-t border-line-soft pt-2 text-xs">
            {[
              ['Severity', `${SEVERITY_TONE[detail.risk.severity].label} (${SEVERITY_VALUE[detail.risk.severity]})`],
              [
                'Likelihood',
                `${LIKELIHOOD_LABEL[detail.risk.likelihood]} (${detail.risk.likelihood})`,
              ],
              ['Aircraft', aircraftById(detail.aircraftId)?.registration ?? '—'],
              ['Date', fmtDate(detail.occurredAt)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="truncate font-medium text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line-soft pt-2">
            <StatusBadge status={detail.status} size="sm" />
            <span className="text-xs font-medium text-brand">Open →</span>
          </div>
        </div>
      )}

      {/* ---- legend (also the band filter) ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-x-1 border-t border-line-soft pt-2.5">
        {BAND_ORDER.map((b) => {
          const bInfo = riskBand(b === 'low' ? 2 : b === 'moderate' ? 7 : b === 'high' ? 12 : 20)
          const on = band === b
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBand(on ? 'all' : b)}
              aria-pressed={on}
              title={`${on ? 'Clear filter' : 'Show only'} ${bInfo.label} risk band`}
              className={cn(
                'flex items-center gap-1.5 rounded px-1.5 py-1 text-xs transition-colors duration-150',
                on ? 'bg-surface-3' : 'hover:bg-surface-2',
                band !== 'all' && !on && 'opacity-45',
              )}
            >
              <span
                className="size-2.5 rounded-sm border"
                style={{ background: bInfo.dim, borderColor: alpha(bInfo.color, 40) }}
              />
              <span style={{ color: bInfo.color }} className="font-medium">
                {bInfo.label}
              </span>
              <span className="text-ink-muted tnum">{counts[b] ?? 0}</span>
            </button>
          )
        })}
        <span className="ml-auto flex items-center gap-1.5 pr-1.5 text-xs text-ink-muted">
          <span className="flex size-3 items-center justify-center rounded-full border border-crit/50 bg-crit/12">
            <Plane className="size-1.5 text-crit-ink" />
          </span>
          Regulator notified
        </span>
      </div>
    </div>
  )

  if (!showHeader) return <div className={className}>{body}</div>

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      className={className}
      info="Risk score = severity (1–5) × likelihood (1–5). Bands follow the operator SMS risk acceptance criteria."
      actions={
        <div className="flex items-center gap-1.5">
          <Select value={band} onValueChange={setBand}>
            <SelectTrigger size="sm" className="w-[122px]" aria-label="Filter risk band">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bands</SelectItem>
              <SelectItem value="low">Low only</SelectItem>
              <SelectItem value="moderate">Moderate only</SelectItem>
              <SelectItem value="high">High only</SelectItem>
              <SelectItem value="critical">Critical only</SelectItem>
            </SelectContent>
          </Select>
          {filtered.length === 0 ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setBand('all')} aria-label="Reset filter">
              <X />
            </Button>
          ) : (
            <span className="rounded border border-line bg-surface-3 px-1.5 py-0.5 text-xs font-medium text-ink-soft tnum">
              {filtered.length}
            </span>
          )}
        </div>
      }
    >
      {active.length === 0 ? (
        <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center">
          <TriangleAlert className="size-5 text-ink-muted" />
          <p className="text-sm text-ink-muted">No active incidents to plot</p>
          <p className="text-xs text-ink-muted">
            All occurrences are closed or in draft. Clear the band filter to review closed events.
          </p>
        </div>
      ) : (
        body
      )}
    </ChartCard>
  )
}
