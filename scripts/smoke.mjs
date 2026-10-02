/**
 * Headless render smoke test.
 *
 * Bundles the real application to a classic IIFE (jsdom cannot execute
 * `type="module"`), mounts every route and asserts that:
 *   - no component throws
 *   - the shell (sidebar + main region) is present on every route
 *   - required dashboard copy and landmarks exist
 *
 * Usage:  npm run dev   (in another shell)  then  node scripts/smoke.mjs
 */
import { build } from 'esbuild'
import { JSDOM, VirtualConsole } from 'jsdom'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEV = process.env.BASE ?? 'http://localhost:5173'

const ROUTES = [
  '/dashboard',
  '/incidents',
  '/incidents/report',
  '/investigations',
  '/actions',
  '/reports',
  '/incidents/inc_001',
  '/incidents/inc_003?tab=rca',
  '/rca',
  '/rca/five-whys',
  '/rca/risk-matrix',
  '/capa',
  '/analytics',
  '/compliance',
  '/notifications',
  '/settings',
  '/settings?tab=system',
  '/definitely-not-a-route',
  // Auth routes
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password/abc123',
  '/verify-email',
  '/invite/abc123',
  '/report',
  '/privacy',
  '/terms',
]

/** Every path the app serves, used to validate the landing page's links. */
const APP_ROUTES = [
  '/',
  '/dashboard',
  '/incidents',
  '/incidents/report',
  '/investigations',
  '/actions',
  '/reports',
  '/rca',
  '/rca/five-whys',
  '/rca/risk-matrix',
  '/capa',
  '/analytics',
  '/compliance',
  '/notifications',
  '/settings',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password/abc123',
  '/verify-email',
  '/invite/abc123',
  '/report',
  '/privacy',
  '/terms',
]

/* --------------------------------------------------------- 1. bundle */

const result = await build({
  entryPoints: [path.join(root, 'scripts/harness.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  alias: { '@': path.join(root, 'src') },
  define: {
    'process.env.NODE_ENV': '"development"',
    'import.meta.env': JSON.stringify({
      MODE: 'development',
      DEV: true,
      PROD: false,
      BASE_URL: '/',
      VITE_USE_MOCK: 'true',
      VITE_API_BASE_URL: '/api/v1',
    }),
  },
  logLevel: 'error',
})

const code = result.outputFiles[0].text
console.log(`Bundled harness: ${(code.length / 1024).toFixed(0)} KB\n`)

/* ------------------------------------------------------------ 2. dom */

const problems = []
const errors = []

const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', (e) => {
  if (/__boundary_test__/.test(e.message) || /__boundary_test__/.test(String(e.detail ?? ''))) return
  errors.push(`jsdom: ${e.message}`)
})
virtualConsole.on('error', (...a) => {
  // The boundary-fallback test (5h) crashes a child on purpose; React reports
  // the caught error through console.error with format specifiers.
  const combined = a.map((x) => (x && x.message) || String(x ?? '')).join(' ')
  if (/__boundary_test__/.test(combined)) return
  errors.push(`console.error: ${String(a[0]).slice(0, 240)}`)
})

const html = await (await fetch(DEV)).text()

const dom = new JSDOM(html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, ''), {
  url: DEV,
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole,
})

const { window } = dom

// jsdom gaps that recharts / Radix rely on.
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.matchMedia ??= (q) => ({
  matches: false,
  media: q,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})
// react-router's data router builds client-side requests
for (const g of ['Request', 'Response', 'Headers', 'fetch', 'AbortController', 'FormData', 'Blob']) {
  if (!window[g] && globalThis[g]) window[g] = globalThis[g]
}
if (globalThis.crypto?.subtle && !window.crypto?.subtle) {
  try {
    Object.defineProperty(window.crypto, 'subtle', { value: globalThis.crypto.subtle, writable: true, configurable: true })
  } catch {
    window.crypto = globalThis.crypto
  }
}
window.scrollTo = () => {}
window.HTMLElement.prototype.scrollTo = () => {}
// Output controls: printing and generated report windows are no-ops here, and
// download anchors must not make jsdom attempt blob navigation.
window.print = () => {}
window.open = () => null
window.HTMLAnchorElement.prototype.click = function () {}
window.HTMLElement.prototype.releasePointerCapture = () => {}
window.HTMLElement.prototype.hasPointerCapture = () => false
if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock'
if (!window.URL.revokeObjectURL) window.URL.revokeObjectURL = () => {}
window.Element.prototype.scrollIntoView = () => {}

const realError = window.console.error.bind(window.console)
window.console.error = (...args) => {
  const msg = String(args[0] ?? '')
  const combined = args.map((a) => (a && a.message) || String(a ?? '')).join(' ')
  // The boundary-fallback test crashes a child on purpose; React reports it.
  const expected =
    window.__expectBoundaryError && /__boundary_test__|The above error/.test(combined + msg)
  if (
    !expected &&
    /The above error|Uncaught|Cannot read|is not a function|undefined is not|is not defined|Minified React error/i.test(
      msg,
    )
  ) {
    errors.push(msg.slice(0, 300))
  }
  realError(...args)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const docAll = (sel) => window.document.querySelectorAll(sel)
const has = (sel) => docAll(sel).length

// jsdom needs the bundle injected as a classic script.
const script = window.document.createElement('script')
script.textContent = code
window.document.body.appendChild(script)
await sleep(500)

const el = window.document.getElementById('root')
if (!el) {
  console.error('#root missing from index.html')
  process.exit(1)
}

/* ------------------------------------------------- 3. render each route */

/** Routes that are public and don't have the app shell (sidebar + main). */
const PUBLIC_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password/abc123',
  '/verify-email',
  '/invite/abc123',
  '/report',
  '/privacy',
  '/terms',
])

async function visit(route) {
  const before = errors.length
  // Prefer the app's own router so navigation exercises the real code path.
  if (window.__router) window.__router.navigate(route)
  else window.location.hash = route
  await sleep(800)
  const htmlOut = el.innerHTML
  if (!htmlOut.trim()) problems.push(`${route}: rendered nothing`)
  // Only app routes have the sidebar and main region.
  if (!PUBLIC_ROUTES.has(route)) {
    // Warm-up race: on the very first navigation the auth seed or the lazy shell
    // can land a tick after first paint. Re-check once before calling it a problem.
    const shellOk = () =>
      !!window.document.querySelector('aside[aria-label="Primary"]') &&
      !!window.document.getElementById('skyshield-main')
    if (!shellOk()) {
      await sleep(700)
      if (!shellOk()) problems.push(`${route}: shell (sidebar + main) missing`)
    }
  }
  if (window.document.querySelector('[data-loading]')) problems.push(`${route}: still suspended`)
  const added = errors.length - before
  console.log(`  ${added === 0 ? 'ok  ' : 'FAIL'} ${route.padEnd(30)} ${htmlOut.length.toLocaleString()} chars`)
}

