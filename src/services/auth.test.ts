// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_PASSWORD, mockAuth } from './auth'

describe('demo auth service', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('seeds and signs in the demo safety manager', async () => {
    const sess = await mockAuth.signIn('demo@skyshield.aero', DEMO_PASSWORD, false)
    expect(sess.user.email).toBe('demo@skyshield.aero')
    expect(sess.user.role).toBe('safety_manager')
  }, 20000)

  it('rejects a wrong password', async () => {
    await expect(mockAuth.signIn('demo@skyshield.aero', 'not-the-password', false)).rejects.toThrow()
  }, 20000)

  it('locks the account after five failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await mockAuth.signIn('demo@skyshield.aero', `bad-${i}`, false).catch(() => {})
    }
    await expect(
      mockAuth.signIn('demo@skyshield.aero', DEMO_PASSWORD, false),
    ).rejects.toThrow(/locked/i)
  }, 60000)

  it('refuses common passwords at signup', async () => {
    await expect(
      mockAuth.signUp('Test User', 'test@operator.aero', 'password123', 'Test Org', true),
    ).rejects.toThrow(/common|weak|breach/i)
  }, 20000)
})
