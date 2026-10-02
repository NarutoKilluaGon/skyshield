/**
 * SkyShield Auth Provider and Hook
 *
 * Provides reactive auth state ({ user, org, status, signIn, signUp, signOut, ... })
 * backed by src/services/auth.ts and localStorage/sessionStorage.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import authService, { type SessionData } from '@/services/auth'
import { can as checkCan, type Permission } from '@/lib/permissions'
import type { User, UserRole } from '@/types'

const SessionExpiredDialog = React.lazy(() => import('./session-expired-dialog'))

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthContextValue {
  user: User | null
  org: string | null
  status: AuthStatus
  signIn: (email: string, password: string, remember?: boolean) => Promise<SessionData>
  signUp: (
    name: string,
    email: string,
    password: string,
    organisation: string,
    termsAccepted: boolean,
  ) => Promise<SessionData>
  signOut: () => void
  requestPasswordReset: (email: string) => Promise<string>
  resetPassword: (token: string, newPass: string) => Promise<void>
  acceptInvite: (token: string, password: string) => Promise<SessionData>
  can: (permission: Permission) => boolean
  hasRole: (...roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [expiredOpen, setExpiredOpen] = useState(false)

  // Initialize session on mount
  useEffect(() => {
    authService.init().then(() => {
      const current = authService.getCurrentSession()
      if (current) {
        if (Date.now() - current.loggedInAt > SESSION_MAX_AGE_MS) {
          authService.signOut()
          setSession(null)
          setStatus('unauthenticated')
          setExpiredOpen(true)
        } else {
          setSession(current)
          setStatus('authenticated')
        }
      } else {
        setSession(null)
        setStatus('unauthenticated')
      }
    })
  }, [])

  // Periodically check for expired session
  useEffect(() => {
    const timer = setInterval(() => {
      const current = authService.getCurrentSession()
      if (current && Date.now() - current.loggedInAt > SESSION_MAX_AGE_MS) {
        authService.signOut()
        setSession(null)
        setStatus('unauthenticated')
        setExpiredOpen(true)
      }
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Listen to multi-tab storage changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'skyshield.auth.session') {
        const current = authService.getCurrentSession()
        if (current) {
          setSession(current)
          setStatus('authenticated')
        } else {
          setSession(null)
          setStatus('unauthenticated')
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const signIn = useCallback(
    async (email: string, password: string, remember = true): Promise<SessionData> => {
      const sess = await authService.signIn(email, password, remember)
      setSession(sess)
      setStatus('authenticated')
      return sess
    },
    [],
  )

  const signUp = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      organisation: string,
      termsAccepted: boolean,
    ): Promise<SessionData> => {
      const sess = await authService.signUp(name, email, password, organisation, termsAccepted)
      setSession(sess)
      setStatus('authenticated')
      return sess
    },
    [],
  )

  const signOut = useCallback(() => {
    authService.signOut()
    setSession(null)
    setStatus('unauthenticated')
  }, [])

  const requestPasswordReset = useCallback((email: string) => {
    return authService.requestPasswordReset(email)
  }, [])

  const resetPassword = useCallback((token: string, newPass: string) => {
    return authService.resetPassword(token, newPass)
  }, [])

  const acceptInvite = useCallback(async (token: string, password: string) => {
    const sess = await authService.acceptInvite(token, password)
    setSession(sess)
    setStatus('authenticated')
    return sess
  }, [])

  const can = useCallback(
    (permission: Permission): boolean => {
      return checkCan(session?.user ?? null, permission)
    },
    [session?.user],
  )

  const hasRole = useCallback(
    (...roles: UserRole[]): boolean => {
      if (!session?.user) return false
      return roles.includes(session.user.role)
    },
    [session?.user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      org: session?.org ?? null,
      status,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      resetPassword,
      acceptInvite,
      can,
      hasRole,
    }),
    [session, status, signIn, signUp, signOut, requestPasswordReset, resetPassword, acceptInvite, can, hasRole],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}

      {expiredOpen && (
        <React.Suspense fallback={null}>
          <SessionExpiredDialog open={expiredOpen} onOpenChange={setExpiredOpen} />
        </React.Suspense>
      )}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}

export function useCan(permission: Permission): boolean {
  const { can } = useAuth()
  return can(permission)
}

export default AuthContext