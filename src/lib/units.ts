/**
 * Unit conversions for aviation quantities (master 6). The register stores
 * canonical units (ft, kt, NM); display conversions are pure and unit-tested.
 * A user-facing units preference lands with the telemetry surfaces (QAR/FDR
 * fields, milestone M7) — shipping a preference with nothing to display it
 * would be a dead control.
 */

export type UnitSystem = 'aviation' | 'metric'

const FT_PER_M = 3.280839895
const KMH_PER_KT = 1.852
const KM_PER_NM = 1.852

export const convert = {
  ftToM: (ft: number) => ft / FT_PER_M,
  mToFt: (m: number) => m * FT_PER_M,
  ktToKmh: (kt: number) => kt * KMH_PER_KT,
  kmhToKt: (kmh: number) => kmh / KMH_PER_KT,
  nmToKm: (nm: number) => nm * KM_PER_NM,
  kmToNm: (km: number) => km / KM_PER_NM,
}

const round = (n: number) => Math.round(n).toLocaleString('en-IN')

/** Altitude: feet (aviation) or metres (metric). */
export function fmtAltitude(ft: number, system: UnitSystem = 'aviation'): string {
  return system === 'aviation' ? `${round(ft)} ft` : `${round(convert.ftToM(ft))} m`
}

/** Speed: knots (aviation) or km/h (metric). */
export function fmtSpeed(kt: number, system: UnitSystem = 'aviation'): string {
  return system === 'aviation' ? `${round(kt)} kt` : `${round(convert.ktToKmh(kt))} km/h`
}

/** Distance: nautical miles (aviation) or kilometres (metric). */
export function fmtDistance(nm: number, system: UnitSystem = 'aviation'): string {
  return system === 'aviation' ? `${round(nm)} NM` : `${round(convert.nmToKm(nm))} km`
}
