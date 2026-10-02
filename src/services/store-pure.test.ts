import { describe, expect, it } from 'vitest'
import {
  maxIso,
  newUuid,
  nextSequentialRef,
  rebaseDays,
  shiftIsoDates,
} from './store-pure'

describe('shiftIsoDates', () => {
  it('shifts full UTC timestamps', () => {
    expect(shiftIsoDates('2026-09-27T08:12:00Z', 4)).toBe('2026-10-01T08:12:00Z')
  })

  it('shifts date-only strings and keeps them date-only', () => {
    expect(shiftIsoDates('2026-09-28', 5)).toBe('2026-10-03')
  })

  it('crosses month and year boundaries', () => {
    expect(shiftIsoDates('2026-12-30T23:00:00Z', 3)).toBe('2027-01-02T23:00:00Z')
  })

  it('leaves non-date strings, numbers and booleans untouched', () => {
    expect(shiftIsoDates('P_006-258', 4)).toBe('P_006-258')
    expect(shiftIsoDates('258', 4)).toBe('258')
    expect(shiftIsoDates(42, 4)).toBe(42)
    expect(shiftIsoDates(true, 4)).toBe(true)
  })

  it('walks nested objects and arrays', () => {
    const out = shiftIsoDates(
      { a: ['2026-09-27T00:00:00Z', { b: '2026-09-28' }], c: 'keep' },
      1,
    )
    expect(out).toEqual({ a: ['2026-09-28T00:00:00Z', { b: '2026-09-29' }], c: 'keep' })
  })

  it('is the identity at zero days', () => {
    const value = { at: '2026-09-27T08:00:00Z' }
    expect(shiftIsoDates(value, 0)).toBe(value)
  })
})

describe('rebaseDays', () => {
  it('counts whole days from a past anchor', () => {
    expect(rebaseDays('2026-09-27', new Date('2026-10-01T15:30:00Z'))).toBe(4)
  })

  it('is zero on the anchor day regardless of time', () => {
    expect(rebaseDays('2026-09-27T22:00:00Z', new Date('2026-09-27T02:00:00Z'))).toBe(0)
  })

  it('is negative for a future anchor', () => {
    expect(rebaseDays('2026-10-05', new Date('2026-10-01T00:00:00Z'))).toBe(-4)
  })
})

describe('maxIso', () => {
  it('picks the latest date', () => {
    expect(maxIso(['2026-09-01T10:00:00Z', '2026-09-27T08:00:00Z', '2026-09-15'])).toBe(
      '2026-09-27T08:00:00Z',
    )
  })

  it('ignores empties', () => {
    expect(maxIso(['', '2026-01-02'])).toBe('2026-01-02')
  })
})

describe('nextSequentialRef', () => {
  it('continues the per-org series at max + 1', () => {
    expect(nextSequentialRef(['P_006-258', 'P_006-240', 'P_006-222'], 'P_006')).toBe('P_006-259')
  })

  it('zero-pads to three digits', () => {
    expect(nextSequentialRef(['P_006-009'], 'P_006')).toBe('P_006-010')
  })

  it('starts at 001 for an empty register', () => {
    expect(nextSequentialRef([], 'P_006')).toBe('P_006-001')
  })

  it('ignores foreign prefixes', () => {
    expect(nextSequentialRef(['X_9-999', 'P_006-100'], 'P_006')).toBe('P_006-101')
  })
})

describe('newUuid', () => {
  it('returns unique non-empty ids', () => {
    const a = newUuid()
    const b = newUuid()
    expect(a).toBeTruthy()
    expect(a).not.toBe(b)
  })
})
