import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Columns3,
  Download,
  FileSpreadsheet,
  Plus,
  ShieldAlert,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { IncidentTable, INCIDENT_COLUMNS } from '@/components/incidents/incident-table'
import { Pagination } from '@/components/data/data-table'
import {
  BulkActionBar,
  DateRangeFilterSection,
  FilterChips,
  FiltersPopover,
  NumberRangeFilterSection,
  SearchBar,
  type FilterChipSpec,
  type FilterGroupSpec,
} from '@/components/data/filters'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/primitives'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AssignInvestigatorDialog } from '@/pages/incidents/assign-dialog'
import { useIncidentTable, EMPTY_FILTERS } from '@/hooks/use-incident-table'
import {
  bulkAssign,
  bulkUpdateStatus,
  downloadCsv,
  getAllIncidents,
  getIncidents,
  toCsv,
} from '@/services/incidents'
import { readPref, writePref, PREF_KEYS } from '@/lib/prefs'
import { AIRCRAFT } from '@/data/aircraft'
import { USERS, userById } from '@/data/users'
import { AIRPORTS } from '@/data/incidents'
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  INCIDENT_STATUS,
  INCIDENT_STATUS_ORDER,
  SEVERITY_TONE,
  SEVERITY_ORDER,
} from '@/lib/domain'
import type { Incident, IncidentCategory, IncidentStatus, Severity } from '@/types'

/* ------------------------------------------------------------ saved views */

const OPEN_STATUSES: IncidentStatus[] = ['reported', 'investigation', 'rca_pending', 'capa']

const VIEWS: {
  id: string
  label: string
  base: Partial<typeof EMPTY_FILTERS>
}[] = [
  { id: 'all', label: 'All', base: {} },
  { id: 'open', label: 'Open', base: { status: OPEN_STATUSES } },
  { id: 'critical', label: 'Critical', base: { severity: ['critical'] as Severity[] } },
  { id: 'investigation', label: 'In investigation', base: { status: ['investigation'] as IncidentStatus[] } },
  { id: 'closed', label: 'Closed', base: { status: ['closed'] as IncidentStatus[] } },
]

const RANGE_PRESET_DAYS = [7, 30, 90]

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')

const isPageSize = (v: unknown): v is number =>
  typeof v === 'number' && [10, 25, 50, 100].includes(v)

/* ------------------------------------------------------------------- page */

