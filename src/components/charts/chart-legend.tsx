/** One-line series legend, placed above the plot. Used when direct labels aren't possible. */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[]
}) {
  return (
    <span className="flex flex-wrap items-center gap-2.5 text-xs text-ink-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </span>
      ))}
    </span>
  )
}
