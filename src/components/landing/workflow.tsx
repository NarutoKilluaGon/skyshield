import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { useInView } from '@/hooks/use-in-view'
import { Reveal } from '@/components/landing/reveal'
import { HowItWorksButton } from '@/components/landing/tour/how-it-works-tour'

const STEPS = [
  {
    num: '01',
    title: 'Report',
    desc: 'Occurrence logged from flight deck, line maintenance or ground operations with confidential isolation.',
    screen: 'Report incident',
    to: '/incidents/report',
  },
  {
    num: '02',
    title: 'Assess',
    desc: 'Initial risk score graded on the ICAO 5×5 matrix with mandatory DGCA/AAIB regulatory notification flags.',
    screen: 'Risk matrix',
    to: '/rca/risk-matrix',
  },
  {
    num: '03',
    title: 'Investigate',
    desc: 'Telemetry evidence attached, flight timeline reconstructed, and root causes diagnosed via 5 Whys.',
    screen: 'Active investigations',
    to: '/investigations',
  },
  {
    num: '04',
    title: 'Correct',
    desc: 'Corrective and preventive actions assigned to owners with active SLA countdowns and progress tracking.',
    screen: 'CAPA tracking',
    to: '/capa',
  },
  {
    num: '05',
    title: 'Verify',
    desc: 'Action effectiveness validated, safety case closed, and tamper-evident audit log export produced.',
    screen: 'Compliance',
    to: '/compliance',
  },
]

export function Workflow() {
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { threshold: 0.15, once: true })

  return (
    <section
      id="workflow"
      ref={sectionRef}
      className="border-b border-line bg-canvas py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand">Operational sequence</p>
          <h2 className="mt-2 font-condensed text-display-2 font-semibold text-ink">
            From occurrence to closed verification
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            Safety reports move through a continuous five-stage workflow, ensuring every finding is
            actioned and verified according to ICAO Annex 19 standards.
          </p>
        </div>

        {/* Workflow steps */}
        <div className="relative mt-12 sm:mt-16">
          {/* Connecting line (desktop) */}
          <div
            aria-hidden="true"
            className="absolute left-0 top-6 hidden h-px w-full bg-line-strong md:block"
          >
            <div
              className="h-full bg-brand transition-all duration-1000 ease-out"
              style={{ width: inView ? '100%' : '0%' }}
            />
          </div>

          <div className="grid gap-8 md:grid-cols-5 md:gap-4 lg:gap-6">
            {STEPS.map((step, i) => (
              <Reveal
                key={step.num}
                delay={i * 110}
                className="relative flex flex-col"
              >
                {/* Step indicator node */}
                <div className="flex items-center gap-3 md:flex-col md:items-start">
                  <div
                    className={`flex size-11 items-center justify-center rounded-md border font-mono text-xs font-semibold transition-colors duration-300 ${
                      inView
                        ? 'border-brand bg-brand text-on-brand shadow-sm'
                        : 'border-line-strong bg-surface text-ink'
                    }`}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-base font-semibold text-ink md:mt-4">{step.title}</h3>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                  {step.desc}
                </p>

                <div className="mt-4 pt-3 border-t border-line-soft">
                  <Link
                    to={step.to}
                    className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft transition-colors hover:text-brand"
                  >
                    <span>{step.screen}</span>
                    <ArrowUpRight className="size-3 text-ink-muted" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Guided-tour handoff */}
          <Reveal
            delay={120}
            className="mt-12 flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="max-w-xl text-sm leading-relaxed text-ink-muted">
              Want the full story? Open the guided tour for a two-minute walkthrough of every
              stage — with the diagrams, roles and guardrails explained.
            </p>
            <HowItWorksButton variant="secondary" label="Open the guided tour" className="shrink-0" />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
