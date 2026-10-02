import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded border-transparent font-medium whitespace-nowrap transition-colors duration-120',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-3 text-ink-soft',
        brand: 'bg-brand-wash text-brand',
        green: 'bg-ok-wash text-ok-ink',
        amber: 'bg-warn-wash text-warn-ink',
        orange: 'bg-alert-wash text-alert-ink',
        red: 'bg-crit-wash text-crit-ink',
        outline: 'bg-surface-3 text-ink-soft',
      },
      size: {
        sm: 'h-5 px-1.5 text-xs',
        md: 'h-5 px-2 text-xs',
        lg: 'h-6 px-2.5 text-sm',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, size, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone, size }), className)} {...props} />
  ),
)
Badge.displayName = 'Badge'

/** Small filled dot used inside status badges. Severity badges never use dots. */
const Dot = ({ className }: { className?: string }) => (
  <span
    className={cn('size-1.5 shrink-0 rounded-full bg-current', className)}
    aria-hidden="true"
  />
)

export { Badge, badgeVariants, Dot }
