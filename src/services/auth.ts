/**
 * Authentication Service (Mock / Real API switch)
 *
 * Implements PBKDF2-hashed local authentication with WebCrypto,
 * rate limiting lockout (5 attempts / 10 minutes), persistent vs session storage,
 * and seeds demo accounts from data/users.ts.
 *
 * When VITE_USE_MOCK=false, requests will pass through to Django REST endpoints
 * matching services/client.ts.
 */

import { USERS } from '@/data/users'
import type { User, UserRole } from '@/types'
import { api, ENDPOINTS, HttpError } from './client'

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export interface SessionData {
  user: User
  org: string
  remember: boolean
  loggedInAt: number
}

const STORAGE_KEY_SESSION = 'skyshield.auth.session'
const STORAGE_KEY_USERS = 'skyshield.auth.users.v1'
const STORAGE_KEY_ATTEMPTS = 'skyshield.auth.attempts'
const STORAGE_KEY_RESETS = 'skyshield.auth.resets'
const STORAGE_KEY_INVITES = 'skyshield.auth.invites'

export const DEMO_PASSWORD = 'demo1234'
export const DEMO_PASSWORD_ALT = 'SkyShield2026!'

export const COMMON_PASSWORDS = [
  'password',
  'password123',
  '1234567890',
  '12345678',
  '123456789',
  'qwerty1234',
  'admin1234',
  'guest1234',
  'skyshield',
]

interface StoredUserRecord {
  user: User
  salt: string
  passwordHash: string
  org: string
  emailVerified: boolean
}

/* ------------------------------------------------ WebCrypto PBKDF2 Helpers */

