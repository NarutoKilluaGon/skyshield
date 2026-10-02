import { lazy, Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BarChart3, CalendarDays, Gauge, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Shared reporting window for every tab in the hub (master 4.7). */
export const REPORT_PERIODS = [
  { value: '12w', label: 'Last 12 weeks' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'ytd', label: 'Year to date' },
] as const

export type ReportPeriod = (typeof REPORT_PERIODS)[number]['value']

const Analytics = lazy(() => import('@/pages/analytics'))
const Compliance = lazy(() => import('@/pages/compliance'))
const RiskMatrixPage = lazy(() => import('@/pages/rca/risk-matrix-page'))

type ReportTab = 'analytics' | 'compliance' | 'risk-matrix'

interface TabOption {
  id: ReportTab
  label: string
  icon: typeof BarChart3
}

const TABS: TabOption[] = [
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
  { id: 'risk-matrix', label: 'Risk Matrix', icon: Gauge },
]

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [period, setPeriod] = useState<ReportPeriod>('12m')
  const rawTab = searchParams.get('tab')
  const currentTab: ReportTab = useMemo(() => {
    if (rawTab === 'compliance' || rawTab === 'risk-matrix') return rawTab
    return 'analytics'
  }, [rawTab])

  const selectTab = (tab: ReportTab) => {
    setSearchParams({ tab }, { replace: true })
  }

  return (
    <div className="space-y-4">
      {/* Tab Switcher Strip */}
      <div className="border-b border-line">
        <nav
          className="-mb-px flex space-x-6"
          aria-label="Reports sections"
          role="tablist"
        >
          {TABS.map((t) => {
            const isSelected = currentTab === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => selectTab(t.id)}
                className={cn(
                  'flex items-center gap-2 border-b-2 py-2.5 text-sm font-medium transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  isSelected
                    ? 'border-brand text-ink'
                    : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink-soft',
                )}
              >
                <Icon className={cn('size-4 shrink-0', isSelected ? 'text-brand' : 'text-ink-muted')} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Shared filter bar — the reporting window applies to every tab that charts history */}
      {currentTab !== 'risk-matrix' && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3.5 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <CalendarDays className="size-3.5" /> Reporting period
          </span>
          <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
            <SelectTrigger size="sm" className="w-[160px]" aria-label="Reporting period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-ink-muted">
            Scopes the analytics register window and its exports.
          </span>
        </div>
      )}

      {/* Tab Content */}
      <div role="tabpanel" aria-label={currentTab}>
        <Suspense fallback={<ReportsLoadingFallback />}>
          {currentTab === 'analytics' && <Analytics period={period} />}
          {currentTab === 'compliance' && <Compliance />}
          {currentTab === 'risk-matrix' && <RiskMatrixPage />}
        </Suspense>
      </div>
    </div>
  )
}

function ReportsLoadingFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  )
}
