import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Incident, IncidentFilters, SortState } from '@/types'
import { getIncidents } from '@/services/incidents'

export const EMPTY_FILTERS: IncidentFilters = {
  search: '',
  severity: [],
  status: [],
  category: [],
  investigator: [],
  aircraft: [],
  airport: [],
}

/**
 * Table state machine: server-shaped query + client debounce, selection,
 * pagination and sorting. Swap `getIncidents` for a REST call and nothing
 * downstream changes.
 */
export function useIncidentTable(options?: { pageSize?: number }) {
  const [filters, setFilters] = useState<IncidentFilters>(EMPTY_FILTERS)
  const [debounced, setDebounced] = useState<IncidentFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortState>({ key: 'occurredAt', direction: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(options?.pageSize ?? 8)
  const [rows, setRows] = useState<Incident[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filters)
      setPage(1)
    }, 220)
    return () => clearTimeout(t)
  }, [filters])

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    getIncidents({ filters: debounced, sort, page, pageSize })
      .then((res) => {
        if (!live) return
        setRows(res.items)
        setTotal(res.total)
      })
      .catch((e) => {
        if (live) setError(e instanceof Error ? e.message : 'The register could not be reached')
      })
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [debounced, sort, page, pageSize])

  const patch = useCallback((p: Partial<IncidentFilters>) => {
    setFilters((f) => ({ ...f, ...p }))
  }, [])

  const reset = useCallback(() => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
    setSelected([])
  }, [])

  const toggleSort = useCallback((key: string) => {
    setSort((s) =>
      s.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' },
    )
  }, [])

  const activeCount = useMemo(() => {
    let n = 0
    if (filters.search) n++
    n += filters.severity.length ? 1 : 0
    n += filters.status.length ? 1 : 0
    n += filters.category.length ? 1 : 0
    n += filters.investigator.length ? 1 : 0
    n += filters.airport.length ? 1 : 0
    n += filters.aircraft.length ? 1 : 0
    n += filters.dateFrom || filters.dateTo ? 1 : 0
    n += filters.riskMin !== undefined || filters.riskMax !== undefined ? 1 : 0
    return n
  }, [filters])

  return {
    rows,
    total,
    loading,
    error,
    page,
    pageSize,
    sort,
    filters,
    selected,
    setSelected,
    setPage,
    setPageSize,
    patch,
    reset,
    toggleSort,
    activeCount,
    setFilters,
  }
}
