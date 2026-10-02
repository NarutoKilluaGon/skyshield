/**
 * Animated mini-diagrams for the How-it-works guided tour.
 *
 * Every visual is decorative (aria-hidden): the chapter text carries the
 * information. Motion uses the landing motion kit in `index.css`, which is
 * fully neutralised under prefers-reduced-motion. Each visual re-mounts when
 * its chapter is entered, so the animations replay on every visit — the tour
 * is built to be presented live.
 */
import { Check, Lock } from 'lucide-react'
import { useCountUp } from '@/hooks/use-count-up'

/* ------------------------------------------------------------------ */
/* 1. The safety-management loop                                       */
/* ------------------------------------------------------------------ */

const LOOP_STAGES = ['Report', 'Assess', 'Investigate', 'Analyse', 'Act', 'Verify']

// Six nodes on a circle, clockwise from 12 o'clock.
const NODES = LOOP_STAGES.map((label, i) => {
  const angle = (-90 + i * 60) * (Math.PI / 180)
  return { label, n: i + 1, cx: 84 + 58 * Math.cos(angle), cy: 84 + 58 * Math.sin(angle) }
})

export function LoopVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
      <svg viewBox="0 0 168 168" className="size-40 shrink-0 sm:size-44">
        <circle cx="84" cy="84" r="58" className="fill-none stroke-line-soft" strokeWidth="1" />
        <circle
          cx="84"
          cy="84"
          r="58"
          className="loop-spin fill-none stroke-brand/70"
          strokeWidth="1.5"
          strokeDasharray="4 10"
          strokeLinecap="round"
        />
        {NODES.map((node, i) => (
          <g key={node.label} className="tour-item" style={{ animationDelay: `${200 + i * 110}ms` }}>
            <circle cx={node.cx} cy={node.cy} r="13" className="fill-surface-2 stroke-line-strong" strokeWidth="1" />
            <text
              x={node.cx}
              y={node.cy}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-brand font-mono"
              fontSize="10"
            >
              {node.n}
            </text>
          </g>
        ))}
        <text x="84" y="80" textAnchor="middle" className="fill-ink font-condensed" fontSize="13" fontWeight="600">
          SMS
        </text>
        <text x="84" y="95" textAnchor="middle" className="fill-ink-muted font-mono" fontSize="7.5">
          closed loop
        </text>
      </svg>

      <ol className="space-y-1.5">
        {LOOP_STAGES.map((stage, i) => (
          <li
            key={stage}
            className="tour-item flex items-center gap-2.5 text-sm text-ink-soft"
            style={{ animationDelay: `${300 + i * 90}ms` }}
          >
            <span className="flex size-5 items-center justify-center rounded font-mono text-xs text-brand">
              {i + 1}
            </span>
            {stage}
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 2. Report — the seven-step wizard                                   */
/* ------------------------------------------------------------------ */

export function ReportVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-4">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="tour-item h-1.5 flex-1 rounded-full bg-brand"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
        <span className="ml-2 font-mono text-xs text-ink-muted">step 4 / 7</span>
      </div>

      <div className="space-y-2.5 rounded-panel border border-line bg-surface-2 p-4">
        <div className="skeleton-shimmer h-7 rounded bg-surface-3" />
        <div className="grid grid-cols-2 gap-2.5">
          <div className="skeleton-shimmer h-7 rounded bg-surface-3" />
          <div className="skeleton-shimmer h-7 rounded bg-surface-3" />
        </div>
        <div className="flex items-center justify-between rounded bg-surface-3 px-3 py-2">
          <span className="text-xs text-ink-muted">Severity 4 × Likelihood 4</span>
          <span className="stamp-in rounded bg-crit-wash px-2 py-0.5 font-mono text-xs text-crit-ink" style={{ ['--d' as string]: '900ms' }}>
            Risk 16 · Critical
          </span>
        </div>
        <div className="flex items-center gap-2 rounded border border-dashed border-line-strong px-3 py-2.5 text-xs text-ink-faint">
          <span className="size-4 rounded-sm border border-dashed border-line-strong" />
          Drop evidence — photos, docs, telemetry exports
        </div>
      </div>

      <p className="font-mono text-xs text-ink-muted">
        Live risk score updates as severity and likelihood are chosen.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 3. Triage — the ICAO 5×5 matrix                                     */
/* ------------------------------------------------------------------ */

function bandClass(score: number): string {
  if (score >= 15) return 'bg-crit-wash'
  if (score >= 10) return 'bg-alert-wash'
  if (score >= 4) return 'bg-warn-wash'
  return 'bg-ok-wash'
}

export function TriageVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row sm:gap-7">
      <div className="grid grid-cols-5 gap-1">
        {[5, 4, 3, 2, 1].map((sev) =>
          [1, 2, 3, 4, 5].map((lik) => {
            const isTarget = sev === 4 && lik === 4
            return (
              <span
                key={`${sev}-${lik}`}
                className={`flex size-8 items-center justify-center rounded-sm border sm:size-9 ${bandClass(sev * lik)} ${
                  isTarget ? 'border-crit ring-1 ring-crit/60' : 'border-line/40'
                }`}
              >
                {isTarget && (
                  <span className="stamp-in flex size-5 items-center justify-center rounded-full bg-crit font-mono text-xs font-bold text-white" style={{ ['--d' as string]: '700ms' }}>
                    1
                  </span>
                )}
              </span>
            )
          }),
        )}
      </div>

      <div className="space-y-2.5">
        <div className="tour-item rounded-panel border border-crit/40 bg-crit-wash/50 px-3.5 py-2.5" style={{ animationDelay: '800ms' }}>
          <p className="font-mono text-xs font-semibold text-crit-ink">Risk 16 · Critical</p>
          <p className="mt-0.5 text-xs text-ink-soft">Severity 4 × Likelihood 4</p>
        </div>
        <div className="tour-item rounded-panel border border-line bg-surface-2 px-3.5 py-2.5 text-xs text-ink-soft" style={{ animationDelay: '1000ms' }}>
          <p className="flex items-center gap-2">
            <span className="soft-pulse size-1.5 rounded-full bg-alert" />
            Regulator flag: notify within 24h
          </p>
          <p className="mt-1 flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-brand" />
            Investigator assigned · SLA clock starts
          </p>
        </div>
        <p className="font-mono text-xs text-ink-muted">Low → Moderate → High → Critical</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Investigate — one record, eight tabs, reconstructed timeline     */
/* ------------------------------------------------------------------ */

const TABS = ['Overview', 'Risk', 'Investigation', 'Evidence', 'Timeline', 'RCA', 'CAPA', 'Audit']

export function InvestigateVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-4">
      <div className="no-scrollbar flex gap-1 overflow-hidden rounded-panel border border-line bg-surface-2 p-1">
        {TABS.map((tab, i) => (
          <span
            key={tab}
            className={`tour-item shrink-0 rounded px-2.5 py-1 text-xs ${
              tab === 'Timeline' ? 'bg-surface-3 font-medium text-ink' : 'text-ink-muted'
            }`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="rounded-panel border border-line bg-surface-2 p-4">
        <svg viewBox="0 0 340 46" className="w-full">
          <line x1="14" y1="23" x2="326" y2="23" className="dash-draw stroke-line-strong" strokeWidth="1.5" style={{ ['--len' as string]: 312 }} />
          {[
            { x: 40, label: '08:12Z · Cruise' },
            { x: 168, label: '08:41Z · Descent' },
            { x: 296, label: '09:03Z · Touchdown' },
          ].map((node, i) => (
            <g key={node.label} className="tour-item" style={{ animationDelay: `${700 + i * 260}ms` }}>
              <circle cx={node.x} cy="23" r="6" className="fill-surface-3 stroke-brand" strokeWidth="1.5" />
              <circle cx={node.x} cy="23" r="2" className="fill-brand" />
              <text x={node.x} y="41" textAnchor="middle" className="fill-ink-muted font-mono" fontSize="8">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap gap-2">
        {['QAR-telemetry.csv', 'cabin-photo-04.jpg', 'ATC-transcript.pdf'].map((file, i) => (
          <span
            key={file}
            className="tour-item rounded border border-line-soft bg-surface-3 px-2.5 py-1 font-mono text-xs text-ink-soft"
            style={{ animationDelay: `${1500 + i * 160}ms` }}
          >
            {file}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 5. Root cause analysis — the 5 Whys chain                           */
/* ------------------------------------------------------------------ */

const WHYS = [
  'Aircraft veered off the runway during rollout',
  'Differential braking failed to decelerate the right gear',
  'Brake servo valve showed intermittent spool response',
  'Hydraulic debris clogged the proportional pilot orifice',
  'Filter bypass sensor failed open with no cockpit advisory',
]

export function RcaVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-2">
      {WHYS.map((why, i) => {
        const isRoot = i === WHYS.length - 1
        return (
          <div key={why} className="flex items-center gap-2.5">
            <div
              className={`tour-item flex min-w-0 flex-1 items-center gap-2.5 rounded-md border px-3 py-2 ${
                isRoot ? 'border-brand/60 bg-brand-wash/40' : 'border-line-soft bg-surface-2'
              }`}
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${
                  isRoot ? 'bg-brand text-on-brand' : 'bg-surface-3 text-ink-muted'
                }`}
              >
                {isRoot ? 'RC' : `W${i + 1}`}
              </span>
              <span className={`truncate text-xs ${isRoot ? 'font-medium text-ink' : 'text-ink-soft'}`}>{why}</span>
              {isRoot && <Check className="ml-auto size-4 shrink-0 text-brand" />}
            </div>
          </div>
        )
      })}
      <p className="tour-item mt-1.5 font-mono text-xs text-ink-muted" style={{ animationDelay: '1100ms' }}>
        Factors: human · technical · environmental · organisational · procedural
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 6. CAPA — owners, SLAs, evidence, verification                      */
/* ------------------------------------------------------------------ */

const CAPA_ROWS = [
  { ref: 'CAPA-2026-088', owner: 'M.S.', pct: 100, state: 'verified', tone: 'ok' },
  { ref: 'CAPA-2026-089', owner: 'R.C.', pct: 72, state: 'due in 3d', tone: 'warn' },
  { ref: 'CAPA-2026-090', owner: 'J.M.', pct: 40, state: '2d overdue', tone: 'crit' },
] as const

export function CapaVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-2.5">
      {CAPA_ROWS.map((row, i) => (
        <div
          key={row.ref}
          className="tour-item rounded-md border border-line-soft bg-surface-2 px-3.5 py-2.5"
          style={{ animationDelay: `${i * 220}ms` }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs font-semibold text-ink">{row.ref}</span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs ${
                  row.tone === 'ok'
                    ? 'bg-ok-wash text-ok-ink'
                    : row.tone === 'warn'
                      ? 'bg-warn-wash text-warn-ink'
                      : 'bg-crit-wash text-crit-ink'
                }`}
              >
                {row.state}
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-surface-3 font-mono text-xs text-ink-soft">
                {row.owner}
              </span>
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
            <span
              className={`block h-full rounded-full ${
                row.tone === 'crit' ? 'bg-crit' : row.tone === 'warn' ? 'bg-warn' : 'bg-ok'
              } bar-grow`}
              style={{ width: `${row.pct}%`, ['--d' as string]: `${400 + i * 220}ms` }}
            />
          </div>
        </div>
      ))}
      <p className="tour-item font-mono text-xs text-ink-muted" style={{ animationDelay: '900ms' }}>
        Complete with evidence → safety manager verifies effectiveness.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 7. Close — guards, audit trail, regulatory export                   */
/* ------------------------------------------------------------------ */

const AUDIT_ROWS = [
  { t: '09:41Z', who: 'M. Sharma', what: 'status → In review' },
  { t: '11:02Z', who: 'R. Chen', what: 'RCA root cause verified' },
  { t: '14:37Z', who: 'A. Verhoeven', what: 'CAPA-088 effectiveness verified' },
  { t: '14:38Z', who: 'A. Verhoeven', what: 'incident → Closed' },
]

export function CloseVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-3">
      <div className="rounded-panel border border-line bg-surface-2 p-3.5">
        <p className="mb-2.5 font-mono text-xs text-ink-muted">Audit history · tamper-evident</p>
        <div className="space-y-1.5">
          {AUDIT_ROWS.map((row, i) => (
            <div
              key={row.what}
              className="tour-item flex items-baseline gap-3 rounded bg-surface-3/60 px-2.5 py-1.5 font-mono text-xs"
              style={{ animationDelay: `${i * 180}ms` }}
            >
              <span className="text-ink-faint">{row.t}</span>
              <span className="text-ink-soft">{row.who}</span>
              <span className="ml-auto truncate text-ink">{row.what}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="tour-item flex items-center gap-2 rounded-md border border-line-soft bg-surface-2 px-3 py-2 text-xs text-ink-soft" style={{ animationDelay: '760ms' }}>
          <Lock className="size-3.5 text-ink-muted" />
          Close blocked while CAPAs are open
        </div>
        <div className="stamp-in flex items-center gap-2 rounded-md border border-ok/50 bg-ok-wash px-3.5 py-2" style={{ ['--d' as string]: '1150ms' }}>
          <Check className="size-4 text-ok-ink" />
          <span className="font-mono text-xs font-semibold text-ok-ink">Closed · verified</span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 8. Insights — KPIs, charts, exports                                 */
/* ------------------------------------------------------------------ */

const BARS = [38, 52, 44, 61, 57, 72, 66, 84]

export function InsightsVisual() {
  const open = useCountUp(14, { duration: 900 })
  const closed = useCountUp(127, { duration: 1100 })

  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Open', value: open },
          { label: 'Closed this year', value: closed },
          { label: 'Compliance', value: '94%', text: true },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            className="tour-item rounded-panel border border-line bg-surface-2 px-3 py-2.5"
            style={{ animationDelay: `${i * 140}ms` }}
          >
            <span className="block font-condensed text-xl font-semibold tabular-nums text-ink">
              {'value' in kpi && kpi.text ? (kpi.value as string) : (kpi.value as number)}
            </span>
            <span className="text-xs text-ink-muted">{kpi.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-panel border border-line bg-surface-2 p-3.5">
        <div className="flex h-24 items-end gap-1.5">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`bar-grow flex-1 rounded-sm ${i === BARS.length - 1 ? 'bg-brand' : 'bg-surface-3'}`}
              style={{ height: `${h}%`, ['--d' as string]: `${500 + i * 80}ms` }}
            />
          ))}
        </div>
        <p className="mt-2 font-mono text-xs text-ink-muted">Monthly reported occurrences — trend</p>
      </div>

      <p className="tour-item font-mono text-xs text-ink-muted" style={{ animationDelay: '1300ms' }}>
        CSV export of the filtered set · print-to-PDF report · grouped notifications
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 9. Roles — five roles, real permission matrix                       */
/* ------------------------------------------------------------------ */

const PERM_COLS = ['Report', 'Investigate', 'RCA', 'Verify', 'Close', 'Export']
const PERM_ROWS: { role: string; perms: number[] }[] = [
  { role: 'Admin', perms: [1, 1, 1, 1, 1, 1] },
  { role: 'Safety manager', perms: [1, 1, 1, 1, 1, 1] },
  { role: 'Investigator', perms: [1, 1, 1, 0, 0, 1] },
  { role: 'Safety officer', perms: [1, 0, 0, 0, 0, 0] },
  { role: 'Auditor', perms: [0, 0, 0, 0, 0, 1] },
]

export function RolesVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-3">
      <div className="overflow-hidden rounded-panel border border-line bg-surface-2">
        <div className="grid grid-cols-[1.6fr_repeat(6,1fr)] border-b border-line-soft px-3 py-2">
          <span className="text-xs text-ink-muted">Role</span>
          {PERM_COLS.map((col) => (
            <span key={col} className="text-center font-mono text-xs text-ink-faint">
              {col.slice(0, 3)}
            </span>
          ))}
        </div>
        {PERM_ROWS.map((row, r) => (
          <div
            key={row.role}
            className={`tour-item grid grid-cols-[1.6fr_repeat(6,1fr)] items-center px-3 py-1.5 ${
              r < PERM_ROWS.length - 1 ? 'border-b border-line-soft/60' : ''
            }`}
            style={{ animationDelay: `${r * 130}ms` }}
          >
            <span className="truncate text-xs text-ink-soft">{row.role}</span>
            {row.perms.map((p, c) => (
              <span key={c} className="flex justify-center">
                <span
                  className={`size-2 rounded-full ${p ? 'bg-brand' : 'bg-surface-3 border border-line'}`}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="tour-item font-mono text-xs text-ink-muted" style={{ animationDelay: '800ms' }}>
        Enforced everywhere — actions a role cannot take are never shown.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 10. Platform — layers and the mock ⇄ API boundary                   */
/* ------------------------------------------------------------------ */

const LAYERS = [
  { name: 'React 19 UI', detail: 'TypeScript · Tailwind v4 design tokens · dark / light' },
  { name: 'Service layer', detail: 'the single place that talks to data — CSRF, endpoints, latency' },
  { name: 'Mock store  ⇄  Django REST', detail: 'VITE_USE_MOCK=false switches the same hooks to /api/v1' },
]

export function PlatformVisual() {
  return (
    <div aria-hidden="true" className="flex h-full flex-col justify-center gap-0">
      {LAYERS.map((layer, i) => (
        <div key={layer.name}>
          <div
            className="tour-item rounded-panel border border-line bg-surface-2 px-4 py-3"
            style={{ animationDelay: `${i * 220}ms` }}
          >
            <p className="text-sm font-semibold text-ink">{layer.name}</p>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">{layer.detail}</p>
          </div>
          {i < LAYERS.length - 1 && (
            <div className="relative flex h-9 justify-center">
              <span className="w-px bg-line-strong" />
              <span
                className="packet-y absolute left-1/2 top-1 size-1.5 -translate-x-1/2 rounded-full bg-brand"
                style={{ ['--travel' as string]: '22px', ['--d' as string]: `${i * 500}ms` }}
              />
            </div>
          )}
        </div>
      ))}
      <p className="tour-item mt-3 font-mono text-xs text-ink-muted" style={{ animationDelay: '900ms' }}>
        Demo auth is client-side PBKDF2 — clearly labelled, backend-delegated in production.
      </p>
    </div>
  )
}
