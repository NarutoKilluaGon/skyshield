import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { NAV } from '@/components/layout/nav-config'

export default function NotFound() {
  const { pathname } = useLocation()

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-card border border-line bg-surface-2">
        <FileQuestion className="size-5 text-ink-muted" />
      </div>
      <p className="mt-5 font-mono text-xs text-ink-muted">Error 404</p>
      <h1 className="mt-1.5 text-lg font-semibold text-ink">
        Record not found
      </h1>
      <p className="mt-2 text-base leading-relaxed text-ink-muted">
        No route is registered for{' '}
        <code className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-ink-soft">
          {pathname}
        </code>
        . It may have been archived or you may not have permission to view it.
      </p>

      <div className="mt-5 flex items-center justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to="/">
            Website
          </Link>
        </Button>
        <Button asChild variant="default" size="sm">
          <Link to="/dashboard">
            <ArrowLeft /> Dashboard
          </Link>
        </Button>
      </div>

      <Card className="mt-8 w-full p-4 text-left">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <Compass className="size-3" /> Available sections
        </p>
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {NAV.filter((n) => n.to).map((n) => (
            <Link
              key={n.id}
              to={n.to!}
              className="flex items-center gap-2 rounded-md border border-line-soft bg-surface-2/50 px-2.5 py-2 text-sm text-ink-soft transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-ink"
            >
              <n.icon className="size-3.5 shrink-0 text-ink-muted" />
              <span className="truncate">{n.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
