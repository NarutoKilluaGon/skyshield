import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field, Textarea } from '@/components/ui/input'
import { Separator } from '@/components/ui/primitives'
import type { ReportForm } from '../use-report-form'

/** Step 3 — the narrative, with the confidentiality classification. */
export function DescriptionStep({ rf }: { rf: ReportForm }) {
  const { form, set, touched, errors } = rf
  return (
    <>
      <Field
        label="Incident description"
        required
        error={touched.description ? errors.description : undefined}
        hint="State the sequence of events factually. Avoid conclusions or blame. Include the conditions, warnings received and crew actions."
      >
        <Textarea
          rows={12}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          invalid={!!(touched.description && errors.description)}
          placeholder="At approximately 08:42 local time, during the initial climb, the crew observed…"
          className="font-[inherit] leading-relaxed"
        />
      </Field>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>Minimum 40 characters. Attach raw data extracts in the Evidence step.</span>
        <span className={cn('tnum', form.description.length < 40 && 'text-warn')}>
          {form.description.length} characters
        </span>
      </div>

      <Separator />

      <div className="rounded-lg border border-line bg-surface-2/40 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <Lock className="size-3" /> Confidentiality
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Occurrence narratives are treated as safety-protected material. Access is limited to the
          investigation team and the Safety Manager. No content of this record may be used for
          disciplinary purposes (CAR 5.12).
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {(['internal', 'restricted', 'open'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set('confidential', c)}
              className={cn(
                'rounded-md border px-2 py-1.5 text-xs capitalize transition-colors',
                form.confidential === c
                  ? 'border-brand/50 bg-brand/10 text-ink'
                  : 'border-line bg-surface-2/40 text-ink-muted hover:bg-surface-2',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
