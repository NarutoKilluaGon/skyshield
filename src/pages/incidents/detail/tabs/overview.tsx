import { EyeOff, Loader2, MapPin, Plane, Truck, UserRound, Users } from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/common/avatar'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { CATEGORY_LABEL, PHASE_LABEL, SEVERITY_TONE, SEVERITY_VALUE, LIKELIHOOD_LABEL } from '@/lib/domain'
import { fmtDate, fmtDateTime, fmtTime, timeTitle } from '@/lib/format'
import { userById, userName } from '@/data/users'
import { IncidentComments } from '@/components/incidents/comments'
import { InfoCard, OCCURRENCE, type DetailData } from '../shared'

/**
 * Overview — two columns: the narrative record on the left, and a sticky
 * facts sidebar on the right carrying the at-a-glance figures (risk, status,
 * people, counters) that used to live in a six-tile strip above the tabs.
 */
export function OverviewTab({ d }: { d: DetailData }) {
  const { incident, ac, band } = d
  const { user } = useAuth()

  // Reporter confidentiality (master 6): restricted records withhold the
  // reporter identity until a manager formally reveals it — an audited act.
  const reporterHidden =
    incident.confidentiality === 'restricted' &&
    !incident.reporterRevealed &&
    incident.reporterId !== user?.id
  const canReveal = can(user, 'incident.close')

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* ---------------- narrative column ---------------- */}
      <div className="space-y-4 xl:col-span-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Incident description</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{incident.description}</p>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InfoCard
            icon={Plane}
            title="Aircraft information"
            rows={[
              ['Registration', ac?.registration ?? '—'],
              ['Type', ac?.type ?? '—'],
              ['Manufacturer', ac?.manufacturer ?? '—'],
              ['Model', ac?.model ?? '—'],
              ['Operator', ac?.operator ?? '—'],
              ['Total cycles', ac?.totalCycles.toLocaleString() ?? '—'],
              ['Total hours', ac?.totalHours.toLocaleString() ?? '—'],
              ['Next inspection', fmtDate(ac?.nextInspectionAt)],
            ]}
          />
          <InfoCard
            icon={Truck}
            title="Flight information"
            rows={[
              ['Flight number', incident.flight?.flightNumber ?? '—'],
              ['Origin', incident.flight?.origin ?? '—'],
              ['Destination', incident.flight?.destination ?? '—'],
              ['Flight type', incident.flight?.flightType ?? '—'],
              ['Scheduled', `${fmtDate(incident.flight?.scheduledDeparture)} ${fmtTime(incident.flight?.scheduledDeparture)}`],
              ['Actual', `${fmtDate(incident.flight?.actualDeparture)} ${fmtTime(incident.flight?.actualDeparture)}`],
              ['Passengers', incident.flight?.pax.toString() ?? '—'],
              ['Operational phase', PHASE_LABEL[incident.phase]],
            ]}
          />
        </div>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Immediate actions taken</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{incident.immediateActions}</p>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
            <Badge size="md" tone="neutral">
              Injuries: {incident.injuries}
            </Badge>
            <Badge size="md" tone="neutral" className="capitalize">
              Damage: {incident.damageCategory}
            </Badge>
            <Badge size="md" tone="neutral">
              {CATEGORY_LABEL[incident.category]}
            </Badge>
            <Badge size="md" tone="neutral">
              {OCCURRENCE[incident.occurrenceCategory]?.label ?? incident.occurrenceCategory}
            </Badge>
          </div>
        </Card>

        <IncidentComments incidentId={incident.id} />
      </div>

      {/* ---------------- sticky facts sidebar ---------------- */}
      <div className="no-scrollbar space-y-4 xl:sticky xl:top-[68px] xl:max-h-[calc(100dvh-88px)] xl:self-start xl:overflow-y-auto">
        <Card
          className="p-4"
          style={{ borderColor: alpha(band.color, 25) }}
        >
          <h3 className="text-sm font-semibold text-ink">Facts</h3>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-xl font-semibold leading-none tnum" style={{ color: band.color }}>
              {incident.risk.score}
            </p>
            <p className="pb-0.5 text-xs text-ink-muted">
              {band.label} band · Severity {SEVERITY_VALUE[incident.risk.severity]} (
              {SEVERITY_TONE[incident.risk.severity].label}) × Likelihood {incident.risk.likelihood} (
              {LIKELIHOOD_LABEL[incident.risk.likelihood]})
            </p>
          </div>
          <dl className="mt-3 space-y-2 border-t border-line-soft pt-3 text-xs">
            {(
              [
                ['Status', incident.status.replace('_', ' ')],
                ['Reported', fmtDateTime(incident.reportedAt)],
                ['Investigator', userName(incident.investigatorId)],
                ['Open actions', String(incident.capaIds.length)],
                ['Evidence items', String(d.evidence.length)],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">{k}</dt>
                <dd className={cn('truncate font-medium capitalize', k === 'Open actions' && incident.capaIds.length > 0 ? 'text-alert-ink' : 'text-ink-soft')}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <InfoCard
          icon={MapPin}
          title="Location"
          rows={[
            ['Airport', incident.location.airport],
            ['IATA', incident.location.iata],
            ['City', `${incident.location.city}, ${incident.location.country}`],
            ['Position', incident.location.specific],
            ['Coordinates', `${incident.location.latitude}, ${incident.location.longitude}`],
          ]}
        />
        <Card className="p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <UserRound className="size-3.5 text-ink-muted" />
            Reporter
            {reporterHidden && (
              <Badge size="sm" tone="neutral" className="ml-auto gap-1">
                <EyeOff className="size-3" /> Restricted
              </Badge>
            )}
          </h3>
          {reporterHidden ? (
            <div className="mt-3">
              <p className="text-sm text-ink-muted">
                Identity withheld — this is a restricted record under the just-culture policy.
              </p>
              {canReveal ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2.5 gap-1.5"
                    data-reveal-reporter
                    disabled={d.revealing}
                    onClick={d.onRevealReporter}
                  >
                    {d.revealing ? <Loader2 className="size-3.5 animate-spin" /> : <EyeOff className="size-3.5" />}
                    Reveal identity
                  </Button>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    The reveal is written to the audit history with your name.
                  </p>
                </>
              ) : (
                <p className="mt-1.5 text-xs text-ink-faint">
                  Safety managers can reveal the identity; the act is audited.
                </p>
              )}
            </div>
          ) : (
            <dl className="mt-3 space-y-1.5">
              {(
                [
                  ['Name', userName(incident.reporterId)],
                  ['Reported at', fmtDateTime(incident.reportedAt)],
                  ['Occurred at', fmtDateTime(incident.occurredAt)],
                  ['Department', incident.department],
                  ['Operator', incident.operator],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-xs text-ink-muted">{k}</dt>
                  <dd
                    className="truncate text-right font-mono text-xs text-ink-soft"
                    title={k.endsWith(' at') ? timeTitle(k === 'Reported at' ? incident.reportedAt : incident.occurredAt) : undefined}
                  >
                    {v}
                  </dd>
                </div>
              ))}
              {incident.reporterRevealed && (
                <p className="pt-1 text-xs text-ink-faint">
                  Identity revealed — see the audit history for who and when.
                </p>
              )}
            </dl>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Crew on duty</h3>
          <ul className="mt-2.5 space-y-2">
            {incident.crew.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Users className="size-3 shrink-0 text-ink-muted" />
                <span className="text-sm text-ink-soft">{c}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Assigned investigator</h3>
          {incident.investigatorId ? (
            <div className="mt-2.5 flex items-center gap-2.5">
              <Avatar user={userById(incident.investigatorId)} size="lg" showStatus />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {userName(incident.investigatorId)}
                </p>
                <p className="truncate text-xs text-ink-muted">
                  {userById(incident.investigatorId)?.title}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">
              No investigator assigned. Assign from the investigation tab.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
