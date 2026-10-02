import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, AlertTriangle, Clock, ShieldAlert, Loader2, PlaneTakeoff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { useCountUp } from '@/hooks/use-count-up'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { HowItWorksButton } from '@/components/landing/tour/how-it-works-tour'
import { daysUntil, fmtTime } from '@/lib/format'
import { INCIDENT_STATUS } from '@/lib/domain'
import type { Incident, CAPA } from '@/types'

// 5x5 Matrix definition
const SEVERITIES = [5, 4, 3, 2, 1] // Catastrophic down to Negligible
const LIKELIHOODS = [1, 2, 3, 4, 5] // Improbable up to Frequent

// Real demo markers on the 5x5 matrix
const MATRIX_MARKERS: Record<string, { ref: string; count: number; title: string }> = {
  '4-4': { ref: 'INC-2026-0258', count: 1, title: 'Runway excursion on touchdown' },
  '5-2': { ref: 'INC-2026-0411', count: 1, title: 'Uncontained engine debris' },
  '3-3': { ref: 'INC-2026-0104', count: 2, title: 'Birdstrike on initial climb' },
  '2-4': { ref: 'INC-2026-0089', count: 3, title: 'TCAS RA in terminal airspace' },
  '1-2': { ref: 'INC-2026-0012', count: 1, title: 'Galley latch failure' },
}

function getRiskBandColor(sev: number, lik: number): string {
  const score = sev * lik
  if (score >= 15) return 'bg-crit-wash text-crit-ink hover:bg-crit/20'
  if (score >= 10) return 'bg-alert-wash text-alert-ink hover:bg-alert/20'
  if (score >= 4) return 'bg-warn-wash text-warn-ink hover:bg-warn/20'
  return 'bg-ok-wash text-ok-ink hover:bg-ok/20'
}

/** Departure-board row derived from a live register record. */
interface BoardRow {
  id: string
  flight: string
  route: string
  time: string
  statusLabel: string
  statusDot: string
}

