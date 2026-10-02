import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-base font-medium transition-colors duration-120 disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0 [&_svg]:pointer-events-none select-none',
  {
    variants: {
      variant: {
        default: 'bg-brand text-on-brand hover:bg-brand-hover active:bg-brand-hover',
        secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-3',
        outline: 'border border-line-strong bg-surface text-ink-soft hover:bg-surface-3 hover:text-ink',
        ghost: 'text-ink-soft hover:bg-surface-3 hover:text-ink',
        subtle: 'bg-surface-3 text-ink-soft hover:bg-surface-3 hover:text-ink',
        destructive: 'bg-crit text-white hover:bg-crit active:bg-crit',
        warning: 'bg-warn text-white hover:bg-warn active:bg-warn',
        link: 'text-brand underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-8 px-3 [&_svg]:size-4',
        sm: 'h-7 px-2.5 text-sm [&_svg]:size-4',
        xs: 'h-6 px-2 text-xs [&_svg]:size-4',
        lg: 'h-9 px-4 text-base [&_svg]:size-4',
        icon: 'h-8 w-8 [&_svg]:size-4',
        'icon-sm': 'h-7 w-7 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
