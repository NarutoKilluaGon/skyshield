import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Award,
  CalendarClock,
  CheckCircle2,
  Download,
  FileCheck2,
  Paperclip,
  Printer,
  Search,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
} from 'lucide-react'
import { cn, alpha } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { ChartCard } from '@/components/charts/chart-card'
import { ComplianceStatusBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { Card } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FilterBar, MultiSelectFilter, SearchBar } from '@/components/data/filters'
import { Pagination } from '@/components/data/data-table'
import { Separator, Skeleton, Tip } from '@/components/ui/primitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getComplianceRequirements,
  getComplianceSummary,
  uploadComplianceAttachment,
} from '@/services/operations'
import { useAuth } from '@/lib/auth'
import { downloadCsv } from '@/services/incidents'
import { COMPLIANCE_STATUS } from '@/lib/domain'
import type { ComplianceRequirement, ComplianceStatus } from '@/types'
import { fmtDate, daysUntil, fmtDaysUntil } from '@/lib/format'
import { userById, userName } from '@/data/users'
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
} from 'recharts'
import {
  CHART_TOOLTIP_STYLE,
  CHART_TOOLTIP_LABEL,
  CHART_AXIS_TICK,
} from '@/components/charts/chart-theme'

const CATEGORY_LABEL: Record<string, string> = {
  safety_reporting: 'Safety Reporting',
  investigation: 'Investigation Procedures',
  corrective_action: 'Corrective Actions',
  documentation: 'Documentation',
  audit: 'Audit Readiness',
}

const CATEGORY_ICON: Record<string, typeof ShieldCheck> = {
  safety_reporting: FileCheck2,
  investigation: Search,
  corrective_action: CheckCircle2,
  documentation: FileCheck2,
  audit: Award,
}

const scoreColor = (s: number) =>
  s >= 95
    ? 'var(--color-ok)'
    : s >= 90
      ? 'var(--color-ok-ink)'
      : s >= 85
        ? 'var(--color-warn)'
        : s >= 75
          ? 'var(--color-alert)'
          : 'var(--color-crit)'

