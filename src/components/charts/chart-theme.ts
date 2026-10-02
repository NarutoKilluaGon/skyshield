/**
 * Shared chart chrome (master 4.3): horizontal gridlines on line-soft, no vertical
 * lines, 12px ink-muted axis text, x baseline only, token-driven series colours,
 * tabular numbers in tooltips, 2px lines with 4px active dots, bars capped at 20px.
 */
export const CHART_AXIS_TICK = { fill: 'var(--color-ink-muted)', fontSize: 12 }
export const CHART_GRID_STROKE = 'var(--color-line-soft)'
export const CHART_X_BASELINE = 'var(--color-line)'
export const CHART_ACTIVE_DOT = { r: 4 }
export const CHART_TOOLTIP_STYLE = {
  background: 'var(--color-surface-2)',
  border: '1px solid var(--color-line-strong)',
  borderRadius: 8,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
} as const
export const CHART_TOOLTIP_LABEL = { color: 'var(--color-ink)', fontSize: 12 } as const

/** Series palette: one emphasised series in brand, comparisons in ink-faint.
 *  Status/severity hues (--color-ok/warn/alert/crit) only for status/severity data. */
export const CHART_EMPHASIS = 'var(--chart-1)'
export const CHART_COMPARE = 'var(--chart-2)'
export const CHART_OK = 'var(--chart-3)'
