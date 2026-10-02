import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox, Skeleton } from '@/components/ui/primitives'
import { Tip } from '@/components/ui/primitives'
import { Inbox, TriangleAlert } from 'lucide-react'

export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Cell renderer. Receives the row. */
  cell: (row: T) => React.ReactNode
  sortKey?: string
  align?: 'left' | 'right' | 'center'
  width?: string
  className?: string
  headerClassName?: string
  /** Hide on small screens. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  loading?: boolean
  /** Fetch failure message — renders the table's error state. */
  error?: string | null
  /** Retry affordance shown with the error state. */
  onRetry?: () => void
  emptyTitle?: string
  emptyBody?: string
  emptyAction?: React.ReactNode
  sort?: { key: string; direction: 'asc' | 'desc' }
  onSort?: (key: string) => void
  selectable?: boolean
  selected?: string[]
  onSelectedChange?: (ids: string[]) => void
  onRowClick?: (row: T) => void
  rowHref?: (row: T) => string
  onNavigate?: (row: T) => void
  /** Rendered instead of the table body on narrow viewports. */
  mobileCard?: (row: T) => React.ReactNode
  className?: string
  rowClassName?: (row: T) => string
  /** Sticky first column, useful for the incident ref. */
  stickyFirst?: boolean
}

const HIDE: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

/* Windowing kicks in above this many rows (master 4.4). Row height is the
   designed 40px + 1px divider; the maths is deliberately trivial so the
   dormant path stays auditable. Page size currently caps at 100, so this
   only activates for callers that raise the cap or drop pagination. */
