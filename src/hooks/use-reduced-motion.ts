import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Tracks the OS "reduce motion" setting.
 *
 * The global stylesheet already neutralises CSS animation and transitions, but
 * SVG SMIL (`<animateMotion>`) on the map's flight path is not CSS, so the
 * aircraft markers have to be unmounted rather than hidden.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY)
    if (!mq) return
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
