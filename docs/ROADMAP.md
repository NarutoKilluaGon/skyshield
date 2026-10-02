# SkyShield — Reconfigured Roadmap (post-audit)

Supersedes the phase list ordering of master prompt v2 **where the audit shows reality differs**.
Same rules, same design principles, same acceptance checklist — only the work packaging changes:
every step below is **one commit**, prefixed `S<n>:`, recorded in `docs/STEP_LOG.md`, and gated by the
verification commands listed for it. Steps are ordered so that gates become reliable first, then the
dashboard (the visible centre of the product), then outward.

## Tracking conventions (how you follow along)

1. One step = one commit = one entry in `docs/STEP_LOG.md` (what changed, files, verify output, leftovers).
2. Gates, in this sandbox: `npm run typecheck` + `npm run verify` (Node 22 + `NODE_OPTIONS=--experimental-require-module`,
   dev server up; smoke is the jsdom suite). Chrome-dependent suites (`flows`, `shots`, axe, Lighthouse)
   run on the owner's machine / CI — every step that touches UI lists them as **owner-gate**.
3. Never delete a test to pass; update `smoke/flows/harness` when routes/labels/copy change (master rule).
4. Each step ends by removing at least one thing that doesn't earn its place (master rule).

## Steps

| Step | Scope (master ref) | Key files | Exit criteria | Verify |
|---|---|---|---|---|
| **S0** ✅ | Docs baseline: AUDIT, ROADMAP, STEP_LOG, BACKEND_PLAN, DESIGN (Docs) | `docs/*` | docs dir exists; BACKEND_PLAN = Appendix A; DESIGN = principles+tokens | typecheck |
| **S1** | Gate reliability: smoke warm-up retry (G2); `engines`+`.nvmrc` node ≥22.12 (G3) | `scripts/smoke.mjs`, `package.json`, `.nvmrc` | 5 consecutive clean smoke runs; Node-20 failure message becomes a clear engines error | typecheck+verify ×2 |
| **S2** | Dashboard six blocks (4.2): header w/ single primary + ⋯ menu; Needs-attention hero (≤5 rows, data-built, empty state); 4-cell KPI strip w/ plain deltas; 2:1 risk matrix (56–64px cells, count circles, click→filtered list, legend replaces severity-mix) + My queue; 1:1 trend + by-type bars; recent table + investigation progress + CAPA status; delete Executive overview/Live data/refresh/subtitle | `pages/dashboard.tsx`, `components/dashboard/*`, `lib/domain.ts` | census: buttons ≤ 12 in header zone; no "Live data"/"Executive overview" strings; all figures from data layer; smoke census updated | typecheck+verify; owner-gate: shots+flows |
| **S3** | Chart system (4.3): `var(--chart-*)` everywhere, horizontal gridlines only, 2px lines/4px active dot, maxBarSize 20, direct labels, surface-2 tooltips, lazy Recharts boundary, `aria-label` + "View as table" toggle per chart | `components/charts/*`, all pages with charts | 0 hex strokes in charts; every chart has table alternative; Recharts absent from landing/auth chunks (build manifest check) | typecheck+verify+build; owner-gate: Lighthouse perf ≥90 on / |
| **S4** | All-incidents list (4.4): saved-view tabs, single Filters popover + removable chips, bulk bar on selection, row-actions real items, column show/hide persisted, page-size selector, virtualise >200 | `pages/incidents/all-incidents.tsx`, `components/data/data-table.tsx` | flows: filter→chip→clear round-trip; column choice survives reload (store) | typecheck+verify; owner-gate: flows |
| **S5** | Report incident (4.4): Quick report default; wizard split into `report/steps/*.tsx` + `useReportForm` hook; sticky live-risk summary; autosave; leave warning; per-step validation summary; confirmation w/ ref | `pages/incidents/report-incident.tsx` → new dir | no file >400 ln; wizard flow test passes; autosave restore test | typecheck+verify; owner-gate: flows |
| **S6** | Incident detail (4.4): split into `detail/tabs/*.tsx`; header mono ref + badges + one context primary action; two-col overview w/ sticky facts sidebar; tabs underline style | `pages/incidents/incident-detail.tsx` → new dir | no file >400 ln; each tab keyboard-reachable; primary action changes with status/role | typecheck+verify; owner-gate: flows+axe |
| **S7** | RCA + risk (4.5): 5 Whys vertical editable chain w/ connector + root-cause callout; factors grouped w/ weights; live plain-language summary; autosave "Saved"; matrix full-size w/ cell side panel + before/after mitigation toggle | `components/rca/*`, `pages/rca/risk-matrix-page.tsx` | no dead buttons in RCA (click-test); summary updates on edit | typecheck+verify; owner-gate: flows |
| **S8** | Actions/CAPA (4.6): summary line, table-first, overdue `crit-wash` + "N days overdue", inline progress, owner avatars, relative dues, Mark-complete-with-evidence, Verify-effectiveness (safety_manager), SLA chart below | `pages/actions/index.tsx`, `pages/capa/*` | complete→verify round-trip in flows; role-gated verify hidden for investigator | typecheck+verify; owner-gate: flows |
| **S9** | Reports hub (4.7): shared filter bar; analytics takeaway-titled charts (computed sentences); compliance score as single large number + ranked gap list + requirements table + evidence attach; CSV + print work | `pages/reports/*`, `pages/analytics.tsx`, `pages/compliance.tsx` | takeaway sentences computed from data (test); export buttons produce real files | typecheck+verify; owner-gate: flows |
| **S10** | Shell & states (4.8): notifications grouped by day + real unread count; settings left-tab list + Team/Preferences/Data; ⌘K palette (entities+actions); empty/loading/error sweep; top-level error boundary | `pages/notifications.tsx`, `pages/settings.tsx`, new `components/common/command-palette.tsx`, `lib/error-boundary.tsx` | palette opens on Ctrl-K and navigates; every table has 3 states; boundary fallback test | typecheck+verify; owner-gate: axe all routes |
| **S11** | Stateful mock + data layer (5.1–5.2): `skyshield.store.v1` persistence, relative seed dates, `crypto.randomUUID()`, per-org sequential refs, Reset demo data; adopt TanStack Query behind `services/client.ts` | `services/*`, `data/*` | create→refresh→still there; reset restores seed; `VITE_USE_MOCK=false` typechecks against same hooks | typecheck+verify+new vitest units |
| **S12** | Workflow service (5.3): `transition()` with role+guard rules (no close w/ open CAPAs or unfinished investigation, button explains why), audit entries in same transaction, optimistic `version`/409 | `lib/workflow.ts`, `services/incidents.ts`, History tab | vitest: every allowed+forbidden transition; UI shows reason on disabled close | typecheck+verify+vitest |
| **S13** | Outputs & dead-control sweep (5.4, 5.6): CSV = current filtered set; print stylesheet (chrome hidden, light theme, page breaks); remove/repair/disable-every dead control; click-everything smoke | exports util, print.css, sweep list in STEP_LOG | click-everything test green; no label lies (PDF vs CSV) | typecheck+verify; owner-gate: flows |
| **S14** | Reporting loop (5.5, 5.7): anonymous /report throttle+honeypot verified, confirmation ref, enters register as "Anonymous, needs triage"; comments w/ @mentions; notifications generated from real events | `pages/auth/anonymous-report.tsx`, comments service | anon report appears in register; mention notifies mentionee | typecheck+verify; owner-gate: flows |
| **S15** | PWA (5.8): manifest, icons, shell service worker, offline quick-report queue w/ sync | `public/manifest.webmanifest`, `sw.js`, queue hook | install prompt metadata present; offline submit→queued→synced on reconnect (test) | typecheck+verify+vitest |
| **S16** | Domain correctness (6): UTC storage + `14:32Z` display + local tooltip + pref; ICAO/IATA/reg/flight-no validation; ft/kt/NM units pref; reporter confidentiality default + reveal audit | `lib/format.ts`, forms, permissions | vitest formatters; reveal writes audit; both themes AA (axe) | typecheck+verify+vitest; owner-gate: axe |
| **S17** | A11y & responsive hard pass (6): keyboard matrix/tables/menus/wizard; aria-live regions; 44px targets; table→card <md; filters→bottom sheet; sidebar→drawer; matrix→banded list | layout + components | axe 0 serious/critical on all routes (CI); overflow 0 at 1440/1024/768/390 | owner-gate: axe+smoke widths (CI) |
| **S18** | Quality tooling (6): ESLint (jsx-a11y, react-hooks) + Prettier; Vitest suites (permissions, formatters, workflow, risk, validation, auth); GH Actions (install, lint, typecheck, unit, build, smoke, flows w/ Chrome); bundle-size fail-gate; prune deps; delete dead components | `.eslintrc`, `vitest.config`, `.github/workflows/ci.yml` | CI green on PR; coverage gate on units | CI |
| **S19** | Security/privacy frontend (6): sanitise rendered user text, CSP in deploy config doc, rate-limit UX, no secrets in localStorage post-API, export/erasure path documented | lib + docs | threat-model note in STEP_LOG; CSP header config shipped in deploy doc | review |
| **S20** | README rewrite (Docs): tokens, type scale, routes, roles, persistence, demo creds+reset, real-API switch, Node requirement | `README.md` | README-only onboarding works (clean clone → dev → demo login) | review |
| **S21** | Landing decision D1 + acceptance sweep: remove/repurpose activity map per owner; run full acceptance checklist; final `shots` critique pass; remove one more unearned element | landing, checklist in STEP_LOG | every acceptance checkbox ticked with evidence links | all gates + CI |

## Parallel programme (after backend M4, unchanged from earlier Qwen plan)
Kaggle-2015 flight-delay ML (train offline → serve in Django → predictions + detections) remains
backlog milestone **M7** of `docs/BACKEND_PLAN.md`; no frontend step blocks or is blocked by it.

## Step sizing
S1 xs · S2 L · S3 M · S4 M · S5 L · S6 L · S7 M · S8 M · S9 M · S10 M · S11 L · S12 M · S13 M ·
S14 M · S15 M · S16 M · S17 M · S18 M · S19 S · S20 S · S21 M
