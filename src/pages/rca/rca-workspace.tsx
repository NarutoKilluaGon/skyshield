import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowUpRight,
  CheckCircle2,
  CircleCheckBig,
  ClipboardCheck,
  GitBranch,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { FiveWhys } from '@/components/rca/five-whys'
import { ContributingFactors } from '@/components/rca/contributing-factors'
import { Card } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator, Skeleton } from '@/components/ui/primitives'
import { RiskBadge, SeverityBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { startRCA, updateRCA } from '@/services/operations'
import { db, storeIncidentById, storeRcaByIncident } from '@/services/store'
import { userById, userName } from '@/data/users'
import { FACTOR_CATEGORIES } from '@/lib/domain'
import { fmtDate, fmtRelative, fmtTime } from '@/lib/format'
import { useAuth } from '@/lib/auth'
import type { ContributingFactor, FiveWhys as FiveWhysModel, RCA } from '@/types'

const AUTOSAVE_MS = 1500

/** Trim long clauses so the summary stays one readable sentence-set. */
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export default function RCAWorkspacePage() {
  const { incidentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [rca, setRca] = useState<RCA | null>(null)
  const [factors, setFactors] = useState<ContributingFactor[]>([])
  const [causes, setCauses] = useState<string[]>([])
  const [recs, setRecs] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)

  // Load the incident-scoped record. No silent fallbacks: if the incident has
  // no analysis yet, the page says so and offers to start one for real.
  useEffect(() => {
    const found = incidentId ? storeRcaByIncident(incidentId) : undefined
    setRca(found ?? null)
    setFactors(found ? found.factors : [])
    setCauses(found ? [...found.identifiedRootCauses] : [])
    setRecs(found ? [...found.recommendations] : [])
    setDirty(false)
    setSavedAt(null)
    setLoaded(true)
  }, [incidentId])

  const inc = useMemo(
    () => (rca ? storeIncidentById(rca.incidentId) : incidentId ? storeIncidentById(incidentId) : undefined),
    [rca, incidentId],
  )

  /* ------------------------------------------------------------ persistence */

  const stateRef = useRef({ rca, factors, causes, recs })
  stateRef.current = { rca, factors, causes, recs }

  const save = useCallback(async () => {
    const cur = stateRef.current.rca
    if (!cur) return
    setSaving(true)
    try {
      const updated = await updateRCA(cur.id, {
        fiveWhys: cur.fiveWhys,
        method: cur.method,
        factors: stateRef.current.factors,
        identifiedRootCauses: stateRef.current.causes,
        recommendations: stateRef.current.recs,
        status: cur.status === 'not_started' ? 'in_progress' : cur.status,
      })
      setRca(updated)
      setSavedAt(new Date().toISOString())
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }, [])

  // Debounced autosave — the header reports Saving… / Saved HH:MM.
  useEffect(() => {
    if (!dirty || !rca) return
    const t = window.setTimeout(() => void save(), AUTOSAVE_MS)
    return () => window.clearTimeout(t)
  }, [dirty, rca, factors, causes, recs, save])

  const createForThisIncident = async () => {
    if (!incidentId) return
    setCreating(true)
    try {
      const created = await startRCA(incidentId, user?.id ?? 'usr_001')
      setRca(created)
      setFactors(created.factors)
      setCauses([...created.identifiedRootCauses])
      setRecs([...created.recommendations])
    } finally {
      setCreating(false)
    }
  }

  /* ------------------------------------------------------------- rendering */

  if (!loaded)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-[320px]" />
        <Skeleton className="h-[420px]" />
      </div>
    )

  if (!rca)
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <GitBranch className="size-5 text-ink-muted" />
        <p className="text-base font-medium text-ink-soft">
          {incidentId ? 'No analysis recorded for this incident yet' : 'No RCA available'}
        </p>
        <p className="max-w-sm text-xs text-ink-muted">
          {incidentId
            ? 'Start a five-whys analysis to record the causal chain, contributing factors and recommendations for this occurrence.'
            : 'Select an incident to open its root cause analysis workspace.'}
        </p>
        {incidentId ? (
          <Button className="mt-2 gap-1.5" size="sm" onClick={createForThisIncident} disabled={creating}>
            {creating ? <Loader2 className="size-3.5 animate-spin" /> : <GitBranch className="size-3.5" />}
            Start 5 Whys analysis
          </Button>
        ) : (
          <Button className="mt-2" size="sm" onClick={() => navigate('/incidents')}>
            Browse incidents
          </Button>
        )}
      </Card>
    )

  const fiveWhysModel: FiveWhysModel = rca.fiveWhys ?? {
    id: `fw_${rca.id}`,
    rcaId: rca.id,
    problem: inc?.title ?? 'Define the problem statement',
    rootCause: '',
    status: 'draft',
    authorId: rca.authorId,
    updatedAt: new Date().toISOString(),
    category: 'technical',
    whys: [
      { id: 'w1', question: 'Why did this happen?', answer: '' },
      { id: 'w2', question: 'Why did that occur?', answer: '' },
      { id: 'w3', question: 'Why was it not detected?', answer: '' },
      { id: 'w4', question: 'Why was the process insufficient?', answer: '' },
      { id: 'w5', question: 'Why was the process designed this way?', answer: '' },
    ],
  }

  /* ------------------------------------------- live plain-language summary */

  const answered = fiveWhysModel.whys.filter((w) => w.answer.trim())
  const lastAnswer = answered.length ? answered[answered.length - 1].answer.trim() : null
  const primaryFactor = factors.find((f) => f.weight === 'primary') ?? factors[0]
  const factorCat = primaryFactor
    ? FACTOR_CATEGORIES.find((c) => c.id === primaryFactor.category)?.label.toLowerCase()
    : null

  const summaryParts: string[] = [`“${clip(fiveWhysModel.problem, 80)}”`]
  summaryParts.push(
    answered.length
      ? `has ${answered.length} answered why-level${answered.length === 1 ? '' : 's'}`
      : 'has no answered why-levels yet',
  )
  if (lastAnswer) summaryParts.push(`the deepest recorded cause is “${clip(lastAnswer, 90)}”`)
  if (fiveWhysModel.rootCause.trim())
    summaryParts.push(`the systemic root cause is “${clip(fiveWhysModel.rootCause.trim(), 110)}”`)
  else summaryParts.push('no systemic root cause has been stated yet')
  if (primaryFactor)
    summaryParts.push(
      `the ${primaryFactor.weight} contributing factor is “${clip(primaryFactor.label, 60)}”${factorCat ? ` (${factorCat})` : ''}`,
    )
  summaryParts.push(
    `${causes.length} root-cause statement${causes.length === 1 ? '' : 's'} and ${recs.length} recommendation${recs.length === 1 ? '' : 's'} are on record`,
  )
  const summary = `${summaryParts.join('; ')}.`

  const completeness =
    (answered.length > 0 ? 1 : 0) +
    (fiveWhysModel.rootCause ? 1 : 0) +
    (causes.length > 0 ? 1 : 0) +
    (recs.length > 0 ? 1 : 0) +
    (factors.length > 0 ? 1 : 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Root Cause Analysis"
        subtitle="Structured causal analysis of safety occurrences using 5 Whys, contributing factors and recommended actions."
        meta={
          <>
            <Badge size="md" tone={rca.status === 'completed' ? 'green' : rca.status === 'in_review' ? 'amber' : 'brand'}>
              {rca.status.replace('_', ' ')}
            </Badge>
            <Badge size="md" tone="neutral">
              {completeness}/5 sections complete
            </Badge>
            <Badge
              size="md"
              tone={dirty ? 'orange' : 'green'}
              data-autosave
            >
              {saving ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> Saving…
                </>
              ) : dirty ? (
                <>
                  <Dot className="bg-alert" /> Unsaved changes
                </>
              ) : savedAt ? (
                <>
                  <CircleCheckBig className="size-3" /> Saved {fmtTime(savedAt)}
                </>
              ) : (
                <>
                  <CircleCheckBig className="size-3" /> All changes saved
                </>
              )}
            </Badge>
          </>
        }
        actions={
          <>
            <Select
              value={rca.id}
              onValueChange={(v) => {
                const next = db.rcas.find((x) => x.id === v)
                if (!next) return
                navigate(`/rca/${next.incidentId}`, { replace: true })
              }}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select analysis" />
              </SelectTrigger>
              <SelectContent>
                {db.rcas.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {storeIncidentById(r.incidentId)?.ref} — {r.title.slice(0, 34)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setRca({ ...rca, status: 'in_review' })
                setDirty(true)
              }}
              disabled={rca.status === 'in_review' || rca.status === 'completed'}
              className="gap-1.5"
            >
              <Send className="size-3.5" /> Submit for review
            </Button>
          </>
        }
      />

      {/* analysis context */}
      {inc && (
        <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(`/incidents/${inc.id}`)}
              className="rounded font-mono text-sm font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
            >
              {inc.ref}
            </button>
            <span className="h-3.5 w-px bg-line" />
            <span className="truncate text-sm text-ink-soft">{inc.title}</span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <SeverityBadge severity={inc.risk.severity} size="sm" />
            <RiskBadge score={inc.risk.score} size="sm" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate(`/incidents/${inc.id}`)}
              className="gap-1 text-brand"
            >
              Open incident <ArrowUpRight className="size-3" />
            </Button>
          </div>
        </Card>
      )}

      {/* 5 Whys */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <GitBranch className="size-4 text-brand" />
          <h2 className="text-md font-semibold text-ink">5 Whys Analysis</h2>
          <span className="text-xs text-ink-muted">
            Drill down to the systemic condition behind the occurrence
          </span>
        </div>
        <FiveWhys
          editable
          model={fiveWhysModel}
          onChange={(m) => {
            setRca({ ...rca, fiveWhys: m, method: 'five_whys' })
            setDirty(true)
          }}
        />
      </section>

      {/* live plain-language summary — recomputed on every edit */}
      <Card className="p-3.5" data-rca-summary>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
          <Sparkles className="size-3 text-brand" />
          Plain-language summary
          <span className="font-normal text-ink-faint">· updates as you edit</span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{summary}</p>
      </Card>

      {/* contributing factors */}
      <section>
        <div className="mb-2.5 flex items-center gap-2">
          <Lightbulb className="size-4 text-brand" />
          <h2 className="text-md font-semibold text-ink">Contributing Factors</h2>
          <span className="text-xs text-ink-muted">
            Classify the human, technical, environmental, organisational and procedural conditions
          </span>
        </div>
        <ContributingFactors
          editable
          factors={factors}
          onChange={(f) => {
            setFactors(f)
            setDirty(true)
          }}
        />
      </section>

      {/* root causes + recommendations */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ListEditor
          title="Identified root causes"
          icon={CheckCircle2}
          tone="var(--color-crit-ink)"
          wash="var(--color-crit-wash)"
          hint="Systemic conditions that, if removed, prevent recurrence."
          items={causes}
          onChange={(c) => {
            setCauses(c)
            setDirty(true)
          }}
          placeholder="e.g. Assurance process for service bulletins was insufficient"
        />
        <ListEditor
          title="Recommendations"
          icon={ClipboardCheck}
          tone="var(--color-ok-ink)"
          wash="var(--color-ok-wash)"
          hint="Converted into CAPA entries when the analysis is accepted."
          items={recs}
          onChange={(r) => {
            setRecs(r)
            setDirty(true)
          }}
          placeholder="e.g. Embody SB-ENG-441 across all affected units"
        />
      </div>

      <Card className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Avatar user={userById(rca.reviewerId ?? rca.authorId)} size="md" />
          <div>
            <p className="text-sm text-ink-soft">
              Author <span className="font-medium">{userName(rca.authorId)}</span>
              {rca.reviewerId && (
                <>
                  {' '}· Reviewer <span className="font-medium">{userName(rca.reviewerId)}</span>
                </>
              )}
            </p>
            <p className="text-xs text-ink-muted">
              Created {fmtDate(rca.createdAt)}
              {rca.completedAt && ` · completed ${fmtDate(rca.completedAt)}`}
              {' · '}
              {fmtRelative(rca.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge size="md" tone="neutral" className="gap-1.5">
            <Sparkles className="size-3" /> Method: {rca.method.replace('_', ' ')}
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => navigate('/rca/five-whys')} className="gap-1.5">
            <GitBranch className="size-3.5" /> 5 Whys index
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------- list editor */

function ListEditor({
  title,
  icon: Icon,
  tone,
  wash,
  hint,
  items,
  onChange,
  placeholder,
}: {
  title: string
  icon: typeof CheckCircle2
  tone: string
  wash: string
  hint: string
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    if (!draft.trim()) return
    onChange([...items, draft.trim()])
    setDraft('')
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <div
        className="flex items-center gap-2 border-b border-line-soft px-3.5 py-2.5"
        style={{ background: wash }}
      >
        <Icon className="size-3.5" style={{ color: tone }} />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="truncate text-xs text-ink-muted">{hint}</p>
        </div>
        <Badge size="sm" tone="neutral" className="tnum">
          {items.length}
        </Badge>
      </div>

      <ul className="flex-1 divide-y divide-line-soft">
        {items.length === 0 && (
          <li className="px-3.5 py-6 text-center text-xs text-ink-muted">Nothing recorded yet.</li>
        )}
        {items.map((c, i) => (
          <li key={i} className="group flex items-start gap-2.5 px-3.5 py-2.5">
            <span
              className="mt-px shrink-0 rounded px-1.5 py-px text-xs font-semibold tnum"
              style={{ color: tone, background: wash }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-soft">{c}</p>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, x) => x !== i))}
              aria-label={`Remove item ${i + 1}`}
              className="shrink-0 rounded p-1 text-ink-muted opacity-0 transition-opacity hover:bg-crit/12 hover:text-crit-ink group-hover:opacity-100 focus-visible:opacity-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <Separator />

      <div className="space-y-1.5 p-2.5">
        <Textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className={cn('min-h-[52px] text-xs')}
        />
        <Button size="xs" onClick={add} disabled={!draft.trim()} className="w-full">
          Add to list
        </Button>
      </div>
    </Card>
  )
}
