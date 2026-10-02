import { TriangleAlert } from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tip } from '@/components/ui/primitives'
import { LIKELIHOOD_LABEL, SEVERITY_TONE, SEVERITY_VALUE, riskBand } from '@/lib/domain'
import type { Likelihood, Severity } from '@/types'

/**
 * Live "Computed risk" panel — severity × likelihood with the band colour,
 * used inside the classification step and in the sticky rail of both modes.
 */
export function RiskSummary({
  score,
  severity,
  likelihood,
  dense = false,
}: {
  score: number
  severity: Severity | ''
  likelihood: Likelihood
  dense?: boolean
}) {
  const band = riskBand(score || 1)
  const missing = !severity

  return (
    <div
      className={cn(
        'rounded-lg border p-3.5 transition-colors duration-200',
        missing ? 'border-line bg-surface-2/40' : 'border-line',
      )}
      style={missing ? undefined : { borderColor: alpha(band.color, 25), background: band.dim }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink-muted">Computed risk</p>
        {missing ? (
          <Badge size="sm" tone="outline">
            Awaiting severity
          </Badge>
        ) : (
          <Tip label="Risk score = severity × likelihood, per the operator SMS risk matrix.">
            <Badge size="sm" tone="outline" style={{ color: band.color, borderColor: alpha(band.color, 33) }}>
              {band.label} risk
            </Badge>
          </Tip>
        )}
      </div>

      <div className="mt-2 flex items-end gap-3">
        <p
          className="text-xl font-semibold leading-none tnum"
          style={{ color: missing ? 'var(--color-ink-faint)' : band.color }}
        >
          {missing ? '—' : score}
        </p>
        <div className="pb-0.5 text-xs text-ink-muted">
          <p>Severity {severity ? `${SEVERITY_VALUE[severity]} · ${SEVERITY_TONE[severity].label}` : '—'}</p>
          <p>
            Likelihood {likelihood} · {LIKELIHOOD_LABEL[likelihood]}
          </p>
        </div>
      </div>

      {!dense && !missing && score >= 10 && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-md bg-canvas/40 px-2 py-1.5 text-xs leading-relaxed text-ink-soft">
          <TriangleAlert className="mt-px size-3 shrink-0" style={{ color: band.color }} />
          {score >= 15
            ? 'Critical risk. A formal investigation must be opened and the authority notified within 1 hour of submission.'
            : 'High risk. Initial assessment and a documented investigation are mandatory before closure.'}
        </p>
      )}
    </div>
  )
}