export function Hero() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [demoLoading, setDemoLoading] = useState(false)
  const reducedMotion = useReducedMotion()

  // Live figures from the same register the app reads — nothing hard-coded.
  const [stats, setStats] = useState({ attention: 0, active: 0, overdue: 0 })
  const [statsReady, setStatsReady] = useState(false)
  const [board, setBoard] = useState<BoardRow[]>([])

  useEffect(() => {
    let live = true
    // Dynamic imports keep the service/store layer out of the eager landing
    // entry chunk (bundle gate).
    Promise.all([import('@/services/incidents'), import('@/services/operations')])
      .then(([{ getAllIncidents }, { getCAPAs }]) => Promise.all([getAllIncidents(), getCAPAs()]))
      .then(([incidents, capas]: [Incident[], CAPA[]]) => {
        if (!live) return
        setStats({
          attention: incidents.filter((i) => i.status === 'reported').length,
          active: incidents.filter((i) => i.status !== 'closed' && i.status !== 'draft').length,
          overdue: capas.filter(
            (c) => (daysUntil(c.dueDate) ?? 0) < 0 && !['completed', 'verified'].includes(c.status),
          ).length,
        })
        setBoard(
          incidents
            .filter((i) => i.flight && i.status !== 'closed' && i.status !== 'draft')
            .slice(0, 4)
            .map((i) => {
              const st = INCIDENT_STATUS[i.status]
              return {
                id: i.id,
                flight: i.flight?.flightNumber ?? '—',
                route: `${i.flight?.origin ?? '—'} → ${i.flight?.destination ?? '—'}`,
                time: fmtTime(i.occurredAt),
                statusLabel: i.status === 'investigation' ? 'Under investigation' : st.label,
                statusDot: st.dot,
              }
            }),
        )
        setStatsReady(true)
      })
      .catch(() => live && setStatsReady(true))
    return () => {
      live = false
    }
  }, [])

  const attentionCount = useCountUp(stats.attention, { duration: 800, enabled: statsReady })
  const activeCount = useCountUp(stats.active, { duration: 900, enabled: statsReady })
  const overdueCount = useCountUp(stats.overdue, { duration: 700, enabled: statsReady })

  const handleDemo = async () => {
    setDemoLoading(true)
    try {
      await signIn('demo@skyshield.aero', 'demo1234', false)
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
      {/* Ambient background: instrument grid, brass wash, radar rings and one
          flowing route arc with a tracked aircraft. Decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="hero-grid absolute inset-0 opacity-60" />
        <div className="hero-glow absolute inset-0" />
        {/* Radar sweep centred behind the wordmark */}
        <div className="absolute left-1/2 top-[-140px] flex -translate-x-1/2 items-center justify-center">
          <div className="relative flex items-center justify-center" style={{ width: 'min(760px, 105vw)', height: 'min(760px, 105vw)' }}>
            <div className="radar-sweep absolute inset-0" />
            <div className="radar-ring absolute inset-[16%]" />
            <div className="radar-ring absolute inset-[34%]" />
            <div className="radar-ring absolute inset-[47%]" />
          </div>
        </div>
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 1400 620"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <path
            id="hero-route"
            d="M-60 520 Q 420 470 780 300 T 1500 40"
            className="route-leg stroke-brand/25"
            strokeWidth="1.4"
            strokeDasharray="5 9"
            strokeLinecap="round"
            style={{ ['--route-period' as string]: 14 }}
          />
          {!reducedMotion && (
            <g className="text-brand/70">
              <path d="M0 -4 L9 0 L0 4 L2.4 0 Z" fill="currentColor">
                <animateMotion dur="14s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#hero-route" />
                </animateMotion>
              </path>
            </g>
          )}
        </svg>
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* ---------------- centred wordmark stack ---------------- */}
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="anim-fade-sub flex items-center gap-2 font-mono text-xs text-ink-muted">
            <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
            Aviation safety management system
            <span aria-hidden="true" className="h-px w-8 bg-line-strong" />
          </p>

          <h1 className="hero-wordmark mt-4 select-none">
            <span className="anim-wipe-1 inline-block">Sky</span>
            <span className="hero-wordmark-shine anim-wipe-2 inline-block">Shield</span>
          </h1>

          {/* Tracked aircraft crossing under the name */}
          <p className="anim-fade-sub mt-3 flex items-center gap-2 font-mono text-xs text-brand">
            <PlaneTakeoff className="size-3.5" aria-hidden="true" />
            <span className="board-blink">•</span>
            every report followed to a verified action
          </p>

          <p className="anim-fade-sub mt-5 max-w-[62ch] text-md leading-relaxed text-ink-soft">
            Every safety report, followed through to a <span className="text-brand">closed action.</span>
          </p>
          <p className="anim-fade-sub mt-3 max-w-[64ch] text-base leading-relaxed text-ink-muted">
            SkyShield takes occurrence reports from first sighting through investigation,
            root cause and corrective action, and keeps the risk score and audit trail current.
          </p>

          <div className="anim-fade-sub mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="btn-shine">
              <Link to="/signup">Get started</Link>
            </Button>
            <HowItWorksButton
              variant="secondary"
              size="lg"
              className="lift"
              aria-label="How it works — open the guided tour of SkyShield"
            />
            <Button
              variant="outline"
              size="lg"
              onClick={handleDemo}
              disabled={demoLoading}
              className="gap-2"
            >
              {demoLoading ? (
                <Loader2 className="size-4 animate-spin text-brand" />
              ) : (
                <ArrowRight className="size-4 text-ink-muted" />
              )}
              View demo
            </Button>
          </div>

          <div className="anim-fade-sub mt-10 grid w-full max-w-lg grid-cols-3 gap-4 border-t border-line-soft pt-6 font-mono">
            <div>
              <span className="block text-xl font-semibold tabular-nums text-ink">{attentionCount}</span>
              <span className="font-sans text-xs text-ink-muted">Needs action</span>
            </div>
            <div>
              <span className="block text-xl font-semibold tabular-nums text-ink">{activeCount}</span>
              <span className="font-sans text-xs text-ink-muted">Active reports</span>
            </div>
            <div>
              <span className="block text-xl font-semibold tabular-nums text-crit-ink">{overdueCount}</span>
              <span className="font-sans text-xs text-ink-muted">Overdue CAPAs</span>
            </div>
          </div>
        </div>

        {/* ---------------- departure-board strip (live from the register) ---------------- */}
        {board.length > 0 && (
          <div className="anim-fade-sub mx-auto mt-10 max-w-4xl overflow-hidden rounded-lg border border-line bg-surface/80">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-2">
              <p className="flex items-center gap-2 font-mono text-xs text-ink-muted">
                <span className="board-blink size-1.5 rounded-full bg-ok" aria-hidden="true" />
                Live from the occurrence register
              </p>
              <p className="font-mono text-xs text-ink-faint">demonstration data</p>
            </div>
            <div className="grid grid-cols-[110px_minmax(0,1fr)_90px_auto] gap-x-4 border-b border-line-soft px-4 py-1.5 font-mono text-xs text-ink-faint max-sm:hidden">
              <span>Flight</span>
              <span>Route</span>
              <span className="text-right">Occurred</span>
              <span className="w-[150px] text-right">Status</span>
            </div>
            <ul>
              {board.map((row, i) => (
                <li
                  key={row.id}
                  className="board-row grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-line-soft/60 px-4 py-2.5 font-mono text-sm last:border-0 sm:grid-cols-[110px_minmax(0,1fr)_90px_auto]"
                  style={{ ['--d' as string]: `${260 + i * 110}ms` }}
                >
                  <span className="font-semibold text-brand">{row.flight}</span>
                  <span className="truncate text-ink-soft">{row.route}</span>
                  <span className="text-right text-xs text-ink-muted tnum max-sm:col-start-2 max-sm:row-start-1">
                    {row.time}
                  </span>
                  <span className="flex items-center justify-end gap-1.5 text-xs sm:w-[150px]">
                    <span className={`size-1.5 rounded-full ${row.statusDot}`} aria-hidden="true" />
                    <span className="font-sans text-ink-muted">{row.statusLabel}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---------------- product composition ---------------- */}
        <div className="anim-panel-rise mx-auto mt-12 max-w-5xl">
          <div className="rounded-lg border border-line bg-surface p-4 shadow-2xl sm:p-5">
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Needs attention block */}
              <div className="flex h-full flex-col border-b border-line pb-4 lg:border-b-0 lg:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-crit" />
                    <h2 className="text-sm font-semibold text-ink">Needs attention today</h2>
                  </div>
                  <span className="font-mono text-xs text-ink-soft">SLA window: 48h</span>
                </div>

                <div className="mt-3 space-y-2">
                  {/* rows */}
                  <div className="flex items-center justify-between rounded-md border border-line-soft bg-surface-2 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <ShieldAlert className="size-4 shrink-0 text-crit-ink" />
                      <span className="font-mono font-medium text-ink">INC-2026-0258</span>
                      <span className="truncate text-ink-soft">Runway excursion on landing roll · VT-ALB</span>
                    </div>
                    <Badge tone="red" size="sm">Critical · DGCA 24h</Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-line-soft bg-surface-2 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <Clock className="size-4 shrink-0 text-alert-ink" />
                      <span className="font-mono font-medium text-ink">CAPA-2026-088</span>
                      <span className="truncate text-ink-soft">Engine cowl latch inspection bulletin</span>
                    </div>
                    <Badge tone="orange" size="sm">2 days overdue</Badge>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-line-soft bg-surface-2 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <AlertTriangle className="size-4 shrink-0 text-warn-ink" />
                      <span className="font-mono font-medium text-ink">INV-2026-041</span>
                      <span className="truncate text-ink-soft">Dual hydraulic pressure fluctuation during climb</span>
                    </div>
                    <Badge tone="amber" size="sm">Review pending</Badge>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <Link
                    to="/incidents"
                    className="inline-flex items-center gap-1.5 rounded text-xs font-medium text-brand transition-colors hover:text-brand-hover focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    Open the full register
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {/* 5x5 Risk Matrix crop */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">5×5 Risk Matrix</h3>
                    <span className="text-xs text-ink-soft">(ICAO Doc 9859)</span>
                  </div>
                  <div className="hidden items-center gap-3 font-mono text-xs text-ink-soft sm:flex">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-crit" /> Critical
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-alert" /> High
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-warn" /> Moderate
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-xs bg-ok" /> Low
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {SEVERITIES.map((sev, rowIdx) =>
                    LIKELIHOODS.map((lik, colIdx) => {
                      const key = `${sev}-${lik}`
                      const marker = MATRIX_MARKERS[key]
                      const diagIndex = rowIdx + colIdx
                      const delayMs = reducedMotion ? 0 : diagIndex * 18

                      return (
                        <div
                          key={key}
                          style={{
                            animationDelay: `${delayMs}ms`,
                          }}
                          className={`relative aspect-square rounded-sm p-1.5 flex flex-col justify-between border border-line/40 transition-colors ${getRiskBandColor(
                            sev,
                            lik,
                          )}`}
                        >
                          <span aria-hidden="true" className="font-mono text-xs text-ink-soft">
                            {sev}×{lik}
                          </span>

                          {marker && (
                            <div className="self-end flex items-center justify-center size-5 rounded-full bg-ink text-canvas font-mono text-xs font-bold shadow-sm anim-scale-in">
                              {marker.count}
                            </div>
                          )}
                        </div>
                      )
                    }),
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-ink-soft">
                  <span>Severity (1=Negligible → 5=Catastrophic)</span>
                  <span>Likelihood (1=Extremely improbable → 5=Frequent)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
