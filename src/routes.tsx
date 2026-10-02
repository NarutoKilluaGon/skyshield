import { lazy, Suspense } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import type { Crumb } from '@/components/layout/breadcrumbs'
import { RequireAuth, PublicOnly } from '@/lib/route-guards'

const AppShell = lazy(() => import('@/components/layout/app-shell').then((m) => ({ default: m.AppShell })))
import LandingPage from '@/pages/landing'
const DashboardPage = lazy(() => import('@/pages/dashboard'))
const AllIncidents = lazy(() => import('@/pages/incidents/all-incidents'))
const ReportIncident = lazy(() => import('@/pages/incidents/report'))
const ActiveInvestigations = lazy(() => import('@/pages/incidents/active-investigations'))
const IncidentDetail = lazy(() => import('@/pages/incidents/detail'))
const ActionsPage = lazy(() => import('@/pages/actions'))
const ReportsPage = lazy(() => import('@/pages/reports'))
const NotificationCenterPage = lazy(() => import('@/pages/notifications'))
const Settings = lazy(() => import('@/pages/settings'))
const NotFound = lazy(() => import('@/pages/not-found'))
const RcaWorkspace = lazy(() => import('@/pages/rca/rca-workspace'))
const FiveWhysIndex = lazy(() => import('@/pages/rca/five-whys'))

// Auth pages
const LoginPage = lazy(() => import('@/pages/auth/login'))
const SignupPage = lazy(() => import('@/pages/auth/signup'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password'))
const VerifyEmailPage = lazy(() => import('@/pages/auth/verify-email'))
const InvitePage = lazy(() => import('@/pages/auth/invite'))
const AnonymousReportPage = lazy(() => import('@/pages/auth/anonymous-report'))
const PrivacyPage = lazy(() => import('@/pages/auth/privacy'))
const TermsPage = lazy(() => import('@/pages/auth/terms'))

/** Route-level code splitting keeps the first paint lean. */
function Page({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return <Suspense fallback={fallback ?? <RouteFallback />}>{children}</Suspense>
}

export function RouteFallback() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-[280px]" />
      <Skeleton className="h-3.5 w-[420px]" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[116px]" />
        ))}
      </div>
      <Skeleton className="h-[320px]" />
    </div>
  )
}


const p = (node: React.ReactNode) => <Page>{node}</Page>
const pub = (node: React.ReactNode) => <PublicOnly><Page>{node}</Page></PublicOnly>

const DASHBOARD_CRUMB: Crumb = { label: 'Dashboard', to: '/dashboard' }

/**
 * Single source of truth for the route table. Consumed by the app (data
 * router) and by the headless smoke harness (memory router), so the two can
 * never drift.
 *
 * `/` is the public landing page and is deliberately NOT nested under
 * `AppShell` — the marketing site has its own header, its own document scroll
 * and its own visual language. Every operational module keeps its existing
 * path, so `/dashboard` renders the authenticated dashboard exactly as before.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  // Public auth routes (redirect to /dashboard if already signed in)
  { path: '/login', element: pub(<LoginPage />) },
  { path: '/signup', element: pub(<SignupPage />) },
  { path: '/forgot-password', element: pub(<ForgotPasswordPage />) },
  { path: '/reset-password/:token', element: pub(<ResetPasswordPage />) },
  { path: '/verify-email', element: pub(<VerifyEmailPage />) },
  // Public open routes
  { path: '/invite/:token', element: p(<InvitePage />) },
  { path: '/report', element: p(<AnonymousReportPage />) },
  { path: '/privacy', element: p(<PrivacyPage />) },
  { path: '/terms', element: p(<TermsPage />) },
  {
    element: (
      <RequireAuth>
        <Suspense fallback={<RouteFallback />}>
          <AppShell />
        </Suspense>
      </RequireAuth>
    ),
    children: [
      {
        path: 'dashboard',
        element: p(<DashboardPage />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Dashboard' }] },
      },
      {
        path: 'incidents',
        element: p(<AllIncidents />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Incidents' }] },
      },
      {
        path: 'incidents/report',
        element: p(<ReportIncident />),
        handle: {
          breadcrumb: [
            DASHBOARD_CRUMB,
            { label: 'Incidents', to: '/incidents' },
            { label: 'Report Incident' },
          ],
        },
      },
      {
        path: 'investigations',
        element: p(<ActiveInvestigations />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Incidents', to: '/incidents' }, { label: 'Investigations' }] },
      },
      {
        path: 'incidents/:id',
        element: p(<IncidentDetail />),
        handle: {
          breadcrumb: [
            DASHBOARD_CRUMB,
            { label: 'Incidents', to: '/incidents' },
            { label: 'Incident Detail' },
          ],
        },
      },
      {
        path: 'actions',
        element: p(<ActionsPage />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Actions' }] },
      },
      {
        path: 'reports',
        element: p(<ReportsPage />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Reports' }] },
      },
      // Backward-compatible redirects
      { path: 'capa', element: <Navigate to="/actions" replace /> },
      { path: 'analytics', element: <Navigate to="/reports?tab=analytics" replace /> },
      { path: 'compliance', element: <Navigate to="/reports?tab=compliance" replace /> },
      { path: 'rca', element: <Navigate to="/investigations" replace /> },
      {
        path: 'rca/five-whys',
        element: p(<FiveWhysIndex />),
        handle: {
          breadcrumb: [DASHBOARD_CRUMB, { label: 'Incidents', to: '/incidents' }, { label: '5 Whys Analyses' }],
        },
      },
      { path: 'rca/risk-matrix', element: <Navigate to="/reports?tab=risk-matrix" replace /> },
      {
        path: 'rca/:incidentId',
        element: p(<RcaWorkspace />),
        handle: {
          breadcrumb: [DASHBOARD_CRUMB, { label: 'Incidents', to: '/incidents' }, { label: 'RCA Workspace' }],
        },
      },
      {
        path: 'notifications',
        element: p(<NotificationCenterPage />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Notification Centre' }] },
      },
      {
        path: 'settings',
        element: p(<Settings />),
        handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Settings' }] },
      },
      { path: '*', element: p(<NotFound />), handle: { breadcrumb: [DASHBOARD_CRUMB, { label: 'Not Found' }] } },
    ],
  },
]