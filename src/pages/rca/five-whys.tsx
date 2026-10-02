import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, GitBranch, Layers, Loader2, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { FiveWhysMini } from '@/components/rca/five-whys'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress, Skeleton } from '@/components/ui/primitives'
import { RiskBadge, SeverityBadge } from '@/components/common/badges'
import { FACTOR_CATEGORIES } from '@/lib/domain'
import { fmtDate, fmtRelative } from '@/lib/format'
import { db, storeIncidentById, storeRcaByIncident } from '@/services/store'
import { userName } from '@/data/users'
import { startRCA } from '@/services/operations'
import { useAuth } from '@/lib/auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RCA } from '@/types'

export default function FiveWhysIndexPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | RCA['status']>('all')
  const [expanded, setExpanded] = useState<string | null>(db.rcas[0]?.id ?? null)
  const [newOpen, setNewOpen] = useState(false)
  const [newIncident, setNewIncident] = useState('')
  const [creating, setCreating] = useState(false)

  // Incidents that do not have an analysis yet — the honest candidate list.
  const candidates = useMemo(() => db.incidents.filter((i) => !storeRcaByIncident(i.id)), [])

  const createAnalysis = async () => {
    if (!newIncident) return
    setCreating(true)
    try {
      await startRCA(newIncident, user?.id ?? 'usr_001')
      setNewOpen(false)
      navigate(`/rca/${newIncident}`)
    } finally {
      setCreating(false)
    }
  }

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return db.rcas.filter((r) => (status === 'all' ? true : r.status === status)).filter((r) => {
      if (!term) return true
      const inc = storeIncidentById(r.incidentId)
      return [r.title, r.id, inc?.ref ?? '', inc?.title ?? '', userName(r.authorId)]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [q, status])

  const counts = useMemo(() => {
    const c: Record<string, number> = { not_started: 0, in_progress: 0, in_review: 0, completed: 0 }
    for (const r of db.rcas) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [])

  return (
    <div className="space-y-4">
      <PageHeader
        title="5 Whys Analysis"
        subtitle="Every 5 Whys chain in the register, with the problem statement, causal chain and resulting root cause."
        meta={
          <>
            <Badge size="md" tone="neutral">
              {db.rcas.length} analyses
            </Badge>
            <Badge size="md" tone="green">
              {counts.completed} accepted
            </Badge>
            <Badge size="md" tone="amber">
              {counts.in_review} in review
            </Badge>
          </>
        }
        actions={
          <Button className="gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="size-3.5" /> New analysis
          </Button>
        }
      />

      {/* New analysis — pick an incident without one; the workspace opens on the fresh draft. */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>New 5 Whys analysis</DialogTitle>
            <DialogDescription>
              Analyses are scoped to one occurrence. {candidates.length} incident
              {candidates.length === 1 ? '' : 's'} in the register do not have one yet.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5">
            <Select value={newIncident} onValueChange={setNewIncident}>
              <SelectTrigger aria-label="Incident">
                <SelectValue placeholder="Select an incident" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.ref} — {i.title.slice(0, 40)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="mt-2 text-xs text-ink-muted">
                Every registered incident already has an analysis.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAnalysis} disabled={!newIncident || creating} className="gap-1.5">
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <GitBranch className="size-3.5" />}
              Create and open
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search analyses, incidents or authors…"
          icon={<Search />}
          className="w-full sm:max-w-sm"
          aria-label="Search 5 Whys analyses"
        />
        <div className="flex items-center gap-1">
          {(['all', 'in_progress', 'in_review', 'completed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-md border px-2.5 py-1.5 text-xs capitalize transition-colors',
                status === s
                  ? 'border-brand/45 bg-brand/12 text-brand'
                  : 'border-line bg-surface-2/40 text-ink-muted hover:bg-surface-2',
              )}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
              {s !== 'all' && (
                <span className="ml-1.5 tnum">{counts[s] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-12 text-center">
            <Search className="size-5 text-ink-muted" />
            <p className="text-base font-medium text-ink-soft">No analyses match</p>
          </Card>
        )}

        {rows.map((r) => {
          const inc = storeIncidentById(r.incidentId)
          const open = expanded === r.id
          const depth = r.fiveWhys?.whys.filter((w) => w.answer.trim()).length ?? 0
          const target = r.fiveWhys?.whys.length ?? 5
          const pct = Math.round((depth / Math.max(1, target)) * 100)

          return (
            <Card key={r.id} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : r.id)}
                className="flex w-full flex-col gap-3 px-3.5 py-3 text-left transition-colors hover:bg-surface-2/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn(
                      'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border',
                      r.status === 'completed'
                        ? 'border-ok/32 bg-ok/12 text-ok-ink'
                        : r.status === 'in_review'
                          ? 'border-warn/32 bg-warn/12 text-warn-ink'
                          : 'border-info/32 bg-info/12 text-brand',
                    )}
                  >
                    <Layers className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {inc && (
                        <span className="font-mono text-xs font-semibold text-brand">
                          {inc.ref}
                        </span>
                      )}
                      <Badge
                        size="sm"
                        tone={r.status === 'completed' ? 'green' : r.status === 'in_review' ? 'amber' : 'brand'}
                      >
                        {r.status.replace('_', ' ')}
                      </Badge>
                      {inc && <SeverityBadge severity={inc.risk.severity} size="sm" />}
                      {inc && <RiskBadge score={inc.risk.score} size="sm" showBand={false} />}
                    </div>
                    <p className="mt-1 truncate text-base font-semibold text-ink">{r.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {userName(r.authorId)} · updated {fmtRelative(r.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="w-28">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>Depth</span>
                      <span className="tnum">
                        {depth}/{target}
                      </span>
                    </div>
                    <Progress value={pct} variant="bar" className="mt-1" indicatorClassName="bg-brand" />
                  </div>
                  <span className="text-xs text-ink-muted">{open ? 'Collapse' : 'Expand'}</span>
                </div>
              </button>

              {open && (
                <div className="border-t border-line bg-canvas-deep/40 px-3.5 py-3.5 animate-fade-in">
                  {r.fiveWhys ? (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-line bg-surface p-3.5">
                        <p className="text-xs font-semibold text-ink-muted">
                          Causal chain
                        </p>
                        <FiveWhysMini model={r.fiveWhys} className="mt-2.5" />
                      </div>
                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-ink-muted">
                          Contributing factor mix
                        </p>
                        {FACTOR_CATEGORIES.map((c) => {
                          const n = r.factors.filter((f) => f.category === c.id).length
                          const total = r.factors.length || 1
                          return (
                            <div key={c.id} className="flex items-center gap-2.5">
                              <span className="w-[112px] shrink-0 truncate text-xs text-ink-soft">
                                {c.label}
                              </span>
                              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-canvas-deep">
                                <div
                                  className="h-full rounded-full transition-[width] duration-500"
                                  style={{ width: `${(n / total) * 100}%`, background: c.color }}
                                />
                              </div>
                              <span className="w-4 shrink-0 text-right text-xs text-ink-muted tnum">
                                {n}
                              </span>
                            </div>
                          )
                        })}
                        {r.identifiedRootCauses.length > 0 && (
                          <div className="rounded-lg border border-crit/25 bg-crit/[0.05] p-2.5">
                            <p className="text-xs font-semibold text-crit-ink">
                              Root causes
                            </p>
                            <ul className="mt-1.5 space-y-1">
                              {r.identifiedRootCauses.map((c, i) => (
                                <li key={i} className="text-xs leading-relaxed text-ink-soft">
                                  · {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/rca/${r.incidentId}`)}
                          className="w-full gap-1.5"
                        >
                          Open full workspace <ArrowUpRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                      <GitBranch className="size-4 text-ink-muted" />
                      <p className="text-sm text-ink-soft">
                        5 Whys not yet recorded for this analysis
                      </p>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/rca/${r.incidentId}`)}
                        className="gap-1.5"
                      >
                        Start the chain <ArrowUpRight className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {!rows.length && <Skeleton className="h-40" />}

      <p className="text-center text-xs text-ink-muted">
        Analyses are retained for the full regulatory retention period. {fmtDate(new Date().toISOString())} view.
      </p>
    </div>
  )
}
