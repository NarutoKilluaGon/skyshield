import { useEffect, useState } from 'react'
import { useReducedMotion } from './use-reduced-motion'

export interface UseCountUpOptions {
  duration?: number
  enabled?: boolean
  start?: number
}

export function useCountUp(
  target: number,
  options: UseCountUpOptions = {},
): number {
  const { duration = 900, enabled = true, start = 0 } = options
  const reducedMotion = useReducedMotion()
  const [count, setCount] = useState(() => (reducedMotion || !enabled ? target : start))

  useEffect(() => {
    if (reducedMotion || !enabled) {
      setCount(target)
      return
    }

    let startTime: number | null = null
    let animId: number

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const elapsed = timestamp - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(start + (target - start) * ease))

      if (progress < 1) {
        animId = requestAnimationFrame(step)
      }
    }

    animId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(animId)
  }, [target, duration, enabled, start, reducedMotion])

  return count
}
