/**
 * Tiny typed localStorage layer for per-user UI preferences (column
 * visibility, page size, …). Deliberately minimal: S11 introduces the
 * stateful `skyshield.store.v1` domain store, this only owns view prefs.
 * Every read is defensive — storage can be unavailable (private mode) or
 * hold junk from an older schema.
 */

const PREFIX = 'skyshield.prefs.v1'

export const PREF_KEYS = {
  incidentsHiddenColumns: 'incidents.hiddenColumns',
  incidentsPageSize: 'incidents.pageSize',
  uiCompactTables: 'ui.compactTables',
  uiTimeMode: 'ui.timeMode',
} as const

export function readPref<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}:${key}`)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (validate && !validate(parsed)) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

export function writePref<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value))
  } catch {
    /* storage unavailable — preference simply won't persist */
  }
}