export default function AllIncidentsPage() {
  const navigate = useNavigate()
  const initialPageSize = readPref(PREF_KEYS.incidentsPageSize, 10, isPageSize)
  const table = useIncidentTable({ pageSize: initialPageSize })

  const [activeView, setActiveView] = useState('all')
  const [toast, setToast] = useState<string | null>(null)
  const [allIncidents, setAllIncidents] = useState<Incident[]>([])
  const [assignTargets, setAssignTargets] = useState<Incident[] | null>(null)

  // Persisted view preferences (column visibility, page size).
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() =>
    readPref(PREF_KEYS.incidentsHiddenColumns, [], isStringArray),
  )

  const investigators = useMemo(
    () => USERS.filter((u) => u.active && ['investigator', 'safety_manager'].includes(u.role)),
    [],
  )

  const refreshAll = useCallback(async () => {
    setAllIncidents(await getAllIncidents())
  }, [])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  /** Real per-view counts, computed from the same store the table reads. */
  const counts = useMemo(
    () => ({
      all: allIncidents.length,
      open: allIncidents.filter((i) => OPEN_STATUSES.includes(i.status)).length,
      critical: allIncidents.filter((i) => i.risk.severity === 'critical').length,
      investigation: allIncidents.filter((i) => i.status === 'investigation').length,
      closed: allIncidents.filter((i) => i.status === 'closed').length,
    }),
    [allIncidents],
  )

  const flash = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 3200)
  }

  /* ------------------------------------------------------------ views */

  const applyView = (id: string) => {
    const view = VIEWS.find((v) => v.id === id)
    if (!view) return
    setActiveView(id)
    table.setFilters({ ...EMPTY_FILTERS, ...view.base })
    table.setSelected([])
    table.setPage(1)
  }

  const clearEverything = () => {
    setActiveView('all')
    table.reset()
  }

  /* ------------------------------------------------------- filter groups */

  const groups: FilterGroupSpec[] = [
    {
      key: 'severity',
      label: 'Severity',
      options: SEVERITY_ORDER.map((s) => ({ value: s, label: SEVERITY_TONE[s].label })),
      selected: table.filters.severity,
      onChange: (v) => table.patch({ severity: v as Severity[] }),
    },
    {
      key: 'status',
      label: 'Status',
      options: INCIDENT_STATUS_ORDER.map((s) => ({ value: s, label: INCIDENT_STATUS[s].label })),
      selected: table.filters.status,
      onChange: (v) => table.patch({ status: v as IncidentStatus[] }),
    },
    {
      key: 'category',
      label: 'Type',
      options: CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
      selected: table.filters.category,
      onChange: (v) => table.patch({ category: v as IncidentCategory[] }),
    },
    {
      key: 'investigator',
      label: 'Investigator',
      options: investigators.map((u) => ({ value: u.id, label: u.name, hint: u.title.slice(0, 12) })),
      selected: table.filters.investigator,
      onChange: (v) => table.patch({ investigator: v }),
    },
    {
      key: 'airport',
      label: 'Airport',
      options: AIRPORTS.map((a) => ({ value: a.iata, label: a.label })),
      selected: table.filters.airport,
      onChange: (v) => table.patch({ airport: v }),
    },
    {
      key: 'aircraft',
      label: 'Aircraft',
      options: AIRCRAFT.map((a) => ({ value: a.registration, label: `${a.registration} — ${a.type}` })),
      selected: table.filters.aircraft,
      onChange: (v) => table.patch({ aircraft: v }),
    },
  ]

  const filtersExtra = (
    <>
      <DateRangeFilterSection
        label="Date occurred"
        from={table.filters.dateFrom}
        to={table.filters.dateTo}
        onFrom={(v) => table.patch({ dateFrom: v })}
        onTo={(v) => table.patch({ dateTo: v })}
        presets={RANGE_PRESET_DAYS}
      />
      <NumberRangeFilterSection
        label="Risk score (1–25)"
        min={table.filters.riskMin}
        max={table.filters.riskMax}
        onMin={(v) => table.patch({ riskMin: v })}
        onMax={(v) => table.patch({ riskMax: v })}
      />
    </>
  )

  /* -------------------------------------------------------------- chips */

  const chips = useMemo<FilterChipSpec[]>(() => {
    const f = table.filters
    const out: FilterChipSpec[] = []
    const remove = (key: keyof typeof f, value: string) => {
      const arr = (f[key] as string[]).filter((x) => x !== value)
      table.patch({ [key]: arr } as never)
    }
    if (f.search)
      out.push({ id: 'search', label: 'Search', value: f.search, onRemove: () => table.patch({ search: '' }) })
    for (const s of f.severity)
      out.push({ id: `sev-${s}`, label: 'Severity', value: SEVERITY_TONE[s].label, onRemove: () => remove('severity', s) })
    for (const s of f.status)
      out.push({ id: `st-${s}`, label: 'Status', value: INCIDENT_STATUS[s].label, onRemove: () => remove('status', s) })
    for (const c of f.category)
      out.push({ id: `cat-${c}`, label: 'Type', value: CATEGORY_LABEL[c], onRemove: () => remove('category', c) })
    for (const id of f.investigator)
      out.push({ id: `inv-${id}`, label: 'Investigator', value: userById(id)?.name ?? id, onRemove: () => remove('investigator', id) })
    for (const a of f.airport)
      out.push({ id: `apt-${a}`, label: 'Airport', value: a, onRemove: () => remove('airport', a) })
    for (const r of f.aircraft)
      out.push({ id: `ac-${r}`, label: 'Aircraft', value: r, onRemove: () => remove('aircraft', r) })
    if (f.dateFrom)
      out.push({ id: 'from', label: 'From', value: f.dateFrom, onRemove: () => table.patch({ dateFrom: undefined }) })
    if (f.dateTo)
      out.push({ id: 'to', label: 'To', value: f.dateTo, onRemove: () => table.patch({ dateTo: undefined }) })
    if (f.riskMin !== undefined)
      out.push({ id: 'rmin', label: 'Risk', value: `≥ ${f.riskMin}`, onRemove: () => table.patch({ riskMin: undefined }) })
    if (f.riskMax !== undefined)
      out.push({ id: 'rmax', label: 'Risk', value: `≤ ${f.riskMax}`, onRemove: () => table.patch({ riskMax: undefined }) })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table.filters])

  /* ------------------------------------------------------------ actions */

  const exportFiltered = async () => {
    const res = await getIncidents({ filters: table.filters, page: 1, pageSize: 10_000 })
    downloadCsv('skyshield-incident-register.csv', toCsv(res.items))
    flash(`Exported ${res.items.length} incident records.`)
  }

  const exportSelection = async () => {
    const all = allIncidents.length ? allIncidents : await getAllIncidents()
    const rows = all.filter((i) => table.selected.includes(i.id))
    downloadCsv('skyshield-incident-selection.csv', toCsv(rows))
    flash(`Exported ${rows.length} selected records.`)
  }

  const exportOne = (row: Incident) => {
    downloadCsv(`skyshield-${row.ref}.csv`, toCsv([row]))
    flash(`Exported ${row.ref}.`)
  }

  const applyBulkStatus = async (status: IncidentStatus) => {
    const n = await bulkUpdateStatus(table.selected, status)
    flash(`${n} incidents moved to ${INCIDENT_STATUS[status].label}.`)
    table.setSelected([])
    void refreshAll()
  }

  const applyAssign = async (investigatorId: string) => {
    if (!assignTargets) return
    const n = await bulkAssign(assignTargets.map((i) => i.id), investigatorId)
    const u = userById(investigatorId)
    flash(n === 1 ? `${assignTargets[0].ref} assigned to ${u?.name}.` : `${n} incidents assigned to ${u?.name}.`)
    setAssignTargets(null)
    table.setSelected([])
    void refreshAll()
  }

  /* ------------------------------------------------------------ columns */

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      writePref(PREF_KEYS.incidentsHiddenColumns, next)
      return next
    })
  }

  const setPageSize = (n: number) => {
    table.setPageSize(n)
    writePref(PREF_KEYS.incidentsPageSize, n)
  }

  /* ------------------------------------------------------------- render */

  return (
    <div className="space-y-4">
      <PageHeader
        title="Incident Management"
        actions={
          <>
            <Button variant="outline" onClick={exportFiltered} className="gap-1.5">
              <Download className="size-3.5" /> Export
            </Button>
            <Button onClick={() => navigate('/incidents/report')} className="gap-1.5">
              <Plus className="size-3.5" /> Report Incident
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {/* Saved views */}
        <div
          role="tablist"
          aria-label="Saved views"
          className="no-scrollbar flex items-center gap-0.5 overflow-x-auto border-b border-line bg-surface px-2"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              id={`view-tab-${v.id}`}
              aria-selected={activeView === v.id}
              aria-controls="register-panel"
              onClick={() => applyView(v.id)}
              className={cn(
                'group relative -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-120 focus-visible:outline-none',
                activeView === v.id
                  ? 'border-brand text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink-soft',
              )}
            >
              {v.label}
              <span
                className={cn(
                  'rounded px-1 py-px text-xs font-semibold tnum',
                  activeView === v.id ? 'bg-brand-wash text-brand' : 'bg-surface-3 text-ink-muted',
                )}
              >
                {counts[v.id as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>

        <div id="register-panel" role="tabpanel" aria-labelledby={`view-tab-${activeView}`}>
          <BulkActionBar count={table.selected.length} onClear={() => table.setSelected([])}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <ShieldAlert className="size-3.5" /> Change status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[196px]">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {INCIDENT_STATUS_ORDER.filter((s) => s !== 'draft').map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => applyBulkStatus(s)}>
                    <span className={cn('size-1.5 rounded-full', INCIDENT_STATUS[s].dot)} />
                    {INCIDENT_STATUS[s].label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const all = allIncidents.length ? allIncidents : []
                const rows = all.filter((i) => table.selected.includes(i.id))
                setAssignTargets(rows.length ? rows : null)
              }}
            >
              <UserPlus className="size-3.5" /> Assign investigator
            </Button>

            <Button variant="secondary" size="sm" onClick={exportSelection} className="gap-1.5">
              <FileSpreadsheet className="size-3.5" /> Export selected
            </Button>
          </BulkActionBar>

          {/* Toolbar: search + one Filters popover + Columns */}
          <div className="flex flex-col gap-2 border-b border-line bg-surface/40 px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <SearchBar
                value={table.filters.search}
                onChange={(v) => table.patch({ search: v })}
                placeholder="Search ID, title, flight, airport, investigator…"
                className="w-full min-w-[220px] sm:w-[280px]"
              />
              <FiltersPopover
                groups={groups}
                activeCount={table.activeCount}
                onClearAll={clearEverything}
                extra={filtersExtra}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted tnum" aria-live="polite">
                {table.loading ? 'Loading…' : `${table.total} matching`}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" data-columns-trigger>
                    <Columns3 className="size-3.5" />
                    Columns
                    {hiddenColumns.length > 0 && (
                      <span className="ml-0.5 rounded bg-brand-wash px-1 text-xs font-semibold text-brand tnum">
                        {INCIDENT_COLUMNS.length - hiddenColumns.length - 1}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[224px] p-1.5">
                  <div className="flex items-center justify-between px-1.5 pb-1.5">
                    <span className="text-xs font-semibold text-ink-muted">Columns</span>
                    {hiddenColumns.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setHiddenColumns([])
                          writePref(PREF_KEYS.incidentsHiddenColumns, [])
                        }}
                        className="text-xs font-medium text-brand transition-colors hover:text-brand-hover"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {INCIDENT_COLUMNS.map((c) => {
                      const visible = !hiddenColumns.includes(c.key)
                      return (
                        <label
                          key={c.key}
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-3',
                            c.locked && 'cursor-default opacity-55 hover:bg-transparent',
                          )}
                        >
                          <Checkbox
                            checked={visible}
                            disabled={c.locked}
                            onCheckedChange={() => !c.locked && toggleColumn(c.key)}
                            aria-label={c.locked ? `${c.label} (always shown)` : `Show ${c.label} column`}
                          />
                          <span className="min-w-0 flex-1 truncate">{c.label}</span>
                          {c.locked && <span className="text-xs text-ink-faint">fixed</span>}
                        </label>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Removable chips for every applied filter value */}
          <FilterChips chips={chips} onClearAll={clearEverything} />

          <IncidentTable
            data={table.rows}
            loading={table.loading}
            error={table.error}
            onRetry={() => table.patch({})}
            sort={table.sort}
            onSort={table.toggleSort}
            selectable
            selected={table.selected}
            onSelectedChange={table.setSelected}
            onRowClick={(r) => navigate(`/incidents/${r.id}`)}
            hiddenColumns={hiddenColumns}
            onAssign={(rows) => setAssignTargets(rows)}
            onExportOne={exportOne}
            emptyAction={
              chips.length > 0 ? (
                <Button variant="outline" size="sm" onClick={clearEverything}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />

          <Pagination
            page={table.page}
            pageSize={table.pageSize}
            total={table.total}
            onPage={table.setPage}
            onPageSize={setPageSize}
          />
        </div>
      </div>

      <AssignInvestigatorDialog
        targets={assignTargets}
        investigators={investigators}
        onAssign={applyAssign}
        onClose={() => setAssignTargets(null)}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2.5 text-sm text-ink-soft pop-shadow"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
