import { useEffect, useState, type RefObject } from 'react'

export interface UseInViewOptions {
  once?: boolean
  threshold?: number | number[]
  rootMargin?: string
}

export function useInView(
  ref: RefObject<Element | null>,
  options: UseInViewOptions = {},
): boolean {
  const { once = true, threshold = 0.2, rootMargin = '0px' } = options
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) {
            observer.disconnect()
          }
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, once, threshold, rootMargin])

  return inView
}
