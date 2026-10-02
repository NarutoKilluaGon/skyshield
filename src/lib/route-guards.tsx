import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { UserRole } from '@/types'

/**
 * Route guards for authentication and authorization.
 *
 * - RequireAuth: redirects to /login?next=... if not signed in
 * - PublicOnly: redirects to /dashboard if already signed in
 * - RequireRole: redirects to /dashboard if user lacks the required role
 */

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      </div>
    )
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <>{children}</>
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}