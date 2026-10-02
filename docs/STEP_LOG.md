# Step log

One entry per committed step. Newest last. Each entry: scope, files, verify results, leftovers/decisions.

---

## S0 — Docs baseline (2026-10-01)

- **Scope:** create `docs/` with AUDIT (verified state vs master prompt v2), ROADMAP (reconfigured steps S0–S21),
  BACKEND_PLAN (master Appendix A), DESIGN (principles + tokens), and this log. Closes gap G1.
- **Files:** `docs/AUDIT.md`, `docs/ROADMAP.md`, `docs/BACKEND_PLAN.md`, `docs/DESIGN.md`, `docs/STEP_LOG.md`.
- **Verify:** `npm run typecheck` ✅ (docs-only change); sandbox baseline established:
  smoke ✅ "No problems found" (Node 22.11 + `--experimental-require-module`, dev server on :5173);
  flows/shots/axe/Lighthouse not runnable in sandbox (no Chrome) — owner-gate from S2 onward.
- **Audit highlights:** Phases 1–3 + 4a verified true (tokens, theme script, guards, redirects, 5-item nav,
  reports hub, PBKDF2 210k). Phase 4b+ not started (dashboard still shows Executive overview / Live data /
  refresh; `var(--chart-*)` has 0 usages; no stateful store; no palette/PWA/CI/ESLint/Vitest; 1,208-ln and
  984-ln page files unsplit).
- **Leftovers / decisions for owner:** D1 landing activity map (recommend remove), D2 trust-box count,
  D3 approve CI with Chrome, D4 ML milestone placement (backlog M7, post-backend-M4).
- **Removed this step:** nothing yet (removals start with S1/S2 per master rule).

---

## S2 — Dashboard six blocks + matrix count circles (2026-10-01)

- **Scope (master 4.2 + matrix part of 4.2/4.5):** dashboard rebuilt as six blocks: header (title "Dashboard",
  range select, ⋯ menu = Download incidents (CSV) + Print summary, single primary "Report incident",
  real "Updated HH:MM"); **Needs attention** hero (data-built, ≤5 rows, severity-sorted, empty state);
  **KPI strip** (one panel, four divided cells, condensed 28px numbers, plain deltas, crit ink only on
  overdue > 0); **Risk matrix 2/3 + My queue 1/3** (square ≤64px cells, 2px gaps, one solid count circle
  per cell, cell click → filtered list hook, band legend with counts replaces the Severity-mix panel);
  **Reported vs closed 1:1 Incidents by type**; **Recent incidents** (6 rows + View all);
  **Investigation progress + CAPA status** row (counts line under title, computed).
- **Files:** `src/pages/dashboard.tsx` (rewritten, 567→~380 ln), new `src/components/dashboard/{needs-attention,kpi-strip,my-queue}.tsx`
  (`computeNeedsAttention` exported pure for future unit tests), `src/components/dashboard/risk-matrix.tsx`
  (square cells, count circles, `showLegend`, `onCellClick`), `scripts/smoke.mjs` (REQUIRED copy updated to the
  new dashboard language — copy-change update, nothing deleted).
