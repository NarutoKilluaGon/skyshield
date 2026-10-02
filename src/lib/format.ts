/** Formatting helpers — consistent, aviation-ops flavoured readouts.
 *  Timestamps are stored in UTC; `fmtTime` renders the ops-standard `HH:MMZ`
 *  and `fmtTimeLocal` the viewer's zone. The `ui.timeMode` preference picks
 *  which one record surfaces show first (the other lives in the tooltip). */
import { readPref, PREF_KEYS } from './prefs'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** ISO -> DD/MM/YYYY (matches the operator's report format). UTC-based:
 *  timestamps are stored in UTC and must not shift a day across time zones. */
export function fmtDate(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

/** ISO -> DD MMM YYYY (UTC). */
export function fmtDateLong(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** ISO -> HH:MMZ (24h, UTC — the Z is explicit, per ops convention). */
export function fmtTime(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`
}

/** ISO -> HH:MM in the viewer's local zone, with the zone abbreviation. */
export function fmtTimeLocal(value?: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm} ${localZoneAbbr(d)}`
}

/** Short zone abbreviation (e.g. IST, UTC) for the local-time tooltip. */
export function localZoneAbbr(d = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(d)
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

/** Tooltip text pairing both representations: "14:32Z · 20:02 IST local". */
export function timeTooltip(value?: string | null): string {
  if (!value) return ''
  const utc = fmtTime(value)
  if (utc === '—') return ''
  return `${utc} · ${fmtTimeLocal(value)} local`
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return '—'
  return `${fmtDate(value)} · ${fmtTime(value)}`
}

/** Compact relative time: 4m ago, 3h ago, 2d ago */
export function fmtRelative(value?: string | null, now = new Date()): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const secs = Math.round((now.getTime() - d.getTime()) / 1000)
  if (secs < 45) return 'just now'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  const wks = Math.round(days / 7)
  if (days < 60) return `${wks}w ago`
  return fmtDate(value)
}

/** Signed days until a due date (UTC calendar days). Negative = overdue. */
export function daysUntil(value?: string | null, now = new Date()): number | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((a - b) / 86400000)
}

export function fmtDaysUntil(value?: string | null, now = new Date()): string {
  const d = daysUntil(value, now)
  if (d === null) return '—'
  if (d === 0) return 'Due today'
  if (d === 1) return 'Due tomorrow'
  if (d === -1) return '1 day overdue'
  if (d < 0) return `${Math.abs(d)} days overdue`
  return `in ${d} days`
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function fmtPercent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`
}

export function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return String(n)
}

export function fmtBytes(kb: number): string {
  if (kb < 1024) return `${kb} KB`
  if (kb < 1024 * 1024) return `${(kb / 1024).toFixed(1)} MB`
  return `${(kb / 1024 / 1024).toFixed(1)} GB`
}

export function initialsOf(name: string): string {
  return name
    .replace(/^(Capt\.?|Cpt\.?|Mr\.?|Ms\.?|Dr\.?)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Stable pseudo-hue from a string, for avatar fallbacks. */
export function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${fmtNumber(n)} ${n === 1 ? one : many}`
}


/* ------------------------------------------------- time-display preference */

export type TimeMode = 'utc' | 'local'

const isTimeMode = (v: unknown): v is TimeMode => v === 'utc' || v === 'local'

export function timeMode(): TimeMode {
  return readPref(PREF_KEYS.uiTimeMode, 'utc', isTimeMode)
}

/** Primary timestamp text for record surfaces, honouring the preference. */
export function fmtTimePref(value?: string | null): string {
  return timeMode() === 'local' ? fmtTimeLocal(value) : fmtTime(value)
}

/** Tooltip for the same surface: the representation not shown first. */
export function timeTitle(value?: string | null): string {
  if (!value) return ''
  return timeMode() === 'local' ? fmtTime(value) : timeTooltip(value)
}
