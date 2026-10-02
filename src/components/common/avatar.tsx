import { cn } from '@/lib/utils'
import type { User } from '@/types'

const SIZES = {
  xs: 'size-5 text-xs',
  sm: 'size-6 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-9 text-sm',
  xl: 'size-12 text-md',
} as const

/** Avatars are initials on surface-3 with ink-soft text. No coloured tones. */
export function Avatar({
  user,
  size = 'md',
  className,
  showStatus = false,
}: {
  user?: Pick<User, 'name' | 'initials'>
  size?: keyof typeof SIZES
  className?: string
  showStatus?: boolean
}) {
  const initials =
    user?.initials ??
    user?.name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() ??
    '?'

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex select-none items-center justify-center rounded-full bg-surface-3 font-medium text-ink-soft',
          SIZES[size],
        )}
        aria-hidden="true"
      >
        {initials}
      </span>
      {showStatus && (
        <span
          className="absolute -bottom-px -right-px size-2.5 rounded-full border-2 border-sidebar bg-ok"
          role="status"
          aria-label="Online"
        />
      )}
      <span className="sr-only">{user?.name}</span>
    </span>
  )
}
