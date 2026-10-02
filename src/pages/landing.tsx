import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { LandingNav } from '@/components/landing/landing-nav'
import { Hero } from '@/components/landing/hero'
import { Workflow } from '@/components/landing/workflow'
import { ProductDeepDives } from '@/components/landing/product-deep-dives'
import { RolesList } from '@/components/landing/roles-list'
import { TrustSection } from '@/components/landing/trust-section'
import { LandingCta } from '@/components/landing/landing-cta'
import { LandingFooter } from '@/components/landing/landing-footer'
import { HowItWorksTourProvider } from '@/components/landing/tour/how-it-works-tour'

export default function LandingPage() {
  const { pathname } = useLocation()

  useEffect(() => {
    const previous = document.title
    document.title = 'SkyShield — Aviation Safety Intelligence'
    return () => {
      document.title = previous
    }
  }, [])

  // Scroll reveals for the motion kit (src/index.css "LANDING PAGE MOTION").
  // The kit contract (index.css): .reveal starts hidden; the observer adds
  // .reveal-in which runs reveal-up with an optional --reveal-delay. Reduced
  // motion forces .reveal visible and kills the animation; environments
  // without IntersectionObserver get everything revealed immediately.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'))
    if (!els.length) return
    if (typeof IntersectionObserver === 'undefined') {
      // No observer (jsdom / ancient browsers): show everything rather than
      // leaving sections invisible.
      els.forEach((el) => el.classList.add('reveal-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pathname])

  // Scroll-lock safety net (same as AppShell): the guided tour and dialogs
  // lock body scroll while open; if one unmounts during a navigation (e.g.
  // "Explore live demo") the lock can survive and leave the page frozen —
  // restore scrollability on every route change.
  useEffect(() => {
    const b = document.body
    if (b.style.overflow === 'hidden') b.style.overflow = ''
    if (b.style.paddingRight) b.style.paddingRight = ''
  }, [pathname])

  return (
    <HowItWorksTourProvider>
      <div className="min-h-dvh bg-canvas text-ink selection:bg-brand-wash selection:text-ink">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-surface-2 focus:px-3 focus:py-2 focus:text-xs text-ink focus:outline-2 focus:outline-brand"
        >
          Skip to content
        </a>

        <LandingNav />

        <main id="main-content">
          <Hero />
          <div className="reveal" style={{ '--reveal-delay': '40ms' } as React.CSSProperties}>
            <Workflow />
          </div>
          <div className="reveal" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>
            <ProductDeepDives />
          </div>
          <div className="reveal" style={{ '--reveal-delay': '60ms' } as React.CSSProperties}>
            <RolesList />
          </div>
          <div className="reveal" style={{ '--reveal-delay': '60ms' } as React.CSSProperties}>
            <TrustSection />
          </div>
          <div className="reveal">
            <LandingCta />
          </div>
        </main>

        <LandingFooter />
      </div>
    </HowItWorksTourProvider>
  )
}
