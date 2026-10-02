import { cn } from '@/lib/utils'

/**
 * SkyShield wordmark: a 24px rounded-square brand tile holding a simple
 * white chevron/wing glyph, next to "SkyShield" in 16px/600 ink.
 */
export function ShieldMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md bg-brand',
        className,
      )}
      role="img"
      aria-label="SkyShield"
    >
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path
          d="M2.5 9.5 13.5 4.5l-3.2 1.6 2.6 3.4-8.4 2.5.9-2.6-2.9-1.1Z"
          fill="none"
          stroke="var(--color-on-brand)"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

export function Wordmark({
  className,
  collapsed = false,
}: {
  className?: string
  collapsed?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-2 overflow-hidden', className)}>
      <ShieldMark />
      {!collapsed && (
        <span className="truncate text-md font-semibold text-ink">SkyShield</span>
      )}
    </div>
  )
}