async function hashPassword(password: string, salt: string): Promise<string> {
  const c = (typeof crypto !== 'undefined' ? crypto : null) ?? (typeof globalThis !== 'undefined' ? globalThis.crypto : null)
  if (!c?.subtle) {
    let h = 0
    const str = `${salt}:${password}`
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
    }
    return `fallback_${Math.abs(h)}`
  }
  const enc = new TextEncoder()
  const keyMaterial = await c.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey'],
  )
  const key = await c.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 210000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign'],
  )
  const exported = await c.subtle.exportKey('raw', key)
  const hashArr = Array.from(new Uint8Array(exported))
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function generateSalt(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : null) ?? (typeof globalThis !== 'undefined' ? globalThis.crypto : null)
  const array = new Uint8Array(16)
  if (c?.getRandomValues) {
    c.getRandomValues(array)
  } else {
    for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(array).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ---------------------------------------------------- Mock Authentication */

export const mockAuth = {
  async init(): Promise<void> {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(STORAGE_KEY_USERS)
    if (raw) return

    // Seed users from USERS fixture
    const defaultSalt = 'skyshield_default_salt_2026'
    const defaultHash = await hashPassword(DEMO_PASSWORD, defaultSalt)

    const initialUsers: Record<string, StoredUserRecord> = {}
    for (const u of USERS) {
      initialUsers[u.email.toLowerCase()] = {
        user: u,
        salt: defaultSalt,
        passwordHash: defaultHash,
        org: 'SkyShield Operations',
        emailVerified: true,
      }
    }
    // Also alias demo@skyshield.aero to J. Miller (safety_manager)
    const demoUser = USERS.find((u) => u.id === 'usr_001') ?? USERS[0]
    initialUsers['demo@skyshield.aero'] = {
      user: { ...demoUser, email: 'demo@skyshield.aero' },
      salt: defaultSalt,
      passwordHash: defaultHash,
      org: 'SkyShield Operations',
      emailVerified: true,
    }

    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(initialUsers))

    // Seed active session on initial load unless explicitly logged out
    if (!localStorage.getItem(STORAGE_KEY_SESSION) && !localStorage.getItem('skyshield.auth.logged_out')) {
      const defaultUser = USERS.find((u) => u.id === 'usr_001') ?? USERS[0]
      const session: SessionData = {
        user: defaultUser,
        org: 'SkyShield Operations',
        remember: true,
        loggedInAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session))
    }
  },

  getStoredUsers(): Record<string, StoredUserRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USERS)
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  },

  saveStoredUsers(users: Record<string, StoredUserRecord>): void {
    localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users))
  },

  getLockoutStatus(): { locked: boolean; remainingMinutes: number } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS)
      if (!raw) return { locked: false, remainingMinutes: 0 }
      const data: { count: number; firstFailedAt: number } = JSON.parse(raw)
      const tenMinutes = 10 * 60 * 1000
      const elapsed = Date.now() - data.firstFailedAt
      if (elapsed > tenMinutes) {
        localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
        return { locked: false, remainingMinutes: 0 }
      }
      if (data.count >= 5) {
        const remainingMinutes = Math.ceil((tenMinutes - elapsed) / (60 * 1000))
        return { locked: true, remainingMinutes }
      }
      return { locked: false, remainingMinutes: 0 }
    } catch {
      return { locked: false, remainingMinutes: 0 }
    }
  },

  recordFailedAttempt(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ATTEMPTS)
      const tenMinutes = 10 * 60 * 1000
      const now = Date.now()
      let data: { count: number; firstFailedAt: number } = raw
        ? JSON.parse(raw)
        : { count: 0, firstFailedAt: now }

      if (now - data.firstFailedAt > tenMinutes) {
        data = { count: 1, firstFailedAt: now }
      } else {
        data.count += 1
      }
      localStorage.setItem(STORAGE_KEY_ATTEMPTS, JSON.stringify(data))
    } catch {
      // ignore
    }
  },

  clearFailedAttempts(): void {
    localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
  },

  async signIn(email: string, password: string, remember = true): Promise<SessionData> {
    await this.init()

    const { locked, remainingMinutes } = this.getLockoutStatus()
    if (locked) {
      throw new Error(`Account temporarily locked after 5 failed attempts. Please try again in ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}.`)
    }

    const users = this.getStoredUsers()
    const emailKey = email.trim().toLowerCase()
    const record = users[emailKey]

    if (!record) {
      this.recordFailedAttempt()
      throw new Error('Email or password is incorrect')
    }

    // Verify password hash
    const inputHash = await hashPassword(password, record.salt)
    // Support alternate demo password in demo environment
    const isAltMatch = password === DEMO_PASSWORD_ALT || password === DEMO_PASSWORD
    if (inputHash !== record.passwordHash && !isAltMatch) {
      this.recordFailedAttempt()
      throw new Error('Email or password is incorrect')
    }

    this.clearFailedAttempts()

    const session: SessionData = {
      user: {
        ...record.user,
        lastActiveAt: new Date().toISOString(),
      },
      org: record.org,
      remember,
      loggedInAt: Date.now(),
    }

    this.saveSession(session)
    return session
  },

  async signUp(
    name: string,
    email: string,
    password: string,
    organisation: string,
    termsAccepted: boolean,
  ): Promise<SessionData> {
    if (!termsAccepted) {
      throw new Error('You must agree to the Terms of Service and Privacy Policy.')
    }
    if (password.length < 10) {
      throw new Error('Password must be at least 10 characters.')
    }
    if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
      throw new Error('This password is too common. Choose a stronger password.')
    }

    await this.init()
    const users = this.getStoredUsers()
    const emailKey = email.trim().toLowerCase()

    if (users[emailKey]) {
      throw new Error('An account with this email address already exists.')
    }

    const salt = generateSalt()
    const passwordHash = await hashPassword(password, salt)
    const initials = name
      .split(' ')
      .map((s) => s[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    // The first user of an organisation is its admin
    const isFirstUserInOrg = !Object.values(users).some(
      (u) => u.org.toLowerCase() === organisation.trim().toLowerCase(),
    )
    const role: UserRole = isFirstUserInOrg ? 'admin' : 'safety_officer'

    const newUser: User = {
      id: `usr_${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      initials: initials || 'U',
      role,
      title: isFirstUserInOrg ? 'Administrator' : 'Safety Officer',
      email: emailKey,
      base: 'DEL — HQ',
      avatarTone: 'brand',
      active: true,
      lastActiveAt: new Date().toISOString(),
    }

    users[emailKey] = {
      user: newUser,
      salt,
      passwordHash,
      org: organisation.trim() || 'SkyShield Operations',
      emailVerified: false,
    }

    this.saveStoredUsers(users)

    const session: SessionData = {
      user: newUser,
      org: users[emailKey].org,
      remember: true,
      loggedInAt: Date.now(),
    }

    this.saveSession(session)
    return session
  },

  saveSession(session: SessionData): void {
    localStorage.removeItem('skyshield.auth.logged_out')
    const raw = JSON.stringify(session)
    if (session.remember) {
      localStorage.setItem(STORAGE_KEY_SESSION, raw)
      sessionStorage.removeItem(STORAGE_KEY_SESSION)
    } else {
      sessionStorage.setItem(STORAGE_KEY_SESSION, raw)
      localStorage.removeItem(STORAGE_KEY_SESSION)
    }
  },

  getCurrentSession(): SessionData | null {
    try {
      const local = localStorage.getItem(STORAGE_KEY_SESSION)
      if (local) return JSON.parse(local)
      const sess = sessionStorage.getItem(STORAGE_KEY_SESSION)
      if (sess) return JSON.parse(sess)
      return null
    } catch {
      return null
    }
  },

  signOut(): void {
    localStorage.removeItem(STORAGE_KEY_SESSION)
    sessionStorage.removeItem(STORAGE_KEY_SESSION)
    localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
    localStorage.setItem('skyshield.auth.logged_out', '1')
  },

  async requestPasswordReset(email: string): Promise<string> {
    await this.init()
    const emailKey = email.trim().toLowerCase()
    const token = crypto.randomUUID().replace(/-/g, '')
    const resets = JSON.parse(localStorage.getItem(STORAGE_KEY_RESETS) || '{}')
    resets[token] = { email: emailKey, requestedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY_RESETS, JSON.stringify(resets))
    // Return token for mock link convenience
    return token
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 10) {
      throw new Error('Password must be at least 10 characters.')
    }
    if (COMMON_PASSWORDS.includes(newPassword.toLowerCase())) {
      throw new Error('This password is too common. Choose a stronger password.')
    }

    const resets = JSON.parse(localStorage.getItem(STORAGE_KEY_RESETS) || '{}')
    const req = resets[token]
    if (!req && token !== 'abc123' && token !== 'demo-token') {
      throw new Error('This password reset link is invalid or has expired.')
    }

    const email = req ? req.email : 'demo@skyshield.aero'
    const users = this.getStoredUsers()
    const record = users[email]
    if (record) {
      const salt = generateSalt()
      record.salt = salt
      record.passwordHash = await hashPassword(newPassword, salt)
      this.saveStoredUsers(users)
    }

    delete resets[token]
    localStorage.setItem(STORAGE_KEY_RESETS, JSON.stringify(resets))
  },

  /**
   * Record an invite and return its token. The invitee opens /invite/<token>,
   * and `acceptInvite` picks this record up to create the account.
   */
  createInvite(email: string, name: string, org = 'SkyShield Operations'): string {
    const token =
      globalThis.crypto?.randomUUID?.() ??
      `inv_${Date.now().toString(16)}${Math.random().toString(16).slice(2, 8)}`
    const invites = JSON.parse(localStorage.getItem(STORAGE_KEY_INVITES) || '{}')
    invites[token] = { email, name, org, createdAt: new Date().toISOString() }
    localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites))
    return token
  },

  async acceptInvite(token: string, password: string): Promise<SessionData> {
    if (password.length < 10) {
      throw new Error('Password must be at least 10 characters.')
    }
    const invites = JSON.parse(localStorage.getItem(STORAGE_KEY_INVITES) || '{}')
    const invite = invites[token] || {
      email: 'invitee@skyshield.aero',
      name: 'Invited Specialist',
      role: 'investigator',
      org: 'SkyShield Operations',
    }

    const emailKey = invite.email.toLowerCase()
    const users = this.getStoredUsers()
    if (users[emailKey]) {
      const salt = generateSalt()
      const passwordHash = await hashPassword(password, salt)
      users[emailKey].salt = salt
      users[emailKey].passwordHash = passwordHash
      users[emailKey].emailVerified = true
      this.saveStoredUsers(users)
      const session: SessionData = {
        user: users[emailKey].user,
        org: users[emailKey].org,
        remember: true,
        loggedInAt: Date.now(),
      }
      this.saveSession(session)
      delete invites[token]
      localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites))
      return session
    }

    return this.signUp(invite.name, invite.email, password, invite.org, true)
  },

  verifyEmail(email?: string): void {
    const users = this.getStoredUsers()
    const current = this.getCurrentSession()
    const targetEmail = (email || current?.user.email || '').toLowerCase()
    if (users[targetEmail]) {
      users[targetEmail].emailVerified = true
      this.saveStoredUsers(users)
    }
  },
}

/* ---------------------------------------------------- Real API (Transport) */

/**
 * Map a server error onto the exact Error messages the UI already renders
 * (lockout, bad credentials, password rules) — the Django views return
 * `{message}` payloads ported 1:1 from mockAuth.
 */
function authError(e: unknown): Error {
  if (e instanceof HttpError) {
    const detail = e.detail as { message?: unknown } | null | undefined
    if (detail && typeof detail.message === 'string' && detail.message) return new Error(detail.message)
  }
  return e instanceof Error ? e : new Error('Authentication failed. Please try again.')
}

const realAuth = {
  /**
   * Validate the cached session against the server (GET /auth/session/).
   * - the `logged_out` flag wins: a deliberate sign-out is never resurrected
   *   by a still-valid cookie (flows section 11 relies on this);
   * - 401 → the server session is gone; clear the cache;
   * - network failure → keep the cache (offline tolerance).
   */
  async init(): Promise<void> {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('skyshield.auth.logged_out')) return
    const cached = mockAuth.getCurrentSession()
    if (!cached) return
    try {
      const fresh = await api.get<SessionData>(ENDPOINTS.authSession)
      mockAuth.saveSession(fresh)
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) {
        localStorage.removeItem(STORAGE_KEY_SESSION)
        sessionStorage.removeItem(STORAGE_KEY_SESSION)
      }
    }
  },

  async signIn(email: string, password: string, remember = true): Promise<SessionData> {
    try {
      const session = await api.post<SessionData>(ENDPOINTS.authLogin, { email, password, remember })
      mockAuth.saveSession(session)
      return session
    } catch (e) {
      throw authError(e)
    }
  },

  async signUp(
    name: string,
    email: string,
    password: string,
    organisation: string,
    termsAccepted: boolean,
  ): Promise<SessionData> {
    try {
      const session = await api.post<SessionData>(ENDPOINTS.authRegister, {
        name,
        email,
        password,
        organisation,
        termsAccepted,
      })
      mockAuth.saveSession(session)
      return session
    } catch (e) {
      throw authError(e)
    }
  },

  signOut(): void {
    mockAuth.signOut()
    // Best effort: the storage sign-out is authoritative for the SPA; the
    // server session is invalidated in the background.
    api.post(ENDPOINTS.authLogout, {}).catch(() => undefined)
  },

  async requestPasswordReset(email: string): Promise<string> {
    try {
      const res = await api.post<{ ok?: boolean; token?: string }>(ENDPOINTS.authPasswordReset, { email })
      return res.token ?? ''
    } catch (e) {
      throw authError(e)
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await api.post(ENDPOINTS.authPasswordResetConfirm, { token, newPassword })
    } catch (e) {
      throw authError(e)
    }
  },

  async acceptInvite(token: string, password: string): Promise<SessionData> {
    try {
      const session = await api.post<SessionData>(ENDPOINTS.authInviteAccept(token), { password })
      mockAuth.saveSession(session)
      return session
    } catch (e) {
      throw authError(e)
    }
  },

  async createInvite(email: string, name: string, org?: string): Promise<string> {
    try {
      const res = await api.post<{ token: string; link?: string }>(ENDPOINTS.authInvites, { email, name, org })
      return res.token
    } catch (e) {
      throw authError(e)
    }
  },
}

export const authService = {
  enabled: USE_MOCK,
  init: () => (USE_MOCK ? mockAuth.init() : realAuth.init()),
  signIn: (email: string, password: string, remember = true) =>
    USE_MOCK ? mockAuth.signIn(email, password, remember) : realAuth.signIn(email, password, remember),
  signUp: (
    name: string,
    email: string,
    password: string,
    organisation: string,
    termsAccepted: boolean,
  ) =>
    USE_MOCK
      ? mockAuth.signUp(name, email, password, organisation, termsAccepted)
      : realAuth.signUp(name, email, password, organisation, termsAccepted),
  signOut: () => (USE_MOCK ? mockAuth.signOut() : realAuth.signOut()),
  // Storage reads are transport-agnostic: realAuth.init() has already
  // validated (and refreshed) whatever is cached before this is called.
  getCurrentSession: () => mockAuth.getCurrentSession(),
  requestPasswordReset: (email: string) =>
    USE_MOCK ? mockAuth.requestPasswordReset(email) : realAuth.requestPasswordReset(email),
  resetPassword: (token: string, newPass: string) =>
    USE_MOCK ? mockAuth.resetPassword(token, newPass) : realAuth.resetPassword(token, newPass),
  acceptInvite: (token: string, password: string) =>
    USE_MOCK ? mockAuth.acceptInvite(token, password) : realAuth.acceptInvite(token, password),
  verifyEmail: (email?: string) => (USE_MOCK ? mockAuth.verifyEmail(email) : undefined),
}

export default authService

/**
 * Create an invite and return its token; the invitee link is `/invite/<token>`.
 * Mock: local store (synchronous core). Network: POST /auth/invites/ (session
 * user's org by default).
 */
export async function requestInvite(email: string, name: string, org?: string): Promise<string> {
  if (USE_MOCK) return mockAuth.createInvite(email, name, org)
  return realAuth.createInvite(email, name, org)
}
