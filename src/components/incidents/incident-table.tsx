import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreHorizontal, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataTable, type Column } from '@/components/data/data-table'
import { RiskBadge, SeverityBadge, StatusBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/primitives'
import { CATEGORY_LABEL, PHASE_LABEL } from '@/lib/domain'
import { fmtDate } from '@/lib/format'
import { aircraftById } from '@/data/aircraft'
import { userById } from '@/data/users'
import type { Incident, SortState } from '@/types'

/** Column metadata for the page-level Columns popover (show/hide, persisted). */
export const INCIDENT_COLUMNS: { key: string; label: string; locked?: boolean }[] = [
  { key: 'ref', label: 'Incident ID', locked: true },
  { key: 'occurredAt', label: 'Date' },
  { key: 'flight', label: 'Flight / Entity' },
  { key: 'category', label: 'Incident Type' },
  { key: 'severity', label: 'Severity' },
  { key: 'score', label: 'Risk' },
  { key: 'status', label: 'Status' },
  { key: 'investigator', label: 'Investigator' },
]

export function IncidentTable({
  data,
  loading,
  sort,
  onSort,
  onRowClick,
  selectable = false,
  selected = [],
  onSelectedChange,
  dense = false,
  error,
  onRetry,
  hiddenColumns = [],
  emptyAction,
  onAssign,
  onExportOne,
}: {
  data: Incident[]
  loading?: boolean
  sort?: SortState
  onSort?: (key: string) => void
  onRowClick?: (row: Incident) => void
  selectable?: boolean
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
  dense?: boolean
  /** Fetch failure message — renders the table's error state. */
  error?: string | null
  onRetry?: () => void
  /** Keys from INCIDENT_COLUMNS the user hid via the Columns popover. */
  hiddenColumns?: string[]
  /** Rendered inside the DataTable empty state (e.g. a "clear filters" action). */
  emptyAction?: ReactNode
  onAssign?: (rows: Incident[]) => void
  onExportOne?: (row: Incident) => void
}) {
  const navigate = useNavigate()

  const allColumns: Column<Incident>[] = [
    {
      key: 'ref',
      header: 'Incident ID',
      sortKey: 'ref',
      width: '128px',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/incidents/${r.id}`)
            }}
            className="rounded font-mono text-sm font-semibold text-brand transition-colors hover:text-brand-hover hover:underline"
          >
            {r.ref}
          </button>
          {r.regulatoryNotification && (
            <Tip label="Regulator notified">
              <span className="size-1.5 shrink-0 rounded-full bg-crit" role="img" aria-label="Regulator notified" />
            </Tip>
          )}
        </div>
      ),
    },
    {
      key: 'occurredAt',
      header: 'Date',
      sortKey: 'occurredAt',
      width: '92px',
      cell: (r) => <span className="text-sm text-ink-muted tnum">{fmtDate(r.occurredAt)}</span>,
    },
    {
      key: 'flight',
      header: 'Flight / Entity',
      sortKey: 'flight',
      width: '140px',
      hideBelow: 'md',
      cell: (r) => (
        <div className="min-w-0">
          <div
            className={cn(
              'truncate text-sm',
              r.flight?.flightNumber ? 'font-mono text-ink-soft' : 'text-ink-muted',
              r.reporterId === 'anonymous' && 'italic',
            )}
          >
            {r.flight?.flightNumber ?? (r.reporterId === 'anonymous' ? 'Anonymous intake' : '—')}
          </div>
          <div className="truncate text-xs text-ink-muted">
            {aircraftById(r.aircraftId)?.registration ?? '—'} · {r.location.iata}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Incident Type',
      sortKey: 'category',
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-sm text-ink-soft">{CATEGORY_LABEL[r.category]}</div>
          <div className="truncate text-xs text-ink-muted">{PHASE_LABEL[r.phase]}</div>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      sortKey: 'severity',
      width: '104px',
      cell: (r) => <SeverityBadge severity={r.risk.severity} size="sm" />,
    },
    {
      key: 'score',
      header: 'Risk',
      sortKey: 'score',
      width: '112px',
      cell: (r) => <RiskBadge score={r.risk.score} size="sm" showBand={false} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      width: '124px',
      cell: (r) => <StatusBadge status={r.status} size="sm" />,
    },
    {
      key: 'investigator',
      header: 'Assigned Investigator',
      sortKey: 'investigator',
      width: '150px',
      hideBelow: 'lg',
      cell: (r) => {
        const u = userById(r.investigatorId)
        if (!u)
          return (
            <span className="text-sm text-ink-muted italic">Unassigned</span>
          )
        return (
          <div className="flex items-center gap-1.5">
            <Avatar user={u} size="xs" />
            <span className="truncate text-sm text-ink-soft">{u.name}</span>
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '52px',
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.ref}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[196px]">
              <DropdownMenuLabel className="font-mono normal-case tracking-normal">
                {r.ref}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate(`/incidents/${r.id}`)}>
                <ExternalLink /> Open incident
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/incidents/${r.id}?tab=timeline`)}>
                View timeline
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/rca/${r.id}`)}>Open RCA workspace</DropdownMenuItem>
              {onAssign && (
                <DropdownMenuItem onSelect={() => onAssign([r])}>Reassign investigator</DropdownMenuItem>
              )}
              {onExportOne && (
                <DropdownMenuItem onSelect={() => onExportOne(r)}>Export record</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const columns = hiddenColumns.length
    ? allColumns.filter((c) => c.key === 'actions' || !hiddenColumns.includes(c.key))
    : allColumns

  return (
    <DataTable<Incident>
      data={data}
      columns={columns}
      rowKey={(r) => r.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      sort={sort as { key: string; direction: 'asc' | 'desc' } | undefined}
      onSort={onSort}
      selectable={selectable}
      selected={selected}
      onSelectedChange={onSelectedChange}
      onRowClick={onRowClick}
      onNavigate={(r) => navigate(`/incidents/${r.id}`)}
      emptyAction={emptyAction}
      stickyFirst
      rowClassName={(r) => (r.risk.level === 'critical' ? 'bg-crit/[0.035]' : '')}
      mobileCard={(r) => <IncidentCard incident={r} dense={dense} />}
    />
  )
}

/* --------------------------------------------------------- mobile card */

export function IncidentCard({
  incident,
  className,
  dense = false,
}: {
  incident: Incident
  className?: string
  dense?: boolean
}) {
  const navigate = useNavigate()
  const ac = aircraftById(incident.aircraftId)
  const inv = userById(incident.investigatorId)
  return (
    <button
      type="button"
      onClick={() => navigate(`/incidents/${incident.id}`)}
      className={cn(
        'w-full px-3.5 text-left transition-colors active:bg-surface-2',
        dense ? 'py-2.5' : 'py-3',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-semibold text-brand">{incident.ref}</span>
            {incident.regulatoryNotification && <span className="size-1.5 rounded-full bg-crit" />}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm leading-snug text-ink-soft">{incident.title}</p>
        </div>
        <RiskBadge score={incident.risk.score} size="sm" showBand={false} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SeverityBadge severity={incident.risk.severity} size="sm" />
        <StatusBadge status={incident.status} size="sm" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
        <span className="tnum">{fmtDate(incident.occurredAt)}</span>
        <span className="font-mono">{incident.flight?.flightNumber}</span>
        <span>{ac?.registration}</span>
        <span>{incident.location.iata}</span>
        {inv && <span className="ml-auto truncate">{inv.name}</span>}
      </div>
    </button>
  )
}
