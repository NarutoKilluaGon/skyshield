# SkyShield

**Aviation Safety & Incident Reporting Platform** — a dark, operations-grade
interface for safety managers, investigators, safety officers and administrators.

The visual language targets operator software rather than a generic SaaS
dashboard: dense, calm, colour used only where it carries operational meaning.

---

## Quick start

Requires **Node ≥ 22.12** (`.nvmrc`; the jsdom harness chain needs it — the
dev server and build also run on Node 20+).

```bash
npm install
npm run dev        # http://localhost:5173
```

**Demo login:** `demo@skyshield.aero` / `demo1234` (a safety manager), or the
landing page's **View demo** button, which signs in automatically. Every
fixture account in `src/data/users.ts` uses the same demo password — e.g.
`r.singh@skysafety.aero` (investigator) to see role gating.

The demo is **stateful**: filed reports, RCA edits, completed actions and read
notifications persist in `localStorage` (`skyshield.store.v1`) across reloads,
with seed dates rebased to today. **Settings → System → Reset demo data**
restores the pristine seed at any time.

```bash
npm run build      # typecheck + production bundle
npm run typecheck  # strict TypeScript
npm run lint       # ESLint (flat config: typescript-eslint, react-hooks, jsx-a11y)
npm run test:unit  # vitest units (store, workflow, permissions, risk, auth, formats…)
npm run size-gate  # bundle-size fail-gate over dist/ (run after build)
npm run format     # Prettier write (format:check to verify)
npm run verify     # typecheck + units + DOM smoke test + interactive flow tests
```

CI (`.github/workflows/ci.yml`) runs install → lint → typecheck → unit → build →
size-gate → smoke (jsdom) → flows (headless Chrome) on every push and PR.

`verify` and `shots` expect the dev server to be running.

---

## Design system

Defined once in `src/index.css` via Tailwind v4 `@theme`, and exposed to
components as semantic tokens. Colour, type and spacing come from these
variables — no hardcoded hex colours or arbitrary pixel sizes in components.

### Dark (default)

| Token | Value |
| --- | --- |
| canvas | `#0F1114` |
| canvas-deep | `#0B0C0E` |
| sidebar | `#0B0C0E` |
| surface | `#16181C` |
| surface-2 (popovers) | `#1C1F24` |
| surface-3 (hover, inputs) | `#23272D` |
| line | `#262A30` |
| line-soft | `#1E2126` |
| line-strong | `#363B43` |
| ink | `#ECEAE6` |
| ink-soft | `#B9B6AF` |
| ink-muted | `#8C8A85` |
| ink-faint (decorative or disabled only) | `#66645F` |
| brand | `#D6A24C` |
| brand-hover | `#E4B565` |
| brand-wash | `#2A2214` |
| on-brand | `#14100A` |

### Light

| Token | Value |
| --- | --- |
| canvas | `#F3F4F5` |
| canvas-deep | `#ECEEF0` |
| sidebar | `#FAFAFB` |
| surface | `#FFFFFF` |
| surface-2 | `#FFFFFF` |
| surface-3 | `#EFF0F2` |
| line | `#E2E4E7` |
| line-soft | `#ECEEF0` |
| line-strong | `#C9CDD3` |
| ink | `#14171A` |
| ink-soft | `#3B4046` |
| ink-muted | `#5E646B` |
| ink-faint | `#8A9098` |
| brand | `#8F5F12` |
| brand-hover | `#7A500E` |
| brand-wash | `#F6ECD9` |
| on-brand | `#FFFFFF` |

### Status colours

| Status | Dark fill / ink / wash | Light fill / ink / wash |
| --- | --- | --- |
| ok | `#46B37F` / `#7FD3A8` / `#11261C` | `#1F8A5B` / `#166A46` / `#E5F3EB` |
| warn | `#E2C044` / `#EBD26F` / `#262010` | `#C99A06` / `#7A5A00` / `#FAF0CF` |
| alert | `#EE7B3E` / `#FF9F6B` / `#2A170D` | `#D2611E` / `#A94B12` / `#FBE9DC` |
| crit | `#E5484D` / `#FF8A8E` / `#2B1416` | `#C42B3A` / `#9E1F2D` / `#FBE6E8` |

