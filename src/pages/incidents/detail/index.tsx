import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ClipboardCheck,
  Clock,
  Download,
  GitBranch,
  ListChecks,
  Loader2,
  Lock,
  MapPin,
  MoreHorizontal,
  Plane,
  Radio,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/lib/auth'
import { can } from '@/lib/permissions'
import { riskBand } from '@/lib/domain'
import { fmtDateLong, fmtTimePref, timeTitle } from '@/lib/format'
import {
  ConflictError,
  WorkflowError,
  downloadCsv,
  getIncident,
  revealReporter,
  toCsv,
  transitionIncident,
} from '@/services/incidents'
import { canTransition, type TransitionContext } from '@/lib/workflow'
import { getCAPAs, getEvidence, getTimeline } from '@/services/operations'
import { aircraftById } from '@/data/aircraft'
import { storeInvestigationByIncident, storeRcaByIncident } from '@/services/store'
import type { CAPA, EvidenceItem, Incident, IncidentStatus, TimelineEvent } from '@/types'
import { DetailSkeleton, type DetailData } from './shared'
import { OverviewTab } from './tabs/overview'
import { RiskTab } from './tabs/risk'
import { InvestigationTab } from './tabs/investigation'
import { EvidenceTab } from './tabs/evidence'
import { TimelineTab } from './tabs/timeline'
import { RcaTab } from './tabs/rca'
import { CapaTab } from './tabs/capa'
import { AuditTab } from './tabs/audit'

const TABS = ['overview', 'risk', 'investigation', 'evidence', 'timeline', 'rca', 'capa', 'audit'] as const
type Tab = (typeof TABS)[number]

