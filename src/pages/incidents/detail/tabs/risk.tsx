import { cn, alpha } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Separator, Tip } from '@/components/ui/primitives'
import { LIKELIHOOD_LABEL, SEVERITY_TONE, SEVERITY_VALUE, riskBand } from '@/lib/domain'
import { fmtDateTime } from '@/lib/format'
import { userName } from '@/data/users'
import { OCCURRENCE, type DetailData } from '../shared'

/** Risk assessment — the record's grading and its position on the 5×5 matrix. */
export function RiskTab({ d }: { d: DetailData }) {
  const { incident, band } = d
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Risk assessment</h3>
        <div
          className="mt-3 flex items-center gap-4 rounded-lg border p-4"
          style={{ borderColor: alpha(band.color, 25), background: band.dim }}
        >
          <div className="text-center">
            <p className="text-xs text-ink-muted">Score</p>
            <p className="text-xl font-semibold leading-none tnum" style={{ color: band.color }}>
              {incident.risk.score}
            </p>
          </div>
          <div className="h-12 w-px bg-line" />
          <div className="min-w-0">
            <p className="text-xs text-ink-muted">Band</p>
            <p className="text-md font-semibold" style={{ color: band.color }}>
              {band.label.toUpperCase()}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Severity {SEVERITY_VALUE[incident.risk.severity]} × Likelihood {incident.risk.likelihood}
            </p>
          </div>
        </div>
        {incident.risk.notes && (
          <p className="mt-3 rounded-md border border-line bg-surface-2/50 p-2.5 text-xs leading-relaxed text-ink-soft">
            {incident.risk.notes}
          </p>
        )}
        <Separator className="my-3.5" />
        <dl className="space-y-2 text-xs">
          {(
            [
              ['Assessed by', userName(incident.risk.assessedBy)],
              ['Assessed at', fmtDateTime(incident.risk.assessedAt)],
              ['Severity class', SEVERITY_TONE[incident.risk.severity].label],
              ['Likelihood class', LIKELIHOOD_LABEL[incident.risk.likelihood]],
              ['Regulatory class', OCCURRENCE[incident.occurrenceCategory]?.label ?? '—'],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="truncate font-medium text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Matrix position</h3>
        <p className="mt-0.5 text-xs text-ink-muted">
          Where this occurrence sits on the operator 5×5 risk matrix.
        </p>
        <div className="mt-3 space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((s) => {
            const on = s === SEVERITY_VALUE[incident.risk.severity]
            return (
              <div key={s} className="flex items-center gap-1.5">
                <span className="w-3 text-xs text-ink-muted tnum">{s}</span>
                {([1, 2, 3, 4, 5] as const).map((l) => {
                  const bb = riskBand(s * l)
                  const hit = on && l === incident.risk.likelihood
                  return (
                    <Tip key={l} label={`Severity ${s} × Likelihood ${l} = ${s * l} — ${bb.label}`}>
                      <span
                        className={cn(
                          'flex h-7 flex-1 items-center justify-center rounded border text-xs font-semibold tnum transition-transform duration-150',
                          hit && 'scale-105 ring-2 ring-ink/50',
                        )}
                        style={{
                          background: bb.dim,
                          borderColor: hit ? bb.color : alpha(bb.color, 16.5),
                          color: hit ? bb.color : 'transparent',
                        }}
                      >
                        {hit ? s * l : ''}
                      </span>
                    </Tip>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between px-4 text-xs text-ink-muted">
          <span>Likelihood 1</span>
          <span>5</span>
        </div>
      </Card>
    </div>
  )
}