Rules: brass never encodes status, and status colours never decorate. Severity and status are always shown with text, never colour alone. Delete `cyan`, `brand-bright`, `brand-dim` and every `*-dim` token and fix their usages. Every text/background pair must meet WCAG AA in both themes. Everything is driven by these variables, so changing the accent later is a two-line edit; keep it that way and say so in the README.

### Type, shape, elevation, motion

**Fonts** (self-hosted with Fontsource, remove the Google Fonts links): `IBM Plex Sans` 400/500/600 for the interface and body, `IBM Plex Sans Condensed` 500/600 for landing headlines and the single large number on each page, `IBM Plex Mono` 400/500 for incident refs, CAPA refs, aircraft registrations, flight numbers and times only.

**Type scale** (the only allowed sizes): xs 12/16, sm 13/20, base 14/22, md 16/24, lg 20/28, xl 28/34, plus landing display sizes `display-1` 56/58 and `display-2` 36/40 (condensed, tight tracking −0.01em). Weights 400 body, 500 labels, 600 titles. No uppercase or letter-spaced labels anywhere; labels are 12px sentence case in `ink-muted`.

**Radius:** 6px controls, 4px badges, 8px panels and dialogs. **Borders:** 1px `line`. **Shadows:** none on panels; a single popover shadow (`0 8px 24px -8px rgb(0 0 0 / .5)` dark, `/ .18` light) on popovers, dialogs and drawers only.

Delete: `.grain`, `.card-shadow`, `.clip-notch`, `.grid-fade`, `pulse-ring`, the `slide-up` entrances on app cards, backdrop blur on topbars and page headers, and the coloured gradient washes on KPI cards.

**App motion budget:** 120ms colour/opacity transitions on interactive elements; dialogs, popovers and drawers 150ms fade+scale; sidebar collapse 180ms. Focus ring is a 2px `brand` outline with 2px offset on every interactive element. Respect `prefers-reduced-motion`.

### Core components

- **Button:** 32px default / 28 sm / 36 lg. Primary = `brand` fill with `on-brand` text. Secondary = `surface` with 1px `line-strong` border. Ghost = transparent with `surface-3` hover. Destructive = `crit` only for irreversible actions. Only one primary button per view. Dashboard: **Report incident** is primary; "Export" is secondary.
- **Inputs:** 32px, `surface` background, 1px `line-strong` border, brand focus ring. Label above (13px/500), helper 12px `ink-muted`, error 12px `crit-ink` with an icon. Placeholder `ink-faint`.
- **Badges:** 20px high, 4px radius, `*-wash` background, `*-ink` text, no border. Status may include a 6px dot, severity never does.
- **Tables:** 40px rows (36 dense), sentence-case 12px/500 `ink-muted` headers, `line-soft` dividers, no zebra, sticky header, right-aligned numeric columns, mono refs, hover `surface-3`, selected `brand-wash`.
- **Panel:** 1px border, 8px radius, 16px padding. Header is a 14px/600 title with actions on the right. A subtitle only when it adds information.
- **Wordmark and logo:** a 24px rounded-square `brand` tile with a simple `on-brand` chevron/wing glyph, and "SkyShield" in 16px/600 (single colour, no tagline). Regenerate `public/shield.svg`, favicons (svg, 32px png, apple-touch 180px), `theme-color` and an OG image (1200×630) in the new palette.
- **Sidebar:** 248px expanded (wide enough that "Incident management" and "Active investigations" never truncate; if a label still truncates, shorten the label instead), 56px collapsed. Items are 32px high with 13px text; the active item uses `surface-3` and `ink` at weight 500, with no glow and no accent bar. Numeric counts only on Incidents (open, critical) and Actions (overdue). Move the collapse toggle into the header beside the wordmark. Remove the "SMS Compliance" block.

---

## Architecture

