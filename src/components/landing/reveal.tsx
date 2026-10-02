import { useRef, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/use-in-view'

interface RevealProps {
  children: ReactNode
  /** Stagger delay in ms, published to CSS as --reveal-delay. */
  delay?: number
  /** Render as a different element (li, section, …). Defaults to div. */
  as?: ElementType
  className?: string
  /** IntersectionObserver threshold before the reveal fires. */
  threshold?: number
}

/**
 * Scroll-triggered reveal for the landing document — the pattern free dark
 * SaaS templates (Cruip Open et al.) use for section entrances, rebuilt on
 * the repo's own `useInView` hook and token system.
 *
 * In environments without IntersectionObserver (jsdom smoke harness) the
 * hook resolves to visible immediately, so content is never hidden from tests.
 * Under prefers-reduced-motion the CSS kit pins `.reveal` to full opacity.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className,
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { threshold, once: true })

  return (
    <Tag
      ref={ref}
      className={cn(inView ? 'reveal-in' : 'reveal', className)}
      style={{ ['--reveal-delay' as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}