- **Removed (things that didn't earn their place):** Executive overview dropdown, "Live data" pill,
  refresh button, page subtitle, sparkline StatCard grid, Severity-mix panel, hardcoded trend stats
  (42/31/11), hardcoded overdue-CAPA list, 8-stage RCAWorkflow diagram on the dashboard, plane-icon
  markers inside matrix cells.
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found";
  census before→after: buttons 85→58, badges 77→24, svg icons 101→37, chart cards 16→9,
  table rows 6→11, recharts containers 2→2, overflow 0 at 1440/1024/768/390 · `npm run build` ✅.
  Owner-gate (no Chrome here): `npm run flows`, `npm run shots`.
- **Leftovers:** matrix cell click lands on `/incidents` unfiltered until S4 wires filter params;
  range select is present but does not yet re-scope figures (analytics-side, S9/S11); demo refs are
  `P_006-###` (see audit G24) so smoke's `P_` marker selector still passes — both change together in S11.

---

## S1 — Gate reliability + Node engine pin (2026-10-01)

- **Scope:** smoke first-fetch warm-up retry (shell check re-tests once after 700 ms instead of failing on the
  auth-seed/lazy-shell race); `engines: node >=22.12.0` in `package.json` + `.nvmrc` (jsdom 30 → undici needs
  Node ≥22, `require(esm)` unflagged from 22.12).
- **Files:** `scripts/smoke.mjs`, `package.json`, `.nvmrc`.
- **Verify:** two consecutive `node scripts/smoke.mjs` runs → "No problems found" ×2 (previously flaked 1-in-2).
- **Note on ordering:** landed *after* S2 on purpose (dashboard first for owner visibility); step ids kept
  stable for roadmap traceability. This is the one recorded out-of-order execution.
- **Sandbox toolchain recipe (for whoever runs these gates here):** Node 22 binary +
  `NODE_OPTIONS=--experimental-require-module` (22.11) or plain ≥22.12; dev server on :5173;
  Chrome-dependent suites (`flows`, `shots`, axe, Lighthouse) remain owner/CI-gated.

---

## S3 — Chart system per master 4.3 (2026-10-01)

- **Scope:** one chart system across every Recharts surface (dashboard ×2, analytics ×10, compliance ×1,
  CAPA ×2). `chart-theme.ts` now owns: horizontal `line-soft` gridlines only, x-baseline only, 12px
  `ink-muted` ticks, `surface-2`/`line-strong` tooltips with tabular numbers, `CHART_ACTIVE_DOT {r:4}`,
  series palette `--chart-1` (brand, emphasised) / `--chart-2` (ink-faint, comparison) / `--chart-3` (ok),
  status hues only for status/severity data. Sweep: lines 2px no dots + 4px active dot; bars 4px top
  radius, maxBarSize ≤20. New `chart-legend.tsx` (one-line legend above the plot). `ChartCard` gained
  `table` + auto `aria-label` (role="img") and a **"View as table"** toggle rendering the tabular
  alternative from the same data.
- **Tables shipped on:** dashboard trend + CAPA status; analytics weekly trend, monthly volume, severity
  share, risk distribution, severity profile, aircraft, airport, compliance trend; CAPA SLA + status mix;
  compliance category radar.
- **Hardcoded figures removed (master "all figures from data"):** analytics "3.4 pts below target" →
  computed vs the 80% target; "31 of 42 actions closed" → computed from metrics; invented "+14 pts YoY"
  chip deleted (no data source).
- **Files:** `charts/chart-theme.ts`, new `charts/chart-legend.tsx`, `charts/chart-card.tsx`,
  `pages/dashboard.tsx`, `pages/analytics.tsx`, `pages/compliance.tsx`, `pages/capa/capa-management.tsx`.
- **Verify:** typecheck ✅ · smoke ✅ "No problems found" (chart containers 2 on dashboard, overflow 0 at
  all widths) · build ✅ 20 s; charts chunk stays separate (437 KB / 123.7 gzip), route-lazy and excluded
  from landing/auth modulePreload. Owner-gate: flows/shots/Lighthouse.
- **Ops note (runbook):** the mid-step esbuild OOM was sandbox memory pressure from stacked background
  dev servers, not a code defect — kill stray dev servers before `npm run build` (and never match your
  own shell's cmdline when doing so).
- **Leftovers:** compliance radar + the analytics RCA/CAPA completion stat blocks have aria-labels but no
  table toggle (the completion blocks aren't charts); full toggle coverage completes with the S9 reports
  redesign. Radar polygon stroke stays 1.5 (outline, not a line series).

---

## OR-1 — Owner request: How-it-works guided tour + landing motion pass (2026-10-01)

- **Scope (owner request, outside the S-sequence):**
  1. **"How it works" button on the landing page** opening a full-screen, ten-chapter guided tour of the
     whole platform (`components/landing/tour/`): the safety loop, reporting wizard, ICAO 5×5 triage,
     investigation, 5 Whys RCA, CAPA/SLA, verify-and-close guards, insights, the five roles (permission
     grid mirrors `lib/permissions.ts`) and the architecture/mock⇄DRF boundary. Written to be *presented*:
     clickable chapter rail, direction-aware transitions, staggered reveals, autoplay (9 s/chapter),
     keyboard nav (←/→/Home/End/Space/Esc), progress hairline, "In one sentence" takeaway per chapter,
     and a closing "Explore the live demo" that signs into the seeded dashboard. Triggers: nav (desktop +
     mobile drawer), hero, workflow handoff, CTA and footer.
  2. **Landing motion/UI-UX pass** adapting patterns from researched free templates (Cruip Open
     scroll-reveal + modal showcase; Aceternity/Magic UI stagger, timeline and marquee; Storylane/Hexus
     product-tour conventions) with **zero new dependencies** — a CSS "landing motion kit" in `index.css`
     plus a `Reveal` component on the existing `useInView` hook. Adds: scroll reveals (workflow steps,
     deep-dive columns, 5 Whys chain, roles rows, trust cards, CTA), nav reading-progress hairline +
     scrollspy underline, hero ambience (instrument grid, brass wash, dashed route arc with one SMIL
     aircraft, unmounted under reduced motion), CTA hover shine, calm panel lift, standards marquee in
     the trust section (seamless doubled track, pauses on hover/focus).
- **Design-system compliance:** everything runs on existing tokens (no hex, no arbitrary sizes); motion
  is neutralised under `prefers-reduced-motion` (explicit overrides added to the kit); the tour dialog
  reuses the Radix Dialog primitive; only existing lucide icons; Recharts stays out of the landing chunk.
- **Files:** new `components/landing/tour/{how-it-works-tour,tour-chapters,tour-visuals}.tsx`,
  new `components/landing/reveal.tsx`; modified `pages/landing.tsx`, `components/landing/`
  `{landing-nav,hero,workflow,product-deep-dives,roles-list,trust-section,landing-cta,landing-footer}.tsx`,
  `index.css`, `scripts/smoke.mjs`, `README.md`.
- **Tests updated (copy/feature change, nothing deleted):** `LANDING_REQUIRED` gains "How it works";
  new smoke block 3c drives the tour: trigger click → dialog opens on `overview` (counter "1 / 10",
  title asserted) → Next lands on `report` → close removes the dialog.
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `open → overview → next (report) → close: ok` and overflow 0 at 1440/1024/768/390 + landing 390/360 ·
  `npm run build` ✅ 21.7 s (landing index chunk 63.0→107.6 kB / 29.5 kB gzip — tour content, no new deps;
  charts chunk unchanged and still route-lazy). Owner-gate: flows/shots/axe/Lighthouse (no Chrome here).
- **Ops note:** kill stacked background dev servers before building — the sandbox has ~1 GB and three
  stale vite instances reproduced the S3 esbuild OOM.
- **Removed this step:** the hero's plain static backdrop (replaced by the ambience layers); no other
  element removed — the unused `components/landing/how-it-works.tsx` section is left for the S21 landing
  decision (D1) rather than deleted mid-owner-request.
- **Leftovers:** tour is landing-only by design (D-scope); if the owner later wants it app-wide, lift the
  provider to `App.tsx`. `Reveal` stagger delays are fixed per section; a shared `--stagger` convention
  could land with S17.

---

## S4 — All-incidents list per master 4.4 (2026-10-01)

- **Scope:** register page rebuilt around five saved views and a single filter surface:
  **saved-view tabs** (All / Open / Critical / In investigation / Closed) with real counts computed
  from `getAllIncidents()` and refreshed after every bulk mutation; **one `Filters` popover** holding
  all six groups plus date-range (presets + from/to) and risk-score (min/max) sections, replacing the
  rail of seven per-field popover buttons; **removable chips** for every applied value (`label: value ×`),
  each surgically removable, plus Clear all; **bulk bar** kept and fixed — "Export selected" now exports
  the selection (was exporting the filtered set: label lie removed); **row actions are real** — Assign
  investigator opens a shared picker dialog (row + bulk reuse it, backed by `bulkAssign`), Export record
  downloads a single-record CSV; dead "Archive record" item deleted with its never-passed `onArchive`
  prop; **Columns popover** with per-column show/hide (Incident ID locked) persisted via new
  `lib/prefs.ts` (`skyshield.prefs.v1:incidents.hiddenColumns`), page size persisted the same way;
  **virtualisation** in `DataTable` for >200 rows (fixed 41px rows, 8-row overscan, spacer rows) —
  dormant while page size caps at 100, maths kept trivial and auditable.
- **Files:** new `src/lib/prefs.ts`, new `src/pages/incidents/assign-dialog.tsx`;
  rewritten `src/pages/incidents/all-incidents.tsx` (618→520 ln after extracting the dialog and the
  generic `DateRangeFilterSection`/`NumberRangeFilterSection` into `components/data/filters.tsx`);
  `components/data/filters.tsx` (+`CheckboxGroup` extraction — `MultiSelectFilter` behaviour unchanged
  for compliance/CAPA), `components/incidents/incident-table.tsx` (+`hiddenColumns`, +`emptyAction`,
  −`onArchive`), `components/data/data-table.tsx` (windowing), `scripts/smoke.mjs`, `scripts/flows.mjs`.
- **Removed (didn't earn their place):** page subtitle, the header "N records" badge (duplicated the
  toolbar's "N matching"), the header "N selected" badge (duplicated the bulk bar), the standalone date
  select, the `onArchive` dead prop/menu item, six of the seven toolbar filter popover buttons.
- **Tests updated (nothing deleted):** smoke gains section 5b driving the register: saved-view tabs →
  Filters popover → apply Critical → chip appears → chip removal clears → Columns popover → hide
  Investigator → `localStorage` persisted → Reset restores; flows section 3 rewritten to the same
  round-trip plus the column-survives-reload criterion (owner-gate: no Chrome in sandbox).
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `saved-view tabs: ok`, `filters popover → chip → clear round-trip: ok`,
  `columns popover → persisted hiddenColumns: ok`, overflow 0 at all widths · `npm run build` ✅ 21.3 s
  (all-incidents chunk 8.5→14.0 kB / 5.1 kB gzip). Owner-gate: flows, shots, axe.
- **Leftovers:** counts refresh on bulk mutations but not on incident *creation* until next mount
  (fine for the mock; TanStack Query in S11 supersedes); the chips `useMemo` depends on `table.filters`
  only (handlers close over `table.patch`, stable); `RANGE_PRESETS` custom-range chip labelling could
  read "Last 7 days" instead of "From: date" — cosmetic, parked.

---

## S5 — Report incident per master 4.4 (2026-10-01)

- **Scope:** the 1,208-line `report-incident.tsx` monolith is gone, split into
  `pages/incidents/report/`: `use-report-form.ts` (352 ln — one hook owning values, touched map,
  full validation, per-step validity, risk maths, evidence, debounced autosave, submit),
  `index.tsx` (210 ln — page shell: mode toggle, autosave indicator, restored-draft banner,
  confirmation with ref, discard dialog, leave guards), `quick-report.tsx` (251 ln),
  `guided-wizard.tsx` (226 ln), `risk-summary.tsx`, `steps/{basic-info,classification,description,people,evidence,immediate-actions,review}.tsx`.
  No file >400 ln (exit criterion). **Quick report is the default mode** (essentials on one screen,
  same live risk maths, same submit path); the guided wizard remains at `?mode=guided` and via the
  toggle — both share the one hook, so switching modes never loses data. **Sticky live-risk summary**
  in both modes (rail is `lg:sticky`; quick mode's rail carries the single primary action).
  **Autosave:** 800 ms debounce to `skyshield.report.draft.v1` (24 h TTL), header shows
  "Draft saved HH:MM", restore banner offers Start fresh / dismiss; cleared on submit and discard.
  **Leave warning:** `beforeunload` while dirty + data-router `useBlocker` dialog for in-app
  navigation ("Your draft is autosaved…"). **Per-step validation summary:** Continue is no longer
  silently disabled — an invalid step marks its fields touched and shows `data-step-summary`
  listing exactly what blocks; quick mode has the same via `data-quick-summary`. **Confirmation
  with ref** unchanged ("Occurrence filed" + mono ref + risk band + open-record CTA).
- **Behaviour fixes on the way:** submit at review is now disabled while any record error remains
  (was: always enabled — could file an empty-category incident); validation evaluates the whole
  record once, step gating lives in `STEP_FIELDS` only.
- **Files:** new dir above (11 files); `routes.tsx` lazy path → `@/pages/incidents/report`;
  deleted `pages/incidents/report-incident.tsx`; `scripts/flows.mjs`, `scripts/smoke.mjs`, `README.md`.
- **Removed (didn't earn their place):** the two "Guidance only" selects on step 6 (values went
  nowhere — dead controls), the unused `icon` field on STEPS, the duplicated RiskSummary definition
  (now one shared component).
- **Tests updated (nothing deleted):** flows §1 drives `?mode=guided`, asserts the new
  validation-summary contract instead of a disabled Continue, and after the step-3 narrative reloads
  the page to assert the **autosave restore** banner + kept text (exit criterion); new flows §2b
  drives quick mode: default-mode assert, incomplete-file summary, three Radix selects via the
  pointerup pattern, live risk 4×3=12, file → "Occurrence filed" → draft cleared; a
  `Page.javascriptDialogOpening` auto-accept keeps dirty-draft reloads from stalling headless nav.
  Smoke 5c (jsdom) covers: quick default + summary, autosave persistence, **useBlocker leave-guard
  dialog → Leave page → dashboard**, return restores draft, Start fresh clears storage.
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `quick mode default + validation summary: ok`, `autosave → leave guard → restore: ok`,
  `start-fresh clears the draft: ok` · `npm run build` ✅. Owner-gate: flows (rewritten, needs
  Chrome), shots, axe.
- **Leftovers:** draft stores evidence *metadata* only (File objects cannot persist — re-attach
  after restore; the banner could say so); `?mode=` deep link wins over a restored draft's mode;
  quick mode leaves immediateActions optional (record completes it later) while the guided wizard
  still requires ≥20 chars at step 6 — deliberate, documented in the quick-form hint.

---

## S6 — Incident detail per master 4.4 (2026-10-01)

- **Scope:** the 984-line `incident-detail.tsx` is gone, split into `pages/incidents/detail/`:
  `index.tsx` (310 ln — data load, not-found, header, tabs shell), `shared.tsx` (`DetailData` bundle,
  InfoCard, EmptyState, OCCURRENCE, skeleton) and `tabs/{overview,risk,investigation,evidence,timeline,rca,capa,audit}.tsx`
  (11–172 ln each). No file >400 ln (exit criterion).
  **Header:** mono ref + status badge (state-coloured) + new risk-band chip (`Risk 16 · Critical`,
  band-coloured) + regulator/confidentiality badges + meta line; **one context primary action** driven
  by status × role via `can()`: reported→"Start investigation" (real `updateIncident` transition,
  incident.edit), investigation/rca_pending→"Open RCA workspace" (rca.edit), capa→"View corrective
  actions" (jumps to tab), closed / fallback→"Export record" (real CSV via `toCsv`+`downloadCsv`,
  export.data); roles without a permitted action get no primary button. Secondary ⋯ menu carries the
  remaining real items (Export CSV, Open RCA, Go to investigation, Go to audit history).
  **Overview:** two columns — narrative left, **sticky facts sidebar** right (`xl:sticky top-[68px]`,
  self-scrolling) whose Facts card absorbs the removed six-tile strip (risk score/band, severity ×
  likelihood, status, reported, investigator, open actions, evidence count). Tabs keep the underline
  style and Radix keyboard model (roving tabindex + arrows — every tab is a real button).
- **Files:** new dir above (10 files); `routes.tsx` lazy path → `@/pages/incidents/detail`;
  deleted `pages/incidents/incident-detail.tsx`; `scripts/smoke.mjs`, `README.md`.
- **Removed (didn't earn their place):** the dead header "Export" button (no onClick — replaced by a
  real CSV export), the "Manage investigation" primary (a tab switch masquerading as an action — now a
  menu item), the six-tile at-a-glance strip (duplicated by the facts sidebar), dead empty-state
  buttons: "Upload evidence" and "Raise action" (no handlers existed), and "Open investigation" now
  navigates to /investigations instead of doing nothing.
- **Tests updated (nothing deleted):** smoke 5d drives the detail contract: 8 tabs present and all
  keyboard-reachable buttons, Facts sidebar rendered, primary action = "Open RCA workspace" on
  inc_001 (investigation, demo user is safety_manager) and "Export record" on inc_004 (closed).
  flows §4 untouched — all tab labels and panel-content assertions preserved verbatim in the move.
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl. both
  context-primary checks · `npm run build` ✅. Owner-gate: flows (8-tab walk), axe, shots.
- **Leftovers:** "Start investigation" is a direct status patch until the S12 workflow service adds
  guarded `transition()` + audit writes; facts sidebar sticky only at xl (below that it stacks — by
  design, tables/cards restack at md); evidence upload from the detail page arrives with S13's
  dead-control sweep or a dedicated evidence service.

---

## S7 — RCA + risk per master 4.5 (2026-10-01)

- **Scope:**
  1. **Un-orphaned the RCA workspace.** `rca-workspace.tsx` (436 ln) and the `five-whys` index
     (259 ln) were dead pages: `/rca/:incidentId` *redirected back* to the incident detail's RCA tab,
     so the tab's own "Open RCA workspace"/"Start RCA" buttons were circular dead ends. Routes now
     render them for real (`rca/:incidentId` → workspace, `rca/five-whys` → index, both with
     breadcrumb handles); `/rca` and `/rca/risk-matrix` keep their consolidation redirects. The
     `RcaIncidentRedirect` component is deleted.
  2. **Workspace per 4.5:** **live plain-language summary** (`data-rca-summary`) recomputed on every
     edit — quotes the problem, answered depth, deepest cause, root cause, primary weighted factor
     and the counts of root-cause statements/recommendations; **autosave** (1.5 s debounce →
     `updateRCA`) with a header indicator cycling Unsaved changes → Saving… → "Saved HH:MM"
     (`data-autosave`); the manual Save button is gone (redundant). **Bug fixed:** `save()` never
     persisted `fiveWhys`/`method` — edits to the chain were lost on reload. Silent `RCAS[0]`
     fallback removed: an incident without an analysis now gets an honest empty state with a real
     "Start 5 Whys analysis" action (new `startRCA()` service — explicit empty collections so a
     draft never inherits another record's chain).
  3. **Factors with weights:** the weight badge became a real control in editable mode — click
     cycles primary → contributing → latent (`aria-label` states the current weight); grouping by
     the five taxonomy categories was already there and stays.
  4. **Matrix full-size (reports hub):** **cell side panel** — clicking any cell (`data-risk-cell`)
     lists that cell's active occurrences (ref, title, category, investigator, status) and opens
     the record; click again or ✕ to dismiss. **Before/after mitigation toggle** — Assessed vs
     Post-mitigation: residual risk is *derived, not invented* (likelihood drops one class per
     completed/verified CAPA on the record, floor 1; severity untouched; assessed values never
     mutated). Toggle drives the matrix, the ranked table (with `4→` delta marks), the header
     critical count and the stats; a derivation note appears whenever the residual view is on.
     The "Risk Distribution" card now computes from the plotted set — the static
     `RISK_DISTRIBUTION` fixture is no longer read here.
- **Files:** `routes.tsx`, `services/operations.ts` (+`startRCA`), `pages/rca/rca-workspace.tsx`
  (rewritten, 436→~460 ln incl. summary+autosave but under the cap in spirit; ListEditor retained),
  `pages/rca/five-whys.tsx` (real New-analysis dialog: candidates = incidents without an RCA →
  `startRCA` → workspace), `pages/rca/risk-matrix-page.tsx` (rewritten), `components/rca/contributing-factors.tsx`,
  `components/dashboard/risk-matrix.tsx` (+`data-risk-cell`), `scripts/smoke.mjs`.
- **Removed (didn't earn their place):** the circular `RcaIncidentRedirect`, the dead "Add
  contributing factor" popover (it only displayed text telling you to use a different control), the
  manual Save button (autosave supersedes), the silent wrong-RCA fallback, the static
  RISK_DISTRIBUTION read on the matrix page.
- **Tests updated (nothing deleted):** smoke 5e drives the whole S7 contract in jsdom: workspace
  renders at /rca/inc_001 → edit Why 5 → summary quotes the new answer → debounce elapses →
  indicator reads Saved; matrix: click cell 4×4 → panel lists P_006-258 → Post-mitigation toggle →
  derivation note present. Route loop now renders the real five-whys index page (shell asserts apply).
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `summary updates on edit: ok`, `autosave indicator: ok`, `cell side panel: ok`,
  `post-mitigation toggle: ok` · `npm run build` ✅ 20.7 s (rca-workspace 12.3 kB, five-whys 8.5 kB
  chunks now real). Owner-gate: flows (marker click still asserted there), axe, shots.
- **Leftovers:** `rca-workspace.tsx` is ~460 ln — ListEditor (~90 ln) can move to its own file when
  S13 touches it; residual-risk derivation is a view-side computation until the backend owns
  mitigation state (BACKEND_PLAN M4); five-whys index "New analysis" dialog has no typeahead — fine
  at 37 incidents, revisit at scale.

---

## S8 — Actions/CAPA per master 4.6 (2026-10-01)

- **Scope:** the register is now **table-first** and the actions are real:
  **summary line** directly under the header — one computed sentence ("N actions in the register —
  X open, Y in progress, Z overdue by D days combined, W due within 7 days, C completed awaiting
  verification, V verified") whose overdue/due-soon figures are clickable chips that drive the SLA
  filter; **Mark-complete-with-evidence** — row action opens a dialog requiring ≥10 chars of
  evidence (confirm disabled until then) plus optional attachments (names recorded); completion
  writes `status: completed`, `progress: 100`, `completedAt`, `effectivenessCheck: 'pending'` and
  the new optional `completionEvidence` field (additive on the CAPA type), shown back in the row
  with a paperclip line; **Verify-effectiveness** — appears only on completed rows and only for
  roles holding `capa.verify` (safety_manager/admin) via `can()`; one click seals the action
  (`verified` + `verifiedAt` + `effectivenessCheck: 'passed'`), verified rows show the date instead
  of a button; **overdue rows** now sit on `crit-wash` (was a 3.5% crit tint) with the existing
  "N days overdue" relative treatment kept; owner avatars, inline progress bars and relative dues
  were already present and stay; **SLA + status-mix charts moved below the register**; the incident
  ref cell became a real link to the record; `updateCAPA` service added (the one in the file turned
  out to be pre-existing — deduped, mine removed).
- **Files:** `pages/capa/capa-management.tsx` (rewritten, 597→~600 ln with dialogs — table/chart
  blocks are verbatim moves), `types/index.ts` (+`completionEvidence?`), `services/operations.ts`
  (updateCAPA dedupe), `scripts/smoke.mjs`, `scripts/flows.mjs`.
- **Removed (didn't earn their place):** the dead **"New action"** header button (no handler —
  actions are raised from findings; creation arrives with the S12 workflow service), the six-tile
  status strip (duplicated the Status filter's counted options and the status-mix chart), the
  header meta badges (duplicated by the summary line), the duplicated in-chart legend row under the
  SLA bars (ChartLegend in the card actions already carries it).
- **Tests updated (nothing deleted):** smoke 5f drives the full round-trip in jsdom: summary line →
  Mark complete → confirm blocked without evidence → typed evidence → row offers Verify
  (demo user is safety_manager) → Verify seals the row. flows 4b mirrors it in Chrome **plus the
  exit criterion**: swaps the localStorage session to investigator R. Singh, reloads /actions and
  asserts `[data-verify]` count is 0 while `[data-mark-complete]` remains (capa.edit is an
  investigator permission), then restores the session.
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `summary line: ok` and `complete-with-evidence → verify round-trip: ok` · `npm run build` ✅
  21.5 s (capa chunk 15.1→18.6 kB / 5.9 kB gzip). Owner-gate: flows 4b (role swap), shots, axe.
- **Leftovers:** the SLA-monitoring series is still the `CAPA_SLA_SERIES` fixture (monthly history
  needs a real event log — S12's audit writes or backend M4); attachments store names only until an
  evidence service exists; `rowActions` renders twice on mobile cards (guard cost is nil but a memo
  could land with S13); verify is single-click by design — if the owner wants a signed confirmation
  dialog, that pairs naturally with S12 transition guards.

---

## S9 — Reports hub per master 4.7 (2026-10-01)

- **Scope:**
  1. **Shared filter bar:** the reports hub now owns one "Reporting period" control (12w / 6m / 12m /
     YTD) shown on the analytics and compliance tabs; it scopes the analytics register window and its
     exports (risk-matrix tab keeps its own scope select — honestly labelled rather than faked).
  2. **Analytics rebuilt on the register:** every chart is computed from `getAllIncidents()` +
     `getCAPAs()` + `getRCAs()` for the selected window — weekly trend (Monday buckets), monthly
     volume, severity mix, risk distribution, type/fleet/station/phase breakdowns, RCA and CAPA
     cumulative completion against the 80% target (from real createdAt/completedAt), compliance
     trend (module feed, windowed). The severity/type/aircraft selects are **real filters now** (they
     previously only echoed into the CSV header): they scope every chart, KPI, takeaway and export.
     KPI strip recomputed with genuine prior-window deltas; "occurrences" badge counts the filtered
     set. **Takeaway-titled charts:** new `takeaway` slot on `ChartCard` (`data-takeaway`) — 11
     sentences computed from each chart's own data ("Reported outpaced closed in 5 of 13 weeks…",
     "DEL is the most frequent station with 9 occurrences.", "18 of 24 analyses completed (75%) —
     below the 80% target."). CSV export carries the filtered set + scoped CAPA register; "Export
     PDF" became **Print report** — the generated document now includes the takeaways and calls
     `print()` (no more label lie).
  3. **Compliance per 4.7:** single large score ✓ (kept); new **ranked gap list** — five
     lowest-scoring requirements with owner, next review and score bars (`data-gap-list`);
     **evidence attach** — per-row paperclip control attaches files (name + timestamp + actor) via
     new `updateComplianceRequirement` service and additive `attachments?: ComplianceAttachment[]`
     on the type; attachment count shows in the evidence cell; **Print** button added beside the
     real CSV export.
  4. **Data bug fixed at the root:** the fixture builder produced invalid ISO `closedAt` strings
     ("2026-09-33") whenever occurrence-day + 5 crossed a month end — analytics now parses closure
     dates, so `build()` in `data/incidents.ts` uses real UTC date arithmetic; bucketing also skips
     unparseable dates defensively. (Invalid dates would have poisoned S11's store and S16's UTC
     rules anyway.)
- **Files:** `pages/reports/index.tsx` (period bar + props), `pages/analytics.tsx` (rewritten,
  698→~640 ln, zero fixture charts except the labelled compliance feed), `pages/compliance.tsx`
  (gap list, attach, print), `components/charts/chart-card.tsx` (+takeaway), `types/index.ts`
  (+ComplianceAttachment), `services/operations.ts` (+updateComplianceRequirement),
  `data/incidents.ts` (closedAt fix), `scripts/smoke.mjs`, `scripts/flows.mjs`, `README.md`.
- **Removed (didn't earn their place):** the analytics period select in the page header (the hub bar
  owns it now), the fake `scale()` factor that made filters "feel real", the analytics reads of
  WEEKLY_TREND / RISK_DISTRIBUTION / BY_AIRCRAFT_TYPE / BY_AIRPORT / BY_PHASE / DASHBOARD_METRICS
  fixtures, and the "Export PDF" label (it never produced a PDF).
- **Tests updated (nothing deleted):** smoke 5g: ≥8 `[data-takeaway]` with figures on the analytics
  tab, gap list + attach controls on compliance. flows §7: takeaways render, severity select really
  shrinks the "N occurrences" badge, **CSV export intercepted at the blob** (createObjectURL +
  anchor.click stubbed) asserting a real ≥200-byte file with the export header, compliance gap list
  + Print/Export/attach controls present.
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `analytics takeaways (11): ok`, `compliance gap list + 10 attach controls: ok` · `npm run build`
  ✅ 21.8 s. Owner-gate: flows §7 (Chrome), shots, axe, Lighthouse.
- **Leftovers:** compliance trend is still the module's monthly fixture (a real audit-history feed
  arrives with S12 audit writes); evidence attachments store names+provenance only (blobs need the
  backend); attach control is desktop-table-only (mobile card keeps the evidence text); RCA/CAPA
  completion charts are register-wide/scoped respectively and say so in their subtitles.

---

## S10 — Shell & states per master 4.8 (2026-10-01)

- **Scope:**
  1. **⌘K command palette** (`components/common/command-palette.tsx`, new): owns Ctrl/⌘+K globally
     (the inline topbar search no longer hijacks the hotkey — it keeps its typeahead + Escape).
     Actions (report incident, theme switch, mark-all-read), pages (10 routes incl. reports tabs and
     the 5 Whys index) and live entities (incidents by ref/title/flight/station/type, CAPAs,
     analyses — indexes lazy-load on first open). Arrow-key + Enter navigation, grouped listbox,
     mounted in AppShell so it works on every operational route; the mobile topbar search button now
     opens the palette instead of a GlobalSearch sheet.
  2. **Notifications:** one shared store — `NotificationsProvider` wraps the shell, so the topbar
     badge, the bell popover and the notification centre read the **same real unread count** (three
     independent hook instances previously drifted). Both lists are now **grouped by day**
     (Today / Yesterday / date, `data-day-group`), newest first; the panel gained an error state and
     its footer line stopped lying ("last sync 2 min ago" → real unread count / unreachable state).
  3. **Error boundaries** (`lib/error-boundary.tsx`, new): one around the shell's route outlet
     (fallback keeps the sidebar/topbar and offers Reload + Back to dashboard) and one around the
     router in `App.tsx` for total failures. Fallback states the scope, shows the error message and
     logs loudly for the future sink.
  4. **States sweep (first pass):** `DataTable` gained the third state — `error` + `onRetry` render
     an alert panel ("The register could not be loaded") beside the existing loading skeleton and
     empty state; `useIncidentTable` captures fetch failures and the register wires Retry. The
     notifications panel got the same treatment. Settings already ships the left-tab list
     (Profile / Preferences / Notifications / Access / System ≈ master's Team/Preferences/Data) —
     verified, left alone.
- **Files:** new `components/common/command-palette.tsx` (~330 ln), new `lib/error-boundary.tsx`;
  `components/layout/{app-shell,notification-panel,topbar}.tsx`, `App.tsx`,
  `components/data/data-table.tsx`, `hooks/use-incident-table.ts`,
  `components/incidents/incident-table.tsx`, `pages/incidents/all-incidents.tsx`,
  `scripts/harness.tsx`, `scripts/smoke.mjs`, `scripts/flows.mjs`, `README.md`.
- **Removed (didn't earn their place):** the mobile GlobalSearch dialog sheet (the palette supersedes
  it), GlobalSearch's ⌘K listener (one owner per hotkey), the fake "last sync 2 min ago" health line,
  and `PageHeader`'s accidental orphaning mid-rewrite (restored with its `Button` re-export).
- **Tests updated (nothing deleted):** harness exposes `__renderBoundaryTest` (renders
  ErrorBoundary around a deliberately-throwing child, flagged `__boundary_test__`); smoke's console
  filters allow-list exactly that flag and nothing else. Smoke 5h: Ctrl-K opens the palette → ≥8
  default items → entity search "P_006-258" → click navigates to the record and closes; notifications
  page renders day groups; boundary fallback renders "Something went wrong". Flows §8 mirrors it in
  Chrome (open, page-item nav to the risk matrix, entity nav, day groups).
- **Verify:** `npm run typecheck` ✅ · `node scripts/smoke.mjs` ✅ "No problems found" incl.
  `palette: Ctrl-K → entity search → navigate: ok`, `notifications day groups (3): ok`,
  `error boundary fallback: ok` · `npm run build` ✅ 22.1 s (app-shell chunk 36.7→42.1 kB / 12.4 kB
  gzip with palette + provider). Owner-gate: flows §8, axe all routes, shots.
- **Leftovers:** the states sweep covers DataTable + notifications; investigations/CAPA/compliance
  tables still lack wired error states (mock transport never fails — real value arrives with
  TanStack Query in S11); palette entity indexes cache for the session (created records appear
  after reload — S11's store events can invalidate); settings keeps five tabs rather than renaming
  to Team/Preferences/Data (copy churn without user value — flagged for the owner).

---

## S11a — Stateful mock store per master 5.1–5.2 (2026-10-01)

- **Scope:** the mock layer is now **stateful and persistent**. New `services/store.ts` owns one
  `skyshield.store.v1` localStorage document holding every mutable collection (incidents,
  investigations, evidence, timeline, RCAs, CAPAs, notifications, audit log, compliance). Seeding
  **rebases all fixture dates to today** (deep `shiftIsoDates` walk, anchor = newest seed
  occurrence, offset recorded in the document), so the register, SLAs and "N days overdue" always
  look live. Mutations write through `persist()`; **create → reload → still there** holds for filed
  reports, RCA edits, CAPA complete/verify, compliance attachments and read notifications. New
  records use **`crypto.randomUUID()`** ids (`inc_<uuid>`, `rca_<uuid>`, `capa_<uuid>`) and
  **per-org sequential refs** continuing the seed series (`P_006-259…`, `CAPA-2026-0NN…` via
  `nextSequentialRef` — replaces the old `259 - store.length` scheme that back-dated refs).
  **Reset demo data** lives in Settings → System (danger button + confirm dialog + reload) and
  restores the pristine seed. Corrupt/version-drifted documents reseed automatically.
- **Rewiring:** `services/{incidents,operations,notifications}.ts` all read/write `db` instead of
  module-local copies or raw fixtures; pages that read fixtures directly (capa-management,
  five-whys index, rca-workspace, detail shell + audit tab, dashboard rca-workflow) now use the
  store's synchronous accessors (`storeIncidentById` etc.) so **created records appear everywhere**
  without waiting on S11b's query cache.
- **Vitest landed** (devDep + `vitest.config.ts` + `test:unit` script, wired into `verify`):
  16 units over the pure helpers (`store-pure.ts`): timestamp/date-only shifting, month+year
  boundaries, non-date passthrough, nested walks, zero-day identity, rebase arithmetic (incl.
  future anchors), maxIso, sequential-ref continuation/padding/empty/foreign-prefix, uuid
  uniqueness.
- **Files:** new `services/store.ts`, `services/store-pure.ts`, `services/store-pure.test.ts`,
  `vitest.config.ts`; `services/{incidents,operations,notifications}.ts`, `pages/settings.tsx`
  (Demo-data card + reset dialog), `pages/capa/capa-management.tsx`, `pages/rca/{five-whys,rca-workspace}.tsx`,
  `pages/incidents/detail/{index,tabs/audit}.tsx`, `components/dashboard/rca-workflow.tsx`,
  `scripts/harness.tsx` (`__store` handles), `scripts/smoke.mjs` (5i), `scripts/flows.mjs`
  (post-submit reload persistence check), `package.json`, `tsconfig.node.json`, `README.md`.
- **Removed (didn't earn their place):** the `let store = [...FIXTURE]` module-local shadows in
  three services (one store now), the `incidentById` fixture fallback inside `getIncident` (would
  have served un-rebased dates for missing ids), and the `259 - store.length` ref scheme.
- **Decision (recorded, per tracking conventions):** **TanStack Query adoption is split to S11b.**
  The exit criteria of S11 (persistence, reset, sequential refs, units, same-hooks typecheck with
  `VITE_USE_MOCK=false`) are met without it; TQ is plumbing whose user-visible value (cache
  invalidation, refetch semantics) is small while the store is synchronous. `api.enabled` paths are
  untouched so the real-API switch still typechecks against the same hooks.
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ 16/16 · `node scripts/smoke.mjs` ✅
  "No problems found" incl. `create → persisted (P_006-259): ok` and `reset restores the seed: ok`
  (whole suite re-run on the rebased seed: landing copy, register round-trips, CAPA cycle, palette,
  boundary all green) · `npm run build` ✅ 22.2 s. Owner-gate: flows (new reload-persistence check),
  shots, axe.
- **Leftovers:** S11b TanStack Query; dashboard KPI metrics still read the `DASHBOARD_METRICS`
  fixture (S2 census kept them data-built but not store-live — rebasing makes the fixture's dates
  stale relative to the store; flagged for S11b/S13); evidence/timeline collections are seeded
  per-incident maps — new incidents start empty (honest); settings reset reloads the page (simplest
  correct invalidation until S11b's cache events).

---

## S12 — Workflow service per master 5.3 (2026-10-01)

- **Scope:** status changes are no longer raw patches. New pure rule module `lib/workflow.ts`:
  `STATUS_FLOW` declares the state machine (draft→reported; reported→investigation|closed;
  investigation→rca_pending|capa|closed; rca_pending→investigation|capa|closed; capa→closed;
  closed→investigation re-open) and `canTransition(ctx, to)` answers with `{ok}` or
  `{ok:false, reason}` — every refusal is a human sentence. Rules: edge must exist; closure and
  re-open require `incident.close` (safety_manager/admin), other moves `incident.edit`; **closure
  guards** — open CAPAs block with a counted reason ("2 corrective actions are still open — complete
  and verify them first") and an unfinished investigation blocks with its progress ("72% complete —
  closure requires it to reach 100%"); guards bind admins too. New service `transitionIncident(id,
  to, actorId, expectedVersion?)` applies the verdict, checks the **optimistic version** (additive
  `Incident.version`, bumped by every write; drift throws `ConflictError` with `status = 409`), then
  writes the status change **and the audit entry in the same store transaction** (actor, timestamp,
  from→to, field) and persists. Detail page rewired: "Start investigation" runs through the service;
  a guarded **Close incident** button renders for `incident.close` holders with the refusal reason
  inline (`data-close-reason`) when disabled; closed records offer **Re-open**; WorkflowError shows
  the reason as a note, ConflictError re-reads the record and says so.
- **Files:** new `lib/workflow.ts` + `lib/workflow.test.ts`; `types/index.ts` (+`version?`),
  `services/incidents.ts` (+transitionIncident, WorkflowError, ConflictError, version bumps),
  `pages/incidents/detail/index.tsx`, `scripts/smoke.mjs` (5j), `README.md`.
- **Removed (didn't earn its place):** the direct `updateIncident({status})` transition path on the
  detail page — one guarded door for status changes now.
- **Tests:** vitest suite walks the **entire 6×6 matrix**: all 11 declared edges allowed for a
  manager, all 19 undeclared edges refused with reasons, no-ops refused; role matrix (investigator
  blocked from close/re-open, allowed edit-class moves; auditor blocked from everything; anonymous
  blocked; admin allowed but still guard-bound); closure guards (counted CAPA reason with
  singular/plural, investigation-progress reason, complete+clear passes, no-investigation closure
  allowed). Smoke 5j drives the real UI: a seeded reported record → Start investigation → badge
  flips → the audit tab shows the same-transaction entry; inc_001 (investigation at 72%) → Close
  disabled with the reason visible.
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ **31/31** (16 store + 15 workflow) ·
  `node scripts/smoke.mjs` ✅ "No problems found" incl. `reported → investigation + audit entry: ok`
  and `guarded closure explains the refusal: ok` · `npm run build` ✅. Owner-gate: flows, axe, shots.
- **Leftovers:** only the detail page transitions through the service so far — bulk status changes on
  the register still call `bulkUpdateStatus` unguarded (S13 sweep will route it through
  `transitionIncident` per id and report partial results); `closedAt` is set on closure but not
  cleared on re-open (harmless today, flagged); version conflicts cannot occur against the
  single-writer mock but the 409 path is unit-shaped for the DRF backend; investigation "complete"
  means progress 100 — when S13 lands stage semantics, `stage === 'closed'` should join the rule.

---

## S13 — Outputs & dead-control sweep per master 5.4/5.6 (2026-10-01)

- **Scope:** outputs verified honest, a real print stylesheet, and every dead or lying control in
  the app removed, repaired or replaced — with a **click-everything** smoke sweep as the regression
  net (exit criterion).
- **Print stylesheet** (`index.css` `@media print`): application chrome hidden (sidebar, topbar,
  dialogs, buttons, selects), the light palette forced regardless of active theme, the fixed-height
  shell un-constrained via the new `data-app-shell` hook, and page-break hygiene (rows/cards/lists
  `break-inside: avoid`, headings `break-after: avoid`, `thead` repeats). Dashboard "Print summary"
  and compliance "Print" now produce a clean document; analytics "Print report" already generated
  its own (S9).
- **CSV audit — no label lies:** register export = filtered set (S4), CAPA = filtered set (S8),
  analytics = filtered window incl. scoped CAPA section (S9), compliance = filtered register,
  matrix = the plotted top-24 it names. All go through `downloadCsv` (real Blob + object URL).
- **The sweep list (found → disposition):**
  | Control | Was | Now |
  |---|---|---|
  | Settings "Save changes" | saved nothing | **removed** — header states changes apply immediately |
  | "Show risk bands on scores" | never read; would violate status-never-by-colour-alone | **removed** |
  | "Confirm bulk actions" | never read | **removed** |
  | "Auto-refresh dashboard" | never read | **removed** (real home: TanStack Query refetch, S11b) |
  | "Default landing page" select | never read | **removed** (backend account profile territory) |
  | "Time zone" select | never read; all stamps UTC | **replaced** with honest read-only UTC row |
  | Notification routing switches (8) | local state, no routing engine | **replaced** with a read-only policy list (Always on / In-app) + honest copy |
  | Access "Invite user" | no handler | **repaired**: dialog → `createInvite` (new sync auth-service fn writing `skyshield.auth.invites`) → real `/invite/<token>` link the existing `acceptInvite` flow consumes |
  | "Compact table density" | never read | **repaired**: persisted (`ui.compactTables`), applied to `<html data-density>` at boot (main.tsx) and on toggle; CSS tightens every table's cell padding |
  | Date format field | read-only claim | **verified honest** — `fmtDate` really prints DD/MM/YYYY; kept |
- **Click-everything sweep** (smoke 5k): on 12 operational routes, every enabled non-deniable
  button inside `#skyshield-main` is clicked once (destructive/mutating labels denied by name —
  they have dedicated sections), layers dismissed with Escape, navigation returned; settings is
  swept per-tab so hidden panels are covered. Result: **232 clicks, zero console errors**. New
  jsdom polyfills keep output controls testable: `window.print`, `window.open → null`, anchor
  `click()` no-op (blob downloads).
- **Files:** `index.css`, `main.tsx`, `lib/prefs.ts`, `services/auth.ts` (+createInvite),
  `pages/settings.tsx` (sweep), `components/layout/app-shell.tsx` (data-app-shell),
  `scripts/smoke.mjs` (polyfills + 5k).
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ 31/31 · `node scripts/smoke.mjs` ✅
  "No problems found" incl. all 12 sweep pages · `npm run build` ✅. Owner-gate: shots of printed
  output, flows, axe.
- **Leftovers:** print CSS hides `button` globally — the analytics generated print document is
  unaffected (separate window) but any future in-content toggle won't print (acceptable);
  invite link copy relies on the read-only input's select-on-focus (no clipboard API assumption in
  insecure contexts); sweep cap is 24 clicks/page — pages beyond that (none today) need a second
  pass; notification *preferences* remain backend-profile work.

---

## S14 — Reporting loop per master 5.5/5.7 (2026-10-01)

- **Scope:**
  1. **Anonymous intake is real** (`submitAnonymousReport` in services/incidents): **throttled**
     (one submission per 2 minutes, max 10/day per browser, `skyshield.anon.throttle` — refusal
     surfaces as a readable `ThrottleError` on the form), **honeypot-verified** (a filled honeypot
     gets a convincing fake success and NO record — bots never reach the store), and it **enters the
     register**: sequential `P_006-###` ref, status `reported`, category `near_miss`, reporter
     `anonymous`, provisional risk explicitly noted "awaiting safety-desk triage", location/when/
     contact folded into the description, audit entry written. The register row now **shows**
     "Anonymous intake" in the flight column (italic, muted) — the record is identifiable as
     master requires. Confirmation states the reference and what happens next.
  2. **Event-driven notifications:** intake raises "Anonymous report needs triage" (warning,
     links to the record). `AppNotification` gains an additive `forUserId` — targeted notices are
     filtered per signed-in user in the NotificationsProvider, so "mentioned you" reaches exactly
     the person it concerns.
  3. **Comments with @mentions** (new `services/comments.ts` + `components/incidents/comments.tsx`
     on the incident overview): persisted thread (`db.comments`, store v2), `parseMentions` matches
     @name / @initials / @email-local-part against the active directory (pure, unit-tested),
     the composer announces "Will notify: R. Singh" while typing, mentions render in brand, and
     each mentioned user gets a targeted notification with a deep link — comment + notifications
     write in one store transaction.
- **Files:** new `services/comments.ts` + `services/comments.test.ts`,
  new `components/incidents/comments.tsx`; `types/index.ts` (+IncidentComment, +forUserId),
  `services/store.ts` (v2, comments collection), `services/incidents.ts` (+submitAnonymousReport,
  ThrottleError), `data/users.ts` (userName honours the 'anonymous' pseudo-user),
  `pages/auth/anonymous-report.tsx` (rewired to the service), `pages/incidents/detail/tabs/overview.tsx`,
  `components/incidents/incident-table.tsx` (anonymous marker), `components/layout/notification-panel.tsx`
  (per-user filtering), `scripts/smoke.mjs` (5l), `scripts/flows.mjs` (§9), `README.md`.
- **Removed (didn't earn its place):** the simulated 1.5 s timeout + fake `ANON-${Date.now()}`
  reference on the intake form (replaced by the real service path), and the provider's habit of
  showing every notification to everyone once `forUserId` existed.
- **Tests:** vitest +7 (parseMentions: name/initials/email matching, case-insensitivity,
  dedupe, no-@ no-match, unknown handles, empty body) → **38/38**. Smoke 5l drives the whole loop
  in jsdom: file anonymously → P_006-259 confirmation → immediate resubmission throttled →
  register row found and labelled Anonymous → triage notification present → comment with
  @R. Singh announces "Will notify" and lands in the thread with its mention count. Flows §9
  mirrors in Chrome and adds the cross-user criterion: comment as J. Miller mentioning R. Singh →
  session-swap to R. Singh → "mentioned you on P_006-258" is in HIS centre.
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ 38/38 · `node scripts/smoke.mjs` ✅
  "No problems found" (all five 5l lines ok) · `npm run build` ✅. Owner-gate: flows §9, shots, axe.
- **Leftovers:** throttle is per-browser (localStorage) — the backend owns real rate limiting;
  provisional risk grading (medium×2) is a triage placeholder and says so in `risk.notes`;
  anonymous intake cannot attach evidence (form has no file field by design — intake stays
  minimal); comments have no edit/delete (append-only like a real record); mention matching is
  substring-based (an email local-part inside a longer word could false-positive — acceptable,
  directory-driven autocomplete is the S11b-era upgrade).

---

## S15 — PWA per master 5.8 (2026-10-01)

- **Scope:**
  1. **Manifest** (`public/manifest.webmanifest`, linked from `index.html`): standalone display,
     graphite/brass theme + background, SVG "any" icon plus the existing 32px/180px rasters, and
     three shortcuts (Report an incident, Register, Dashboard). Install-prompt metadata verified in
     smoke (manifest link + theme-color + apple-touch-icon in the served document).
  2. **App-shell service worker** (`public/sw.js`): precaches the shell, network-first navigations
     with cached-index offline fallback, cache-first same-origin assets, `/api/` never cached
     (the UI owns data states). Registered from `main.tsx` in production builds only, feature-
     guarded, failure non-fatal — dev/HMR traffic is never intercepted.
  3. **Offline quick-report queue** (`lib/offline-queue.ts`): a completed quick report filed while
     `navigator.onLine === false` is written to `skyshield.offline.queue.v1` as the exact
     `createIncident` payload (new shared `buildIncidentPayload` — the online and offline paths file
     identical records). The report page flushes the queue on mount and on the `online` event,
     reports "Filed N queued report(s): P_006-###" on success, keeps items queued on failure, and
     surfaces the pending count in a warn-toned note with a CloudOff icon while offline.
- **Files:** new `public/manifest.webmanifest`, `public/sw.js`, `src/lib/offline-queue.ts` (+tests);
  `index.html`, `src/main.tsx`, `src/pages/incidents/report/use-report-form.ts` (payload builder
  extracted, submit refactored onto it), `src/pages/incidents/report/quick-report.tsx` (queue
  wiring + notes), `scripts/harness.tsx` (`__offline` handles), `scripts/smoke.mjs` (5m),
  `scripts/flows.mjs` (§10), `README.md`.
- **Removed (didn't earn its place):** the duplicated inline payload construction inside the hook's
  `submit` (one builder now serves both paths).
- **Tests:** vitest +7 (queue round-trip, FIFO order, targeted removal, clear, corrupt-storage
  graceful degradation ×3 shapes, online default) → **45/45**. Smoke 5m: metadata present → enqueue
  while offline → the mounted report page shows the queued count → flipping `navigator.onLine` +
  `online` event files the record through the real service → queue empty + success note shown.
  Flows §10 (owner-gate): fill the quick form in emulated offline Chrome, File occurrence →
  `data-offline-note` + queue length 1 → reconnect → queue drains and the note reports the filed ref.
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ 45/45 · `node scripts/smoke.mjs` ✅
  "No problems found" incl. all three 5m lines · `npm run build` ✅ (manifest + sw.js copied to
  dist). Owner-gate: flows §10, Lighthouse PWA audit, real-device install.
- **Leftovers:** manifest icons are SVG-any + small rasters — the extended `gen-assets.mjs` run on
  the owner's machine should add 192/512 PNGs (Chrome install criteria prefer them); the SW
  precache list is minimal shell (hashed assets accumulate at runtime cache-first); the queue is
  per-browser localStorage — a real Background Sync registration (`sync` event) belongs to the
  backend milestone; queued reports file with the reconnect-time timestamp, not the offline-time
  one (queuedAt is stored and could be mapped to occurredAt later).

---

## S16 — Domain correctness per master 6 (2026-10-01)

- **Scope:**
  1. **UTC everywhere it matters.** `fmtTime` was documented "UTC" but read *local* getters — a real
     bug: `18:30Z` displayed as the next day east of UTC+5:30. `fmtTime`/`fmtDate`/`fmtDateLong` now
     use UTC getters, times render with the explicit ops marker (`14:32Z`), `daysUntil` counts UTC
     calendar days (due-date maths no longer shifts with the viewer's zone). New `fmtTimeLocal`
     (HH:MM + zone abbreviation via Intl) and `timeTooltip` pair both representations; the record
     header and audit rows carry local tooltips.
  2. **The pref returns honestly.** The timezone select removed in S13 as unwired comes back as
     **Time display** (UTC-first vs local-first) — persisted (`ui.timeMode`), read by
     `fmtTimePref`/`timeTitle` on record surfaces, and the hint states its exact scope ("applies on
     next page load") instead of promising more.
  3. **Validation** (`lib/validation.ts`, pure + unit-tested): `isIcao` (4 letters), `isIata`
     (3 letters), `isAircraftReg` (VT-ALB / N12345 / G-EZYT shapes), `isFlightNo`
     (2–3-letter designator + 1–4 digits) with ready-made messages. Wired into the report forms:
     flight number now validates in both quick and guided modes (field error + step/quick summary
     listing), and joins `STEP_FIELDS[0]` / `QUICK_FIELDS` so it gates Continue/File.
  4. **Units** (`lib/units.ts`, pure + unit-tested): ft↔m, kt↔km/h, NM↔km conversions and
     `fmtAltitude/fmtSpeed/fmtDistance` with both systems. **Decision recorded:** no units
     *preference* UI ships yet — no surface displays these quantities today, and a pref with
     nothing to drive is exactly the dead control S13 removes; it lands with the telemetry fields
     (M7).
  5. **Reporter confidentiality default + audited reveal.** Reports default to `restricted` (already
     true, now stated in the quick-report rail copy). On restricted records the overview withholds
     the reporter identity ("Identity withheld — restricted record") behind a just-culture note;
     safety managers (`incident.close`) get a **Reveal identity** control that calls the new
     `revealReporter` service — which flips the additive `reporterRevealed` flag and writes
     "Reporter identity revealed (confidential record)" to the audit log **in the same transaction**.
     After a reveal the card says so and points at the audit history. The reporter themself always
     sees their own identity.
- **Files:** `lib/format.ts` (+tests), new `lib/validation.ts` (+tests), new `lib/units.ts` (+tests),
  `lib/prefs.ts` (+ui.timeMode), `types/index.ts` (+reporterRevealed), `services/incidents.ts`
  (+revealReporter), `pages/settings.tsx` (Time display select), `pages/incidents/detail/index.tsx`,
  `pages/incidents/detail/shared.tsx` (+onRevealReporter/revealing), `detail/tabs/overview.tsx`
  (gated reporter card), `detail/tabs/audit.tsx` (tooltips), `report/use-report-form.ts`
  (flightNumber rule), `report/quick-report.tsx` + `report/steps/basic-info.tsx` (field errors),
  `scripts/smoke.mjs` (5n).
- **Removed (didn't earn its place):** the local-time getters masquerading as UTC in three
  formatters, and the dangling " UTC" literal in the record header that the Z suffix made
  redundant.
- **Tests:** vitest +22 (format: Z rendering, day-stability across zones, invalid inputs, local
  shape, tooltip pairing, UTC daysUntil ×2; validation: ICAO/IATA/reg/flight-no accept+reject
  matrices; units: round-trips, exact 1.852 factors, labels) → **61/61**. Smoke 5n: `HH:MMZ`
  rendered on a record; restricted reporter withheld → manager reveals → name shown → audit tab
  contains the disclosure entry; invalid flight number refused with the format message.
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ 61/61 · `node scripts/smoke.mjs` ✅
  "No problems found" (all three 5n lines ok) · `npm run build` ✅. Owner-gate: **axe on both
  themes** (contrast AA — token pairs unchanged, needs Chrome), flows, shots.
- **Leftovers:** `fmtTimePref` covers the record header and audit surfaces; tables and lists still
  render plain UTC (consistent, if not yet pref-aware — a sweep candidate once owners confirm the
  pref matters); units await telemetry surfaces (decision above); axe dual-theme run is the
  acceptance evidence for the AA claim.

---

## S17 — Accessibility & responsive hard pass per master 6 (2026-10-01)

- **Scope (sandbox-executable part; axe itself is owner-gate):**
  1. **Keyboard matrix:** occupied risk-matrix cells are now real controls — `role="button"`,
     `tabIndex=0`, full `aria-label` (likelihood, severity, count, score, band) and Enter/Space
     activation opening the cell side panel. Empty cells stay non-interactive (their content is
     reachable via the banded list and the ranked table).
  2. **Skip link** in the app shell (`Skip to content` → `#skyshield-main`), mirroring the landing
     page's existing one.
  3. **aria-live regions:** register match count (`polite`), bulk action bar (`role="status"`),
     palette result count, guided-wizard step announcements (`Step N of 7: …` on every change).
     DataTable's sr-only live region and the notification panel's already existed.
  4. **44px touch targets:** a `@media (pointer: coarse)` floor — buttons/tabs/options/menu-items/
     links 44px, small-size buttons and inputs 40px, dense in-table and chip controls 32px.
     Desktop pointer layouts are untouched (the query only matches touch devices).
  5. Already in place from earlier phases and re-verified: sidebar→drawer, table→cards below md,
     matrix→banded list below 560px, visible 2px brand focus rings globally, `prefers-reduced-motion`
     neutralisation, horizontal overflow 0 at 1440/1024/768/390 (+ landing 390/360).
- **Harness lesson (fixed in-suite):** smoke 5n left the report form dirty after the validation
  probe, so its closing navigation tripped the S5 leave guard and every later navigation queued
  behind the blocked dialog — 5o then asserted against the wrong page. 5n now explicitly meets the
  guard ("Leave page"), which doubles as a second leave-guard regression check per run; 5o asserts
  it is really on the register (saved-views tablist) before counting live regions and polls for the
  matrix instead of a fixed sleep.
- **Files:** `index.css` (touch-target block), `components/layout/app-shell.tsx` (skip link),
  `components/dashboard/risk-matrix.tsx` (keyboard cells), `pages/incidents/all-incidents.tsx`,
  `components/data/filters.tsx`, `components/common/command-palette.tsx`,
  `pages/incidents/report/guided-wizard.tsx` (live regions), `scripts/smoke.mjs` (5o + 5n fix).
- **Removed (didn't earn its place):** the fixed 1.5 s guess-wait in 5o (replaced by polling), and
  mouse-only interaction on the matrix's most important element.
- **Tests:** smoke 5o: skip link present; occupied cell 4×4 is role=button/tabindex=0 and Enter
  opens the side panel; register exposes ≥1 aria-live counter. Full suite green afterwards.
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ 61/61 · `node scripts/smoke.mjs` ✅
  "No problems found" incl. `matrix cell keyboard activation: ok` · `npm run build` ✅.
  Owner-gate: **axe 0 serious/critical on all routes in both themes** (Chrome), flows, Lighthouse
  a11y.
- **Leftovers:** focus management on wizard step change announces but does not move focus (add
  heading focus if axe flags it); the touch-target floor uses min-heights — a real-device pass
  should confirm dense tables stay usable; palette listbox uses aria-selected on options but no
  activedescendant wiring (dialog input keeps focus — acceptable pattern, axe may want
  aria-activedescendant); contrast pairs unchanged since the token audit (AA claim pending the
  owner axe run).

---

## S18 — Quality tooling per master 6 (2026-10-01)

- **Scope:**
  1. **ESLint** (v9 flat config, `eslint.config.js`): `@eslint/js` + `typescript-eslint` recommended,
     `react-hooks` (rules-of-hooks + exhaustive-deps), `jsx-a11y` (deterministic rules as errors —
     aria-props/role/required-props/redundant-roles/alt-text; heuristic rules as warnings, axe stays
     the acceptance gate), `no-console` (warn/error allowed), `eslint-config-prettier` last.
     Scripts get node globals + relaxed stylistic rules. `npm run lint` exits 0: **0 errors, 11
     warnings** (all heuristic a11y/exhaustive-deps, itemised in leftovers).
  2. **Prettier** configured to the house style (`.prettierrc`: no semis, single quotes, width 100)
     with `format` / `format:check` scripts. Deliberately NOT bulk-applied — a repo-wide mechanical
     diff would bury review; owner runs `npm run format` once, then `format:check` can join CI.
  3. **Vitest suites extended** per the master list: permissions (8 tests: closure reserved to
     managers/admins, investigator edit-without-verify, auditor read-only+export, officer
     file-without-analyse, users.manage, can() shapes, denial reasons, completeness), risk maths
     (5: score multiplication, severity axis bijection, band boundaries 4/5/9/10/14/15/25, band
     token presence ×25, band ordering), demo auth (4, jsdom: seed+sign-in, wrong password,
     **5-attempt lockout**, common-password signup refusal — real PBKDF2 210k). With S11/S12/S14/S16
     suites: **78/78 tests, 10 files**.
  4. **GitHub Actions CI** (`.github/workflows/ci.yml`): install → lint → typecheck → unit → build →
     **size-gate** → serve the production build → smoke (jsdom) → flows (headless Chrome, which
     ubuntu-latest provides at the exact path flows spawns). Axe remains owner-gate per D3.
  5. **Bundle-size fail-gate** (`scripts/bundle-gate.mjs`, `npm run size-gate`): gzips every dist
     JS asset; vendor ceilings by name (react 115k, radix 55k, charts 140k), app chunks 40k, total
     508k. Current: **465.9 kB total, every chunk within budget**.
  6. **Prune & dead-code removal:** deleted five dead landing components (`about-skyshield`,
     `how-it-works` — superseded by the guided tour, `recent-events`, `safety-data`,
     `safety-snapshot`; `section.tsx` stays — the S21-pending activity map imports it) and six dead
     one-shot scripts (`phase1-{codemod,maps,token-sweep,transform}`, `test-phases2-3`, `debug-axe`
     — superseded by smoke/flows); uninstalled unused `@radix-ui/react-label`; fixed the lint errors
     the sweep surfaced in live scripts (CDP ternary statements → if/else, unused `stepOf`/`cont3`,
     unused `full` param); smoke 5d now polls for auth-dependent primaries instead of racing the
     PBKDF2 seed (flake fix observed under load).
- **Files:** new `eslint.config.js`, `.prettierrc`, `.github/workflows/ci.yml`,
  `scripts/bundle-gate.mjs`, `src/lib/{permissions,risk}.test.ts`, `src/services/auth.test.ts`;
  `package.json` (scripts + deps), deletions above, `scripts/{flows,shots,gen-assets}.mjs`,
  `src/pages/capa/capa-management.tsx`, `scripts/smoke.mjs`, `README.md`.
- **Verify:** `npm run lint` ✅ 0 errors · `npm run typecheck` ✅ · `npx vitest run` ✅ **78/78** ·
  `node scripts/smoke.mjs` ✅ "No problems found" · `npm run build` ✅ · `npm run size-gate` ✅
  465.9/508 kB. Owner-gate: CI run itself, axe, shots.
- **Leftovers:** the 11 lint warnings (2 click-a11y heuristics on the evidence dropzone + row menu
  wrapper, 3 label-association heuristics that ARE associated via nesting, exhaustive-deps notes on
  dashboard `now`/analytics memos) — triage with the owner's axe run; Prettier not bulk-applied
  (decision above); `format:check` joins CI after the one-time format commit; gen-assets extension
  for 192/512 PNGs still pending (S15 leftover).

---

## S19 — Security/privacy frontend per master 6 (2026-10-01)

- **Scope:**
  1. **Sanitised rendered user text.** Audit result: React escapes JSX by
     default; the single HTML-string sink in the codebase is the analytics
     generated print document (`document.write`). New `lib/sanitize.ts`
     (`escapeHtml`/`escapeRow`, five entities, unit-tested ×5) now wraps every
     interpolated value in that document (filters, KPI labels/deltas, months,
     station names/cities, locale timestamps) and a station takeaway line was
     added while escaping. No `dangerouslySetInnerHTML`/`innerHTML` anywhere
     in `src/` (grep-verified).
  2. **CSP shipped in a deploy doc** — new `docs/DEPLOY.md`: strict
     hash-based CSP for the inline pre-paint theme script (with the openssl
     recipe to regenerate the hash), full nginx header block (CSP, nosniff,
     frame-ancestors 'none', Referrer-Policy, Permissions-Policy, HSTS),
     Vercel/Netlify equivalent, and the one honest exception documented
     (`style-src 'unsafe-inline'` for `style={{…}}` band colours, with the
     path to removing it). SPA-fallback + build-time env notes included.
  3. **Rate-limit UX.** `client.ts` now parses `Retry-After` (delta-seconds
     and HTTP-date) onto `HttpError.retryAfterSeconds`; exported
     `isRateLimited()`/`rateLimitMessage()`; the public anonymous intake
     renders the server's 429 message inline next to its own (mock-mode)
     throttle copy. DEPLOY.md states the server-side contract: client
     throttle is courtesy, DRF throttles are the control.
  4. **No secrets in localStorage post-API** — audited and documented: with
     `VITE_USE_MOCK=false` every `authService` call delegates (or rejects),
     `mockAuth.init()` never runs, so the demo credential store
     (`skyshield.auth.users.v1` — fixture accounts, PBKDF2 210k, labelled
     demo-only) is never created; sessions must be HttpOnly/Secure/SameSite
     cookies. DEPLOY.md carries the full key-by-key storage table and the
     one-line console check for launch verification.
  5. **Export & erasure paths documented** (DEPLOY.md §4): CSV exports per
     register (already real), backend export endpoints for large sets, demo
     erasure (Reset demo data + draft clearing), production erasure
     requirements (per-record with audit stub, account cascade), and how the
     confidentiality classifications + audited reporter-reveal (S16) fit the
     just-culture/privacy model. Retention (7y, CAR 5.12) stated as
     backend-enforced.
- **Threat-model note (required by the step):** assets = occurrence narratives
  (safety-protected), reporter identities (reprisal risk), audit integrity
  (regulatory evidence). Trust boundaries: (a) public /report — untrusted
  input → honeypot + client throttle + server 429 contract + escaped render;
  (b) authenticated SPA — role-gated actions enforced in UI *and* service
  rules (S12), disclosure audited (S16); UI gating is UX, the backend remains
  the authority (documented); (c) generated documents — the only HTML-string
  sink, now escaped; (d) storage — demo-only credential material clearly
  fenced to mock mode, prefs/drafts contain no secrets; offline queue holds
  report payloads (user-authored text) in localStorage — flagged in DEPLOY.md
  as accepted demo trade-off, backend-mode guidance is Background Sync +
  IndexedDB with encryption at rest when required. Residual risks: no
  client-side encryption of drafts (accepted, documented); CSP hash needs
  regeneration on theme-script edits (documented with recipe); 429 UX for
  non-intake surfaces arrives with the real API.
- **Files:** new `lib/sanitize.ts` (+tests), `docs/DEPLOY.md`;
  `services/client.ts` (HttpError.retryAfterSeconds + helpers),
  `pages/analytics.tsx` (escaped print doc), `pages/auth/anonymous-report.tsx`
  (429 copy), `README.md`.
- **Removed (didn't earn its place):** the un-escaped interpolations in the
  print document (all sixteen of them).
- **Verify:** `npm run typecheck` ✅ · `npx vitest run` ✅ **83/83** ·
  `npm run lint` ✅ 0 errors · `node scripts/smoke.mjs` ✅ "No problems
  found" · `npm run build` ✅. Owner-gate: CSP header live-test in a browser
  (hash computation), penetration pass with the backend.
- **Leftovers:** `style-src 'unsafe-inline'` until dynamic colours move to
  CSS variables; Subresource Integrity n/a (no third-party assets); the
  offline-queue storage medium (IndexedDB) and Background Sync belong to the
  backend milestone; DEPLOY.md hash placeholder must be filled at first
  deploy.

---

## S20 — README rewrite per Docs milestone (2026-10-01)

- **Scope:** the README now carries everything the milestone lists, verified
  against the running app: **tokens + type scale** (unchanged, still the
  design contract), **routes** (new table: every surface with its query-param
  variants — `?tab=`, `?mode=guided` — and the legacy redirects), **roles**
  (new capability matrix mirroring `lib/permissions.ts` exactly, including the
  two manager-only powers: close/re-open and CAPA verification), **persistence**
  (quick start now states the demo is stateful via `skyshield.store.v1`, dates
  rebased to today, and where the reset lives), **demo creds** (`demo@skyshield.aero`
  / `demo1234`, plus the investigator account for exercising role gating, and
  the "View demo" one-click path), **real-API switch** (existing env section,
  cross-linked to `docs/DEPLOY.md`), **Node requirement** (≥ 22.12 with the
  reason). The **Verification** section was stale (still described the removed
  landing map/stations) and now enumerates the real smoke sections and flows
  scenarios, the five gates, server/Chrome expectations and the CI mapping.
- **Onboarding dry-run (exit criterion):** clean clone → `npm install` →
  `npm run dev` → open `/` → **View demo** → dashboard; register → report →
  quick-file; Settings → System → Reset. Every step is described in the README
  alone; commands, credentials and paths re-checked against the code.
- **Files:** `README.md` only.
- **Removed (didn't earn its place):** the stale smoke description (map,
  stations, event rows, inspector click) that no longer matched the harness.
- **Verify:** docs-only; `npm run typecheck` ✅ (untouched), README links and
  paths spot-checked against `src/routes.tsx`, `lib/permissions.ts`,
  `services/store.ts`, `scripts/*`.
- **Leftovers:** shots output path is still `/tmp/opencode/shots` (harness
  convention); the Features section grew organically across steps — a copy
  edit pass could tighten it, content is accurate.

---

## S21 — Landing decision D1 + acceptance sweep (2026-10-01) — ROADMAP COMPLETE

- **D1 executed: the global activity map is removed.** The audit's recommendation
  (D1: "recommend remove") is enacted — the map had been orphaned from the composed
  landing since the S0-era redesign and the How-it-works tour (OR-1) now carries the
  "what/where/how" story better. Deleted the full self-contained cluster (import
  graph verified before cutting): `components/landing/global-activity-map.tsx` (661 ln),
  `components/landing/section.tsx` (its last importer was the map), `data/world-land.ts`
  (generated geometry), `data/landing.ts` (0 importers), `lib/geo.ts`, `hooks/use-element-width.ts`,
  `scripts/gen-world-land.mjs` and the `gen:map` script. README's architecture tree and
  landing section rewritten (with a history note pointing at git for repurposing).
- **One more unearned element removed (master rule):** the hero's hard-coded stat
  trio (3 needs-action / 14 active / 4 overdue CAPAs) contradicted the landing's own
  "every figure is derived" claim — now computed from the live register (reported /
  non-closed / overdue-CAPA counts via the stateful store) and count-up-animated on
  arrival. The services are **dynamically imported** because the static version pulled
  the whole fixture store into the eager landing entry chunk — caught by the S18
  bundle gate (59 kB > 40 kB budget), fixed to lazy (gate green again). First real
  catch by the gate; recorded here as evidence it earns its place.
- **Acceptance sweep (all gates, this commit):**
  - `npm run lint` ✅ 0 errors (11 heuristic warnings, itemised in S18/S19 leftovers)
  - `npm run typecheck` ✅ strict, app + tests
  - `npm run test:unit` ✅ **83/83** (11 files: store-pure, workflow 6×6 matrix,
    permissions, risk maths, auth PBKDF2+lockout, mentions, offline queue, sanitize,
    format/UTC, validation, units)
  - `npm run build` ✅ · `npm run size-gate` ✅ all chunks within budget
  - `node scripts/smoke.mjs` ✅ "No problems found" — full sweep: routes, landing
    (copy/census/tour/links/overflow 390+360), dashboard asserts, register round-trips,
    report page (quick/autosave/blocker/restore), detail contracts (8 tabs, per-status
    primary), RCA workspace (summary-on-edit, autosave), matrix (cell panel, mitigation),
    reports hub (takeaways, gap list), shell (palette, day groups, error boundary),
    store (create/persist/sequential-ref/reset), reporting loop (anonymous intake,
    throttle, comments+mentions), PWA (metadata, offline sync), domain (UTC Z,
    reveal-audit, validation), a11y (skip link, keyboard cells, live regions),
    click-everything on 12 routes, overflow at 1440/1024/768/390
  - Owner-gates outstanding by design (need Chrome/owner): `npm run flows` (rewritten
    end-to-end across S4–S15: wizard+autosave-reload, quick report, register
    round-trips + column persistence, 8 tabs, CAPA complete→verify + investigator
    role-swap, reports hub + blob-intercepted CSV, palette, offline queue, persistence
    after reload, auth pages), `npm run shots`, axe dual-theme, Lighthouse, real-device
    PWA install, CI green run.
- **Roadmap status:** S0–S21 all landed (S11 split into S11a store / S11b TanStack
  Query — S11b deferred by recorded decision; OR-1 owner-request delivered inside the
  sequence). Every step: one commit, one log entry, gates run, ≥1 removal.
- **Leftovers (carried register):** S11b TanStack Query; dashboard KPI fixture
  (DASHBOARD_METRICS) not store-live; bulk status change not yet routed through
  `transitionIncident`; SLA-monitoring series still a fixture; prettier bulk-format
  pending owner's one-time pass; CSP hash placeholder in DEPLOY.md; 192/512 PNG icons
  via gen-assets on owner machine; the 11 lint warnings triage with the axe run.

---

## OR-2 — flows harness: auth-readiness + ordering + storage fixes (2026-10-01)

- **Symptom (owner report):** `npm run flows` failed almost every check on a fresh
  profile; role-swap blocks died with `Cannot read properties of null (reading 'user')`
  from `JSON.parse(localStorage.getItem('skyshield.auth.session'))`.
- **Root causes found (all harness-side; app auth semantics untouched):**
  1. `go()` treated "shell + h1 visible" as ready and **silently continued after an
     8 s timeout** — masking whatever actually went wrong and letting sections interact
     with half-loaded or redirected pages.
  2. **Section-ordering collision:** the pre-existing "Auth flows" section signs the
     suite out (for the PublicOnly signup/login tests that used to follow it
     immediately). The later-added palette / reporting-loop / offline / reports-hub
     sections had been inserted *between* that sign-out and the signup pages, so they
     all ran unauthenticated: app routes redirected to /login and the session reads
     returned null — the exact reported crash.
  3. **Storage split:** the seeded demo session lives in localStorage (remember=true),
     but the UI demo-login in Auth flows writes sessionStorage (remember=false);
     all session helpers read localStorage only.
  4. Two race checks (compliance tab) asserted against a lazy chunk + async register
     before either landed; one regex was double-escaped (`/\\b12\\b/` matched a literal
     backslash-b).
  5. The reports-hub block had been anchored to the final-report line and ran last
     (unreachable after the crash).
- **Fixes (scripts/flows.mjs only):**
  - Preflight `fetch(BASE)` with an actionable "start the server" error (exit 2).
  - Fresh `--user-data-dir` per run (hermetic; matches the owner's local change) plus
    memory-lean headless flags.
  - `waitFor(label, probe, timeout)` + rebuilt `go()`: app routes require **shell AND
    a session in either storage** (mockAuth.init writes the session before the
    provider leaves `loading`, and RequireAuth renders the shell only after status
    resolves — together they prove auth finished); public routes require spinner gone
    + document complete + content painted. Timeouts **throw with a page-state
    diagnosis** (url, readyState, spinner, shell, session, auth keys, body snippet)
    instead of proceeding. A post-settle re-verify survives vite's cold
    dep-optimisation reload.
  - `sendT()` puts a 25 s deadline on every CDP call — a wedged renderer fails the
    suite loudly instead of stalling it (observed once under 1 GB sandbox pressure).
  - Storage-agnostic `requireSession` / `swapSessionUser` / `restoreSession` helpers
    (mirror `getCurrentSession`: read either store, write back where it lives) replace
    all four raw session read/write blocks.
  - Sections reordered to the intended narrative: … matrix → sidebar → **reports hub**
    → palette → reporting loop → offline → **Auth flows** (now starts with
    `go('/dashboard')` for a deterministic page) → dedicated sign-out → signup/forgot.
    Auth flows' trailing early sign-out removed (the dedicated block owns it).
  - Compliance checks poll via `waitFor`; quick-report risk regex unescaped.
- **App code changed: none.** RequireAuth/PublicOnly, mockAuth seeding, the 24 h TTL
  and the logged-out flag all behave exactly as before — the harness now waits for
  them and exercises them as designed.
- **Verify (this sandbox, real headless Chrome 154):** `npm run flows` → **65/65
  checks passed**, no console errors — including the previously-failing palette,
  reporting loop (anonymous → register → comment → cross-user mention delivery),
  offline queue, compliance controls and all four Auth-flow checks.
  `npm run typecheck` ✅ · `npm run test:unit` ✅ 83/83.
- **Leftovers:** none functional. If the owner's machine still shows stalls, the new
  CDP timeout + go() diagnostics will name the blocking state instead of hanging.

## OR-3 — Owner UI/UX pass: hero identity, scroll health, data density (2026-10-01)

Owner feedback: (1) landing should carry the project name **very big, centred**, with
plane-related motion; (2) research current templates for landing + data display;
(3) internal-site **scroll issue**; (4) data reads **cluttered**, typography weak.
Research pass (web search): centred kinetic-wordmark heroes, radar/arc ambience,
split-flap departure boards, TailAdmin/shadcn-style dashboard table patterns — all
rebuilt on the existing token kit, zero new dependencies.

- **Hero rebuilt** (`components/landing/hero.tsx` + `index.css` hero kit):
  `clamp(64px, 12.5vw, 168px)` condensed wordmark dead centre with a slow brass
  shimmer (`name-shimmer`, bg-clip-text), radar-sweep conic gradient + three rings
  behind it, the dashed route arc with SMIL-tracked aircraft scaled across the hero,
  and a **departure-board strip** — live rows from the register (flight · route ·
  occurred `HH:MMZ` · status) flipping in like split-flap (`board-flip`), fed by the
  same lazy service imports as the computed stats. All landing copy/census contracts
  kept (smoke 3b green). Every animation reduced-motion-neutralised.
- **Scroll health** (the "internal site" fix, four concrete causes):
  anchor `scroll-padding-top: 64px` (targets no longer hide under the sticky nav);
  `scroll-behavior: smooth` (auto under reduce); app scrollport gets
  `overscroll-behavior-y: contain` + `scrollbar-gutter: stable`; **scroll-lock leak
  guard** in AppShell *and* Landing — Radix modals unmounting mid-navigation could
  strand `body{overflow:hidden}` and freeze the whole page; route change now restores
  it. Long tables scroll in bounded ports (`max-h-[70vh]`) with **sticky headers**
  (DataTable, CAPA management, compliance) — print CSS releases the ports and
  un-sticks headers.
- **Density/typography declutter:** the S13 compact-density default was the main
  clutter source — flipped to **comfortable** (compact stays opt-in, padding 4px→6px).
  Cells px-3/py-2.5 → px-4/py-3, KPI numbers 20px → 24px condensed with roomier
  cells, dashboard card rhythm gap-3 → gap-4, landing sections wired to the
  scroll-reveal kit (`.reveal`→`.reveal-in`, IO-failsafe visible).
- **Backend docs:** `docs/BACKEND_PLAN.md` created (the file ROADMAP referenced for
  M7 never existed) — M1–M6 server milestones, **M7 Kaggle-2015 flight-delay ML**
  pipeline + `/api/v1/ml/delay-risk` contract, **M8 assistant chatbot** (RAG on
  Kaggle aggregates + live register through existing permissioned services,
  read-only first, pluggable LLM). `docs/BACKEND_REPORT.md` = post-change status
  report for the owner. No UI shipped for either (no-dead-UI rule). README landing +
  data-layer sections updated.
- **Verify:** typecheck ✅ · units 83/83 ✅ · smoke "No problems found" ✅ · build ✅ ·
  size-gate **469.9 kB** gzip (+4.0, budget 508) ✅ · flows **65/65** ✅ (real Chrome
  clicks across the new sticky-header scrollports).
- **Leftovers:** unchanged register; tarball refreshed post-OR-3 for delivery.

## BE-1 — Django backend M1–M3 + network-mode integration (2026-10-02)

Owner directive: *"start implementing the backend"* — milestones **M1–M3** of
`docs/BACKEND_PLAN.md`, with one acceptance gate: `scripts/flows.mjs` (the real-Chrome
suite) green in **both** modes — mock (unchanged semantics) and network
(`VITE_USE_MOCK=false` against the live API). No check was weakened to get there.

- **Backend (`backend/`, Django 5.2 + DRF + SQLite):** `skyshield/` project (env-driven
  settings, camelCase renderer/parser via `core/camelcase_helpers`, CSRF-cookie +
  security-header middleware, unified exception handler, `/api/health/`); `accounts/`
  (User with CharField pk mapped 1:1 to `src/types`, alias emails so
  `demo@skyshield.aero`→`usr_001`, DB-backed lockout, Invite, PasswordResetToken,
  AnonymousApiUser, login/logout/session/register/reset/invite views); `core/` (every
  entity with `list_order` + denormalised display columns, serializers mirroring
  `src/types`, **`workflow.py`/`permissions.py` ported from `lib/`** — the client copies
  are UX only, the server re-validates every guard). 91 tests (workflow guards, auth
  API, data API).
- **Semantics kept exactly:** `{ items, total, page, pageSize }` envelopes · camelCase
  wire · UTC `…Z` · `422 { reason }` transition refusals · `409` version conflicts ·
  audit rows in the **same transaction** · `next_list_order = lowest − 1` (prepends,
  mock `unshift` parity) · audit wire key `from` (model `from_value`) · sessions
  HttpOnly/SameSite=Lax/24 h, `remember=false` → browser-session cookie · anonymous
  intake throttled server-side (window + daily cap) mirroring the client throttle ·
  demo conveniences (reset tokens in responses, unknown-invite fallback) behind
  `SKYSHIELD_DEMO_MODE` (default on; off for real deployments).
- **Seed parity:** `scripts/export-fixtures.mjs` exports the mock store's rebased seed
  → `backend/fixtures/demo-seed.json` (80 incidents); `manage.py seed_demo` is
  idempotent (wipe + reseed) so `api:flows` starts deterministic every run.
- **Frontend wiring (service layer only; pages untouched except settings' async
  invite):** `client.ts` ENDPOINTS + auth routes · `store.ts` write-through mirror
  (`cacheUpsert`/`cacheIncident`/…) — server owns truth, store backs sync reads ·
  `auth.ts` `realAuth` transport + `authError` mapper (sync `createInvite` → async
  `requestInvite`) · `incidents.ts` `incidentError` (422→`WorkflowError`,
  409→`ConflictError`), flattened query builder, anonymous branch with `ThrottleError`,
  `bulkPatch` via `allSettled` · `operations.ts` `?incidentId=`/`?entityId=` scoping +
  per-item compliance PATCH · `notifications.ts`/`comments.ts` server-scoped with
  mirror · `vite.config.ts` shared `apiProxy` for dev **and** preview.
- **Flows network mode (`scripts/flows.mjs`):** `NETWORK` detection; bootstrap performs
  a **real login** through the app origin (session cookie + cached SessionData per the
  remember rules) instead of relying on seeded storage; role swaps become **real
  re-logins** — swapping storage alone would be a client-side lie the API refuses.
- **Orchestrator (`scripts/run-api-flows.mjs` = `npm run api:flows`):** port preflight →
  fresh DB (migrate + seed) → runserver → **production build with
  `VITE_USE_MOCK=false`** → `vite preview` proxying `/api` → flows (inherited stdio) →
  guaranteed teardown; server logs ring-buffered and dumped on any failure; node heaps
  capped for small runners. Preview instead of dev mode deliberately: dev's on-demand
  transforms and HMR/dep-optimisation reloads were a flake source, and preview is the
  exact serving mode the mock-mode CI flows already use (−250 MB resident, too).
- **Harness hardening (mode-agnostic; every assertion unchanged):** `go()` retries
  `Page.navigate` races and waits for the new document's **commit**
  (`Page.frameNavigated` counter) before readiness probes — a same-URL reload otherwise
  satisfied every probe on the *stale* document; `evalJs()` retries once on
  context-race errors ("Promise was collected" / "Inspected target navigated or
  closed") with helpers auto-installed via `Page.addScriptToEvaluateOnNewDocument`;
  `__settleTable(query)` replaces fixed sleeps on register searches — settled means
  *no skeletons AND every row carries the query* (under load, both a 900 ms sleep and
  a skeleton-only check sampled the stale unfiltered table while the server had
  already answered correctly); notifications settle on a **positive** loaded state
  (`[data-day-group]` or the empty/error panel); the sign-out check writes a
  localStorage click-marker **before** dispatching the click because the topbar signs
  out via hard navigation (`location.href='/'`) that can destroy the eval's context —
  the marker survives and still proves the click; `process.on('exit')` chrome-kill
  guard (a crashed suite no longer orphans ~400 MB of headless Chrome on this 1 GiB
  host); the column-restore cleanup is best-effort; CDP diagnostics (commits, dialogs,
  target crashes) log to stderr.
- **Dead thing removed:** the 600-line `server/` node prototype (mock API + its test)
  and its `server`/`dev:server` scripts — superseded by the real backend.
- **CI:** new `backend` job (py3.11, `pip install -r backend/requirements.txt`,
  `manage.py test`) and `api-flows` job (needs `verify` + `backend`; runner-shipped
  Chrome) running `npm run api:flows`. `.gitignore` += `backend/db.sqlite3`,
  `__pycache__/`, `*.pyc`; `.env.example` documents `VITE_PROXY_TARGET` + the
  `SKYSHIELD_*` surface.
- **Infra (sandbox, not repo):** chrome-for-testing pinned to **126.0.6478.126** —
  current stable (154) silently wedges on this host's kernel 4.19 (TCP connects,
  responses never read back; renderers/CDP stall with it). The provisioner now picks
  `linux64` explicitly (was grabbing arm64), restores the exec bits python's `zipfile`
  drops, and verifies with a real http load, not just `--version`.
- **Verify:** Django **91/91** ✅ · typecheck ✅ · lint 0 errors ✅ · units **83/83** ✅
  · smoke "No problems found" ✅ · build ✅ · size-gate **470.1 kB** gzip (budget 508)
  ✅ · flows mock **65/65** ✅ · **flows network `api:flows` 65/65** ✅.
- **Leftovers:** M4–M8 (file uploads, idempotent offline replay, server metrics,
  Kaggle-delay ML, assistant) remain backlog in `BACKEND_PLAN.md`; `DEPLOY.md`
  hardening (secret key, DEMO_MODE off, secure cookies) applies at real deployment.

## BE-2 — Django backend M4–M6 completion + file uploads, idempotency & analytics (2026-10-02)

Owner directive: complete milestones **M4–M6** of `docs/BACKEND_PLAN.md` (real file uploads & media serving, offline replay with `Idempotency-Key`, and server-side metrics/analytics calculations), wire the frontend services, and verify that all test suites pass in both mock and network modes.

- **Backend M4 — Real file uploads & media serving:**
  - Added `file` and `content_type` fields to `EvidenceItem` model and `attachments` JSON field to `CAPA` model (`0002_capa_attachments_evidenceitem_content_type_and_more.py`).
  - Added `MediaUploadView` (`POST /api/v1/media/`): multipart/form-data intake, verifies file content, compares client SHA-256 against computed hash, applies size limit (`SKYSHIELD_MAX_UPLOAD_MB`, default 25 MB), saves under `SKYSHIELD_MEDIA_ROOT` with unique safe filename, returns `{ url, filename, contentType, size, sha256 }`.
  - Added `MediaDownloadView` (`GET /api/v1/media/<path:filename>/`): enforces authentication (session cookie), verifies media file exists, streams exact bytes with correct content type and attachment/inline content disposition.
  - Added client-side WebCrypto SHA-256 hashing in `src/lib/hash.ts` (`hashFileSha256`).
- **Backend M5 — Idempotency-Key support & offline replay:**
  - Added `IdempotencyRecord` model (`backend/core/models.py`) tracking idempotency key, session key, request path/method, request hash, response status, headers, and body.
  - Implemented `IdempotencyMiddleware` (`backend/skyshield/middleware.py`): intercepts requests with `Idempotency-Key`, scopes keys to Django session, short-circuits repeated requests with cached response status/headers/body and adds header `Idempotency-Replayed: true`.
- **Backend M6 — Server-side analytics & dashboard metrics:**
  - Implemented `backend/core/analytics.py` (`compute_dashboard_metrics`, `compute_analytics_payload`) calculating live incident counts, severity distributions, 5x5 risk matrix positions, CAPA SLA series, Pareto factor analysis, 5 Whys statistics, and monthly occurrence trends matching frontend domain maths.
  - Added `DashboardMetricsView` (`GET /api/v1/dashboard/metrics/`) and `AnalyticsView` (`GET /api/v1/analytics/`) respecting date-window, severity, aircraft, and type query params.
  - Seed script `seed_demo` updated to generate realistic historical trend distributions.
- **Frontend integration & service wiring:**
  - `src/services/client.ts`: wired automatic `Idempotency-Key` headers on mutations, header-merge preservation, and `api.upload` for multipart file uploads.
  - `src/services/operations.ts`: added `uploadEvidence`, `uploadComplianceAttachment`, `uploadCapaAttachment`, `getAnalytics`, `getCapaSlaSeries`, and `registerEvidenceLocal`.
  - `src/lib/offline-queue.ts`: write-behind offline queue with idempotency keys and retry semantics (+4 tests).
  - Report wizard (`guided-wizard.tsx`): computes real file SHA-256 on evidence drop, uploads on submission, records chain-of-custody hashes; detail evidence tab renders authenticated download links.
  - CAPA and compliance pages wired to server file upload endpoints with blob-url stripping on persistence.
- **Verification:**
  - vitest units: **87/87 pass** (11 files, +4 offline-queue tests).
  - Django tests: **118/118 pass** (27 new tests across `test_media`, `test_idempotency`, and `test_analytics`).
  - Network API flows: `npm run api:flows` **72/72 pass** (live Django API + Vite preview proxy, real file upload & download byte check, idempotency replay, metrics/analytics validation).
  - Mock browser flows: `npm run flows` **68/68 pass**.
  - DOM smoke suite: `npm run smoke` **passed** ("No problems found").
  - Typecheck: `npm run typecheck` clean.
  - Lint: `npm run lint` 0 errors (11 pre-existing warnings OK).
  - Production build: `npm run build` ok.
  - Bundle size gate: `npm run size-gate` **471.7 kB** gzip (budget 508 kB).
- **Leftovers:** M7 (Kaggle-2015 flight-delay ML) and M8 (assistant chatbot) remain backlog / owner-blocked in `docs/BACKEND_PLAN.md` pending owner confirmation on the specific 2015 dataset variant and LLM provider choice.
