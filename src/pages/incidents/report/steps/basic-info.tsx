import { cn } from '@/lib/utils'
import { Field, Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AIRCRAFT } from '@/data/aircraft'
import { AIRPORTS } from '@/data/incidents'
import type { ReportForm } from '../use-report-form'

/** Step 1 — when, where and which aircraft. */
export function BasicInfoStep({ rf }: { rf: ReportForm }) {
  const { form, set, onReg, touched, errors } = rf
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Incident ID" hint="Auto-assigned on submission" htmlFor="id">
          <Input id="id" value="Auto-generated" readOnly className="font-mono text-ink-muted" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required error={touched.occurredDate ? errors.occurredDate : undefined} htmlFor="date">
            <Input
              id="date"
              type="date"
              value={form.occurredDate}
              onChange={(e) => set('occurredDate', e.target.value)}
              invalid={!!(touched.occurredDate && errors.occurredDate)}
            />
          </Field>
          <Field label="Time" required htmlFor="time">
            <Input
              id="time"
              type="time"
              value={form.occurredTime}
              onChange={(e) => set('occurredTime', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <Field label="Airport / Station" required error={touched.airport ? errors.airport : undefined}>
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

      <Field label="Specific location" hint="Taxiway, stand, gate or airspace segment" htmlFor="loc">
        <Input
          id="loc"
          value={form.location}
          onChange={(e) => set('location', e.target.value)}
          placeholder="e.g. RWY 28L, Taxiway M4"
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Flight number" htmlFor="flt" error={touched.flightNumber ? errors.flightNumber : undefined}>
          <Input
            id="flt"
            value={form.flightNumber}
            onChange={(e) => set('flightNumber', e.target.value.toUpperCase())}
            placeholder="SKY2214"
            className="font-mono"
            invalid={!!(touched.flightNumber && errors.flightNumber)}
          />
        </Field>
        <Field label="Aircraft registration" required error={touched.aircraftReg ? errors.aircraftReg : undefined}>
          <Select value={form.aircraftReg} onValueChange={onReg}>
            <SelectTrigger className={cn(touched.aircraftReg && errors.aircraftReg && 'border-crit/60')}>
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
      </div>

      <Field label="Aircraft type" hint="Populated from the fleet register" htmlFor="atype">
        <Input
          id="atype"
          value={form.aircraftType}
          readOnly
          placeholder="Select an aircraft first"
          className="text-ink-muted"
        />
      </Field>
    </>
  )
}
