import { describe, expect, it } from 'vitest'
import { canTransition, STATUS_FLOW, type TransitionContext } from './workflow'
import type { IncidentStatus } from '@/types'

const STATUSES: IncidentStatus[] = [
  'draft',
  'reported',
  'investigation',
  'rca_pending',
  'capa',
  'closed',
]

const base = (over: Partial<TransitionContext> = {}): TransitionContext => ({
  status: 'reported',
  userRole: 'safety_manager',
  openCapas: 0,
  investigationProgress: null,
  ...over,
})

describe('canTransition — the state machine', () => {
  it('allows every declared edge for a safety manager', () => {
    for (const from of STATUSES) {
      for (const to of STATUS_FLOW[from]) {
        const ctx = base({
          status: from,
          // guards cleared so only the edge + role decide
          openCapas: 0,
          investigationProgress: to === 'closed' ? 100 : null,
        })
        expect(canTransition(ctx, to), `${from} → ${to}`).toEqual({ ok: true })
      }
    }
  })

  it('refuses every undeclared edge with a reason', () => {
    let checked = 0
    for (const from of STATUSES) {
      for (const to of STATUSES) {
        if (to === from || STATUS_FLOW[from].includes(to)) continue
        const res = canTransition(base({ status: from }), to)
        expect(res.ok, `${from} → ${to}`).toBe(false)
        if (!res.ok) expect(res.reason.length).toBeGreaterThan(10)
        checked++
      }
    }
    expect(checked).toBe(19) // every undeclared edge of the 6×6 matrix, minus no-ops
  })

  it('refuses no-op moves', () => {
    const res = canTransition(base({ status: 'capa' }), 'capa')
    expect(res.ok).toBe(false)
  })
})

describe('canTransition — roles', () => {
  it('blocks investigators from closing', () => {
    const res = canTransition(
      base({ status: 'capa', userRole: 'investigator', openCapas: 0 }),
      'closed',
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toMatch(/safety managers and administrators/i)
  })

  it('blocks investigators from re-opening', () => {
    const res = canTransition(base({ status: 'closed', userRole: 'investigator' }), 'investigation')
    expect(res.ok).toBe(false)
  })

  it('lets investigators perform edit-class moves', () => {
    expect(canTransition(base({ status: 'reported', userRole: 'investigator' }), 'investigation')).toEqual({ ok: true })
  })

  it('blocks auditors from every move (view + export only)', () => {
    for (const from of STATUSES) {
      for (const to of STATUS_FLOW[from]) {
        const res = canTransition(
          base({ status: from, userRole: 'auditor', investigationProgress: 100 }),
          to,
        )
        expect(res.ok, `${from} → ${to} as auditor`).toBe(false)
      }
    }
  })

  it('blocks anonymous actors', () => {
    expect(canTransition(base({ userRole: null }), 'investigation').ok).toBe(false)
    expect(canTransition(base({ userRole: undefined }), 'investigation').ok).toBe(false)
  })

  it('lets admins close and re-open', () => {
    expect(
      canTransition(base({ status: 'capa', userRole: 'admin', openCapas: 0 }), 'closed'),
    ).toEqual({ ok: true })
    expect(canTransition(base({ status: 'closed', userRole: 'admin' }), 'investigation')).toEqual({
      ok: true,
    })
  })
})

describe('canTransition — closure guards', () => {
  it('refuses closure while CAPAs are open, and says how many', () => {
    const res = canTransition(base({ status: 'capa', openCapas: 2 }), 'closed')
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.reason).toContain('2 corrective actions are still open')
      expect(res.reason).toMatch(/verify them first/i)
    }
  })

  it('singularises the reason for one open CAPA', () => {
    const res = canTransition(base({ status: 'capa', openCapas: 1 }), 'closed')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('1 corrective action is still open')
  })

  it('refuses closure while the investigation is unfinished, stating progress', () => {
    const res = canTransition(
      base({ status: 'investigation', investigationProgress: 72 }),
      'closed',
    )
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toContain('72% complete')
  })

  it('allows closure with a complete investigation and no open CAPAs', () => {
    expect(
      canTransition(base({ status: 'investigation', investigationProgress: 100, openCapas: 0 }), 'closed'),
    ).toEqual({ ok: true })
  })

  it('allows closure when no investigation was ever opened (reviewed, nothing to do)', () => {
    expect(
      canTransition(base({ status: 'reported', investigationProgress: null, openCapas: 0 }), 'closed'),
    ).toEqual({ ok: true })
  })

  it('guards apply to admins too — closure is earned, not ranked', () => {
    const res = canTransition(
      base({ status: 'capa', userRole: 'admin', openCapas: 3 }),
      'closed',
    )
    expect(res.ok).toBe(false)
  })
})