```
src/
  routes.tsx              route table (data router) + breadcrumb handles
  types/index.ts          domain model — mirrors the planned DRF serializers
  lib/
    domain.ts             status/severity/category labels, colours, risk maths
    format.ts             UTC-first date/time, duration and SLA formatting
    workflow.ts           incident state machine + guarded transition rules
    permissions.ts        role → permission matrix, can(), denial reasons
    validation.ts         ICAO/IATA/registration/flight-number validators
    units.ts              ft/m, kt/km-h, NM/km conversions
    sanitize.ts           HTML escaping for generated documents
    offline-queue.ts      write-behind queue for offline quick reports
    error-boundary.tsx    top-level + route-level crash boundaries
    prefs.ts              typed localStorage UI preferences
  data/                   mock fixtures, one file per entity (store seeds)
  services/
    client.ts             fetch transport, CSRF, endpoints, 429/Retry-After
    store.ts              stateful skyshield.store.v1 demo store (+ store-pure)
    incidents.ts          incident CRUD, filtering, anonymous intake, transitions
    operations.ts         dashboard, investigation, RCA, CAPA, compliance
    comments.ts           incident comments + @mentions
    notifications.ts      notification read state
    auth.ts               demo PBKDF2 auth, invites (mock mode only)
  hooks/
    use-incident-table.ts      query state machine (filters/sort/page/error)
    use-reduced-motion.ts      OS motion preference (SVG SMIL needs unmounting)
    use-theme.ts               light/dark/system theme tokens
  components/
    ui/                   shadcn-style primitives over Radix
    common/               logo, avatar, status/severity/risk badges
    layout/               AppShell, Sidebar, Topbar, Breadcrumbs, notifications
    landing/              public site — nav, hero, deep-dives, roles, trust, CTA
      tour/               How-it-works guided tour (chapters + animated visuals)
      reveal.tsx          scroll-reveal primitive (useInView-based)
    data/                 DataTable (loading/empty/error), Pagination, filters
    dashboard/            StatCard, RiskMatrix, RCAWorkflow, ProgressTimeline
    charts/               ChartCard (+takeaway), Sparkline, SparkBars
    incidents/            IncidentTable, IncidentCard, IncidentTimeline, comments
    rca/                  FiveWhys, ContributingFactors
  pages/                  one file per route
    incidents/report/     quick + guided wizard (hook, steps/, autosave)
    incidents/detail/     record shell + tabs/ (one file per tab)
scripts/
  smoke.mjs / flows.mjs / shots.mjs    the three harnesses
  harness.tsx             jsdom mount used by smoke (real route table)
  bundle-gate.mjs         gzip budget gate over dist/
  gen-assets.mjs          favicons/OG image regeneration (needs Chrome)
```

### Routing

`src/routes.tsx` is the single source of truth. Every page is lazy-loaded, and
each operational route declares a `handle.breadcrumb`, so `Breadcrumbs` needs no
per-page wiring. The same array is consumed by the headless test harness, which
means tests cannot drift from the real route table.

`/` is the public landing page and is deliberately **outside** `AppShell` — the
marketing site is a document, with its own header, its own document scroll and
its own visual language. Every operational module keeps its existing path, so
`/dashboard` renders the authenticated dashboard exactly as before.

### The landing page

`src/pages/landing.tsx` composes the sections in `src/components/landing/`. It
is a **presentation layer over the existing system**: every figure it publishes
is computed from the same incident register the authenticated modules read
(`services/incidents.ts` over the stateful store) — including the hero's
needs-action / active / overdue counts. Nothing is hard-coded.

The **How-it-works guided tour** (`components/landing/tour/`) is the landing's
deep-dive: ten chapters (safety loop → reporting → triage → investigation →
RCA → CAPA → verify → insights → roles → architecture), each with an animated
diagram, detail bullets and a one-sentence presenter takeaway; it supports
autoplay, keyboard navigation and a clickable chapter rail, and closes with a
one-click sign-in to the live demo.

The hero leads with the **project name at display scale, dead centre**
(`clamp(64px, 12.5vw, 168px)` condensed) with a slow brass shimmer sweep, a
radar-sweep ring system and the dashed great-circle route arc with a tracked
aircraft behind it. Under the headline sits a **departure-board strip**: live
rows from the occurrence register (flight, route, occurred time in `HH:MMZ`,
workflow status) that flip in like a split-flap board. The computed stat row
and the product composition (needs-attention list + 5×5 matrix crop) follow.