const VIRTUAL_THRESHOLD = 200
const ROW_H = 41
const VIEWPORT_H = 640
const OVERSCAN = 8

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle = 'No records match the current filters',
  emptyBody = 'Adjust the search term or clear a filter to widen the result set.',
  emptyAction,
  sort,
  onSort,
  selectable,
  selected = [],
  onSelectedChange,
  onRowClick,
  onNavigate,
  mobileCard,
  className,
  rowClassName,
  stickyFirst,
}: DataTableProps<T>) {
  const virtual = data.length > VIRTUAL_THRESHOLD
  const [scrollTop, setScrollTop] = React.useState(0)
  const winStart = virtual ? Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN) : 0
  const winEnd = virtual
    ? Math.min(data.length, winStart + Math.ceil(VIEWPORT_H / ROW_H) + OVERSCAN * 2)
    : data.length
  const rows = virtual ? data.slice(winStart, winEnd) : data

  const allSelected = data.length > 0 && data.every((r) => selected.includes(rowKey(r)))
  const someSelected = !allSelected && data.some((r) => selected.includes(rowKey(r)))

  const toggleAll = () => {
    if (!onSelectedChange) return
    onSelectedChange(allSelected ? [] : data.map(rowKey))
  }

  const toggleOne = (id: string) => {
    if (!onSelectedChange) return
    onSelectedChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
  }

  const colCount = columns.length + (selectable ? 1 : 0)

  return (
    <div className={cn('min-w-0', className)}>
      {/* ---------- desktop table ---------- */}
      <div
        data-table-scroll
        className="hidden max-h-[70vh] overflow-auto md:block"
        style={virtual ? { maxHeight: VIEWPORT_H } : undefined}
        onScroll={virtual ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}
      >
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {selectable && (
                <th scope="col" className="sticky top-0 z-20 w-9 border-b border-line bg-surface py-2.5 pl-4 pr-1">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((col, ci) => {
                const sortable = Boolean(col.sortKey && onSort)
                const isSorted = sort?.key === (col.sortKey ?? col.key)
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={col.width ? { width: col.width } : undefined}
                    aria-sort={
                      isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                    className={cn(
                      'sticky top-0 z-20 border-b border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink-muted',
                      col.align === 'right' && 'text-right',
                      col.align === 'center' && 'text-center',
                      col.hideBelow && HIDE[col.hideBelow],
                      stickyFirst && ci === 0 && 'sticky left-0 top-0 z-30',
                      col.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort!(col.sortKey ?? col.key)}
                        className={cn(
                          'group inline-flex items-center gap-1 rounded transition-colors hover:text-ink-soft focus-visible:outline-none',
                          isSorted && 'text-brand',
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sort!.direction === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : (
                            <ArrowDown className="size-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, r) => (
                <tr key={`sk-${r}`} className="border-b border-line-soft last:border-0">
                  {selectable && (
                    <td className="py-3 pl-4 pr-1">
                      <Skeleton className="size-4" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn('px-3 py-2.5', c.hideBelow && HIDE[c.hideBelow])}>
                      <Skeleton className="h-3.5" style={{ width: `${45 + ((r * 13) % 45)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}

            {virtual && !loading && winStart > 0 && (
              <tr aria-hidden="true" style={{ height: winStart * ROW_H }}>
                <td colSpan={colCount} className="p-0 border-0" />
              </tr>
            )}

            {!loading &&
              rows.map((row) => {
                const id = rowKey(row)
                const isSelected = selected.includes(id)
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onDoubleClick={onNavigate ? () => onNavigate(row) : undefined}
                    tabIndex={onRowClick || onNavigate ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        onRowClick(row)
                      }
                    }}
                    className={cn(
                      'group border-b border-line-soft transition-colors duration-120 last:border-0',
                      (onRowClick || onNavigate) && 'cursor-pointer',
                      isSelected ? 'bg-brand-wash' : 'hover:bg-surface-3',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable && (
                      <td className="py-3 pl-4 pr-1 align-middle" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label={`Select row ${id}`}
                        />
                      </td>
                    )}
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 align-middle text-sm text-ink-soft',
                          col.align === 'right' && 'text-right',
                          col.align === 'center' && 'text-center',
                          col.hideBelow && HIDE[col.hideBelow],
                          stickyFirst && ci === 0 && 'sticky left-0 z-[1] bg-surface transition-colors',
                          stickyFirst && ci === 0 && isSelected && 'bg-surface-3',
                          col.className,
                        )}
                      >
                        {col.cell(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}

            {virtual && !loading && winEnd < data.length && (
              <tr aria-hidden="true" style={{ height: (data.length - winEnd) * ROW_H }}>
                <td colSpan={colCount} className="p-0 border-0" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---------- mobile cards ---------- */}
      {mobileCard && (
        <div className="divide-y divide-line-soft md:hidden">
          {loading
            ? Array.from({ length: 4 }).map((_, r) => (
                <div key={`msk-${r}`} className="space-y-2 p-3.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            : data.map((row) => (
                <div
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className="transition-colors active:bg-surface-2"
                >
                  {mobileCard(row)}
                </div>
              ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center" role="alert">
          <div className="flex size-9 items-center justify-center rounded-full border border-crit/30 bg-crit-wash">
            <TriangleAlert className="size-4 text-crit-ink" />
          </div>
          <p className="text-base font-medium text-ink-soft">The register could not be loaded</p>
          <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 inline-flex h-7 items-center rounded-md border border-line-strong bg-surface px-2.5 text-sm font-medium text-ink-soft transition-colors duration-120 hover:bg-surface-3 hover:text-ink"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
          <div className="flex size-9 items-center justify-center rounded-full border border-line bg-surface-2">
            <Inbox className="size-4 text-ink-muted" />
          </div>
          <p className="text-base font-medium text-ink-soft">{emptyTitle}</p>
          <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{emptyBody}</p>
          {emptyAction && <div className="mt-1.5">{emptyAction}</div>}
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {loading ? 'Loading records' : `${data.length} of ${colCount} columns, ${data.length} rows`}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------ pagination */

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [10, 25, 50, 100],
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  onPageSize?: (s: number) => void
  pageSizes?: number[]
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const nums = pageWindow(page, pages)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-t border-line px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span className="tnum">
          <span className="font-medium text-ink-soft">{from}</span>–<span className="font-medium text-ink-soft">{to}</span>{' '}
          of <span className="font-medium text-ink-soft tnum">{total}</span>
        </span>
        {onPageSize && (
          <label className="flex items-center gap-1.5">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSize(Number(e.target.value))
                onPage(1)
              }}
              className="h-6 rounded border border-line bg-canvas-deep px-1 text-xs text-ink-soft focus:border-brand/60 focus:outline-none"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Tip label="First page">
            <button
              type="button"
              onClick={() => onPage(1)}
              disabled={page === 1}
              className="h-6 rounded border border-line px-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
            >
              «
            </button>
          </Tip>
          <Tip label="Previous page">
            <button
              type="button"
              onClick={() => onPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="h-6 rounded border border-line px-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
            >
              ‹
            </button>
          </Tip>

          {nums.map((n, i) =>
            n === '…' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-ink-muted">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPage(n)}
                aria-current={n === page ? 'page' : undefined}
                className={cn(
                  'h-6 min-w-6 rounded border px-1.5 text-xs font-medium tnum transition-colors',
                  n === page
                    ? 'border-brand/45 bg-brand/15 text-brand'
                    : 'border-line text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                {n}
              </button>
            ),
          )}

          <Tip label="Next page">
            <button
              type="button"
              onClick={() => onPage(Math.min(pages, page + 1))}
              disabled={page === pages}
              className="h-6 rounded border border-line px-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
            >
              ›
            </button>
          </Tip>
          <Tip label="Last page">
            <button
              type="button"
              onClick={() => onPage(pages)}
              disabled={page === pages}
              className="h-6 rounded border border-line px-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-35"
            >
              »
            </button>
          </Tip>
        </div>
      )}
    </div>
  )
}

function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const lo = Math.max(2, page - 1)
  const hi = Math.min(pages - 1, page + 1)
  if (lo > 2) out.push('…')
  for (let i = lo; i <= hi; i++) out.push(i)
  if (hi < pages - 1) out.push('…')
  out.push(pages)
  return out
}
