import { describe, expect, it } from 'vitest'
import { isAircraftReg, isFlightNo, isIata, isIcao } from './validation'

describe('isIcao / isIata', () => {
  it('accepts real codes, case-insensitively', () => {
    expect(isIcao('VIDP')).toBe(true)
    expect(isIcao('vidp')).toBe(true)
    expect(isIata('DEL')).toBe(true)
    expect(isIata(' del ')).toBe(true)
  })
  it('rejects wrong lengths and digits', () => {
    expect(isIcao('DEL')).toBe(false)
    expect(isIcao('VIDP1')).toBe(false)
    expect(isIata('VIDP')).toBe(false)
    expect(isIata('D3L')).toBe(false)
  })
})

describe('isAircraftReg', () => {
  it('accepts international formats', () => {
    expect(isAircraftReg('VT-ALB')).toBe(true)
    expect(isAircraftReg('N12345')).toBe(true)
    expect(isAircraftReg('G-EZYT')).toBe(true)
    expect(isAircraftReg('vt-alb')).toBe(true)
  })
  it('rejects malformed registrations', () => {
    expect(isAircraftReg('')).toBe(false)
    expect(isAircraftReg('VT-')).toBe(false)
    expect(isAircraftReg('VTVTB-ALB')).toBe(false)
    expect(isAircraftReg('12')).toBe(false)
  })
})

describe('isFlightNo', () => {
  it('accepts designator + number', () => {
    expect(isFlightNo('SKY2214')).toBe(true)
    expect(isFlightNo('AI101')).toBe(true)
    expect(isFlightNo('sky2214')).toBe(true)
    expect(isFlightNo('BA1')).toBe(true)
  })
  it('rejects anything else', () => {
    expect(isFlightNo('2214')).toBe(false)
    expect(isFlightNo('SKYZ2214')).toBe(false)
    expect(isFlightNo('SKY22114')).toBe(false)
    expect(isFlightNo('SKY-2214')).toBe(false)
    expect(isFlightNo('')).toBe(false)
  })
})
