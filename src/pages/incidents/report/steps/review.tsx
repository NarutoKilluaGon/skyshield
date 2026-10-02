import { TriangleAlert } from 'lucide-react'
import { alpha } from '@/lib/utils'
import { Dot } from '@/components/ui/badge'
import { SeverityBadge, StatusBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { USERS } from '@/data/users'
import {
  CATEGORY_LABEL,
  LIKELIHOOD_LABEL,
  PHASE_LABEL,
  SEVERITY_TONE,
  riskBand,
} from '@/lib/domain'
import { fmtDateTime } from '@/lib/format'
import type { FormState } from '../use-report-form'
import type { EvidenceItem } from '@/types'

const ERROR_STEP: (keyof FormState)[] = [
  'occurredDate',
  'occurredTime',
  'airport',
  'aircraftReg',
  'category',
  'severity',
  'description',
  'reporterId',
  'immediateActions',
]

function stepForField(field: string): number {
  const MAP: Record<string, number> = {
    occurredDate: 1,
    occurredTime: 1,
    airport: 1,
    aircraftReg: 1,
    category: 2,
    severity: 2,
    description: 3,
    reporterId: 4,
    immediateActions: 6,
  }
  return MAP[field] ?? Math.max(1, ERROR_STEP.indexOf(field as keyof FormState) + 1)
}

/** Step 7 — full-record review: risk statement, error summary, section grid. */
export function ReviewStep({
  form,
  score,
  evidence,
  onJump,
  errors,
}: {
  form: FormState
  score: number
  evidence: EvidenceItem[]
  onJump: (n: number) => void
  errors: Partial<Record<keyof FormState, string>>
}) {
  const band = riskBand(score || 1)
  const anyError = Object.keys(errors).length > 0

  const groups = [
    {
      step: 1,
      title: 'Basic information',
      rows: [
        ['Date & time', `${form.occurredDate} ${form.occurredTime}`],
        ['Airport', `${form.airport}${form.location ? ` — ${form.location}` : ''}`],
        ['Flight', form.flightNumber || '—'],
        ['Aircraft', form.aircraftReg ? `${form.aircraftReg} (${form.aircraftType})` : '—'],
      ],
    },
    {
      step: 2,
      title: 'Classification',
      rows: [
        ['Incident type', form.category ? CATEGORY_LABEL[form.category] : '—'],
        ['Severity', form.severity ? SEVERITY_TONE[form.severity].label : '—'],
        ['Likelihood', `${form.likelihood} — ${LIKELIHOOD_LABEL[form.likelihood]}`],
        ['Operational phase', PHASE_LABEL[form.phase]],
      ],
    },
    {
      step: 3,
      title: 'Description',
      rows: [
        [
          'Narrative',
          form.description ? `${form.description.slice(0, 160)}${form.description.length > 160 ? '…' : ''}` : '—',
        ],
      ],
    },
    {
      step: 4,
      title: 'People & organisations',
      rows: [
        ['Reporter', USERS.find((u) => u.id === form.reporterId)?.name ?? '—'],
        ['Crew', form.crew || '—'],
        ['Department', form.department],
        ['Operator', form.operator],
        ['Regulatory', form.regulatory ? 'Notifiable to authority' : 'Internal only'],
      ],
    },
    {
      step: 5,
      title: 'Evidence',
      rows: [
        ['Attachments', `${evidence.length} item${evidence.length === 1 ? '' : 's'}`],
        ['Files', evidence.map((e) => e.name).join(', ') || '—'],
      ],
    },
    {
      step: 6,
      title: 'Immediate actions',
      rows: [['Actions taken', form.immediateActions || '—']],
    },
  ]

  return (
    <div className="space-y-3">
      {anyError && (
        <div className="flex items-start gap-2.5 rounded-lg border border-crit/35 bg-crit/[0.08] p-3">
          <TriangleAlert className="mt-px size-4 shrink-0 text-crit-ink" />
          <div>
            <p className="text-sm font-medium text-ink">The record is incomplete</p>
            <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
              {Object.entries(errors).map(([k, v]) => (
                <li key={k}>
                  · {v}{' '}
                  <button
                    type="button"
                    onClick={() => onJump(stepForField(k))}
                    className="text-brand underline underline-offset-2"
                  >
                    fix
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div
        className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: alpha(band.color, 27), background: band.dim }}
      >
        <div>
          <p className="text-xs font-semibold text-ink-muted">Risk assessment</p>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="text-xl font-semibold leading-none tnum" style={{ color: band.color }}>
              {score}
            </span>
            <span className="text-base font-semibold" style={{ color: band.color }}>
              {band.label.toUpperCase()}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">
            {form.severity ? SEVERITY_TONE[form.severity].label : '—'} severity × likelihood{' '}
            {form.likelihood} ({LIKELIHOOD_LABEL[form.likelihood]})
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          {form.severity && <SeverityBadge severity={form.severity} size="lg" />}
          <StatusBadge status="reported" size="lg" />
          <p className="text-xs text-ink-muted">Status on filing</p>
        </div>
      </div>

      {score >= 10 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-alert/32 bg-alert/[0.07] p-3">
          <TriangleAlert className="mt-px size-4 shrink-0 text-alert" />
          <p className="text-xs leading-relaxed text-ink-soft">
            On submission this occurrence is automatically routed to the Safety Manager for
            investigation assignment, and a regulatory notification task is raised to DGCA AAIB.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.step} className="rounded-lg border border-line bg-surface-2/40">
            <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
              <h3 className="text-xs font-semibold text-ink">{g.title}</h3>
              <button
                type="button"
                onClick={() => onJump(g.step)}
                className="text-xs font-medium text-brand transition-colors hover:text-brand-hover"
              >
                Edit
              </button>
            </div>
            <dl className="space-y-1.5 p-3">
              {g.rows.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 text-xs">
                  <dt className="shrink-0 text-ink-muted">{k}</dt>
                  <dd className="min-w-0 text-right font-medium text-ink-soft">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas-deep/50 px-3 py-2.5">
        <Avatar user={USERS.find((u) => u.id === form.reporterId)} size="sm" />
        <p className="text-xs leading-relaxed text-ink-muted">
          Submitting confirms the information is accurate to the best of the reporter's knowledge and
          is made under the operator's safety reporting policy. Logged{' '}
          <span className="text-ink-soft">{fmtDateTime(new Date().toISOString())}</span>.
        </p>
        <Dot className="ml-auto shrink-0 bg-ok" />
      </div>
    </div>
  )
}