console.log('Routes:')
await visit('/dashboard')
for (const r of ROUTES.slice(1)) await visit(r)

/* ------------------------------------------------- 3b. public landing page */

// The landing page is deliberately outside AppShell, so it is checked with its
// own assertions rather than the shell ones above.
console.log('\nLanding page:')
await window.__router.navigate('/')
await sleep(1000)
const landingHtml = el.innerHTML
if (!landingHtml.trim()) problems.push('/: rendered nothing')
if (window.document.querySelector('aside[aria-label="Primary"]'))
  problems.push('/: landing page must not be wrapped in the AppShell sidebar')
if (window.document.getElementById('skyshield-main'))
  problems.push('/: landing page must not render inside the app shell')
if (window.document.querySelector('[data-loading]')) problems.push('/: still suspended')

const landingText = window.document.body.textContent ?? ''
const LANDING_REQUIRED = [
  'SkyShield',
  'Every safety report',
  'followed through to a closed action',
  'SkyShield takes occurrence reports from first sighting through investigation',
  'From occurrence to closed verification',
  'Report',
  'Assess',
  'Investigate',
  'Correct',
  'Verify',
  'See where risk sits, not just how many reports there are.',
  '5 Whys and contributing factors kept with the incident.',
  'Owners, due dates and overdue tracking that reach the incident record.',
  'Calibrated for operational roles',
  'Safety manager',
  'Lead investigator',
  'Safety officer',
  'Compliance auditor',
  'Engineered for certified aviation compliance',
  'Role-based access control',
  'Anonymous safety intake',
  'Start with your next report.',
  'Get started',
  'Sign in',
  'How it works',
]
for (const w of LANDING_REQUIRED)
  if (!landingText.includes(w)) problems.push(`landing copy missing: "${w}"`)

const landing_census = {
  headerLinks: has('header a'),
  workflowNodes: has('#workflow h3'),
  matrixCells: has('#product .aspect-square'),
  rolesListItems: has('#roles dl dt'),
  trustBoxes: has('#security .rounded-lg'),
}
console.log('  DOM census:', landing_census)
if (landing_census.headerLinks < 4) problems.push('landing: header navigation links missing')
if (landing_census.workflowNodes < 5) problems.push('landing: 5-step workflow missing')
if (landing_census.matrixCells < 25) problems.push('landing: 5x5 risk matrix crop missing')
if (landing_census.rolesListItems < 4) problems.push('landing: 4-role definition list missing')
if (landing_census.trustBoxes < 3) problems.push('landing: trust statements missing')

// Landing links must point at real application routes.
const badLinks = [...docAll('a[href^="/"]')]
  .map((a) => a.getAttribute('href'))
  .filter((h) => h && !APP_ROUTES.some((r) => h === r || h.startsWith(`${r}/`) || h.startsWith(`${r}?`)))
if (badLinks.length) problems.push(`landing: links to unknown routes: ${[...new Set(badLinks)].join(', ')}`)
else console.log('  internal links: ok')

/* ---------------------------------------------- 3c. how-it-works guided tour */

// The landing page's "How it works" buttons open a full-screen, ten-chapter
// guided tour. Drive it: open → assert chapter 1 → Next → assert chapter 2 →
// close. The dialog is a Radix portal on document.body.
console.log('\nHow-it-works tour:')
{
  const clickEl = (node) => node?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const tourOpen = window.document.querySelector('[data-tour-open]')
  if (!tourOpen) problems.push('landing: no How-it-works tour trigger found')
  else {
    clickEl(tourOpen)
    await sleep(500)
    if (!window.document.querySelector('[data-tour-dialog]')) {
      problems.push('tour: dialog did not open')
    } else {
      const ch1 = window.document.querySelector('[data-tour-chapter]')
      if (ch1?.getAttribute('data-tour-chapter') !== 'overview')
        problems.push(`tour: first chapter is "${ch1?.getAttribute('data-tour-chapter')}", expected "overview"`)
      const counter = window.document.querySelector('[data-tour-counter]')?.textContent ?? ''
      if (!counter.includes('1 / 10')) problems.push(`tour: counter reads "${counter}", expected "1 / 10"`)
      const tourText = window.document.body.textContent ?? ''
      if (!tourText.includes('What is SkyShield?')) problems.push('tour: chapter 1 title missing')

      clickEl(window.document.querySelector('[data-tour-next]'))
      await sleep(300)
      const ch2 = window.document.querySelector('[data-tour-chapter]')
      if (ch2?.getAttribute('data-tour-chapter') !== 'report')
        problems.push(`tour: Next landed on "${ch2?.getAttribute('data-tour-chapter')}", expected "report"`)

      clickEl(window.document.querySelector('[data-tour-close]'))
      await sleep(400)
      if (window.document.querySelector('[data-tour-dialog]'))
        problems.push('tour: dialog did not close')
      else console.log('  open → overview → next (report) → close: ok')
    }
  }
}

/* ----------------------------------------- 4. dashboard design-system asserts */

await visit('/dashboard')
const doc = window.document
const text = doc.body.textContent ?? ''

const REQUIRED = [
  'SkyShield',
  'Dashboard',
  'Needs attention',
  'Open incidents',
  'Active investigations',
  'RCAs in progress',
  'Overdue CAPAs',
  'Risk matrix',
  'My queue',
  'Reported vs closed',
  'Incidents by type',
  'Recent incidents',
  'Investigation progress',
  'CAPA status',
  'Report incident',
  'Incidents',
  'All Incidents',
  'Investigations',
  'Actions',
  'Reports',
  'Analytics',
  'Compliance',
  'Risk Matrix',
  'Settings',
]
for (const w of REQUIRED) if (!text.includes(w)) problems.push(`dashboard copy missing: "${w}"`)

// Interaction primitives present
const dom_stats = {
  sidebarLinks: has('aside a'),
  navGroups: has('aside ul li'),
  tableRows: has('tbody tr'),
  tableHeaders: has('thead th'),
  svgIcons: has('svg'),
  chartContainers: has('.recharts-responsive-container'),
  chartCards: has('[class*="rounded-card"]'),
  riskMatrixCells: has('[title*="Severity"], .grid > div[style*="border-color"]'),
  buttons: has('button'),
  badges: has('[class*="-wash"]'),
}
console.log('\nDOM census:', dom_stats)

