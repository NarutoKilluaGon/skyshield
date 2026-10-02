import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/primitives'
import { CommandPalette } from '@/components/common/command-palette'
import { ErrorBoundary } from '@/lib/error-boundary'
import { NotificationsProvider, useNotifications } from '@/components/layout/notification-panel'

const SIDEBAR_KEY = 'skyshield.sidebar.collapsed'

/** Palette inside the notifications context so it can offer "mark all read". */
function PaletteHost({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { markAll } = useNotifications()
  return (
    <CommandPalette open={open} onOpenChange={onOpenChange} onMarkAllNotificationsRead={markAll} />
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem(SIDEBAR_KEY) === '1',
  )
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // Route change: close the mobile drawer and return the reader to the top.
  useEffect(() => {
    setMobileOpen(false)
    document.getElementById('skyshield-main')?.scrollTo({ top: 0, behavior: 'instant' })
    // Scroll-lock safety net: modal surfaces (Radix dialogs, the command
    // palette, the landing tour) lock body scroll while open. If one unmounts
    // mid-navigation the lock can survive and leave the whole app
    // unscrollable — restore scrollability on every route change.
    const b = document.body
    if (b.style.overflow === 'hidden') b.style.overflow = ''
    if (b.style.paddingRight) b.style.paddingRight = ''
  }, [pathname])

  return (
    <NotificationsProvider>
      <TooltipProvider delayDuration={220} skipDelayDuration={0}>
        <a
          href="#skyshield-main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-surface-2 focus:px-3 focus:py-2 focus:text-sm focus:text-ink focus:outline-2 focus:outline-brand"
        >
          Skip to content
        </a>
        <div data-app-shell className="flex h-dvh w-full overflow-hidden bg-canvas">
          {/* ---------------- desktop rail ---------------- */}
          <div
            className={cn(
              'hidden shrink-0 transition-[width] duration-180 ease-out lg:block',
              collapsed ? 'w-14' : 'w-[248px]',
            )}
          >
            <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} className="w-full" />
          </div>

          {/* ---------------- mobile drawer ---------------- */}
          <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
            <DialogContent
              size="drawer"
              hideClose
              className="w-[264px] border-l-0 p-0 lg:hidden"
              aria-describedby={undefined}
            >
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="absolute right-2.5 top-3.5 z-10 rounded-md p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" />
              </button>
              <Sidebar
                mobile
                collapsed={false}
                onToggle={() => setMobileOpen(false)}
                onNavigate={() => setMobileOpen(false)}
                className="h-full border-r-0"
              />
            </DialogContent>
          </Dialog>

          {/* ---------------- main column ---------------- */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar onOpenMobileNav={() => setMobileOpen(true)} onOpenCommand={() => setPaletteOpen(true)} />

            {/* ⌘K command palette — actions, pages and live entities */}
            <PaletteHost open={paletteOpen} onOpenChange={setPaletteOpen} />

            <main
              id="skyshield-main"
              className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
              tabIndex={-1}
            >
              <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
                <ErrorBoundary
                  scope="this page"
                  fallbackAction={
                    <Link
                      to="/dashboard"
                      className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-base font-medium text-ink-soft transition-colors duration-120 hover:bg-surface-3 hover:text-ink"
                    >
                      Back to dashboard
                    </Link>
                  }
                >
                  <Outlet />
                </ErrorBoundary>
              </div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </NotificationsProvider>
  )
}
/* -------------------------------------------------------- page header */

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-lg font-semibold leading-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-muted">{subtitle}</p>
        )}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export { Button }
