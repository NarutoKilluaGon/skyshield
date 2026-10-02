import {
  Activity,
  BarChart3,
  BellRing,
  ClipboardCheck,
  FileSearch,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to?: string
  icon: LucideIcon
  /** Badge count or resolver for live counts. */
  badge?: number
  end?: boolean
}

export interface NavGroup {
  id: string
  label: string
  icon: LucideIcon
  /** Single destination for the group header. */
  to?: string
  items?: NavItem[]
  badge?: number
}

export const NAV: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
  },
  {
    id: 'incidents',
    label: 'Incidents',
    icon: ShieldAlert,
    to: '/incidents',
    badge: 42,
    items: [
      { label: 'All Incidents', to: '/incidents', icon: FileSearch, end: true },
      { label: 'Investigations', to: '/investigations', icon: Activity, badge: 18 },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    icon: ClipboardCheck,
    to: '/actions',
    badge: 3,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    to: '/reports',
    items: [
      { label: 'Analytics', to: '/reports?tab=analytics', icon: BarChart3 },
      { label: 'Compliance', to: '/reports?tab=compliance', icon: ShieldCheck },
      { label: 'Risk Matrix', to: '/reports?tab=risk-matrix', icon: Gauge },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    to: '/settings',
  },
]

export const FOOTER_NAV: NavItem[] = [
  { label: 'System Status', to: '/settings?tab=system', icon: BellRing },
  { label: 'Preferences', to: '/settings?tab=preferences', icon: SlidersHorizontal },
]
