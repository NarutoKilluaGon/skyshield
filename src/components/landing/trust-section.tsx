import { Link } from 'react-router-dom'
import { Lock, EyeOff, Shield, ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/landing/reveal'

const TRUST_ITEMS = [
  {
    icon: Lock,
    title: 'Role-based access control',
    desc: 'Permissions are strictly enforced across five roles. Only assigned investigators can modify RCA nodes; only safety managers can seal investigation closures.',
  },
  {
    icon: EyeOff,
    title: 'Anonymous safety intake',
    desc: 'Whistleblower and confidential occurrence reports are decoupled from authenticated credentials, ensuring open safety culture without fear of reprisal.',
  },
  {
    icon: Shield,
    title: 'Confidentiality isolation',
    desc: 'Mandatory and voluntary reports are tagged with discrete visibility classifications, restricting sensitive flight deck and medical findings to authorized staff.',
  },
]

const STANDARDS = [
  'ICAO Annex 19',
  'ICAO Doc 9859',
  'DGCA notification windows',
  'AAIB occurrence packages',
  '5×5 risk matrix',
  '5 Whys RCA',
  'CAPA · SLA monitoring',
  'Tamper-evident audit trail',
  'Anonymous intake',
  'Role-based access control',
  'WCAG AA in both themes',
]

function StandardsMarquee() {
  const items = [...STANDARDS, ...STANDARDS]
  return (
    <div className="marquee mt-10 border-y border-line-soft py-3" aria-hidden="true">
      <div className="marquee-track">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="flex shrink-0 items-center gap-4 pr-10 font-mono text-xs text-ink-muted">
            {item}
            <span className="size-1 rotate-45 bg-brand/60" />
          </span>
        ))}
      </div>
    </div>
  )
}

export function TrustSection() {
  return (
    <section id="security" className="border-b border-line bg-canvas-deep py-16 sm:py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-wider text-brand">Integrity & Governance</p>
          <h2 className="mt-2 font-condensed text-display-2 font-semibold text-ink">
            Engineered for certified aviation compliance
          </h2>
          <p className="mt-3 text-base text-ink-muted">
            Safety records require clear boundary enforcement and confidential reporting options from day one.
          </p>
        </div>

        <StandardsMarquee />

        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {TRUST_ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={i * 120} className="lift group rounded-lg border border-line bg-surface p-5">
              <div className="flex size-9 items-center justify-center rounded-md bg-brand-wash text-brand transition-transform duration-200 group-hover:scale-110">
                <item.icon className="size-4" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-ink">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">{item.desc}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-line-soft bg-surface-2 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-brand" />
            <span className="text-sm font-medium text-ink">Need to report a safety concern confidentially?</span>
          </div>
          <Link
            to="/report"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
          >
            Report anonymously <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
