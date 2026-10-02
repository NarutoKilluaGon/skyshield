import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/common/logo'
import { useHowItWorksTour } from '@/components/landing/tour/how-it-works-tour'

const GROUPS = [
  {
    title: 'Product',
    links: [
      { label: 'Overview', to: '#product' },
      { label: 'Workflow', to: '#workflow' },
      { label: 'Roles', to: '#roles' },
      { label: 'Security & Trust', to: '#security' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Get started', to: '/signup' },
      { label: 'Report anonymously', to: '/report' },
      { label: 'Live dashboard', to: '/dashboard' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Terms of Service', to: '/terms' },
    ],
  },
]

export function LandingFooter() {
  const [utcTime, setUtcTime] = useState('')
  const { openTour } = useHowItWorksTour()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const hours = String(now.getUTCHours()).padStart(2, '0')
      const minutes = String(now.getUTCMinutes()).padStart(2, '0')
      setUtcTime(`${hours}:${minutes} UTC`)
    }
    updateTime()
    const timer = setInterval(updateTime, 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <footer className="border-t border-line bg-canvas-deep py-12 sm:py-16">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-5 md:gap-8">
          <div className="md:col-span-2">
            <Link to="/" className="inline-block" aria-label="SkyShield home">
              <Wordmark />
            </Link>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-ink-muted">
              Aviation safety management system built for certified operators. Occurrence
              intake, 5×5 ICAO risk triage, 5 Whys root cause analysis, and verified CAPA workflows.
            </p>
            {utcTime && (
              <div className="mt-4 flex items-center gap-2 font-mono text-xs text-ink-muted">
                <span className="size-1.5 rounded-full bg-ok" />
                <span>{utcTime}</span>
              </div>
            )}
          </div>

          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="font-mono text-xs uppercase tracking-wider text-ink-muted">
                {group.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.to.startsWith('#') ? (
                      <a
                        href={link.to}
                        className="text-xs text-ink-soft transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="text-xs text-ink-soft transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
                {group.title === 'Product' && (
                  <li>
                    <button
                      type="button"
                      data-tour-open
                      onClick={openTour}
                      className="text-left text-xs text-ink-soft transition-colors hover:text-brand"
                    >
                      How it works
                    </button>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line-soft pt-6 sm:flex-row sm:items-center sm:justify-between font-mono text-xs text-ink-muted">
          <p>© {new Date().getFullYear()} SkyShield Operations Inc. All rights reserved.</p>
          <p>ICAO Annex 19 Document 9859 compliant SMS architecture.</p>
        </div>
      </div>
    </footer>
  )
}
