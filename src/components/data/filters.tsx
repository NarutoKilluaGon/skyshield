import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/primitives'
import { SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'

/* ------------------------------------------------------------ search bar */

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  autoFocus,
  hint,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  hint?: string
}) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        icon={<Search />}
        suffix={
          value ? (
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label="Clear search"
              className="rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          ) : hint ? (
            <kbd className="rounded border border-line bg-surface-2 px-1 font-mono text-xs text-ink-muted">
              {hint}
            </kbd>
          ) : null
        }
        className="h-8"
      />
    </div>
  )
}

/* ----------------------------------------------------------- filter bar */

export interface FilterGroupOption {
  value: string
  label: string
  hint?: string
}

/** Inline checkbox list — the shared body of MultiSelectFilter and FiltersPopover. */
export function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
  maxHeight = 'max-h-64',
}: {
  label: string
  options: FilterGroupOption[]
  selected: string[]
  onChange: (v: string[]) => void
  maxHeight?: string
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])

  return (
    <div>
      <div className="flex items-center justify-between px-1.5 pb-1.5">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs font-medium text-brand transition-colors hover:text-brand-hover"
          >
            Clear
          </button>
        )}
      </div>
      <div className={cn('space-y-0.5 overflow-y-auto', maxHeight)}>
        {options.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-3"
          >
            <Checkbox checked={selected.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.hint && <span className="shrink-0 text-xs text-ink-muted tnum">{o.hint}</span>}
          </label>
        ))}
      </div>
    </div>
  )
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  icon,
  className,
}: {
  label: string
  options: FilterGroupOption[]
  selected: string[]
  onChange: (v: string[]) => void
  icon?: ReactNode
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={selected.length ? 'secondary' : 'outline'}
          size="sm"
          className={cn('gap-1.5 whitespace-nowrap', className)}
        >
          {icon ?? <SlidersHorizontal />}
          {label}
          {selected.length > 0 && (
            <span className="ml-0.5 rounded bg-brand-wash px-1 text-xs font-semibold text-brand tnum">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[228px] p-1.5">
        <CheckboxGroup label={label} options={options} selected={selected} onChange={onChange} />
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------- single filters popover */

export interface FilterGroupSpec {
  key: string
  label: string
  options: FilterGroupOption[]
  selected: string[]
  onChange: (v: string[]) => void
}

/**
 * One "Filters" popover holding every group, replacing a rail of per-field
 * popover buttons (master 4.4). Applied values surface as removable chips
 * rendered by `FilterChips` beside the toolbar.
 */
export function FiltersPopover({
  groups,
  activeCount,
  onClearAll,
  extra,
  className,
}: {
  groups: FilterGroupSpec[]
  activeCount: number
  onClearAll: () => void
  /** Additional sections (date range, risk score…) rendered under the groups. */
  extra?: ReactNode
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={activeCount ? 'secondary' : 'outline'}
          size="sm"
          className={cn('gap-1.5 whitespace-nowrap', className)}
          data-filters-trigger
        >
          <SlidersHorizontal />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 rounded bg-brand-wash px-1 text-xs font-semibold text-brand tnum">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[292px] p-1.5">
        <div className="no-scrollbar max-h-[60vh] space-y-3 overflow-y-auto pr-0.5">
          {groups.map((g) => (
            <CheckboxGroup
              key={g.key}
              label={g.label}
              options={g.options}
              selected={g.selected}
              onChange={g.onChange}
              maxHeight="max-h-44"
            />
          ))}
          {extra}
        </div>
        {activeCount > 0 && (
          <div className="mt-2 flex items-center justify-between border-t border-line-soft px-1.5 pt-2">
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Clear all filters
            </button>
            <span className="text-xs text-ink-faint tnum">{activeCount} active</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* ---------------------------------------------------------- filter chips */

export interface FilterChipSpec {
  id: string
  label: string
  value: string
  onRemove: () => void
}

/** Removable chips for every applied filter value (master 4.4). */
export function FilterChips({
  chips,
  onClearAll,
  className,
}: {
  chips: FilterChipSpec[]
  onClearAll?: () => void
  className?: string
}) {
  if (chips.length === 0) return null
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 border-b border-line-soft bg-surface/40 px-3.5 py-2',
        className,
      )}
      aria-label="Active filters"
    >
      {chips.map((chip) => (
        <span
          key={chip.id}
          data-filter-chip
          className="flex h-6 items-center gap-1 rounded-badge border border-line-soft bg-surface-2 pl-2 text-xs text-ink-soft"
        >
          <span className="text-ink-muted">{chip.label}:</span>
          <span className="max-w-[160px] truncate font-medium text-ink">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.label}: ${chip.value}`}
            className="-mr-1 flex size-4 items-center justify-center rounded-sm text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 && onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

export function FilterBar({
  children,
  activeCount,
  onClear,
  className,
  right,
}: {
  children: ReactNode
  activeCount?: number
  onClear?: () => void
  className?: string
  right?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-line bg-surface/40 px-3.5 py-2.5 lg:flex-row lg:items-center lg:justify-between',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      <div className="flex items-center gap-2">
        {activeCount ? (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
          >
            <Badge tone="brand" size="sm">
              {activeCount} active
            </Badge>
            Clear all
          </button>
        ) : null}
        {right}
      </div>
    </div>
  )
}

/* -------------------------------------------------------- bulk actions */

export function BulkActionBar({
  count,
  onClear,
  children,
  className,
}: {
  count: number
  onClear: () => void
  children: ReactNode
  className?: string
}) {
  if (count === 0) return null
  return (
    <div
      role="status"
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-line bg-brand-wash px-3.5 py-2 animate-fade-in',
        className,
      )}
    >
      <span className="text-sm font-semibold text-brand tnum">
        {count} selected
      </span>
      <span className="h-3.5 w-px bg-line" />
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-xs text-ink-muted transition-colors hover:text-ink"
      >
        Clear selection
      </button>
    </div>
  )
}

/* --------------------------------------------- popover filter sections */

/**
 * Date-range section for FiltersPopover: quick presets plus explicit
 * from/to inputs. Generic — the incident register uses it today, other
 * registers can adopt it unchanged.
 */
export function DateRangeFilterSection({
  label = 'Date',
  from,
  to,
  onFrom,
  onTo,
  presets = [7, 30, 90],
}: {
  label?: string
  from?: string
  to?: string
  onFrom: (v: string | undefined) => void
  onTo: (v: string | undefined) => void
  presets?: number[]
}) {
  return (
    <div className="border-t border-line-soft px-1.5 pt-2.5">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <div className="mt-2 flex items-center gap-1.5">
        {presets.map((days) => (
          <Button
            key={days}
            variant="outline"
            size="xs"
            onClick={() => {
              onFrom(new Date(Date.now() - days * 86400000).toISOString().slice(0, 10))
              onTo(undefined)
            }}
          >
            Last {days}d
          </Button>
        ))}
        {from && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              onFrom(undefined)
              onTo(undefined)
            }}
          >
            All time
          </Button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">From</span>
          <input
            type="date"
            value={from ?? ''}
            onChange={(e) => onFrom(e.target.value || undefined)}
            aria-label={`${label} from`}
            className="h-7 w-full rounded-control border border-line-strong bg-surface px-2 text-xs text-ink-soft focus:border-brand/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">To</span>
          <input
            type="date"
            value={to ?? ''}
            onChange={(e) => onTo(e.target.value || undefined)}
            aria-label={`${label} to`}
            className="h-7 w-full rounded-control border border-line-strong bg-surface px-2 text-xs text-ink-soft focus:border-brand/60 focus:outline-none"
          />
        </label>
      </div>
    </div>
  )
}

/** Numeric min/max section for FiltersPopover (e.g. risk score 1–25). */
export function NumberRangeFilterSection({
  label,
  min,
  max,
  onMin,
  onMax,
  floor = 1,
  ceil = 25,
  minLabel = 'Min',
  maxLabel = 'Max',
}: {
  label: string
  min?: number
  max?: number
  onMin: (v: number | undefined) => void
  onMax: (v: number | undefined) => void
  floor?: number
  ceil?: number
  minLabel?: string
  maxLabel?: string
}) {
  return (
    <div className="border-t border-line-soft px-1.5 pt-2.5">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">{minLabel}</span>
          <input
            type="number"
            min={floor}
            max={ceil}
            value={min ?? ''}
            onChange={(e) => onMin(e.target.value === '' ? undefined : Number(e.target.value))}
            aria-label={`${label} ${minLabel.toLowerCase()}`}
            className="h-7 w-full rounded-control border border-line-strong bg-surface px-2 text-xs text-ink-soft tnum focus:border-brand/60 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-muted">{maxLabel}</span>
          <input
            type="number"
            min={floor}
            max={ceil}
            value={max ?? ''}
            onChange={(e) => onMax(e.target.value === '' ? undefined : Number(e.target.value))}
            aria-label={`${label} ${maxLabel.toLowerCase()}`}
            className="h-7 w-full rounded-control border border-line-strong bg-surface px-2 text-xs text-ink-soft tnum focus:border-brand/60 focus:outline-none"
          />
        </label>
      </div>
    </div>
  )
}