if (dom_stats.sidebarLinks < 8) problems.push(`sidebar links too few: ${dom_stats.sidebarLinks}`)
if (dom_stats.tableRows < 4) problems.push(`recent incidents table too few rows: ${dom_stats.tableRows}`)
if (dom_stats.chartContainers < 2) problems.push('chart containers did not render')

/* ---------------------------------------- 5. interaction spot-checks */

// Sorting
const sortBtn = [...doc.querySelectorAll('thead th button')].find((b) =>
  b.textContent?.includes('Incident ID'),
)
if (sortBtn) {
  sortBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(600)
}
if (has('tbody tr') === 0) problems.push('table broke after sort click')

// Risk matrix marker hover card
const marker = doc.querySelector('button[aria-label^="P_"]')
if (!marker) {
  problems.push('risk matrix produced no incident markers')
} else {
  const ev = (type) =>
    new window.MouseEvent(type, { bubbles: true, clientX: 120, clientY: 120 })
  marker.dispatchEvent(ev('mouseover'))
  await sleep(120)
  marker.dispatchEvent(ev('mousemove'))
  await sleep(300)
  const tip = doc.querySelector('[role="tooltip"]')
  console.log('risk matrix hover card:', tip ? 'ok' : 'missing')
  if (!tip) problems.push('risk matrix hover card did not appear')
  for (const f of ['Severity', 'Likelihood', 'Aircraft']) {
    if (tip && !tip.textContent?.includes(f)) problems.push(`hover card missing "${f}"`)
  }
}

// Notification popover
const bell = [...doc.querySelectorAll('button')].find((b) =>
  (b.getAttribute('aria-label') ?? '').startsWith('Notifications'),
)
if (!bell) problems.push('notification trigger not found')
else {
  bell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(500)
  const t = doc.body.textContent ?? ''
  if (!t.includes('Critical incident reported')) problems.push('notification list did not open')
  else console.log('notification panel: ok')
  window.document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  await sleep(200)
}

// Global search
const search = doc.querySelector('input[aria-label="Global search"]')
if (!search) problems.push('global search input missing')
else {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(search, 'SKY2214')
  search.dispatchEvent(new window.Event('input', { bubbles: true }))
  await sleep(400)
  if (!(doc.body.textContent ?? '').includes('P_006-258'))
    problems.push('global search returned no result for SKY2214')
  else console.log('global search: ok')
}

/* ------------------------------------------ 5b. incident register (S4) */

// Saved-view tabs, the single Filters popover, removable chips and the
// persisted Columns choice — driven end to end (filter → chip → clear
// round-trip is the S4 exit criterion).
console.log('\nIncident register:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

  // Clear the global search first so its dropdown cannot interfere.
  const gs = doc.querySelector('input[aria-label="Global search"]')
  if (gs) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(gs, '')
    gs.dispatchEvent(new window.Event('input', { bubbles: true }))
    await sleep(200)
  }

  await window.__router.navigate('/incidents')
  await sleep(1000)

  const tabs = [...docAll('[role="tab"]')].map((t) => t.textContent ?? '')
  if (!['All', 'Open', 'Critical'].every((v) => tabs.some((t) => t.includes(v))))
    problems.push(`incidents: saved-view tabs missing (${tabs.join(' | ')})`)
  else console.log('  saved-view tabs: ok')

  // Filters popover → apply Critical → chip appears
  const filtersTrigger = window.document.querySelector('[data-filters-trigger]')
  if (!filtersTrigger) problems.push('incidents: Filters trigger missing')
  else {
    clickEl(filtersTrigger)
    await sleep(400)
    const pop = window.document.querySelector('[role="dialog"]')
    if (!pop || !(pop.textContent ?? '').includes('Severity')) {
      problems.push('incidents: Filters popover did not open with the Severity group')
    } else {
      const critBox = [...window.document.querySelectorAll('[role="checkbox"]')].find(
        (o) => (o.closest('label')?.textContent ?? '').trim().startsWith('Critical'),
      )
      if (!critBox) problems.push('incidents: Critical option missing in Filters popover')
      else {
        clickEl(critBox)
        await sleep(1000) // debounce + mock latency
        const chip = window.document.querySelector('[data-filter-chip]')
        if (!chip || !(chip.textContent ?? '').includes('Critical'))
          problems.push('incidents: filter chip did not appear after applying severity')
        else {
          clickEl(chip.querySelector('button'))
          await sleep(1000)
          if (window.document.querySelector('[data-filter-chip]'))
            problems.push('incidents: chip removal did not clear the filter')
          else console.log('  filters popover → chip → clear round-trip: ok')
        }
      }
    }
    clickEl(window.document.querySelector('[data-filters-trigger]'))
    await sleep(300)
  }

  // Columns popover → hide Investigator → persisted in the prefs store
  const colsTrigger = window.document.querySelector('[data-columns-trigger]')
  if (!colsTrigger) problems.push('incidents: Columns trigger missing')
  else {
    clickEl(colsTrigger)
    await sleep(400)
    const invBox = [...window.document.querySelectorAll('[role="checkbox"]')].find(
      (o) => (o.closest('label')?.textContent ?? '').includes('Investigator'),
    )
    if (!invBox) problems.push('incidents: Investigator column toggle missing')
    else {
      clickEl(invBox)
      await sleep(500)
      const raw = window.localStorage.getItem('skyshield.prefs.v1:incidents.hiddenColumns')
      if (!raw || !raw.includes('investigator'))
        problems.push(`incidents: column choice not persisted (store: ${raw})`)
      else console.log('  columns popover → persisted hiddenColumns: ok')
      const resetBtn = [...window.document.querySelectorAll('button')].find(
        (b) => (b.textContent ?? '').trim() === 'Reset',
      )
      clickEl(resetBtn)
      await sleep(300)
    }
    clickEl(window.document.querySelector('[data-columns-trigger]'))
    await sleep(200)
  }

  // Leave the width loop measuring the dashboard, as before.
  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* --------------------------------------------- 5c. report page (S5) */