The motion language (scroll reveals, the standards marquee, hero route-arc
ambience, the departure board, staggered timelines) is a pure-CSS kit in
`index.css` on top of the design tokens, fully neutralised under
`prefers-reduced-motion` — no animation dependencies are shipped.

> History note: an earlier iteration carried an interactive world map
> ("Global Aviation Activity") with generated Natural Earth geometry. Decision
> item D1 (audit) resolved to **remove** it: it was orphaned from the composed
> page, carried a 661-line component plus a generated geometry fixture and
> toolchain for zero live surface, and the guided tour now tells the story
> better. It remains in git history (`OR-1` and earlier) if the owner ever
> wants to repurpose it.

### Data layer

`src/services/client.ts` is the only place that talks to the network. When
`VITE_USE_MOCK` is unset the services resolve from a **stateful demo store**
(`skyshield.store.v1` in localStorage, `src/services/store.ts`) with simulated
latency: the store seeds from `src/data/*` with every date **rebased to today**
(so the register always looks live), then persists every mutation — filed
reports, RCA edits, CAPA completions and read notifications survive a reload.
New records get `crypto.randomUUID()` ids and per-org sequential refs
(`P_006-259`, `CAPA-2026-0NN`). **Settings → System → Reset demo data**
restores the pristine seed. Setting `VITE_API_BASE_URL` and `VITE_USE_MOCK=false`
switches the same functions to `fetch` against a Django REST backend. Endpoint
paths are centralised in `ENDPOINTS`. Pure store helpers (`store-pure.ts`: date
shifting, ref sequencing, uuids) carry vitest units (`npm run test:unit`).

**The Django backend is implemented** (`backend/`, milestones M1–M3 of
`docs/BACKEND_PLAN.md`): DRF + SQLite, session-cookie auth over the demo roster,
camelCase JSON, `{ items, total, page, pageSize }` envelopes, and the full
workflow/permission engine re-validated server-side — transition refusals answer
`422 { reason }`, stale writes `409`, and every mutation writes its audit row in
the same transaction. Run it:

```bash
pip install -r backend/requirements.txt
npm run api:migrate   # create the schema
npm run api:seed      # idempotent demo seed (fixtures exported from the mock store)
npm run api:dev       # Django on :8000 — vite dev/preview proxy /api to it
npm run api:test      # 91 Django tests (workflow guards, auth, data API)
npm run api:flows     # the full 65-check flows suite against the real API
```

`api:flows` is the acceptance gate: it rebuilds with `VITE_USE_MOCK=false`,
serves the production bundle through the vite preview proxy, seeds a fresh
database, and drives real Chrome against Django — no mocks involved.

The full server-side roadmap — milestones M1–M6 (Django/DRF, auth, workflow,
files, idempotent offline replay, metrics), **M7: the Kaggle-2015 flight-delay
ML pipeline** and **M8: the grounded assistant chatbot** — is specified in
**`docs/BACKEND_PLAN.md`**; the current integration status is summarised in
**`docs/BACKEND_REPORT.md`**.

### Security & Authentication Notice

> **Important**: The client-side authentication mock in `src/services/auth.ts` (using WebCrypto PBKDF2 with 210,000 iterations, salt generation, and 5-attempt/10-minute lockout in `localStorage`) is strictly for **demonstration and prototype testing** — it is the default (`VITE_USE_MOCK` unset). It does **not** provide real production security. With `VITE_USE_MOCK=false` the app authenticates against the Django backend (`backend/accounts`): server-side sessions in HttpOnly SameSite cookies, CSRF-protected mutations, database-backed lockout and DRF throttling — the localStorage cache is then only a display mirror of the server session. Production deployments must additionally set `SKYSHIELD_SECRET_KEY`, turn `SKYSHIELD_DEMO_MODE` off, serve over HTTPS (`SKYSHIELD_COOKIE_SECURE`), and follow `docs/DEPLOY.md`.
>
> Deployment hardening — CSP (hash-based, with the one documented `style-src` exception), security headers, the 429/Retry-After contract, the localStorage policy per mode, and the export/erasure paths — is specified in **`docs/DEPLOY.md`**. Generated HTML documents (the analytics print report) escape every interpolated value via `lib/sanitize.ts`.

### Customizing the Brand Accent

