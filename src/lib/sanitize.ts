/**
 * Output sanitisation for the few places that build HTML strings instead of
 * React trees (the generated print document). React escapes JSX interpolation
 * by default; anything going through `document.write`/`innerHTML` must pass
 * through here first.
 */

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escape the five HTML-significant characters. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c])
}

/** Escape a list of values (for table-row building). */
export function escapeRow(values: unknown[]): string[] {
  return values.map(escapeHtml)
}
