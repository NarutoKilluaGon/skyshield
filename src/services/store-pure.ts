/**
 * Pure helpers behind the stateful demo store (`services/store.ts`).
 * Kept dependency-free and side-effect-free so they can be unit-tested
 * (S11 exit: vitest units) and audited at a glance.
 */

/** Matches full ISO timestamps and plain YYYY-MM-DD date strings. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?$/

const DAY_MS = 86400000

/** Shift every ISO date/datetime string in a JSON-like tree by `days`. */
export function shiftIsoDates<T>(value: T, days: number): T {
  if (days === 0) return value
  if (typeof value === 'string') {
    if (!ISO_DATE.test(value)) return value
    const dateOnly = value.length === 10
    const d = new Date(dateOnly ? `${value}T00:00:00Z` : value)
    if (Number.isNaN(d.getTime())) return value
    d.setTime(d.getTime() + days * DAY_MS)
    return (dateOnly ? d.toISOString().slice(0, 10) : d.toISOString().replace('.000Z', 'Z')) as T
  }
  if (Array.isArray(value)) return value.map((v) => shiftIsoDates(v, days)) as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      // Object keys can be dates too (evidence/timeline are keyed by incident id,
      // but audit shapes may use date keys in future) — shift key and value.
      out[ISO_DATE.test(k) ? (shiftIsoDates(k, days) as string) : k] = shiftIsoDates(v, days)
    }
    return out as T
  }
  return value
}

/** Whole days between an anchor date and today (positive = anchor is in the past). */
export function rebaseDays(anchorIso: string, now = new Date()): number {
  const anchor = new Date(anchorIso.length === 10 ? `${anchorIso}T00:00:00Z` : anchorIso)
  if (Number.isNaN(anchor.getTime())) return 0
  const startOf = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())
  return Math.round((startOf(now) - startOf(anchor)) / DAY_MS)
}

/** Latest ISO date string in a list (falls back to the first entry). */
export function maxIso(dates: string[]): string | undefined {
  return dates.filter(Boolean).sort().at(-1)
}

/**
 * Continue a per-org sequential reference series. Seed refs look like
 * `P_006-258`; the next filed occurrence gets max + 1, zero-padded to 3.
 */
export function nextSequentialRef(existingRefs: string[], prefix: string): string {
  let max = 0
  for (const ref of existingRefs) {
    if (!ref.startsWith(`${prefix}-`)) continue
    const n = Number(ref.slice(prefix.length + 1))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

/** crypto.randomUUID where available, with a collision-safe fallback. */
export function newUuid(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random()
    .toString(16)
    .slice(2, 8)}`
}
