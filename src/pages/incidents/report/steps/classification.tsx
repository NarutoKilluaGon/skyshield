import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field } from '@/components/ui/input'
import { Separator } from '@/components/ui/primitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  LIKELIHOOD_LABEL,
  PHASE_LABEL,
  SEVERITY_TONE,
  SEVERITY_VALUE,
} from '@/lib/domain'
import type { Likelihood, OperationalPhase, Severity } from '@/types'
import { RiskSummary } from '../risk-summary'
import type { ReportForm } from '../use-report-form'

/** Step 2 — type, severity, likelihood and phase; risk computes live. */
export function ClassificationStep({ rf }: { rf: ReportForm }) {
  const { form, set, touched, errors, score } = rf
  return (
    <>
      <Field label="Incident type" required error={touched.category ? errors.category : undefined}>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {CATEGORY_ORDER.map((c) => {
            const on = form.category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => set('category', c)}
                className={cn(
                  'rounded-md border px-2.5 py-2 text-left text-sm transition-colors duration-150',
                  on
                    ? 'border-brand/50 bg-brand/10 text-ink'
                    : 'border-line bg-surface-2/50 text-ink-soft hover:border-line-strong hover:bg-surface-2',
                )}
              >
                {CATEGORY_LABEL[c]}
              </button>
            )
          })}
        </div>
      </Field>

      <Separator />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Severity" required error={touched.severity ? errors.severity : undefined}>
          <div className="space-y-1.5">
            {(Object.keys(SEVERITY_TONE) as Severity[]).map((s) => {
              const t = SEVERITY_TONE[s]
              const on = form.severity === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('severity', s)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors duration-150',
                    on ? cn(t.border, t.bg) : 'border-line bg-surface-2/40 hover:bg-surface-2',
                  )}
                >
                  <span className={cn('size-2 rounded-sm', t.dot)} />
                  <span className={cn('flex-1 text-sm', on ? t.text : 'text-ink-soft')}>{t.label}</span>
                  <span className="text-xs text-ink-muted tnum">{SEVERITY_VALUE[s]}</span>
                  {on && <Check className={cn('size-3.5', t.text)} />}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Likelihood" hint="Based on fleet history and operational exposure">
          <div className="space-y-1.5">
            {([1, 2, 3, 4, 5] as Likelihood[]).map((l) => {
              const on = form.likelihood === l
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => set('likelihood', l)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-left transition-colors duration-150',
                    on ? 'border-brand/50 bg-brand/10' : 'border-line bg-surface-2/40 hover:bg-surface-2',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-sm border text-xs font-semibold tnum',
                      on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong text-ink-muted',
                    )}
                  >
                    {l}
                  </span>
                  <span className={cn('flex-1 text-sm', on ? 'text-ink' : 'text-ink-soft')}>
                    {LIKELIHOOD_LABEL[l]}
                  </span>
                  {on && <Check className="size-3.5 text-brand" />}
                </button>
              )
            })}
          </div>
        </Field>
      </div>

      <Field label="Operational phase" hint="Flight phase during which the event occurred">
        <Select value={form.phase} onValueChange={(v) => set('phase', v as OperationalPhase)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PHASE_LABEL) as OperationalPhase[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PHASE_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <RiskSummary score={score} severity={form.severity} likelihood={form.likelihood} />
    </>
  )
}
