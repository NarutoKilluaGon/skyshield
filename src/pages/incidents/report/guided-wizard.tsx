import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Loader2, Send, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/primitives'
import { CATEGORY_LABEL, PHASE_LABEL } from '@/lib/domain'
import { RiskSummary } from './risk-summary'
import { STEPS, type ReportForm } from './use-report-form'
import { BasicInfoStep } from './steps/basic-info'
import { ClassificationStep } from './steps/classification'
import { DescriptionStep } from './steps/description'
import { PeopleStep } from './steps/people'
import { EvidenceStep } from './steps/evidence'
import { ImmediateActionsStep } from './steps/immediate-actions'
import { ReviewStep } from './steps/review'

/**
 * The seven-step guided wizard: stepper rail, per-step validation summary,
 * footer navigation and the sticky live-risk rail. All state lives in
 * `useReportForm`, shared with the quick-report mode.
 */
export function GuidedWizard({ rf }: { rf: ReportForm }) {
  const { step, setStep, form, errors, stepErrors, stepValid, score, evidence, submitting, submit, markStepTouched } = rf
  const [showSummary, setShowSummary] = useState(false)

  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100)
  const currentErrors = stepErrors(step)

  const goNext = () => {
    if (!stepValid) {
      markStepTouched(step)
      setShowSummary(true)
      return
    }
    setShowSummary(false)
    setStep(Math.min(STEPS.length, step + 1))
  }

  const jumpTo = (n: number) => {
    setShowSummary(false)
    setStep(n)
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_260px]">
      {/* ---------------- stepper ---------------- */}
      <nav aria-label="Report progress" className="lg:sticky lg:top-[68px] lg:self-start">
        <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
          {STEPS.map((s) => {
            const state = s.id === step ? 'current' : s.id < step ? 'done' : 'todo'
            return (
              <li key={s.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => s.id < step && jumpTo(s.id)}
                  disabled={s.id > step}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors duration-150',
                    state === 'current' && 'bg-brand/[0.1]',
                    state === 'done' && 'hover:bg-surface-2',
                    state === 'todo' && 'cursor-default opacity-55',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-[22px] shrink-0 items-center justify-center rounded-full border text-xs font-semibold tnum',
                      state === 'current' && 'border-brand bg-brand text-on-brand',
                      state === 'done' && 'border-brand/45 bg-brand/18 text-brand',
                      state === 'todo' && 'border-line-strong text-ink-muted',
                    )}
                  >
                    {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : s.id}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block truncate text-sm font-medium',
                        state === 'current' ? 'text-ink' : 'text-ink-soft',
                      )}
                    >
                      {s.label}
                    </span>
                    <span className="hidden truncate text-xs text-ink-muted lg:block">{s.hint}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="mt-3 hidden lg:block">
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Progress</span>
            <span className="tnum">{pct}%</span>
          </div>
          <Progress value={pct} variant="bar" className="mt-1.5" indicatorClassName="bg-brand" />
        </div>
      </nav>

      {/* ---------------- form body ---------------- */}
      <Card className="min-w-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-md font-semibold text-ink">{STEPS[step - 1].label}</h2>
            <p className="mt-0.5 text-xs text-ink-muted">{STEPS[step - 1].hint}</p>
          </div>
          <Badge size="md" tone="neutral">
            Step {step} of {STEPS.length}
          </Badge>
        </div>

        {/* Screen-reader announcement of step changes (a11y hard pass). */}
        <p className="sr-only" aria-live="polite">
          Step {step} of {STEPS.length}: {STEPS[step - 1].label}
        </p>

        <div className="space-y-4 p-4">
          {step === 1 && <BasicInfoStep rf={rf} />}
          {step === 2 && <ClassificationStep rf={rf} />}
          {step === 3 && <DescriptionStep rf={rf} />}
          {step === 4 && <PeopleStep rf={rf} />}
          {step === 5 && <EvidenceStep rf={rf} />}
          {step === 6 && <ImmediateActionsStep rf={rf} />}
          {step === 7 && (
            <ReviewStep form={form} score={score} evidence={evidence} onJump={jumpTo} errors={errors} />
          )}
        </div>

        {/* per-step validation summary */}
        {showSummary && currentErrors.length > 0 && (
          <div
            data-step-summary
            role="alert"
            className="mx-4 mb-4 flex items-start gap-2.5 rounded-lg border border-crit/35 bg-crit/[0.08] p-3"
          >
            <TriangleAlert className="mt-px size-4 shrink-0 text-crit-ink" />
            <div>
              <p className="text-sm font-medium text-ink">
                Complete {currentErrors.length} field{currentErrors.length === 1 ? '' : 's'} to continue
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                {currentErrors.map((e) => (
                  <li key={e.field}>· {e.message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ---------------- footer nav ---------------- */}
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/30 px-4 py-3">
          <Button
            variant="ghost"
            onClick={() => jumpTo(Math.max(1, step - 1))}
            disabled={step === 1}
            className="gap-1.5 text-ink-muted"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Button>

          <div className="hidden items-center gap-1.5 sm:flex">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => s.id < step && jumpTo(s.id)}
                disabled={s.id > step}
                aria-label={`Go to step ${s.id}: ${s.label}`}
                className={cn(
                  'h-1 rounded-full transition-all duration-200',
                  s.id === step ? 'w-5 bg-brand' : s.id < step ? 'w-2.5 bg-brand/45' : 'w-2.5 bg-line',
                )}
              />
            ))}
          </div>

          {step < STEPS.length ? (
            <Button onClick={goNext} className="gap-1.5">
              Continue <ArrowRight className="size-3.5" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={submitting || Object.keys(errors).length > 0}
              className="gap-1.5 bg-ok text-ink-soft hover:bg-surface-3"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Filing…
                </>
              ) : (
                <>
                  <Send className="size-3.5" /> Submit occurrence
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* ---------------- live risk rail ---------------- */}
      <aside className="lg:col-start-2 lg:self-start xl:col-start-3">
        <div className="space-y-3 lg:sticky lg:top-[68px]">
          <RiskSummary score={score} severity={form.severity} likelihood={form.likelihood} dense />
          <Card className="p-3.5">
            <p className="text-xs font-semibold text-ink-muted">Report summary</p>
            <dl className="mt-2.5 space-y-2 text-xs">
              {(
                [
                  ['Airport', form.airport],
                  ['Flight', form.flightNumber || '—'],
                  ['Aircraft', form.aircraftReg || '—'],
                  ['Type', form.category ? CATEGORY_LABEL[form.category] : '—'],
                  ['Phase', PHASE_LABEL[form.phase]],
                  ['Evidence', `${evidence.length} item${evidence.length === 1 ? '' : 's'}`],
                  ['Regulatory', form.regulatory ? 'Notifiable' : 'Internal only'],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="truncate font-medium text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </aside>
    </div>
  )
}
