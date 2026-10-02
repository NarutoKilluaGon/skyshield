/**
 * Aviation-domain input validation (master 6) — pure, unit-tested, shared by
 * the report forms today and the backend serializers tomorrow.
 */

/** ICAO airport/designator code: four letters (VODP, VIDP, EGLL). */
export function isIcao(value: string): boolean {
  return /^[A-Z]{4}$/.test(value.trim().toUpperCase())
}

/** IATA airport code: three letters (DEL, BLR, LHR). */
export function isIata(value: string): boolean {
  return /^[A-Z]{3}$/.test(value.trim().toUpperCase())
}

/**
 * Aircraft registration: 1-2 alphanumeric nationality characters, optional
 * hyphen, then the registration body — covers VT-ALB, N12345, G-EZYT.
 */
export function isAircraftReg(value: string): boolean {
  const v = value.trim().toUpperCase()
  return /^[A-Z0-9]{1,2}-?[A-Z0-9]{1,6}$/.test(v) && v.replace('-', '').length >= 3
}

/** Flight number: 2-3 letter airline designator + 1-4 digits (SKY2214, AI101). */
export function isFlightNo(value: string): boolean {
  return /^[A-Z]{2,3}[0-9]{1,4}$/.test(value.trim().toUpperCase())
}

export const VALIDATION_MESSAGES = {
  icao: 'ICAO codes are four letters, e.g. VIDP.',
  iata: 'IATA codes are three letters, e.g. DEL.',
  reg: 'Registrations look like VT-ALB, N12345 or G-EZYT.',
  flightNo: 'Use the airline designator + number format, e.g. SKY2214.',
} as const
