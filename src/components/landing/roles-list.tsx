import { Reveal } from '@/components/landing/reveal'

const ROLES = [
  {
    role: 'Safety manager',
    action: 'Maintains organizational risk appetite, triages high-severity occurrences, and assigns investigation leads.',
  },
  {
    role: 'Lead investigator',
    action: 'Conducts structured 5 Whys root cause analysis, attaches QAR/FDR telemetry, and reconstructs timelines.',
  },
  {
    role: 'Safety officer',
    action: 'Files immediate air safety and ground occurrence reports from flight ops, line stations, or maintenance hangars.',
  },
  {
    role: 'Compliance auditor',
    action: 'Validates closing effectiveness, generates ICAO/DGCA occurrence packages, and inspects tamper-evident audit logs.',
  },
]

export function RolesList() {
  return (
    <section id="roles" className="border-b border-line bg-canvas py-16 sm:py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand">Access & Responsibility</p>
          <h2 className="mt-2 font-condensed text-display-2 font-semibold text-ink">
            Calibrated for operational roles
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            Each role interacts with a focused subset of the safety management system to ensure clarity,
            compliance, and data confidentiality.
          </p>
        </div>

        <dl className="mt-12 divide-y divide-line-soft border-y border-line-soft">
          {ROLES.map(({ role, action }, i) => (
            <Reveal
              key={role}
              delay={i * 90}
              className="grid gap-3 py-6 sm:grid-cols-12 sm:items-baseline"
            >
              <dt className="text-base font-semibold text-ink sm:col-span-4 lg:col-span-3">
                {role}
              </dt>
              <dd className="text-sm leading-relaxed text-ink-muted sm:col-span-8 lg:col-span-9">
                {action}
              </dd>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  )
}