The graphite and brass identity is driven entirely by CSS tokens in `src/index.css`. Changing the brass accent (`#D6A24C` dark / `#8F5F12` light) to any airline corporate livery is a two-line edit to `--color-brand` and `--color-brand-hover` in `src/index.css`.


---

## Routes

| Path | Surface |
| --- | --- |
| `/` | Public landing page (outside the app shell) + How-it-works guided tour |
| `/login` `/signup` `/forgot-password` `/reset-password/:token` `/verify-email` | Auth (public-only) |
| `/invite/:token` | Invite acceptance |
| `/report` | **Public anonymous intake** (throttled, honeypot-guarded) |
| `/privacy` `/terms` | Legal |
| `/dashboard` | KPI strip, needs-attention, 2:1 risk matrix + queue, trend, recent, progress |
| `/incidents` | Register: saved views, filters+chips, bulk actions, columns, pagination |
| `/incidents/report` | Quick report (default) / 7-step guided wizard (`?mode=guided`), autosave |
| `/incidents/:id` | Record: 8 tabs (`?tab=risk|investigation|evidence|timeline|rca|capa|audit`), guarded transitions |
| `/investigations` | Active investigations |
| `/actions` | CAPA register (table-first, complete-with-evidence, verify) |
| `/reports?tab=analytics|compliance|risk-matrix` | Reports hub with shared reporting-period bar |
| `/rca/:incidentId` | RCA workspace (5 Whys, factors, live summary, autosave) |
| `/rca/five-whys` | 5 Whys index (+ new-analysis dialog) |
| `/notifications` `/settings` | Notification centre · Settings (left-tab list) |
| `/rca` `/analytics` `/compliance` `/capa` `/rca/risk-matrix` | Legacy redirects to the consolidated nav |

`src/routes.tsx` is the single source of truth; the smoke harness consumes the
same table.

## Roles

Five roles, enforced everywhere via `can(user, permission)`
(`src/lib/permissions.ts`) — controls a role cannot use are never rendered.

| Capability | Admin | Safety manager | Investigator | Safety officer | Auditor |
| --- | :-: | :-: | :-: | :-: | :-: |
| File reports | ✓ | ✓ | ✓ | ✓ | — |
| Edit records / transition status | ✓ | ✓ | ✓ | ✓ | — |
| **Close / re-open incidents** | ✓ | ✓ | — | — | — |
| Run investigations & RCA | ✓ | ✓ | ✓ | — | — |
| Raise/edit CAPAs | ✓ | ✓ | ✓ | — | — |
| **Verify CAPA effectiveness** | ✓ | ✓ | — | — | — |
| Export data | ✓ | ✓ | ✓ | — | ✓ |
| Manage users & settings | ✓ | ✓ | — | — | — |

## Features

- **Landing page** (`/`) — public site outside the app shell: an ambient
  instrument-grid hero with a live 5×5 matrix crop and needs-attention panel,
  the five-stage operational workflow, three product deep-dives (risk matrix,
  5 Whys, CAPA), the role breakdown, the trust section with a standards
  marquee, and a closing call to action. Scroll reveals, staggered timelines
  and hover motion run on a pure-CSS "landing motion kit" over the token
  system (`index.css` + `components/landing/reveal.tsx`), fully neutralised
  under `prefers-reduced-motion` — zero added dependencies.
- **How-it-works guided tour** — "How it works" buttons (nav, hero, workflow,
  CTA, footer) open a full-screen ten-chapter walkthrough of the platform:
  the safety loop, reporting, ICAO 5×5 triage, investigation, 5 Whys RCA,
  CAPA/SLA tracking, verify-and-close guards, insights, the five roles and
  the architecture underneath. Each chapter pairs detail bullets with an
  animated diagram and a one-sentence takeaway. Built for presenting live:
  clickable chapter rail, autoplay slideshow (9s/chapter), keyboard
  navigation (←/→, Home/End, Space, Esc), reading-progress hairline, and a
  final step that signs into the seeded demo dashboard.
- **Dashboard** — four KPI cards with trend sparklines, an interactive 5×5 risk
  matrix (hover a marker for the record; click to open it; legend filters by
  band), occurrence trend, severity mix, recent incident table, investigation
  progress against the eight-stage workflow, and CAPA SLA monitoring.
