import { describe, expect, it } from 'vitest'
import { convert, fmtAltitude, fmtDistance, fmtSpeed } from './units'

describe('unit conversions', () => {
  it('round-trips feet and metres', () => {
    expect(Math.round(convert.ftToM(3280.84))).toBe(1000)
    expect(Math.round(convert.mToFt(1000))).toBe(3281)
  })
  it('converts knots and nautical miles exactly at 1.852', () => {
    expect(convert.ktToKmh(100)).toBeCloseTo(185.2, 5)
    expect(convert.kmhToKt(185.2)).toBeCloseTo(100, 5)
    expect(convert.nmToKm(10)).toBeCloseTo(18.52, 5)
    expect(convert.kmToNm(18.52)).toBeCloseTo(10, 5)
  })
  it('formats with the right unit labels', () => {
    expect(fmtAltitude(35000)).toBe('35,000 ft')
    expect(fmtAltitude(35000, 'metric')).toContain('m')
    expect(fmtSpeed(450)).toBe('450 kt')
    expect(fmtSpeed(450, 'metric')).toContain('km/h')
    expect(fmtDistance(120)).toBe('120 NM')
    expect(fmtDistance(120, 'metric')).toContain('km')
  })
})
