import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field, Textarea } from '@/components/ui/input'
import type { ReportForm } from '../use-report-form'

/** Step 6 — containment and recovery actions taken on the day. */
export function ImmediateActionsStep({ rf }: { rf: ReportForm }) {
  const { form, set, touched, errors } = rf
  const elevated = form.severity === 'critical' || form.severity === 'high'
  return (
    <>
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-lg border p-3',
          elevated ? 'border-alert/32 bg-alert/[0.07]' : 'border-line bg-surface-2/40',
        )}
      >
        <TriangleAlert className={cn('mt-px size-4 shrink-0', elevated ? 'text-alert' : 'text-ink-muted')} />
        <div>
          <p className="text-sm font-medium text-ink">Immediate actions taken</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            Record the containment and recovery actions executed before the aircraft continued, was
            recovered or was released to service. This section forms part of the regulatory record.
          </p>
        </div>
      </div>

      <Field
        label="Actions taken on the day"
        required
        error={touched.immediateActions ? errors.immediateActions : undefined}
      >
        <Textarea
          rows={8}
          value={form.immediateActions}
          onChange={(e) => set('immediateActions', e.target.value)}
          invalid={!!(touched.immediateActions && errors.immediateActions)}
          placeholder="Crew shut down the engine in accordance with the QRH and continued to…"
        />
      </Field>
    </>
  )
}
