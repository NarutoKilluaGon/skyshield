import { describe, expect, it } from 'vitest'
import { RISK_BANDS, riskBand, riskLevel, riskScore, SEVERITY_VALUE, SEVERITY_ORDER } from './domain'

describe('risk maths (ICAO 5×5)', () => {
  it('multiplies severity value by likelihood', () => {
    expect(riskScore('critical', 5)).toBe(25)
    expect(riskScore('high', 4)).toBe(16)
    expect(riskScore('negligible', 1)).toBe(1)
  })

  it('maps severity labels to the 1–5 axis exactly once', () => {
    expect(SEVERITY_ORDER.map((s) => SEVERITY_VALUE[s]).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('bands the score at the documented boundaries', () => {
    expect(riskLevel(1)).toBe('low')
    expect(riskLevel(4)).toBe('low')
    expect(riskLevel(5)).toBe('moderate')
    expect(riskLevel(9)).toBe('moderate')
    expect(riskLevel(10)).toBe('high')
    expect(riskLevel(14)).toBe('high')
    expect(riskLevel(15)).toBe('critical')
    expect(riskLevel(25)).toBe('critical')
  })

  it('riskBand agrees with riskLevel and carries display tokens', () => {
    for (let score = 1; score <= 25; score++) {
      const band = riskBand(score)
      expect(band.level).toBe(riskLevel(score))
      expect(band.label.length).toBeGreaterThan(2)
      expect(band.color).toMatch(/^(#|var\()/)
      expect(band.dim).toBeTruthy()
      expect(band.ink).toBeTruthy()
    }
  })

  it('bands are ordered and cover 1–25 without gaps', () => {
    const maxes = RISK_BANDS.map((b) => b.max)
    expect(maxes).toEqual([...maxes].sort((a, b) => a - b))
    expect(maxes[maxes.length - 1]).toBeGreaterThanOrEqual(25)
  })
})
