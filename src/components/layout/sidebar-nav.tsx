import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Wordmark } from '@/components/common/logo'
import { NAV, type NavGroup, type NavItem } from './nav-config'

function isGroupActive(group: NavGroup, pathname: string, search: string): boolean {
  if (group.to && pathname === group.to) return true
  const fullPath = pathname + search
  if (
    group.items?.some((i) => {
      if (!i.to) return false
      if (i.to.includes('?'))
        return fullPath === i.to || (i.to === '/reports?tab=analytics' && pathname === '/reports' && !search)
      return pathname === i.to || (pathname.startsWith(`${i.to}/`) && i.end !== true)
    })
  )
    return true
  if (group.to && group.to !== '/' && pathname.startsWith(`${group.to}/`)) return true
  return false
}

/** Sub-items are visible for the active group, and pinned open on hover intent. */
export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { pathname, search } = useLocation()
  // Groups default to expanded; the operator can collapse them to declutter.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  const isOpen = (id: string) => openGroups[id] ?? true

  const toggle = (id: string) =>
    setOpenGroups((s) => ({ ...s, [id]: !(s[id] ?? true) }))

  return (
    <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-2" aria-label="Main navigation">
      <ul className="space-y-0.5">
        {NAV.map((group) => {
          const active = isGroupActive(group, pathname, search)
          const hasChildren = Boolean(group.items?.length)

          return (
            <li key={group.id}>
              {hasChildren ? (
                <NavGroupRow
                  group={group}
                  collapsed={collapsed}
                  active={active}
                  open={isOpen(group.id)}
                  onToggle={() => toggle(group.id)}
                  onNavigate={onNavigate}
                />
              ) : (
                <NavLeaf
                  item={{ label: group.label, to: group.to, icon: group.icon, badge: group.badge }}
                  collapsed={collapsed}
                  end
                  onNavigate={onNavigate}
                />
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function NavGroupRow({
  group,
  collapsed,
  active,
  open,
  onToggle,
  onNavigate,
}: {
  group: NavGroup
  collapsed: boolean
  active: boolean
  open: boolean
  onToggle: () => void
  onNavigate?: () => void
}) {
  return (
    <div>
      <div className="group/row relative flex items-center">
        <NavLink
          to={group.to ?? '#'}
          onClick={onNavigate}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pl-2.5 pr-1 text-sm font-medium transition-colors duration-120',
            active ? 'bg-surface-3 font-medium text-ink' : 'text-ink-soft hover:bg-surface-3 hover:text-ink',
            collapsed && 'justify-center pl-0 pr-0',
          )}
          title={collapsed ? group.label : undefined}
        >
          <group.icon
            className={cn(
              'size-4 shrink-0 transition-colors duration-120',
              active ? 'text-ink' : 'text-ink-muted group-hover/row:text-ink-soft',
            )}
            strokeWidth={2}
          />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              {group.badge !== undefined && (
                <span className="shrink-0 rounded bg-surface-3 px-1.5 py-px text-xs font-semibold text-ink-muted tnum">
                  {group.badge}
                </span>
              )}
            </>
          )}
        </NavLink>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${group.label}`}
            className="mr-0.5 rounded-sm px-1 py-0.5 text-ink-muted transition-colors duration-120 hover:bg-surface-3 hover:text-ink-soft focus-visible:outline-none"
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform duration-120', open && 'rotate-180')}
            />
          </button>
        )}
      </div>

      {!collapsed && open && group.items && (
        <ul className="relative ml-[14px] mt-0.5 space-y-0.5 border-l border-line pl-2 animate-fade-in">
          {group.items.map((item) => (
            <li key={item.to}>
              <NavLeaf item={item} collapsed={false} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NavLeaf({
  item,
  collapsed,
  end,
  onNavigate,
}: {
  item: NavItem
  collapsed: boolean
  end?: boolean
  onNavigate?: () => void
}) {
  const { pathname, search } = useLocation()
  if (!item.to) return null

  const hasQuery = item.to.includes('?')
  const isCustomActive = hasQuery
    ? (pathname + search) === item.to || (item.to === '/reports?tab=analytics' && pathname === '/reports' && !search)
    : undefined

  return (
    <NavLink
      to={item.to}
      end={end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => {
        const active = isCustomActive !== undefined ? isCustomActive : isActive
        return cn(
          'group relative flex items-center gap-2 rounded-md py-1.5 text-sm transition-colors duration-120',
          collapsed ? 'justify-center px-0' : 'px-2.5',
          active
            ? 'bg-surface-3 font-medium text-ink'
            : 'font-medium text-ink-soft hover:bg-surface-3 hover:text-ink',
        )
      }}
    >
      {({ isActive }) => {
        const active = isCustomActive !== undefined ? isCustomActive : isActive
        return (
          <>
            <item.icon
              className={cn(
                'size-4 shrink-0 transition-colors duration-120',
                active ? 'text-ink' : 'text-ink-muted group-hover:text-ink-soft',
              )}
              strokeWidth={2}
            />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="shrink-0 rounded bg-surface-3 px-1.5 py-px text-xs font-semibold text-ink-muted tnum">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </>
        )
      }}
    </NavLink>
  )
}

export function SidebarBrand({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  return (
    <div
      className={cn(
        'flex h-12 shrink-0 items-center gap-1 border-b border-line px-3',
        collapsed && 'justify-center px-0',
      )}
    >
      <Link
        to="/dashboard"
        className={cn(
          'flex min-w-0 flex-1 items-center overflow-hidden rounded focus-visible:outline-none',
          collapsed && 'justify-center',
        )}
        title="SkyShield Dashboard"
      >
        <Wordmark collapsed={collapsed} />
      </Link>
      {!collapsed && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="rounded-md p-1.5 text-ink-muted transition-colors duration-120 hover:bg-surface-3 hover:text-ink focus-visible:outline-none"
        >
          <ChevronsLeft className="size-4" aria-hidden="true" />
        </button>
      )}
      {collapsed && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand navigation"
          className="rounded-md p-1.5 text-ink-muted transition-colors duration-120 hover:bg-surface-3 hover:text-ink focus-visible:outline-none"
        >
          <ChevronsRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
