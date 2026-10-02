import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/landing/reveal'
import { HowItWorksButton } from '@/components/landing/tour/how-it-works-tour'

export function LandingCta() {
  return (
    <section className="border-b border-line bg-canvas py-16 sm:py-24">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <Reveal className="rounded-lg border border-line bg-surface p-8 sm:p-12 lg:p-16">
          <div className="max-w-2xl">
            <h2 className="font-condensed text-display-2 font-semibold text-ink">
              Start with your next report.
            </h2>
            <p className="mt-4 text-base text-ink-muted">
              Whether you operate a commercial fleet or a regional charter, SkyShield delivers the
              rigorous structure required for certified safety operations.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" asChild className="btn-shine">
                <Link to="/signup">Get started</Link>
              </Button>
              <HowItWorksButton variant="secondary" size="lg" className="lift" />
              <Button variant="outline" size="lg" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
