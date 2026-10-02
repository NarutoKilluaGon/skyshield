import { useEffect, useState } from 'react'
import { CloudOff, Loader2, Send, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
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
  SEVERITY_TONE,
  SEVERITY_VALUE,
} from '@/lib/domain'
import { AIRCRAFT } from '@/data/aircraft'
import { AIRPORTS } from '@/data/incidents'
import type { Likelihood, Severity } from '@/types'
import { RiskSummary } from './risk-summary'
import { buildIncidentPayload, type ReportForm } from './use-report-form'
import { enqueueReport, isOffline, processQueue, readQueue } from '@/lib/offline-queue'
import { useAuth } from '@/lib/auth'

/**
 * Quick report — the default mode (master 4.4). One screen with the
 * essentials, the same live risk maths and the same submission path as the
 * wizard; everything else can be completed on the record afterwards.
 */
export function QuickReport({ rf }: { rf: ReportForm }) {
  const {
    form,
    set,
    onReg,
    touched,
    errors,
    quickErrors,
    score,
    submitting,
    submit,
    markStepTouched,
  } = rf
  const { user } = useAuth()
  const [showSummary, setShowSummary] = useState(false)
  const [offlineNote, setOfflineNote] = useState<string | null>(null)
  const [queuedCount, setQueuedCount] = useState(() => readQueue().length)

  // Flush the offline queue on mount and whenever the connection returns.
  useEffect(() => {
    const flush = async () => {
      if (isOffline()) return
      const { filed, rejected } = await processQueue()
      setQueuedCount(readQueue().length)
      if (filed.length)
        setOfflineNote(
          `Filed ${filed.length} queued report${filed.length === 1 ? '' : 's'}: ${filed.join(', ')}`,
        )
      if (rejected.length)
        setOfflineNote(
          `${rejected.length} queued report${rejected.length === 1 ? '' : 's'} rejected by the server and removed from the queue: ${rejected.join(', ')}`,
        )
    }
    void flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [])

  const fileIt = () => {
    if (quickErrors.length > 0) {
      // Surface every essential field's error state at once.
      markStepTouched(1)
      markStepTouched(2)
      markStepTouched(3)
      setShowSummary(true)
      return
    }
    setShowSummary(false)
    if (isOffline()) {
      enqueueReport(buildIncidentPayload(form, 0, user?.id))
      setQueuedCount(readQueue().length)
      setOfflineNote('Queued offline — it will file automatically when the connection returns.')
      return
    }
    void submit()
  }

  const err = (k: keyof typeof errors) => (touched[k as string] ? errors[k] : undefined)

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="min-w-0 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-md font-semibold text-ink">Quick report</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              The essentials only — the record stays editable, and evidence, crew and regulatory
              detail can be added afterwards.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Date" required error={err('occurredDate')}>
              <Input
                type="date"
                value={form.occurredDate}
                onChange={(e) => set('occurredDate', e.target.value)}
                invalid={!!err('occurredDate')}
                aria-label="Date of occurrence"
              />
            </Field>
            <Field label="Time" required error={err('occurredTime')}>
              <Input
                type="time"
                value={form.occurredTime}
                onChange={(e) => set('occurredTime', e.target.value)}
                aria-label="Time of occurrence"
              />
            </Field>
            <Field label="Airport" required error={err('airport')}>
              <Select value={form.airport} onValueChange={(v) => set('airport', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select airport" />
                </SelectTrigger>
                <SelectContent>
                  {AIRPORTS.map((a) => (
                    <SelectItem key={a.iata} value={a.iata}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Flight number" error={err('flightNumber')}>
              <Input
                value={form.flightNumber}
                onChange={(e) => set('flightNumber', e.target.value.toUpperCase())}
                placeholder="SKY2214"
                className="font-mono"
                aria-label="Flight number"
                invalid={!!err('flightNumber')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Aircraft registration" required error={err('aircraftReg')}>
              <Select value={form.aircraftReg} onValueChange={onReg}>
                <SelectTrigger>
                  <SelectValue placeholder="Select registration" />
                </SelectTrigger>
                <SelectContent>
                  {AIRCRAFT.map((a) => (
                    <SelectItem key={a.id} value={a.registration}>
                      {a.registration} — {a.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Incident type" required error={err('category')}>
              <Select
                value={form.category || ''}
                onValueChange={(v) => set('category', v as never)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select incident type" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Severity" required error={err('severity')}>
              <Select
                value={form.severity || ''}
                onValueChange={(v) => set('severity', v as Severity)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assess severity" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEVERITY_TONE) as Severity[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEVERITY_TONE[s].label} ({SEVERITY_VALUE[s]})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Likelihood">
              <Select
                value={String(form.likelihood)}
                onValueChange={(v) => set('likelihood', Number(v) as Likelihood)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([1, 2, 3, 4, 5] as Likelihood[]).map((l) => (
                    <SelectItem key={l} value={String(l)}>
                      {l} — {LIKELIHOOD_LABEL[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="What happened"
            required
            error={err('description')}
            hint="Factual sequence of events — conditions, warnings, crew actions. Minimum 40 characters."
          >
            <Textarea
              rows={6}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              invalid={!!err('description')}
              placeholder="At approximately 08:42 local time, during the initial climb, the crew observed…"
              className="leading-relaxed"
            />
          </Field>
          <div className="flex justify-end">
            <span
              className={cn(
                'text-xs text-ink-muted tnum',
                form.description.length < 40 && 'text-warn',
              )}
            >
              {form.description.length} characters
            </span>
          </div>

          <Field
            label="Immediate actions"
            hint="Optional here — required before the record closes."
          >
            <Textarea
              rows={3}
              value={form.immediateActions}
              onChange={(e) => set('immediateActions', e.target.value)}
              placeholder="Crew shut down the engine in accordance with the QRH and…"
            />
          </Field>
        </div>
      </Card>

      {/* Sticky live-risk rail with the single primary action */}
      <aside className="lg:self-start">
        <div className="space-y-3 lg:sticky lg:top-[68px]">
          <RiskSummary score={score} severity={form.severity} likelihood={form.likelihood} />

          {showSummary && quickErrors.length > 0 && (
            <div
              data-quick-summary
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-crit/35 bg-crit/[0.08] p-3"
            >
              <TriangleAlert className="mt-px size-4 shrink-0 text-crit-ink" />
              <div>
                <p className="text-sm font-medium text-ink">
                  Complete {quickErrors.length} field{quickErrors.length === 1 ? '' : 's'} to file
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                  {quickErrors.map((e) => (
                    <li key={e.field}>· {e.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <Button onClick={fileIt} disabled={submitting} className="w-full gap-1.5" size="lg">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Filing…
              </>
            ) : (
              <>
                <Send className="size-4" /> File occurrence
              </>
            )}
          </Button>

          {(offlineNote || queuedCount > 0) && (
            <p
              data-offline-note
              className="flex items-start gap-1.5 rounded-md border border-warn/30 bg-warn-wash px-2.5 py-2 text-xs leading-relaxed text-warn-ink"
            >
              <CloudOff className="mt-px size-3.5 shrink-0" />
              <span>
                {offlineNote ??
                  `${queuedCount} report${queuedCount === 1 ? '' : 's'} queued offline — will file on reconnect.`}
              </span>
            </p>
          )}

          <p className="text-center text-xs text-ink-muted">
            Files as <span className="font-medium text-ink-soft">Reported</span> · restricted
            confidentiality by default · queued for triage
            {typeof navigator !== 'undefined' && navigator.onLine === false
              ? ' · currently offline'
              : ''}
          </p>
        </div>
      </aside>
    </div>
  )
}