export default function CompliancePage() {
  const { user } = useAuth()
  const [reqs, setReqs] = useState<ComplianceRequirement[]>([])
  const [attachTarget, setAttachTarget] = useState<ComplianceRequirement | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getComplianceSummary>> | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ComplianceStatus[]>([])
  const [category, setCategory] = useState<string[]>([])
  const [authority, setAuthority] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  useEffect(() => {
    Promise.all([getComplianceRequirements(), getComplianceSummary()])
      .then(([r, s]) => {
        setReqs(r)
        setSummary(s)
      })
      .finally(() => setLoading(false))
  }, [])

  const counts = useMemo(() => {
    const c: Record<ComplianceStatus, number> = {
      compliant: 0,
      partially_compliant: 0,
      non_compliant: 0,
      under_review: 0,
    }
    for (const r of reqs) c[r.status]++
    return c
  }, [reqs])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return reqs
      .filter((r) => (status.length ? status.includes(r.status) : true))
      .filter((r) => (category.length ? category.includes(r.category) : true))
      .filter((r) => (authority === 'all' ? true : r.authority === authority))
      .filter((r) => {
        if (!term) return true
        return [r.code, r.title, r.description, r.authority, r.evidence, userName(r.ownerId)]
          .join(' ')
          .toLowerCase()
          .includes(term)
      })
  }, [reqs, q, status, category, authority])

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length || !attachTarget) return
    const target = attachTarget
    try {
      // M4: real uploads — the server hashes and stores the bytes, then the
      // requirement comes back with the attachment descriptor appended.
      let updated = target
      for (const f of Array.from(files)) {
        updated = await uploadComplianceAttachment(target.id, f, user?.id ?? 'usr_001')
      }
      setReqs((prev) => prev.map((r) => (r.id === updated.id ? { ...updated } : r)))
    } finally {
      setAttachTarget(null)
    }
  }

  const exportCsv = () => {
    const csv = [
      [
        'Code',
        'Requirement',
        'Authority',
        'Category',
        'Status',
        'Score',
        'Evidence',
        'Owner',
        'Last Review',
        'Next Review',
      ].join(','),
      ...filtered.map((r) =>
        [
          r.code,
          `"${r.title.replace(/"/g, '""')}"`,
          r.authority,
          CATEGORY_LABEL[r.category],
          COMPLIANCE_STATUS[r.status].label,
          r.score,
          `"${r.evidence.replace(/"/g, '""')}"`,
          userName(r.ownerId),
          r.lastReviewAt.slice(0, 10),
          r.nextReviewAt.slice(0, 10),
        ].join(','),
      ),
    ].join('\n')
    downloadCsv('skyshield-compliance-register.csv', csv)
  }

  const overall = summary?.overall ?? 92
  const radar =
    summary?.breakdown.map((b) => ({ subject: b.label, value: b.score, fullMark: 100 })) ?? []
  const nextAudit = summary?.nextAuditDate
  const daysToAudit = daysUntil(nextAudit)

  const activeCount =
    (q ? 1 : 0) +
    (status.length ? 1 : 0) +
    (category.length ? 1 : 0) +
    (authority !== 'all' ? 1 : 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Compliance Dashboard"
        subtitle="Regulatory and internal standard conformance across the Safety Management System, with the audit evidence register."
        meta={
          <>
            <Badge size="md" tone="green">
              <Dot className="bg-ok" /> {fmtDate(new Date().toISOString())} review cycle
            </Badge>
            {counts.non_compliant > 0 && (
              <Badge size="md" tone="red">
                <ShieldX className="size-3" /> {counts.non_compliant} non-compliant
              </Badge>
            )}
            {counts.partially_compliant > 0 && (
              <Badge size="md" tone="amber">
                {counts.partially_compliant} partial
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Printer className="size-3.5" /> Print
            </Button>
            <Button variant="outline" onClick={exportCsv} className="gap-1.5">
              <Download className="size-3.5" /> Export register
            </Button>
          </>
        }
      />

      {/* overall */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <Card className="relative overflow-hidden p-4 xl:col-span-1">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background: `radial-gradient(360px 140px at 20% -20%, ${alpha(scoreColor(overall), 13)}, transparent 70%)`,
            }}
            aria-hidden="true"
          />
          <p className="text-xs font-semibold text-ink-muted">Overall Compliance</p>
          <div className="mt-2 flex items-end gap-2">
            <p
              className="text-xl font-semibold leading-none tnum"
              style={{ color: scoreColor(overall) }}
            >
              {overall}
            </p>
            <span className="mb-1 text-lg font-medium text-ink-muted">%</span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas-deep"
            role="progressbar"
            aria-valuenow={overall}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Overall compliance ${overall}%`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-1000"
              style={{
                width: `${overall}%`,
                background: `linear-gradient(90deg, ${alpha(scoreColor(overall), 60)}, ${scoreColor(overall)})`,
              }}
            />
          </div>
          <Separator className="my-3" />
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Requirements</dt>
              <dd className="font-medium text-ink-soft tnum">{reqs.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Fully compliant</dt>
              <dd className="font-medium text-ok-ink tnum">{counts.compliant}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Open findings</dt>
              <dd className="font-medium text-warn-ink tnum">{summary?.openFindings ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Closed findings</dt>
              <dd className="font-medium text-ink-soft tnum">{summary?.closedFindings ?? 0}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-4 xl:col-span-2">
          <h3 className="text-sm font-semibold text-ink">Compliance by category</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Weighted score across {summary?.breakdown.reduce((a, b) => a + b.requirements, 0) ?? 0}{' '}
            mapped requirements.
          </p>
          <div className="mt-3 space-y-2.5">
            {(summary?.breakdown ?? []).map((b) => {
              const Icon = CATEGORY_ICON[b.key] ?? ShieldCheck
              const color = scoreColor(b.score)
              return (
                <div key={b.key}>
                  <div className="flex items-center gap-2">
                    <Icon className="size-3 shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{b.label}</span>
                    <span className="text-xs text-ink-muted tnum">{b.requirements} req</span>
                    <span className="w-9 text-right text-sm font-semibold tnum" style={{ color }}>
                      {b.score}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-canvas-deep">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{ width: `${b.score}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <div className="space-y-3">
          <ChartCard title="Next audit" subtitle={summary?.auditWindow} dense>
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border border-line bg-canvas-deep">
                <span className="text-md font-semibold leading-none text-ink tnum">
                  {daysToAudit !== null && daysToAudit <= 30 ? daysToAudit : '—'}
                </span>
                <span className="mt-0.5 text-xs text-ink-muted">days</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-soft">
                  {fmtDate(summary?.nextAuditDate)}
                </p>
                <p className="truncate text-xs text-ink-muted">Lead auditor: {summary?.auditor}</p>
              </div>
            </div>
            <Separator className="my-2.5" />
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <CalendarClock className="size-3 text-ink-muted" />
              Evidence packs due 5 working days prior
            </div>
          </ChartCard>

          <ChartCard
            title="Category profile"
            dense
            bodyClassName="p-2"
            table={{
              columns: ['Category', 'Incidents'],
              rows: radar.map((d) => [d.subject, d.value]),
            }}
          >
            <div className="h-[132px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="68%">
                  <PolarGrid stroke="var(--color-line)" />
                  <PolarAngleAxis dataKey="subject" tick={CHART_AXIS_TICK} />
                  <RTooltip contentStyle={CHART_TOOLTIP_STYLE} labelStyle={CHART_TOOLTIP_LABEL} />
                  <Radar
                    isAnimationActive={false}
                    dataKey="value"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.2}
                    strokeWidth={1.5}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>
      </div>

      {/* status distribution */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {(Object.keys(COMPLIANCE_STATUS) as ComplianceStatus[]).map((s) => {
          const t = COMPLIANCE_STATUS[s]
          const on = status.includes(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(on ? status.filter((x) => x !== s) : [...status, s])
                setPage(1)
              }}
              className={cn(
                'relative overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-150',
                on
                  ? 'border-brand/45 bg-surface-2'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
              )}
            >
              <span
                className={cn('absolute inset-y-2 left-0 w-[2px] rounded-r-full', t.dot)}
                aria-hidden="true"
              />
              <p className={cn('truncate text-xs font-semibold', t.text)}>{t.label}</p>
              <p className="mt-1 text-lg font-semibold leading-none text-ink tnum">{counts[s]}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {reqs.length ? Math.round((counts[s] / reqs.length) * 100) : 0}% of register
              </p>
            </button>
          )
        })}
      </div>

      {/* ranked gap list — lowest scoring requirements first (master 4.7) */}
      {reqs.length > 0 && (
        <Card className="overflow-hidden" data-gap-list>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">Largest gaps</h3>
              <p className="mt-0.5 text-xs text-ink-muted">
                Five lowest-scoring requirements, ranked. Closing these moves the overall score
                most.
              </p>
            </div>
            <Badge size="sm" tone="neutral" className="tnum">
              {Math.min(5, reqs.length)} of {reqs.length}
            </Badge>
          </div>
          <ol className="divide-y divide-line-soft">
            {[...reqs]
              .sort((a, b) => a.score - b.score)
              .slice(0, 5)
              .map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-4 shrink-0 text-xs font-semibold text-ink-faint tnum">
                    {i + 1}
                  </span>
                  <span className="shrink-0 rounded border border-line bg-canvas-deep px-1.5 py-px font-mono text-xs text-ink-soft">
                    {r.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink-soft" title={r.title}>
                      {r.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {userName(r.ownerId)} · next review {fmtDate(r.nextReviewAt)}
                    </span>
                  </span>
                  <span className="hidden w-32 shrink-0 sm:block">
                    <span className="h-1.5 overflow-hidden rounded-full bg-canvas-deep block">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${r.score}%`, background: scoreColor(r.score) }}
                      />
                    </span>
                  </span>
                  <span
                    className="w-10 shrink-0 text-right text-sm font-semibold tnum"
                    style={{ color: scoreColor(r.score) }}
                  >
                    {r.score}%
                  </span>
                </li>
              ))}
          </ol>
        </Card>
      )}

      {/* register */}
      <div className="overflow-hidden rounded-card border border-line bg-surface ">
        <FilterBar
          activeCount={activeCount}
          onClear={() => {
            setQ('')
            setStatus([])
            setCategory([])
            setAuthority('all')
            setPage(1)
          }}
          right={
            <span className="text-xs text-ink-muted">
              {loading ? 'Loading…' : `${filtered.length} requirements`}
            </span>
          }
        >
          <SearchBar
            value={q}
            onChange={(v) => {
              setQ(v)
              setPage(1)
            }}
            placeholder="Search code, requirement, evidence or owner…"
            className="w-full min-w-[220px] sm:w-[300px]"
          />
          <MultiSelectFilter
            label="Status"
            options={(Object.keys(COMPLIANCE_STATUS) as ComplianceStatus[]).map((s) => ({
              value: s,
              label: COMPLIANCE_STATUS[s].label,
              hint: String(counts[s]),
            }))}
            selected={status}
            onChange={(v) => {
              setStatus(v as ComplianceStatus[])
              setPage(1)
            }}
          />
          <MultiSelectFilter
            label="Category"
            options={Object.keys(CATEGORY_LABEL).map((k) => ({
              value: k,
              label: CATEGORY_LABEL[k],
            }))}
            selected={category}
            onChange={(v) => {
              setCategory(v)
              setPage(1)
            }}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-ink-muted">Authority</span>
            <Select
              value={authority}
              onValueChange={(v) => {
                setAuthority(v)
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-[116px]" aria-label="Authority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {['DGCA', 'FAA', 'EASA', 'ICAO', 'ISO 45001', 'Internal SMS'].map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FilterBar>

        {loading ? (
          <div className="space-y-2 p-3.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <ShieldQuestion className="size-4 text-ink-muted" />
            <p className="text-base font-medium text-ink-soft">No requirements match</p>
          </div>
        ) : (
          <>
            {/* desktop */}
            <div
              data-table-scroll
              className="hidden max-h-[70vh] overflow-auto lg:block"
              tabIndex={0}
              role="region"
              aria-label="Regulatory compliance table"
            >
              <table className="w-full min-w-[1020px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {[
                      'Requirement',
                      'Category',
                      'Authority',
                      'Status',
                      'Evidence',
                      'Owner',
                      'Last Review',
                      'Next Review',
                    ].map((h) => (
                      <th
                        key={h}
                        className="sticky top-0 z-20 border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paged.map((r) => {
                    const dd = daysUntil(r.nextReviewAt)
                    const dueSoon = dd !== null && dd >= 0 && dd <= 30
                    const past = dd !== null && dd < 0
                    return (
                      <tr
                        key={r.id}
                        className="border-b border-line-soft transition-colors last:border-0 hover:bg-surface-2/70"
                      >
                        <td className="max-w-[300px] px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="shrink-0 rounded border border-line bg-canvas-deep px-1.5 py-px font-mono text-xs text-ink-soft">
                              {r.code}
                            </span>
                            <span
                              className="text-xs font-semibold tnum"
                              style={{ color: scoreColor(r.score) }}
                            >
                              {r.score}%
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-ink-soft" title={r.title}>
                            {r.title}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-ink-muted">
                          {CATEGORY_LABEL[r.category]}
                        </td>
                        <td className="px-4 py-3">
                          <Badge size="sm" tone="outline">
                            {r.authority}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ComplianceStatusBadge status={r.status} size="sm" />
                        </td>
                        <td className="max-w-[210px] px-3 py-2.5">
                          <Tip label={r.evidence}>
                            <span className="block cursor-help truncate text-xs text-ink-muted">
                              {r.evidence}
                            </span>
                          </Tip>
                          {(r.attachments?.length ?? 0) > 0 && (
                            <span
                              className="mt-1 flex items-center gap-1 truncate text-xs text-ok-ink"
                              title={(r.attachments ?? []).map((a) => a.name).join(', ')}
                            >
                              <Paperclip className="size-3 shrink-0" />
                              <span className="truncate">{r.attachments!.length} attached</span>
                            </span>
                          )}
                          <button
                            type="button"
                            data-attach={r.id}
                            onClick={() => {
                              setAttachTarget(r)
                              fileRef.current?.click()
                            }}
                            className="mt-1 flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-brand-hover"
                          >
                            <Paperclip className="size-3" /> Attach evidence
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5">
                            <Avatar user={userById(r.ownerId)} size="xs" />
                            <span className="truncate text-sm text-ink-soft">
                              {userName(r.ownerId)}
                            </span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-ink-muted tnum">
                          {fmtDate(r.lastReviewAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'text-xs tnum',
                              past ? 'text-crit-ink' : dueSoon ? 'text-warn-ink' : 'text-ink-muted',
                            )}
                          >
                            {fmtDate(r.nextReviewAt)}
                          </span>
                          {dueSoon && (
                            <span className="mt-0.5 block text-xs text-ink-muted tnum">
                              {fmtDaysUntil(r.nextReviewAt)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile */}
            <div className="divide-y divide-line-soft lg:hidden">
              {paged.map((r) => {
                const dd = daysUntil(r.nextReviewAt)
                return (
                  <div key={r.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-line bg-canvas-deep px-1.5 py-px font-mono text-xs text-ink-soft">
                            {r.code}
                          </span>
                          <ComplianceStatusBadge status={r.status} size="sm" />
                        </div>
                        <p className="mt-1.5 text-sm text-ink-soft">{r.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {CATEGORY_LABEL[r.category]} · {r.authority}
                        </p>
                      </div>
                      <span
                        className="shrink-0 text-base font-semibold tnum"
                        style={{ color: scoreColor(r.score) }}
                      >
                        {r.score}%
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                      <span>{userName(r.ownerId)}</span>
                      <span
                        className={cn(
                          dd !== null && dd <= 30 && 'text-warn-ink',
                          dd !== null && dd < 0 && 'text-crit-ink',
                        )}
                      >
                        Next review {fmtDate(r.nextReviewAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPage={setPage}
          onPageSize={(s) => {
            setPageSize(s)
            setPage(1)
          }}
        />
      </div>

      {/* non-compliance callout */}
      {counts.non_compliant > 0 && (
        <Card className="border-crit/32 bg-crit/[0.05] p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldX className="mt-px size-4 shrink-0 text-crit-ink" />
              <div>
                <p className="text-sm font-medium text-ink">
                  Action required on non-compliant items
                </p>
                <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-ink-muted">
                  {filtered
                    .filter((r) => r.status === 'non_compliant')
                    .map((r) => `${r.code} — ${r.title}`)
                    .join('; ')}
                  . Corrective actions must be closed before the next regulatory review.
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0">
              Raise corrective plan
            </Button>
          </div>
        </Card>
      )}
      {/* evidence attach input (single, retargeted per row) */}
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        aria-label="Evidence files"
        onChange={(e) => {
          void attachFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
