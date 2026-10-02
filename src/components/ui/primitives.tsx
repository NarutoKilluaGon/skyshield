import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------ checkbox */

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { indeterminate?: boolean }
>(({ className, indeterminate, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer size-4 shrink-0 rounded border border-line-strong bg-surface transition-colors duration-120 hover:border-brand focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-on-brand">
      {indeterminate ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'

/* ------------------------------------------------------------- tooltip */

export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs leading-relaxed text-canvas pop-shadow animate-fade-in',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = 'TooltipContent'

/** Convenience wrapper: `<Tip label="…">{trigger}</Tip>` */
export function Tip({
  label,
  children,
  side = 'top',
  delay = 200,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
  className?: string
}) {
  if (!label) return <>{children}</>
  return (
    <TooltipRoot delayDuration={delay}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {label}
      </TooltipContent>
    </TooltipRoot>
  )
}

/* ------------------------------------------------------------ progress */

export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string
    /** 'bar' for a slim rule, 'block' for a taller track */
    variant?: 'bar' | 'block'
    /** Indicator gradient. Omit to use the current text colour. */
    tone?: string
  }
>(({ className, value, indicatorClassName, variant = 'block', tone, style, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    aria-label={props['aria-label'] || 'Progress'}
    className={cn(
      'relative w-full overflow-hidden rounded-full bg-canvas-deep',
      variant === 'bar' ? 'h-1' : 'h-1.5',
      className,
    )}
    style={style}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        'h-full rounded-full bg-current',
        indicatorClassName,
      )}
      style={{
        width: `${Math.min(100, Math.max(0, value ?? 0))}%`,
        ...(tone ? { background: tone } : null),
        ...style,
      }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = 'Progress'

/* -------------------------------------------------------------- switch */

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-line-strong bg-surface transition-colors duration-120 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-brand data-[state=checked]:bg-brand',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-3 rounded-full bg-ink-muted transition-transform duration-120 data-[state=checked]:translate-x-[15px] data-[state=checked]:bg-on-brand" />
  </SwitchPrimitive.Root>
))
Switch.displayName = 'Switch'

/* ----------------------------------------------------------- separator */

export const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-line-soft',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
))
Separator.displayName = 'Separator'

/* ------------------------------------------------------------ skeleton */

export { Skeleton } from './skeleton'

