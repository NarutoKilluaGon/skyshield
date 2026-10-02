import { Link } from 'react-router-dom'
import { ArrowRight, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Reveal } from '@/components/landing/reveal'

export function ProductDeepDives() {
  const WHYS = [
    {
      level: 1,
      why: 'Aircraft veered off runway during high-speed rollout',
      factor: 'Operational',
    },
    {
      level: 2,
      why: 'Differential braking command failed to decelerate right main gear',
      factor: 'Mechanical',
    },
    {
      level: 3,
      why: 'Right brake servo valve exhibited intermittent spool response',
      factor: 'Component',
    },
    {
      level: 4,
      why: 'Hydraulic particulate debris clogged proportional pilot orifice',
      factor: 'Fluid contamination',
    },
    {
      level: 5,
      why: 'Filter bypass indicator sensor failed open without cockpit advisory',
      factor: 'Root Cause',
      isRoot: true,
    },
  ]

  return (
    <div id="product" className="divide-y divide-line border-b border-line bg-canvas">
      {/* 4a: Risk matrix */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
            <Reveal className="lg:col-span-5">
              <span className="font-mono text-xs uppercase tracking-wider text-brand">Risk Matrix</span>
              <h2 className="mt-2 font-condensed text-display-2 font-semibold text-ink leading-tight">
                See where risk sits, not just how many reports there are.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                Raw occurrence counts create false reassurance. SkyShield plots every event on a 5×5 ICAO
                risk matrix using calibrated severity and probability metrics. Critical risk clusters pop
                immediately, triggering mandatory reporting and investigation protocols.
              </p>
              <div className="mt-6">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/rca/risk-matrix" className="gap-2">
                    Explore risk matrix <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={140} className="lg:col-span-7">
              <div className="lift rounded-lg border border-line bg-surface p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">ICAO 5×5 Risk Assessment</span>
                    <span className="text-xs text-ink-muted">· Real-time triage</span>
                  </div>
                  <Badge tone="red" size="sm">1 Critical (Score 16)</Badge>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-1.5">
                  {[5, 4, 3, 2, 1].map((sev) =>
                    [1, 2, 3, 4, 5].map((lik) => {
                      const score = sev * lik
                      const isTarget = sev === 4 && lik === 4
                      let bg = 'bg-ok-wash text-ok-ink'
                      if (score >= 15) bg = 'bg-crit-wash text-crit-ink'
                      else if (score >= 10) bg = 'bg-alert-wash text-alert-ink'
                      else if (score >= 4) bg = 'bg-warn-wash text-warn-ink'

                      return (
                        <div
                          key={`${sev}-${lik}`}
                          className={`relative aspect-square rounded-sm p-1.5 flex flex-col justify-between border ${
                            isTarget
                              ? 'border-crit ring-1 ring-crit/50 bg-crit/20'
                              : 'border-line/40'
                          } ${bg}`}
                        >
                          <span aria-hidden="true" className="font-mono text-xs text-ink-soft">{sev}×{lik}</span>
                          {isTarget && (
                            <div className="self-end flex items-center justify-center size-5 rounded-full bg-crit text-white font-mono text-xs font-bold shadow">
                              1
                            </div>
                          )}
                        </div>
                      )
                    }),
                  )}
                </div>

                {/* Highlighted occurrence detail crop */}
                <div className="mt-4 rounded-md border border-crit/40 bg-crit-wash/40 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="size-4 text-crit-ink" />
                      <span className="font-mono text-xs font-semibold text-ink">INC-2026-0258</span>
                      <span className="text-xs text-ink-soft">Runway excursion on landing rollout</span>
                    </div>
                    <span className="font-mono text-xs text-crit-ink font-semibold">Risk: 16 (4×4)</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Aircraft: A320neo (VT-ALB) · Airport: DEL · Triaged to Lead Investigator
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4b: Root cause analysis */}
      <section className="py-16 sm:py-24 bg-canvas-deep">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
            {/* UI Crop left */}
            <Reveal delay={140} className="order-2 lg:order-1 lg:col-span-7">
              <div className="lift rounded-lg border border-line bg-surface p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">5 Whys Causal Tree</span>
                    <span className="text-xs text-ink-muted">· INV-2026-041</span>
                  </div>
                  <span className="font-mono text-xs text-ok-ink">Root cause verified</span>
                </div>

                <div className="relative mt-4 space-y-3">
                  {WHYS.map((w, wi) => (
                    <Reveal
                      key={w.level}
                      delay={wi * 130}
                      className={`relative flex items-start gap-3 rounded-md border p-2.5 transition-all duration-300 ${
                        w.isRoot
                          ? 'border-brand/60 bg-brand-wash/30 text-ink'
                          : 'border-line-soft bg-surface-2 text-ink-soft'
                      }`}
                    >
                      <div
                        className={`flex size-6 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${
                          w.isRoot ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-muted'
                        }`}
                      >
                        W{w.level}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-relaxed font-medium">{w.why}</p>
                        <span className="mt-0.5 inline-block font-mono text-[10px] text-ink-muted">
                          Factor: {w.factor}
                        </span>
                      </div>
                      {w.isRoot && (
                        <CheckCircle2 className="size-4 shrink-0 text-brand" />
                      )}
                    </Reveal>
                  ))}
                </div>
              </div>
            </Reveal>

            {/* Text right */}
            <Reveal className="order-1 lg:order-2 lg:col-span-5">
              <span className="font-mono text-xs uppercase tracking-wider text-brand">Root Cause Analysis</span>
              <h2 className="mt-2 font-condensed text-display-2 font-semibold text-ink leading-tight">
                5 Whys and contributing factors kept with the incident.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                Causal analysis should never live in disconnected spreadsheets. SkyShield embeds the 5
                Whys sequence directly into the investigation record, connecting symptom to root cause while
                classifying organizational, environmental, and human factors.
              </p>
              <div className="mt-6">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/rca/five-whys" className="gap-2">
                    Open 5 Whys workspace <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 4c: Corrective actions (CAPA) */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
            <Reveal className="lg:col-span-5">
              <span className="font-mono text-xs uppercase tracking-wider text-brand">Corrective Actions</span>
              <h2 className="mt-2 font-condensed text-display-2 font-semibold text-ink leading-tight">
                Owners, due dates and overdue tracking that reach the incident record.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-ink-muted">
                Safety recommendations are useless without follow-through. Track every CAPA through
                implementation, SLA monitoring, and verification of effectiveness with direct links back to
                the primary occurrence.
              </p>
              <div className="mt-6">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/capa" className="gap-2">
                    View CAPA tracking <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </Reveal>

            <Reveal delay={140} className="lg:col-span-7">
              <div className="lift rounded-lg border border-line bg-surface p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-ink">Active CAPA Register</span>
                    <span className="text-xs text-ink-muted">· SLA countdowns</span>
                  </div>
                  <span className="font-mono text-xs text-crit-ink font-medium">1 Overdue SLA</span>
                </div>

                <div className="mt-3 divide-y divide-line-soft">
                  {/* Row 1: Overdue */}
                  <div className="py-3 flex items-center justify-between rounded-md px-2 bg-crit-wash/40 border border-crit/30">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <AlertOctagon className="size-3.5 text-crit-ink shrink-0" />
                        <span className="font-mono text-xs font-semibold text-ink">CAPA-2026-088</span>
                        <Badge tone="red" size="sm">2 days overdue</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-soft">
                        Replace hydraulic filter housing seals across line stations
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-ink-muted">Owner: M. Sharma</span>
                    </div>
                  </div>

                  {/* Row 2: Approaching */}
                  <div className="py-3 flex items-center justify-between px-2">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink">CAPA-2026-089</span>
                        <Badge tone="orange" size="sm">Due in 3 days</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-soft">
                        Inspect brake servo valve batch lot #4412
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-ink-muted">Owner: R. Chen</span>
                    </div>
                  </div>

                  {/* Row 3: In progress */}
                  <div className="py-3 flex items-center justify-between px-2">
                    <div className="min-w-0 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-ink">CAPA-2026-090</span>
                        <Badge tone="amber" size="sm">Verification</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-soft">
                        Revise line maintenance filter check task card (AMM 32-42)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs text-ink-muted">Owner: J. Miller</span>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  )
}
