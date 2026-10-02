import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Compact trend line for KPI cards. Hand-rolled SVG — no chart runtime
 * overhead at this size. No animation: motion answers actions only.
 */
export function Sparkline({
  data,
  color = 'var(--color-brand)',
  width = 108,
  height = 34,
  className,
  strokeWidth = 1.5,
  fill = true,
  showLastPoint = true,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
  strokeWidth?: number
  fill?: boolean
  showLastPoint?: boolean
}) {
  const gid = useId().replace(/:/g, '')
  if (!data.length) return null

  const pad = 3
  const w = width - pad * 2
  const h = height - pad * 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w
    const y = pad + h - ((v - min) / span) * h
    return [x, y] as const
  })

  // Catmull-Rom-ish smoothing via midpoint quadratics
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = (x0 + x1) / 2
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`
  }
  const area = `${d} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`
  const last = pts[pts.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.26" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#spark-${gid})`} />
        </>
      )}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {showLastPoint && (
        <>
          <circle cx={last[0]} cy={last[1]} r="3" fill={color} opacity="0.22" />
          <circle cx={last[0]} cy={last[1]} r="1.6" fill={color} />
        </>
      )}
    </svg>
  )
}

/** Vertical bar micro-chart — used where a shape reads faster than a line. */
export function SparkBars({
  data,
  color = 'var(--color-brand)',
  width = 108,
  height = 34,
  className,
  gap = 2,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  className?: string
  gap?: number
}) {
  if (!data.length) return null
  const max = Math.max(...data) || 1
  const bw = (width - gap * (data.length - 1)) / data.length
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)} aria-hidden="true">
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * (height - 4))
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={height - h}
            width={Math.max(1.5, bw)}
            height={h}
            rx={Math.min(1.5, bw / 2)}
            fill={color}
            opacity={0.35 + (v / max) * 0.6}
          />
        )
      })}
    </svg>
  )
}