// Quick report is the default; an incomplete filing answers with a summary;
// typing autosaves a draft; SPA-leaving triggers the blocker; returning
// restores the draft; "Start fresh" clears it.
console.log('\nReport page:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const bodyText = () => window.document.body.textContent ?? ''
  const byText = (sel, text) =>
    [...window.document.querySelectorAll(sel)].find((b) => (b.textContent ?? '').includes(text))

  window.localStorage.removeItem('skyshield.report.draft.v1')
  await window.__router.navigate('/incidents/report')
  await sleep(1000)

  if (!bodyText().includes('Quick report')) problems.push('report: quick mode is not the default')
  const fileBtn = byText('button', 'File occurrence')
  if (!fileBtn) problems.push('report: File occurrence button missing')
  else {
    clickEl(fileBtn)
    await sleep(300)
    if (!window.document.querySelector('[data-quick-summary]'))
      problems.push('report: incomplete quick report showed no validation summary')
    else console.log('  quick mode default + validation summary: ok')
  }

  const ta = window.document.querySelector('textarea')
  if (!ta) problems.push('report: description textarea missing')
  else {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, 'During pushback the tow tractor shear pin failed and the aircraft contacted the ground power unit.')
    ta.dispatchEvent(new window.Event('input', { bubbles: true }))
    await sleep(1400) // 800ms autosave debounce + margin
    const draft = window.localStorage.getItem('skyshield.report.draft.v1')
    if (!draft || !draft.includes('tow tractor')) {
      problems.push('report: autosave did not persist the draft')
    } else {
      // Leaving mid-draft must be blocked with the leave dialog.
      await window.__router.navigate('/dashboard')
      await sleep(500)
      const leaveDialog = [...window.document.querySelectorAll('[role="dialog"]')].find((d) =>
        (d.textContent ?? '').includes('Leave this report?'),
      )
      if (!leaveDialog) problems.push('report: SPA leave guard dialog did not appear')
      else {
        clickEl(byText('button', 'Leave page'))
        await sleep(700)
        if (!bodyText().includes('Needs attention')) problems.push('report: leave guard did not proceed to the dashboard')
      }

      // Coming back restores the draft.
      await window.__router.navigate('/incidents/report')
      await sleep(1000)
      const banner = bodyText().includes('Restored an unsaved draft')
      const ta2 = window.document.querySelector('textarea')
      if (!banner || !(ta2?.value ?? '').includes('tow tractor'))
        problems.push(`report: draft not restored (banner=${banner})`)
      else console.log('  autosave → leave guard → restore: ok')

      clickEl(byText('button', 'Start fresh'))
      await sleep(400)
      if (window.localStorage.getItem('skyshield.report.draft.v1') !== null)
        problems.push('report: Start fresh did not clear the draft')
      else console.log('  start-fresh clears the draft: ok')
    }
  }

  // Leave the width loop measuring the dashboard, as before.
  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* --------------------------------------- 5d. incident detail (S6) */

