import * as React from 'react'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered inside the leading edge. */
  icon?: React.ReactNode
  /** Trailing element, e.g. a clear button or unit. */
  suffix?: React.ReactNode
  invalid?: boolean
}

const base =
  'h-8 w-full rounded-md border border-line-strong bg-surface px-2.5 text-base text-ink transition-colors duration-120 placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:outline-none'

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, suffix, invalid, ...props }, ref) => {
    const field = (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          base,
          icon && 'pl-8',
          suffix && 'pr-16',
          invalid && 'border-crit focus:border-crit',
          className,
        )}
        {...props}
      />
    )
    if (!icon && !suffix) return field
    return (
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint [&_svg]:size-3.5">
            {icon}
          </span>
        )}
        {field}
        {suffix && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
            {suffix}
          </span>
        )}
      </div>
    )
  },
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      base,
      'h-auto min-h-[80px] resize-y px-2.5 py-2 leading-relaxed',
      invalid && 'border-crit focus:border-crit',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'block text-sm font-medium text-ink-muted',
        className,
      )}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor: customHtmlFor,
  children,
  className,
}: {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  const generatedId = React.useId()
  const fieldId = customHtmlFor || generatedId

  const content =
    React.isValidElement(children) && !(children.props as { id?: string }).id
      ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id: fieldId })
      : children

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={fieldId}>
          {label}
          {required && <span className="ml-0.5 text-crit">*</span>}
        </Label>
      )}
      {content}
      {error ? (
        <p className="flex items-center gap-1 text-xs leading-tight text-crit-ink">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-tight text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export { Input, Textarea, Label }
