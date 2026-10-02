import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/common/logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useHowItWorksTour } from '@/components/landing/tour/how-it-works-tour'

const LINKS = [
  { label: 'Product', to: '#product', id: 'product' },
  { label: 'Workflow', to: '#workflow', id: 'workflow' },
  { label: 'Roles', to: '#roles', id: 'roles' },
  { label: 'Security', to: '#security', id: 'security' },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { openTour } = useHowItWorksTour()

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8)
      const doc = document.documentElement
      const max = doc.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Scrollspy: highlight the section currently in view (skipped in jsdom).
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (!sections.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActiveId(visible.target.id)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.2, 0.6] },
    )
    sections.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 h-12 transition-colors duration-150',
        scrolled || open
          ? 'border-b border-line bg-canvas'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center" aria-label="SkyShield home">
          <Wordmark />
        </Link>

        {/* Desktop anchor links + tour trigger */}
        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.to}
              href={link.to}
              className={cn(
                'relative text-sm font-medium transition-colors duration-120 hover:text-ink',
                activeId === link.id ? 'text-ink' : 'text-ink-muted',
              )}
            >
              {link.label}
              {activeId === link.id && (
                <span aria-hidden="true" className="absolute -bottom-1 left-0 h-px w-full bg-brand" />
              )}
            </a>
          ))}
          <button
            type="button"
            onClick={openTour}
            data-tour-open
            className="text-sm font-medium text-ink-muted transition-colors duration-120 hover:text-brand"
          >
            How it works
          </button>
        </nav>

        {/* Right side CTA actions */}
        <div className="hidden items-center gap-2.5 md:flex">
          {user ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild className="btn-shine">
                <Link to="/signup">Get started</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            className="flex size-9 items-center justify-center rounded-md border border-line-strong text-ink hover:bg-surface-3"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Reading progress — a hairline that tracks document scroll */}
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-transparent">
        <div
          className="h-full origin-left bg-brand transition-transform duration-150 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div
          id="landing-mobile-nav"
          className="border-b border-line bg-canvas px-4 py-4 md:hidden"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col space-y-3">
            {LINKS.map((link) => (
              <a
                key={link.to}
                href={link.to}
                onClick={() => setOpen(false)}
                className="py-1 text-sm font-medium text-ink-soft hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              data-tour-open
              onClick={() => {
                setOpen(false)
                openTour()
              }}
              className="py-1 text-left text-sm font-medium text-brand hover:text-brand-hover"
            >
              How it works
            </button>
            <div className="pt-3 border-t border-line-soft flex flex-col gap-2">
              {user ? (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link to="/dashboard">Open dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild className="w-full justify-start">
                    <Link to="/login">Sign in</Link>
                  </Button>
                  <Button size="sm" asChild className="w-full">
                    <Link to="/signup">Get started</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