// Header contract: mono ref + badges + ONE context primary action that
// changes with status/role; sticky facts sidebar; eight keyboard-reachable tabs.
console.log('\nIncident detail:')
{
  // Auth seeds via PBKDF2 (210k iterations); poll for role-dependent UI
  // instead of racing a fixed sleep.
  const pollFor = async (fn, tries = 14, ms = 500) => {
    for (let i = 0; i < tries; i++) {
      const v = fn()
      if (v) return v
      await sleep(ms)
    }
    return fn()
  }
  const findMain = (re) =>
    [...window.document.querySelectorAll('#skyshield-main button')].find((b) =>
      re.test(b.textContent ?? ''),
    )

  await window.__router.navigate('/incidents/inc_001')
  await sleep(1100)
  const tabCount = has('[role="tab"]')
  if (tabCount < 8) problems.push(`detail: expected 8 tabs, found ${tabCount}`)
  if (!(window.document.body.textContent ?? '').includes('Facts'))
    problems.push('detail: sticky facts sidebar missing')
  if (!(await pollFor(() => findMain(/Open RCA workspace/))))
    problems.push('detail: investigation-status record missing the "Open RCA workspace" primary')
  else console.log('  investigation status → "Open RCA workspace" primary: ok')

  await window.__router.navigate('/incidents/inc_004')
  await sleep(1100)
  if (!(await pollFor(() => findMain(/Export record/))))
    problems.push('detail: closed record should offer "Export record" as the primary action')
  else console.log('  closed status → "Export record" primary: ok')

  const allTabs = [...docAll('[role="tab"]')]
  if (allTabs.some((t) => t.tagName !== 'BUTTON' || t.hasAttribute('disabled')))
    problems.push('detail: tabs are not all keyboard-reachable buttons')

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* --------------------------------------------- 5e. RCA + matrix (S7) */

// The workspace must route for real (/rca/inc_001), the plain-language summary
// must update on edit, autosave must report Saved, the matrix cell side panel
// must list the cell's occurrences, and the post-mitigation toggle must
// explain itself.
console.log('\nRCA workspace & risk matrix:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const bodyText = () => window.document.body.textContent ?? ''
  const byText = (sel, text) =>
    [...window.document.querySelectorAll(sel)].find((b) => (b.textContent ?? '').includes(text))

  await window.__router.navigate('/rca/inc_001')
  await sleep(1100)
  if (!bodyText().includes('5 Whys Analysis')) problems.push('rca: workspace did not render at /rca/inc_001')
  if (!window.document.querySelector('[data-rca-summary]')) problems.push('rca: plain-language summary missing')
  else {
    // Edit the deepest answered level — the summary quotes it live.
    clickEl(window.document.querySelector('button[aria-label="Edit Why 5"]'))
    await sleep(300)
    const ta = window.document.querySelector('textarea')
    if (!ta) problems.push('rca: level editor did not open')
    else {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, 'Hydraulic particulate bypassed the filter housing seal during rollout')
      ta.dispatchEvent(new window.Event('input', { bubbles: true }))
      await sleep(200)
      clickEl(byText('button', 'Save level'))
      await sleep(500)
      const after = window.document.querySelector('[data-rca-summary]')?.textContent ?? ''
      if (!after.includes('Hydraulic particulate'))
        problems.push('rca: summary did not update after edit')
      else console.log('  summary updates on edit: ok')

      await sleep(2400) // 1.5s autosave debounce + service delay + margin
      const autosave = window.document.querySelector('[data-autosave]')?.textContent ?? ''
      if (!/Saved|All changes saved/.test(autosave))
        problems.push(`rca: autosave indicator reads "${autosave.trim().slice(0, 40)}"`)
      else console.log('  autosave indicator: ok')
    }
  }

  // Matrix (inside the reports hub): cell side panel + mitigation toggle.
  await window.__router.navigate('/reports?tab=risk-matrix')
  await sleep(1300)
  const cell = window.document.querySelector('[data-risk-cell="4-4"]')
  if (!cell) problems.push('matrix: 4×4 risk cell missing')
  else {
    clickEl(cell)
    await sleep(400)
    const panel = window.document.querySelector('[data-cell-panel]')
    if (!panel || !(panel.textContent ?? '').includes('P_006-258'))
      problems.push('matrix: cell side panel did not list the 4×4 occurrence')
    else console.log('  cell side panel: ok')
  }
  const residualBtn = byText('button', 'Post-mitigation')
  if (!residualBtn) problems.push('matrix: post-mitigation toggle missing')
  else {
    clickEl(residualBtn)
    await sleep(600)
    if (!bodyText().includes('Post-mitigation view'))
      problems.push('matrix: residual view did not explain its derivation')
    else console.log('  post-mitigation toggle: ok')
  }

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* ------------------------------------------- 5f. CAPA round-trip (S8) */

// Summary line, mark-complete-with-evidence (confirm blocked until evidence),
// then the role-gated Verify for the safety-manager demo user.
console.log('\nCAPA register:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

  await window.__router.navigate('/actions')
  await sleep(1100)

  const summary = window.document.querySelector('[data-capa-summary]')
  if (!summary || !/actions in the register/.test(summary.textContent ?? ''))
    problems.push('capa: computed summary line missing')
  else console.log('  summary line: ok')

  const markBtn = window.document.querySelector('[data-mark-complete]')
  if (!markBtn) problems.push('capa: no Mark-complete action rendered')
  else {
    const id = markBtn.getAttribute('data-mark-complete')
    clickEl(markBtn)
    await sleep(400)
    const confirmBtn = window.document.querySelector('[data-confirm-complete]')
    if (!confirmBtn) problems.push('capa: complete dialog did not open')
    else {
      if (!confirmBtn.disabled) problems.push('capa: confirm enabled without evidence')
      const ta = window.document.querySelector('textarea[aria-label="Evidence of completion"]')
      if (!ta) problems.push('capa: evidence textarea missing')
      else {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
        setter.call(ta, 'Work order 4412 closed; seal replacement torque-checked and logged.')
        ta.dispatchEvent(new window.Event('input', { bubbles: true }))
        await sleep(300)
        clickEl(window.document.querySelector('[data-confirm-complete]'))
        await sleep(800)
        const row = window.document.querySelector(`[data-capa-row="${id}"]`)
        const verifyBtn = row?.querySelector('[data-verify]')
        if (!verifyBtn) problems.push('capa: completed row offers no Verify to the safety manager')
        else {
          clickEl(verifyBtn)
          await sleep(800)
          const row2 = window.document.querySelector(`[data-capa-row="${id}"]`)
          if (!row2 || !/verified/i.test(row2.textContent ?? ''))
            problems.push('capa: verify did not seal the action')
          else console.log('  complete-with-evidence → verify round-trip: ok')
        }
      }
    }
  }

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* ------------------------------------------- 5g. reports hub (S9) */

console.log('\nReports hub:')
{
  await window.__router.navigate('/reports?tab=analytics')
  await sleep(1400)
  const takeaways = docAll('[data-takeaway]')
  if (takeaways.length < 8)
    problems.push(`analytics: expected >=8 computed takeaways, found ${takeaways.length}`)
  else if (![...takeaways].some((t) => /%|\d/.test(t.textContent ?? '')))
    problems.push('analytics: takeaways contain no figures')
  else console.log(`  analytics takeaways (${takeaways.length}): ok`)

  await window.__router.navigate('/reports?tab=compliance')
  await sleep(1200)
  if (!window.document.querySelector('[data-gap-list]'))
    problems.push('compliance: ranked gap list missing')
  const attach = docAll('[data-attach]')
  if (attach.length === 0) problems.push('compliance: no evidence-attach controls rendered')
  else console.log(`  compliance gap list + ${attach.length} attach controls: ok`)

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* -------------------------------------- 5h. shell: palette + boundary (S10) */

console.log('\nShell (S10):')
{
  // ⌘K palette opens, searches entities, navigates, closes.
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
  await sleep(600)
  const palette = window.document.querySelector('[data-command-palette]')
  if (!palette) problems.push('palette: Ctrl-K did not open it')
  else {
    const defItems = window.document.querySelectorAll('[data-command-item]')
    if (defItems.length < 8) problems.push(`palette: too few default items (${defItems.length})`)
    const input = window.document.querySelector('[data-command-input]')
    if (!input) problems.push('palette: search input missing')
    else {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, 'P_006-258')
      input.dispatchEvent(new window.Event('input', { bubbles: true }))
      await sleep(900) // entity indexes lazy-load on first open
      const incItem = window.document.querySelector('[data-command-item^="inc-"]')
      if (!incItem) problems.push('palette: incident entity search returned nothing')
      else {
        incItem.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        await sleep(1300)
        if (window.document.querySelector('[data-command-palette]'))
          problems.push('palette: did not close after navigating')
        else if (!(window.document.body.textContent ?? '').includes('P_006-258'))
          problems.push('palette: navigation to the incident failed')
        else console.log('  palette: Ctrl-K → entity search → navigate: ok')
      }
    }
  }

  // Notifications are grouped by day.
  await window.__router.navigate('/notifications')
  await sleep(1000)
  const groups = docAll('[data-day-group]')
  if (groups.length < 1) problems.push('notifications: no day groups rendered')
  else console.log(`  notifications day groups (${groups.length}): ok`)

  // Error boundary fallback around a throwing child.
  const host = window.document.createElement('div')
  window.document.body.appendChild(host)
  window.__renderBoundaryTest(host)
  await sleep(500)
  const fb = host.querySelector('[data-error-boundary]')
  if (!fb || !(fb.textContent ?? '').includes('Something went wrong'))
    problems.push('error boundary: fallback did not render around a throwing child')
  else console.log('  error boundary fallback: ok')
  window.__expectBoundaryError = false
  host.remove()

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* --------------------------------------- 5i. stateful store (S11) */

// create → persisted under skyshield.store.v1 → sequential per-org ref →
// reset restores the pristine seed.
console.log('\nStateful store:')
{
  const st = window.__store
  if (!st) problems.push('store: harness did not expose __store')
  else {
    const before = await st.getAllIncidents().then((a) => a.length)
    const created = await st.createIncident({
      title: 'Smoke persistence probe',
      description: 'Deliberate probe record created by the smoke suite to verify store persistence.',
      category: 'engine_issue',
    })
    const raw = window.localStorage.getItem(st.STORE_KEY)
    const inStore = await st.getAllIncidents().then((a) => a.some((i) => i.id === created.id))
    if (!created.ref || !inStore || !raw || !raw.includes(created.ref))
      problems.push(`store: created record not persisted (ref=${created?.ref}, inStore=${inStore})`)
    else if (!/^P_006-\d{3}$/.test(created.ref))
      problems.push(`store: ref is not the per-org sequential format: ${created.ref}`)
    else {
      console.log(`  create → persisted (${created.ref}): ok`)
      // sequential: next ref must be exactly one above the previous max
      const nums = await st.getAllIncidents().then((a) =>
        a.map((i) => Number(i.ref.slice(6))).filter((n) => Number.isFinite(n)),
      )
      const expected = Math.max(...nums.filter((n) => n !== Number(created.ref.slice(6)))) + 1
      if (Number(created.ref.slice(6)) !== expected)
        problems.push(`store: ref ${created.ref} is not max+1 (${expected})`)

      st.resetDemoData()
      const after = await st.getAllIncidents()
      if (after.some((i) => i.id === created.id) || after.length !== before)
        problems.push(`store: reset did not restore the seed (${after.length} vs ${before})`)
      else console.log('  reset restores the seed: ok')
    }
  }
}

/* ------------------------------------- 5j. workflow transitions (S12) */

// A reported record transitions through the guarded service (audit entry
// included); a record with an unfinished investigation shows WHY closure is
// refused on the disabled button.
console.log('\nWorkflow service:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const bodyText = () => window.document.body.textContent ?? ''
  const byText = (sel, text) =>
    [...window.document.querySelectorAll(sel)].find((b) => (b.textContent ?? '').includes(text))

  const reportedId = await window.__store
    .getAllIncidents()
    .then((a) => a.find((i) => i.status === 'reported')?.id ?? null)
  if (!reportedId) problems.push('workflow: no reported-status incident in the seed')
  else {
    await window.__router.navigate(`/incidents/${reportedId}`)
    await sleep(1200)
    const startBtn = byText('button', 'Start investigation')
    if (!startBtn) problems.push('workflow: reported record offers no Start-investigation primary')
    else {
      clickEl(startBtn)
      await sleep(1000)
      if (!bodyText().includes('Under Investigation'))
        problems.push('workflow: status did not move to investigation')
      else {
        // the transition must have written an audit entry in the same operation
        await window.__router.navigate(`/incidents/${reportedId}?tab=audit`)
        await sleep(1200)
        if (!bodyText().includes('Status Reported')) problems.push('workflow: transition wrote no audit entry')
        else console.log('  reported → investigation + audit entry: ok')
      }
    }
  }

  // inc_001: investigation at 72% → closure must be refused with a reason.
  await window.__router.navigate('/incidents/inc_001')
  await sleep(1200)
  const closeBtn = window.document.querySelector('[data-close-incident]')
  const reason = window.document.querySelector('[data-close-reason]')
  if (!closeBtn) problems.push('workflow: Close-incident control missing for a safety manager')
  else if (!closeBtn.disabled) problems.push('workflow: closure enabled despite an unfinished investigation')
  else if (!reason || !/complete|open/i.test(reason.textContent ?? ''))
    problems.push(`workflow: disabled closure does not explain itself ("${reason?.textContent ?? ''}")`)
  else console.log('  guarded closure explains the refusal: ok')

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* ------------------------------------- 5k. click-everything sweep (S13) */

// Every enabled button inside the main region of every operational page is
// clicked once: no console errors, no crashes, and navigation always returns.
// Destructive or state-mutating labels are denied by name (they are covered
// by their dedicated sections above).
console.log('\nClick-everything sweep:')
{
  const DENY = /sign out|discard|reset|delete|remove|start fresh|leave page|submit occurrence|file occurrence|reload|explore the live demo|save level|verify|mark complete/i
  const SWEEP_PAGES = [
    '/dashboard',
    '/incidents',
    '/incidents/inc_001',
    '/actions',
    '/investigations',
    '/reports?tab=analytics',
    '/reports?tab=compliance',
    '/reports?tab=risk-matrix',
    '/notifications',
    '/settings',
    '/rca/five-whys',
    '/rca/inc_001',
  ]
  const currentRoute = () => {
    const loc = window.__router.state.location
    return loc.pathname + (loc.search || '')
  }

  const sweepContent = async (route, excludeSelector) => {
    let clicks = 0
    for (let pass = 0; pass < 24; pass++) {
      const main = window.document.getElementById('skyshield-main')
      if (!main) break
      const scope = excludeSelector ? [...main.querySelectorAll('button')].filter((b) => !b.closest(excludeSelector)) : [...main.querySelectorAll('button')]
      const next = scope.find((b) => {
        if (b.disabled || b.__swept) return false
        const text = `${b.textContent ?? ''} ${b.getAttribute('aria-label') ?? ''}`.toLowerCase()
        return !DENY.test(text)
      })
      if (!next) break
      next.__swept = true
      next.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      clicks++
      await sleep(160)
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(90)
      const loc = window.__router.state.location
      if (loc.pathname + (loc.search || '') !== route) {
        await window.__router.navigate(route)
        await sleep(650)
      }
    }
    return clicks
  }

  for (const route of SWEEP_PAGES) {
    await window.__router.navigate(route)
    await sleep(900)
    const before = errors.length
    let clicks = 0

    // Settings hides content behind its own tab list: activate each tab, then
    // sweep that tab's controls before moving on.
    if (route === '/settings') {
      for (const tabLabel of ['Profile', 'Preferences', 'Notifications', 'Access', 'System']) {
        const main = window.document.getElementById('skyshield-main')
        const tabBtn = [...main.querySelectorAll('nav[aria-label="Settings sections"] button')].find(
          (b) => (b.textContent ?? '').trim() === tabLabel,
        )
        if (!tabBtn) continue
        tabBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        clicks++
        await sleep(350)
        clicks += await sweepContent(route, 'nav[aria-label="Settings sections"]')
      }
    }

    for (let pass = 0; clicks >= 0 && pass < 24; pass++) {
      const main = window.document.getElementById('skyshield-main')
      if (!main) break
      const next = [...main.querySelectorAll('button')].find((b) => {
        if (b.disabled || b.__swept) return false
        const text = `${b.textContent ?? ''} ${b.getAttribute('aria-label') ?? ''}`.toLowerCase()
        return !DENY.test(text)
      })
      if (!next) break
      next.__swept = true
      next.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      clicks++
      await sleep(160)
      // Dismiss whatever opened, then restore the route if it navigated.
      window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await sleep(90)
      if (currentRoute() !== route) {
        await window.__router.navigate(route)
        await sleep(650)
      }
    }
    const added = errors.length - before
    if (added > 0) problems.push(`click-everything ${route}: ${added} console error(s)`)
    else console.log(`  ok  ${route.padEnd(28)} ${clicks} clicks`)
  }

  await window.__router.navigate('/dashboard')
  await sleep(700)
}

/* ------------------------------------- 5l. reporting loop (S14) */

// Anonymous intake: throttled, honeypot-guarded, and REAL — the report must
// enter the register for triage and notify the safety desk. Comments with
// @mentions must persist and announce their targets.
console.log('\nReporting loop:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const bodyText = () => window.document.body.textContent ?? ''
  const byText = (sel, text) =>
    [...window.document.querySelectorAll(sel)].find((b) => (b.textContent ?? '').includes(text))
  const setVal = (el, v) => {
    const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  }

  window.localStorage.removeItem('skyshield.anon.throttle')
  await window.__router.navigate('/report')
  await sleep(900)

  const what = window.document.querySelector('textarea#what')
  const whereEl = window.document.querySelector('input#where')
  const whenEl = window.document.querySelector('input#when')
  if (!what || !whereEl || !whenEl) problems.push('anon: intake form fields missing')
  else {
    setVal(what, 'During pushback at the stand the tow bar shear pin failed and the aircraft drifted toward the jet bridge.')
    setVal(whereEl, 'BLR — stand 42')
    setVal(whenEl, '2026-09-30T06:15')
    await sleep(200)
    clickEl(byText('button', 'Submit report'))
    await sleep(2400) // service delay + state
    const m = bodyText().match(/P_006-\d{3}/)
    if (!bodyText().includes('Report submitted') || !m)
      problems.push('anon: confirmation with a register reference did not appear')
    else {
      const anonRef = m[0]
      console.log(`  anonymous intake filed as ${anonRef}: ok`)

      // throttle: an immediate second submission must be refused
      await window.__router.navigate('/login')
      await sleep(400)
      await window.__router.navigate('/report')
      await sleep(800)
      const what2 = window.document.querySelector('textarea#what')
      const where2 = window.document.querySelector('input#where')
      const when2 = window.document.querySelector('input#when')
      if (what2 && where2 && when2) {
        setVal(what2, 'Second immediate submission that the throttle must refuse outright.')
        setVal(where2, 'DEL')
        setVal(when2, '2026-09-30T07:00')
        await sleep(150)
        clickEl(byText('button', 'Submit report'))
        await sleep(1200)
        if (!window.document.querySelector('[data-throttle-error]'))
          problems.push('anon: throttle did not refuse the immediate second submission')
        else console.log('  throttle refuses rapid resubmission: ok')
      }

      // the report is in the register, labelled anonymous
      await window.__router.navigate('/incidents')
      await sleep(1000)
      const search = window.document.querySelector('input[aria-label*="Search ID"]')
      if (search) {
        setVal(search, anonRef)
        await sleep(1000)
        const rowText = [...docAll('tbody tr')].map((r) => r.textContent).join(' ')
        if (!rowText.includes(anonRef) || !/Anonymous/i.test(rowText))
          problems.push('anon: filed report did not enter the register as Anonymous')
        else console.log('  register shows "Anonymous" intake: ok')
        setVal(search, '')
        await sleep(600)
      }

      // the safety desk was notified
      await window.__router.navigate('/notifications')
      await sleep(1000)
      if (!bodyText().includes('Anonymous report needs triage'))
        problems.push('anon: safety-desk notification was not generated')
      else console.log('  triage notification generated: ok')
    }
  }

  // comments + @mention detection on a record
  await window.__router.navigate('/incidents/inc_001')
  await sleep(1300)
  const commentBox = window.document.querySelector('textarea[aria-label="New comment"]')
  if (!commentBox) problems.push('comments: composer missing on the incident overview')
  else {
    setVal(commentBox, 'Seal replacement scheduled — @R. Singh please coordinate the line check.')
    await sleep(400)
    if (!bodyText().includes('Will notify: R. Singh'))
      problems.push('comments: mention detection did not announce the target')
    clickEl(window.document.querySelector('[data-send-comment]'))
    await sleep(900)
    const thread = window.document.querySelector('[data-comments]')
    if (!thread || !(thread.textContent ?? '').includes('Seal replacement scheduled'))
      problems.push('comments: submitted comment did not appear in the thread')
    else if (!(thread.textContent ?? '').includes('1 mentioned'))
      problems.push('comments: mention count not shown on the comment')
    else console.log('  comment + @mention detection: ok')
  }

  await window.__router.navigate('/dashboard')
  await sleep(800)
}

/* ------------------------------------------- 5m. PWA + offline (S15) */

console.log('\nPWA & offline queue:')
{
  // Install-prompt metadata ships in the document head.
  if (!/manifest\.webmanifest/.test(html)) problems.push('pwa: manifest link missing from index.html')
  if (!/name="theme-color"/.test(html)) problems.push('pwa: theme-color missing')
  if (!/apple-touch-icon/.test(html)) problems.push('pwa: apple-touch-icon missing')
  else console.log('  install-prompt metadata: ok')

  // Offline: enqueue while "offline", the report page must sync on reconnect.
  const off = window.__offline
  if (!off) problems.push('pwa: harness did not expose __offline')
  else {
    window.localStorage.removeItem(off.QUEUE_KEY)
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    off.enqueueReport({
      title: 'Offline queue probe',
      description: 'Filed from the offline queue by the smoke suite to verify write-behind sync.',
      category: 'near_miss',
    })
    if (off.readQueue().length !== 1) problems.push('pwa: enqueue did not persist')

    await window.__router.navigate('/incidents/report')
    await sleep(1000)
    const noteOffline = (window.document.body.textContent ?? '').includes('queued offline')
    if (!noteOffline) problems.push('pwa: mounted page did not surface the queued count')

    Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    window.dispatchEvent(new window.Event('online'))
    await sleep(1600)
    const left = off.readQueue().length
    const filed = await window.__store
      .getAllIncidents()
      .then((a) => a.some((i) => i.title === 'Offline queue probe'))
    if (left !== 0 || !filed)
      problems.push(`pwa: queue did not sync on reconnect (left=${left}, filed=${filed})`)
    else console.log('  offline enqueue → online sync: ok')
    const filedNote = (window.document.body.textContent ?? '').includes('Filed 1 queued report')
    if (!filedNote) problems.push('pwa: sync success was not reported to the user')
    else console.log('  sync success note: ok')

    await window.__router.navigate('/dashboard')
    await sleep(700)
  }
}

/* ------------------------------------- 5n. domain correctness (S16) */

console.log('\nDomain correctness:')
{
  const clickEl = (node) => node && node.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  const bodyText = () => window.document.body.textContent ?? ''
  const byText = (sel, text) =>
    [...window.document.querySelectorAll(sel)].find((b) => (b.textContent ?? '').includes(text))
  const setVal = (el, v) => {
    const proto = el instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  }

  // UTC display: timestamps render with an explicit Z.
  await window.__router.navigate('/incidents/inc_001')
  await sleep(1300)
  if (!/\d{2}:\d{2}Z/.test(bodyText())) problems.push('utc: no HH:MMZ timestamp rendered on the record')
  else console.log('  UTC HH:MMZ display: ok')

  // Reporter confidentiality + audited reveal (demo user is a safety manager).
  if (!bodyText().includes('Identity withheld'))
    problems.push('reveal: restricted reporter identity not withheld')
  const revealBtn = window.document.querySelector('[data-reveal-reporter]')
  if (!revealBtn) problems.push('reveal: no reveal control offered to a manager')
  else {
    clickEl(revealBtn)
    await sleep(1000)
    if (!bodyText().includes('R. Singh')) problems.push('reveal: identity not shown after the reveal')
    else {
      await window.__router.navigate('/incidents/inc_001?tab=audit')
      await sleep(1300)
      if (!bodyText().includes('Reporter identity revealed'))
        problems.push('reveal: disclosure was not written to the audit trail')
      else console.log('  confidentiality reveal + audit entry: ok')
    }
  }

  // Flight-number format validation on the quick report.
  await window.__router.navigate('/incidents/report')
  await sleep(1100)
  const flt = window.document.querySelector('input[aria-label="Flight number"]')
  if (!flt) problems.push('validation: flight number field missing on the quick report')
  else {
    setVal(flt, 'SKYX12345')
    await sleep(250)
    clickEl(byText('button', 'File occurrence'))
    await sleep(500)
    const summary = window.document.querySelector('[data-quick-summary]')
    if (!summary || !/airline designator/i.test(summary.textContent ?? ''))
      problems.push('validation: bad flight number was not refused with a format message')
    else console.log('  flight-number validation: ok')
  }

  // The form is dirty now — leaving trips the S5 leave guard. Dismiss the
  // draft so later sections navigate freely (this also re-tests the guard).
  await window.__router.navigate('/dashboard')
  await sleep(500)
  const leaveBtn = [...window.document.querySelectorAll('[role="dialog"] button')].find((b) =>
    (b.textContent ?? '').includes('Leave page'),
  )
  if (!leaveBtn) problems.push('a11y-prep: leave guard did not appear for the dirty validation probe')
  else {
    clickEl(leaveBtn)
    await sleep(700)
  }
  // Clear the autosaved draft so nothing restores unexpectedly later.
  window.localStorage.removeItem('skyshield.report.draft.v1')
}

/* ------------------------------------- 5o. accessibility hard pass (S17) */

console.log('\nAccessibility (S17):')
{
  // Skip link in the app shell
  const skip = window.document.querySelector('a[href="#skyshield-main"]')
  if (!skip) problems.push('a11y: shell skip link missing')
  else console.log('  skip link: ok')

  // Keyboard-operable risk-matrix cells (occupied cells are role=button)
  await window.__router.navigate('/reports?tab=risk-matrix')
  let cell = null
  for (let t = 0; t < 12 && !cell; t++) {
    await sleep(500)
    cell = window.document.querySelector('[data-risk-cell="4-4"]')
  }
  if (!cell) {
    const diag = {
      boundary: !!window.document.querySelector('[data-error-boundary]'),
      tabs: [...window.document.querySelectorAll('[role="tab"]')].map((t) => `${t.textContent}:${t.getAttribute('aria-selected')}`).join(','),
      panels: window.document.querySelectorAll('[role="tabpanel"]').length,
      mainLen: (window.document.getElementById('skyshield-main')?.textContent ?? '').length,
      snippet: (window.document.getElementById('skyshield-main')?.textContent ?? '').slice(0, 160),
    }
    console.log('  DIAG:', JSON.stringify(diag))
    problems.push('a11y: matrix cell 4×4 missing')
  }
  else if (cell.getAttribute('role') !== 'button' || cell.getAttribute('tabindex') !== '0')
    problems.push('a11y: occupied matrix cell is not keyboard-focusable')
  else {
    cell.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await sleep(500)
    if (!window.document.querySelector('[data-cell-panel]'))
      problems.push('a11y: Enter on a matrix cell did not open the side panel')
    else console.log('  matrix cell keyboard activation: ok')
  }

  // Live regions on the register (assert we really are on the register)
  await window.__router.navigate('/incidents')
  await sleep(1200)
  if (!window.document.querySelector('[role="tablist"][aria-label="Saved views"]'))
    problems.push('a11y: register did not render for the live-region check')
  else {
    const liveCount = window.document.querySelectorAll('#register-panel [aria-live]').length
    if (liveCount < 1) problems.push('a11y: register has no aria-live result count')
    else console.log(`  aria-live regions on the register (${liveCount}): ok`)
  }

  await window.__router.navigate('/dashboard')
  await sleep(700)
}

/* --------------------------------------------------- 6. responsiveness */

for (const w of [1440, 1024, 768, 390]) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
  window.dispatchEvent(new window.Event('resize'))
  await sleep(220)
  const overflow = el.scrollWidth - el.clientWidth
  console.log(`  width ${String(w).padStart(4)}px → horizontal overflow ${overflow}px`)
  if (w === 390 && overflow > 24) problems.push(`mobile horizontal overflow: ${overflow}px`)
}

// The landing page scrolls the document rather than an inner element, so its
// overflow has to be measured against the documentElement.
await window.__router.navigate('/')
await sleep(900)
for (const w of [390, 360]) {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true, writable: true })
  window.dispatchEvent(new window.Event('resize'))
  await sleep(220)
  const de = window.document.documentElement
  const overflow = de.scrollWidth - de.clientWidth
  console.log(`  landing @${w}px → horizontal overflow ${overflow}px`)
  if (overflow > 2) problems.push(`landing mobile horizontal overflow at ${w}px: ${overflow}px`)
}

/* ------------------------------------------------------------- report */

const real = [...new Set([...problems, ...errors])]
console.log(real.length ? `\nPROBLEMS (${real.length}):` : '\nNo problems found.')
for (const p of real.slice(0, 50)) console.log('  -', p)

process.exit(real.length ? 1 : 0)
