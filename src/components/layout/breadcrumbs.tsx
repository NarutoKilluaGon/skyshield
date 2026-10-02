import { Fragment } from 'react'
import { Link, useLocation, useMatches } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

/**
 * Breadcrumbs only render for depth 2+ (hidden on top-level pages).
 */
const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  incidents: 'Incidents',
  report: 'Report Incident',
  investigations: 'Investigations',
  actions: 'Actions',
  reports: 'Reports',
  rca: 'Root Cause Analysis',
  'five-whys': '5 Whys',
  'risk-matrix': 'Risk Matrix',
  capa: 'Actions',
  analytics: 'Analytics',
  compliance: 'Compliance',
  settings: 'Settings',
  notifications: 'Notification Centre',
}

const labelFor = (seg: string) => {
  if (/^inc_/.test(seg)) return 'Incident Record'
  if (/^rca_/.test(seg)) return 'RCA'
  return (
    LABELS[seg] ??
    seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function fromPathname(pathname: string): Crumb[] {
  const segs = pathname.split('/').filter(Boolean)
  return [
    { label: 'Dashboard', to: '/dashboard' },
    ...segs.map((seg, i) => ({
      label: labelFor(seg),
      to: `/${segs.slice(0, i + 1).join('/')}`,
    })),
  ]
}

export function Breadcrumbs({ items, className }: { items?: Crumb[]; className?: string }) {
  const { pathname } = useLocation()
  const matches = useMatches() as { handle?: { breadcrumb?: Crumb[] } }[]

  const declared = matches.map((m) => m.handle?.breadcrumb).find(Boolean)
  const crumbs = items ?? declared ?? fromPathname(pathname)

  // Top-level pages (Home + one) show no trail.
  if (crumbs.length <= 2) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex items-center gap-1 text-xs text-ink-muted">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 && (
                <ChevronRight className="size-3 shrink-0 text-ink-muted" aria-hidden="true" />
              )}
              <li className="min-w-0">
                {c.to && !last ? (
                  <Link
                    to={c.to}
                    className="flex items-center gap-1 truncate transition-colors hover:text-ink-soft"
                  >
                    {i === 0 && <Home className="size-3 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{c.label}</span>
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'flex items-center gap-1 truncate',
                      last ? 'font-medium text-ink' : 'text-ink-muted',
                    )}
                    aria-current={last ? 'page' : undefined}
                  >
                    {i === 0 && <Home className="size-3 shrink-0" aria-hidden="true" />}
                    <span className="truncate">{c.label}</span>
                  </span>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