export default function IncidentDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab') as Tab | null
  const tab = tabParam && TABS.includes(tabParam) ? tabParam : 'overview'

  const [incident, setIncident] = useState<Incident | null>(null)
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [capas, setCapas] = useState<CAPA[]>([])
  const [loading, setLoading] = useState(true)
  const [transitioning, setTransitioning] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [actionNote, setActionNote] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true)
    Promise.all([getIncident(id), getEvidence(id), getTimeline(id), getCAPAs()])
      .then(([inc, ev, tl, cp]) => {
        if (!live) return
        setIncident(inc)
        setEvidence(ev)
        setTimeline(tl)
        setCapas(cp)
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [id])

  const ac = incident ? aircraftById(incident.aircraftId) : undefined
  const inv = useMemo(() => (incident ? storeInvestigationByIncident(incident.id) : undefined), [incident])
  const rca = useMemo(() => (incident ? storeRcaByIncident(incident.id) : undefined), [incident])
  const incidentCapas = useMemo(
    () => (incident ? capas.filter((c) => incident.capaIds.includes(c.id)) : []),
    [incident, capas],
  )

  if (loading) return <DetailSkeleton />

  if (!incident)
    return (
      <Card className="p-10 text-center">
        <ShieldAlert className="mx-auto size-6 text-ink-muted" />
        <h2 className="mt-3 text-md font-semibold text-ink">Incident not found</h2>
        <p className="mt-1 text-sm text-ink-muted">
          The record <span className="font-mono">{id}</span> does not exist or you do not have access.
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate('/incidents')}>
          Back to register
        </Button>
      </Card>
    )

  const band = riskBand(incident.risk.score)

  const handleRevealReporter = async () => {
    setRevealing(true)
    try {
      setIncident(await revealReporter(incident.id, user?.id ?? 'usr_001'))
    } finally {
      setRevealing(false)
    }
  }

  const d: DetailData = {
    incident,
    ac,
    inv,
    rca,
    capas: incidentCapas,
    evidence,
    timeline,
    band,
    onRevealReporter: () => void handleRevealReporter(),
    revealing,
  }

  const setTab = (t: string) => {
    const next = new URLSearchParams(params)
    if (t === 'overview') next.delete('tab')
    else next.set('tab', t)
    setParams(next, { replace: true })
  }

  const exportRecord = () => {
    downloadCsv(`skyshield-${incident.ref}.csv`, toCsv([incident]))
  }

  /** One primary action, driven by status and the signed-in role (master 4.4).
   *  Status moves run through the guarded workflow service (master 5.3). */
  const runTransition = async (to: IncidentStatus) => {
    setTransitioning(true)
    setActionNote(null)
    try {
      const updated = await transitionIncident(incident.id, to, user?.id ?? 'usr_001', incident.version)
      setIncident(updated)
    } catch (e) {
      if (e instanceof ConflictError) {
        try {
          setIncident(await getIncident(incident.id))
        } catch {
          /* keep the current copy */
        }
        setActionNote({ kind: 'info', text: e.message })
      } else if (e instanceof WorkflowError) {
        setActionNote({ kind: 'error', text: e.message })
      } else {
        setActionNote({ kind: 'error', text: e instanceof Error ? e.message : 'The transition failed.' })
      }
    } finally {
      setTransitioning(false)
    }
  }

  const startInvestigation = () => runTransition('investigation')

  // Closure verdict — computed with the same rules the service enforces, so
  // the button can explain a refusal before it is clicked.
  const openCapas = incidentCapas.filter((c) => !['completed', 'verified'].includes(c.status)).length
  const closeCtx: TransitionContext = {
    status: incident.status,
    userRole: user?.role ?? null,
    openCapas,
    investigationProgress: inv ? inv.progress : null,
  }
  const closeVerdict = canTransition(closeCtx, 'closed')
  const reopenVerdict = canTransition(closeCtx, 'investigation')

  const primary = ((): { label: string; icon: typeof GitBranch; onClick: () => void } | null => {
    if (incident.status === 'reported' && can(user, 'incident.edit'))
      return { label: 'Start investigation', icon: ClipboardCheck, onClick: () => void startInvestigation() }
    if ((incident.status === 'investigation' || incident.status === 'rca_pending') && can(user, 'rca.edit'))
      return { label: 'Open RCA workspace', icon: GitBranch, onClick: () => navigate(`/rca/${incident.id}`) }
    if (incident.status === 'capa')
      return { label: 'View corrective actions', icon: ListChecks, onClick: () => setTab('capa') }
    if (can(user, 'export.data'))
      return { label: 'Export record', icon: Download, onClick: exportRecord }
    return null
  })()

  return (
    <div className="space-y-4">
      {/* ---------------- header ---------------- */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/incidents')}
          className="-ml-1.5 gap-1.5 text-ink-muted"
        >
          <ArrowLeft className="size-3.5" /> Incident register
        </Button>

        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-lg font-semibold text-ink">{incident.ref}</h1>
              <Badge
                size="lg"
                tone="outline"
                className={cn(
                  incident.status === 'closed'
                    ? 'border-ok/32 bg-ok/12 text-ok-ink'
                    : incident.status === 'capa'
                      ? 'border-alert/32 bg-alert/12 text-alert-ink'
                      : incident.status === 'rca_pending'
                        ? 'border-warn/32 bg-warn/12 text-warn-ink'
                        : 'border-brand/32 bg-brand/10 text-brand',
                )}
              >
                <Dot
                  className={cn(
                    incident.status === 'closed'
                      ? 'bg-ok'
                      : incident.status === 'capa'
                        ? 'bg-alert'
                        : incident.status === 'rca_pending'
                          ? 'bg-warn'
                          : 'bg-brand',
                  )}
                />
                {incident.status === 'investigation' ? 'Under Investigation' : incident.status.replace('_', ' ')}
              </Badge>
              <Badge
                size="md"
                tone="outline"
                style={{ color: band.color, borderColor: alpha(band.color, 33) }}
              >
                Risk {incident.risk.score} · {band.label}
              </Badge>
              {incident.regulatoryNotification && (
                <Badge size="md" tone="red">
                  <Radio className="size-3" /> {incident.notifiedAuthority ?? 'Authority notified'}
                </Badge>
              )}
              {incident.confidentiality !== 'internal' && (
                <Badge size="md" tone="neutral">
                  {incident.confidentiality === 'open' ? 'Open reporting' : 'Restricted access'}
                </Badge>
              )}
            </div>
            <p className="mt-1.5 max-w-3xl text-base leading-relaxed text-ink-soft">{incident.title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
              <span className="flex items-center gap-1">
                <Plane className="size-3" /> {ac?.registration} · {ac?.type}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3" /> {incident.location.airport} ({incident.location.iata})
              </span>
              <span className="flex items-center gap-1" title={timeTitle(incident.occurredAt)}>
                <Clock className="size-3" /> {fmtDateLong(incident.occurredAt)} · {fmtTimePref(incident.occurredAt)}
              </span>
              <span className="font-mono">{incident.flight?.flightNumber}</span>
            </p>
          </div>

          {/* One context primary action + a real secondary menu */}
          <div className="flex shrink-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="More actions" className="gap-1.5">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[212px]">
                {can(user, 'export.data') && (
                  <DropdownMenuItem onSelect={exportRecord}>
                    <Download className="size-3.5" /> Export record (CSV)
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => navigate(`/rca/${incident.id}`)}>
                  <GitBranch className="size-3.5" /> Open RCA workspace
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab('investigation')}>
                  <ClipboardCheck className="size-3.5" /> Go to investigation
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab('audit')}>
                  <Clock className="size-3.5" /> Go to audit history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {primary && (
              <Button size="sm" className="gap-1.5" onClick={primary.onClick} disabled={transitioning}>
                {transitioning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <primary.icon className="size-3.5" />
                )}
                {primary.label}
              </Button>
            )}
          </div>
        </div>

        {/* guarded closure / re-open — the button explains every refusal */}
        {can(user, 'incident.close') && incident.status !== 'closed' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!closeVerdict.ok || transitioning}
              onClick={() => runTransition('closed')}
              data-close-incident
            >
              <Lock className="size-3.5" /> Close incident
            </Button>
            {!closeVerdict.ok && (
              <span data-close-reason className="max-w-xl text-xs leading-relaxed text-ink-muted">
                {closeVerdict.reason}
              </span>
            )}
          </div>
        )}
        {can(user, 'incident.close') && incident.status === 'closed' && reopenVerdict.ok && (
          <div className="mt-2.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={transitioning}
              onClick={() => runTransition('investigation')}
              data-reopen-incident
            >
              <RotateCcw className="size-3.5" /> Re-open incident
            </Button>
          </div>
        )}

        {actionNote && (
          <p
            role="status"
            data-action-note
            className={cn(
              'mt-2.5 rounded-md border px-3 py-2 text-xs leading-relaxed',
              actionNote.kind === 'error'
                ? 'border-crit/35 bg-crit-wash text-crit-ink'
                : 'border-line bg-surface-2 text-ink-soft',
            )}
          >
            {actionNote.text}
          </p>
        )}
      </div>

      {/* ---------------- tabs ---------------- */}
      <Card className="overflow-hidden">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="px-3">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
              <TabsTrigger value="investigation">Investigation</TabsTrigger>
              <TabsTrigger value="evidence" badge={evidence.length}>
                Evidence
              </TabsTrigger>
              <TabsTrigger value="timeline" badge={timeline.length}>
                Timeline
              </TabsTrigger>
              <TabsTrigger value="rca">RCA</TabsTrigger>
              <TabsTrigger value="capa" badge={incident.capaIds.length}>
                CAPA
              </TabsTrigger>
              <TabsTrigger value="audit">Audit History</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="p-4">
            <OverviewTab d={d} />
          </TabsContent>
          <TabsContent value="risk" className="p-4">
            <RiskTab d={d} />
          </TabsContent>
          <TabsContent value="investigation" className="p-4">
            <InvestigationTab d={d} />
          </TabsContent>
          <TabsContent value="evidence" className="p-4">
            <EvidenceTab d={d} />
          </TabsContent>
          <TabsContent value="timeline" className="p-4">
            <TimelineTab d={d} />
          </TabsContent>
          <TabsContent value="rca" className="p-4">
            <RcaTab d={d} />
          </TabsContent>
          <TabsContent value="capa" className="p-4">
            <CapaTab d={d} />
          </TabsContent>
          <TabsContent value="audit" className="p-4">
            <AuditTab entityId={incident.id} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  )
}