- **Incident management** — five saved views (All / Open / Critical / In
  investigation / Closed) with live counts, search, a single Filters popover
  (six groups + date range + risk score) with removable per-value chips,
  column sorting, persisted column visibility and page size, pagination, bulk
  selection with bulk status change / reassignment / selection CSV export, and
  real per-row actions (assign, export record).
- **Report incident** — quick report by default (essentials on one screen with
  the same live risk maths) plus the full seven-step guided wizard, per-step
  validation summaries, live risk scoring as severity and likelihood are
  chosen, a sticky live risk rail, drag-and-drop evidence upload, debounced
  autosave with draft restore, browser and in-app leave guards, and a review
  step that states the risk score and band before submission. Split into
  `pages/incidents/report/` (hook + step components, no file over 400 lines).
- **Incident detail** — header with mono ref, state badges and one context
  primary action that changes with status and role (start investigation, open
  RCA, view CAPAs, export CSV); guarded Close/Re-open buttons that explain
  every refusal inline (open CAPAs, unfinished investigation, role); status
  moves run through the workflow service with same-transaction audit entries
  and optimistic version checks; eight keyboard-reachable underline tabs:
  overview (two-column with a sticky facts sidebar), risk assessment (with the
  record's position on the matrix), investigation, evidence, timeline, RCA,
  CAPA, audit history. Split into `pages/incidents/detail/` (shell + one file
  per tab, no file over 400 lines).
- **RCA** — real workspace route (`/rca/:incidentId`) with an editable 5 Whys
  chain (add, edit, remove levels, root cause), contributing factors grouped by
  taxonomy with click-to-cycle weights (primary/contributing/latent), a live
  plain-language summary that updates as you edit, and debounced autosave with
  a Saved indicator. A 5 Whys index (`/rca/five-whys`) lists every analysis and
  creates drafts for incidents that have none.
- **CAPA** — table-first register with a computed summary line (clickable
  overdue / due-soon chips), per-action progress, owner avatars, relative due
  dates and `crit-wash` overdue rows; mark-complete requires typed evidence,
  and effectiveness verification is role-gated to `capa.verify` holders. SLA
  monitoring and status-mix charts sit below the register.
- **Analytics** — every chart computed from the incident/CAPA/RCA registers for
  the hub's shared reporting window; real severity/type/aircraft filters,
  prior-window KPI deltas, takeaway sentences per chart, CSV export of the
  filtered set and a print-ready report.
- **Reports hub** — one reporting-period bar shared by the analytics and
  compliance tabs; risk-matrix tab keeps its own scope.
- **Risk matrix** (reports hub) — full-size 5×5 with click-a-cell side panel
  listing that cell's occurrences, and an assessed / post-mitigation toggle
  whose residual likelihood is derived from completed and verified CAPAs
  (never hand-edited).
- **Compliance** — single large overall score, per-category breakdown, ranked
  gap list (five lowest-scoring requirements), audit countdown, and a
  requirements register with evidence text, file attachments (name +
  provenance), owners, review dates, CSV export and print.
- **Notifications** — in-app panel and a full centre sharing one store (the
  unread count is real and identical everywhere), grouped by day and severity
  weighted, with loading / empty / error states; targeted notices (`forUserId`,
  e.g. @mentions) reach only the user they concern, and real events generate
  them (anonymous intake, mentions).
- **Anonymous intake** (`/report`) — throttled (2-min window, 10/day),
  honeypot-guarded, and real: the report enters the register as an
  "Anonymous intake — needs triage" record with a sequential reference, and
  the safety desk is notified.
- **Comments** — persisted threads on incident records with @mention
  detection against the user directory ("Will notify: …" while typing) and
  per-user mention notifications.
- **PWA** — installable manifest with shortcuts, an app-shell service worker
  (network-first navigations, offline fallback, assets cache-first, API never
  cached), and an offline quick-report queue: a completed report filed without
  a connection is stored locally and files itself through the real service on
  reconnect, with the pending count surfaced on the page.
- **Command palette** — Ctrl/⌘+K opens actions, pages and live entities
  (incidents, CAPAs, analyses) in one keyboard-first dialog; ↑↓ + Enter
  navigate, mounted shell-wide.
- **Error boundaries** — a crashed page keeps the shell and offers Reload /
  Back to dashboard; a second boundary guards the whole application.

## Responsive behaviour

Desktop is the primary target. Below `md` the sidebar becomes a drawer, tables
collapse to cards, the 5×5 matrix switches to a banded list, and charts
restack. Verified for horizontal overflow at 1440 / 1024 / 768 / 390 px.

The landing page is a document, so it responds differently: the nav collapses to
a panel, the map holds a legible scale and is panned horizontally below `xl`
(with a "drag to pan" affordance and an edge fade), the safety-data panels
restack, the four-stage workflow becomes a vertical run, and the recent-events
register drops its column grid for a stacked row. Verified for horizontal
overflow at 1600 / 1280 / 1024 / 834 / 768 / 640 / 414 / 390 / 360 px.

## Accessibility

Semantic landmarks (`aside` navigation, `main`, `nav` breadcrumbs), visible
focus rings, `aria-sort` on sortable columns, `role="progressbar"` with values
on progress meters, labelled form controls, and live regions for filter results.

---

## Verification

Five layers, all driving the real application:

| Command | What it does |
| --- | --- |
| `npm run lint` | ESLint flat config — typescript-eslint + react-hooks + jsx-a11y (0 errors gate; heuristic a11y warnings triaged against axe) |
| `npm run typecheck` | strict TypeScript across app and tests |
| `npm run test:unit` | vitest: store helpers (date rebasing, sequential refs), workflow state machine (full 6×6 matrix walk), permissions, risk maths, demo auth incl. PBKDF2 lockout, mention parsing, offline queue, sanitisation, formatters — 83 tests |
| `npm run build` + `npm run size-gate` | production bundle, then gzip budgets per chunk class and total |
| `npm run smoke` | bundles the app to a classic script, mounts it in jsdom and drives it: every route renders in the shell; the landing page (outside `AppShell`) with its copy, census, internal links, the How-it-works tour (open → chapter → next → close) and 390/360px overflow; dashboard copy, risk-matrix hover card, notifications, global search; the S4 register (saved views, filters → chips → clear, persisted columns); the S5 report page (quick default, validation summary, autosave → leave guard → restore); incident-detail contracts (8 tabs, per-status primary action); the S7 RCA workspace (summary updates on edit, autosave indicator) and matrix (cell side panel, post-mitigation toggle); the reports hub (computed takeaways, compliance gap list); the shell (⌘K palette entity search → navigate, day-grouped notifications, error-boundary fallback); the stateful store (create → persisted → sequential ref → reset restores seed); the reporting loop (anonymous intake → register → triage notification, throttled resubmission, comments + @mention detection); the PWA (install metadata, offline enqueue → reconnect sync); domain correctness (HH:MMZ display, audited reporter reveal, flight-number validation); accessibility (skip link, keyboard-activated matrix cells, aria-live regions); then a **click-everything sweep** — every enabled non-destructive button on 12 routes, asserting zero console errors — and horizontal overflow at 1440/1024/768/390 |
| `npm run flows` | headless Chrome over CDP: the guided wizard end-to-end (validation summary, computed risk 16, autosave restore across a real reload, review, submit), the quick report (default mode, selects, live risk, filing), the register (search, saved views, filter → chip → clear, column persistence across reload), all eight incident tabs, the CAPA complete → verify round-trip **and the investigator role-swap proving Verify is hidden**, the reports hub (takeaways, real filtering, blob-intercepted CSV), the command palette, the offline quick-report queue, matrix-marker navigation, sidebar collapse, and the auth pages |
| `npm run shots` | full-page screenshots to `/tmp/opencode/shots` |

`verify` runs typecheck + units + smoke + flows. `smoke`/`flows`/`shots` expect
a server on `:5173` (`npm run dev`, or `npm run preview` against a build —
CI uses preview). `flows`/`shots` need Chrome at `/usr/bin/google-chrome`
(included on GitHub Actions ubuntu runners).

`scripts/shots.mjs` briefly overrides the fixed-viewport shell into document
flow for capture. That override is test-only and never shipped.
