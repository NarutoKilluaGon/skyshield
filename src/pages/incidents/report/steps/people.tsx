import { Building2 } from 'lucide-react'
import { Field, Input, Textarea } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/primitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { USERS } from '@/data/users'
import type { ReportForm } from '../use-report-form'

const DEPARTMENTS = [
  'Flight Operations',
  'Line Maintenance',
  'Cabin Crew',
  'Engineering',
  'Ground Handling',
  'Ramp Services',
  'Training',
]

/** Step 4 — reporter, crew, department and the regulatory flag. */
export function PeopleStep({ rf }: { rf: ReportForm }) {
  const { form, set, touched, errors } = rf
  return (
    <>
      <Field label="Reporter" required error={touched.reporterId ? errors.reporterId : undefined}>
        <Select value={form.reporterId} onValueChange={(v) => set('reporterId', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USERS.filter((u) => u.active).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name} — {u.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Crew on duty" hint="Comma separated. Include flight, cabin and engineering crew.">
        <Textarea
          rows={3}
          value={form.crew}
          onChange={(e) => set('crew', e.target.value)}
          placeholder="Capt. V. Raghavan, F/O S. Iyer, F/E M. Qureshi"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Department / Function">
          <Select value={form.department} onValueChange={(v) => set('department', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Operator / Organisation">
          <Input value={form.operator} onChange={(e) => set('operator', e.target.value)} icon={<Building2 />} />
        </Field>
      </div>

      <Field label="Injuries" hint="Number of persons injured. Enter 0 if none.">
        <Input
          type="number"
          min={0}
          max={99}
          value={form.injuries}
          onChange={(e) => set('injuries', Number(e.target.value))}
          className="w-28"
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-line bg-surface-2/40 p-3 transition-colors hover:bg-surface-2">
        <Checkbox
          checked={form.regulatory}
          onCheckedChange={(v) => set('regulatory', v === true)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-medium text-ink">Regulatory notification required</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
            Tick when the occurrence is notifiable to DGCA AAIB or the relevant state authority. The
            Safety Manager is alerted immediately on submission.
          </span>
        </span>
      </label>
    </>
  )
}
