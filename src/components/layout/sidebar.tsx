import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Globe, HelpCircle, LogOut, Palette, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarBrand, SidebarNav } from './sidebar-nav'
import { Avatar } from '@/components/common/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/hooks/use-theme'
import { useAuth } from '@/lib/auth'

const ROLE_LABEL: Record<string, string> = {
  safety_manager: 'Safety Manager',
  investigator: 'Investigator',
  safety_officer: 'Safety Officer',
  auditor: 'Auditor',
  admin: 'Administrator',
}

export function Sidebar({
  collapsed,
  onToggle,
  mobile = false,
  onNavigate,
  className,
}: {
  collapsed: boolean
  onToggle?: () => void
  mobile?: boolean
  onNavigate?: () => void
  className?: string
}) {
  const { user, signOut } = useAuth()
  const { choice } = useTheme()
  const collapsedView = collapsed && !mobile
  const themeLabel = useMemo(
    () => (choice === 'system' ? 'System' : choice === 'dark' ? 'Dark' : 'Light'),
    [choice],
  )

  const handleSignOut = () => {
    signOut()
    window.location.href = '/'
  }

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-line bg-sidebar',
        className,
      )}
      aria-label="Primary"
    >
      <SidebarBrand collapsed={collapsedView} onToggle={onToggle} />

      <SidebarNav collapsed={collapsedView} onNavigate={onNavigate} />

      {/* --- user --- */}
      <div className={cn('shrink-0 border-t border-line p-2', collapsedView && 'px-1.5')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition-colors duration-120 hover:bg-surface-3 focus-visible:outline-none',
                collapsedView && 'justify-center',
              )}
            >
              <Avatar user={user ?? undefined} size="md" showStatus />
              {!mobile && !collapsed && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {user?.name ?? 'J. Miller'}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {ROLE_LABEL[user?.role ?? ''] ?? user?.title}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-[212px]">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <div className="flex items-center gap-2 px-2 pb-2">
              <Avatar user={user ?? undefined} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
                <p className="truncate text-xs text-ink-muted">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/">
                <Globe /> Back to website
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings?tab=profile">
                <UserRound /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings?tab=preferences">
                <Palette /> Preferences · {themeLabel}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="mailto:support@skyshield.aero?subject=SkyShield%20Support">
                <HelpCircle /> Support
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleSignOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}