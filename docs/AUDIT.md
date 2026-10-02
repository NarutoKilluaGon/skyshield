# SkyShield — State Audit (vs master prompt v2)

Date: 2026-10-01 · Repo: github.com/NarutoKilluaGon/skyshield @ `a55cf56` · Audited in-sandbox by Qwen
Method: every claim below was re-checked in this sandbox (clone → `npm install` → `npm run typecheck` →
`npm run verify` with dev server) or by direct source inspection. Anything that could not be reproduced
here is marked **unverified-here** with the reason.

## 1. Toolchain note (important for all future steps)

- Repo dependencies (jsdom 30 → undici 7) require **Node ≥ 22**; `require(esm)` in jsdom's dep chain is
  unflagged only from **22.12**. Sandbox runs Node 22.11 with `NODE_OPTIONS=--experimental-require-module`;
  a machine on Node 20 fails `npm run verify` at import time. **Action S1b: add `engines` + `.nvmrc`.**
- `scripts/smoke.mjs` (jsdom-based) runs in this sandbox ✔.
- `scripts/flows.mjs`, `scripts/shots.mjs`, `scripts/test-phases2-3.mjs` (axe + Lighthouse) spawn
  `/usr/bin/google-chrome` — **not available in this sandbox** → those suites (and antigravity's
  31/31, 34/34, Lighthouse 97/100/100 numbers) are **unverified-here**. They must run in CI (S10)
  and/or on the owner's machine for every step that touches UI.
- `npm run verify` observed flaky once: first-fetch race produced
  `/dashboard: sidebar missing` + `main region missing`, then passed on re-run. **Action S1a: warm-up retry in smoke (no test deletions).**

## 2. Phase status

| Master-prompt phase | Status | Evidence |
|---|---|---|
| 1 Visual identity "Instrument" | **Done** | `--color-brand:#d6a24c` (dark) / `#8f5f12` (light); inline pre-paint theme script in `index.html`; IBM Plex Fontsource packages; no `cyan`/`*-dim` tokens left |
| 2 Routing + connectivity + auth | **Done** | `/login /signup /forgot-password /reset-password/:token /verify-email /invite/:token /report /privacy /terms` render; `RequireAuth/PublicOnly/RequireRole` in `src/lib/route-guards.tsx`; PBKDF2 210k iterations in `services/auth.ts`; back-redirects `/capa /analytics /compliance /rca*` verified by identical route HTML in smoke |
| 3 Landing page | **Done (one deviation)** | smoke census: 6 header links, 5 workflow nodes, 25 matrix cells, 4 roles items, 4 trust boxes; robots/sitemap/OG present. **Deviation:** `components/landing/global-activity-map.tsx` (661 ln) is not in the master-prompt landing structure — decision item D1 |
| 4a Navigation consolidation | **Done** | exactly 5 top-level items in `nav-config.ts`; `pages/reports/index.tsx` tab hub (lazy-reuses `analytics.tsx`, `compliance.tsx`, `risk-matrix-page.tsx` as tab content — not dead code); `pages/actions/index.tsx`; breadcrumbs updated |
| 4b Dashboard six blocks | **Not started** | `dashboard.tsx` still has "Executive overview" select, "Live data" pill, refresh button (lines 67/123/167) — the exact items 4.2 removes |
| 4.3 Chart theming | **Not started** | `--chart-*` tokens exist in `index.css` but **0 usages** in `src/` |
| 4.4–4.8 section redesigns | **Not started** | `report-incident.tsx` 1,208 ln & `incident-detail.tsx` 984 ln unsplit; no command palette; settings/notifications pre-redesign |
| 5 Functionally real | **Not started** | no `skyshield.store.v1` stateful store; no TanStack Query; no PWA manifest/SW in `public/`; exports/print stylesheet unverified |
| 6 Weaknesses | **Not started** | `lint` is still `tsc -b`; no ESLint/Prettier/Vitest; no `.github/` CI; no `engines` |
| Docs deliverables | **Missing** | no `docs/` directory at all → created by S0 (this commit) |

## 3. Gap register (work items feeding the roadmap)

| ID | Gap | Master ref | Step |
|---|---|---|---|
| G1 | `docs/BACKEND_PLAN.md`, `docs/DESIGN.md` missing | Docs | **S0 (done)** |
| G2 | smoke first-fetch flake | process | S1a |
| G3 | no `engines`/`.nvmrc` (Node ≥22.12) | process | S1b |
| G4 | dashboard not per 4.2 (six blocks, hero list, KPI strip, matrix sizing, queue) | 4.2 | S2 |
| G5 | charts not themed/lazy/a11y (`var(--chart-*)` unused, no "View as table") | 4.3 | S3 |
| G6 | incidents list UX (saved-view tabs, filter chips, bulk bar, column persistence, pagination) | 4.4 | S4 |
| G7 | report wizard split (1,208 ln → per-step files + hook) & quick report default | 4.4 | S5 |
| G8 | incident detail split (984 ln → per-tab files), context primary action, sticky facts | 4.4 | S6 |
| G9 | RCA chain UI + risk matrix side panel/mitigation toggle | 4.5 | S7 |
| G10 | Actions/CAPA table-first, evidence-on-complete, verify step | 4.6 | S8 |
| G11 | Reports tabs: takeaway-titled charts, compliance ranked list + evidence attach | 4.7 | S9 |
| G12 | notifications grouping, settings tabs, ⌘K palette, empty/loading/error sweep, error boundary | 4.8 | S10 |
| G13 | stateful mock store + relative dates + UUIDs + sequential refs; TanStack Query | 5.1–5.2 | S11 |
| G14 | workflow transition service + guards + audit writes + optimistic locking | 5.3 | S12 |
| G15 | exports match labels (CSV filtered set, print stylesheet); dead-control sweep + click-everything test | 5.4, 5.6 | S13 |
| G16 | anonymous /report hardening (honeypot present? verify; throttle) + comments/@mentions + event-driven notifications | 5.5, 5.7 | S14 |
| G17 | PWA (manifest, SW, offline quick report queue) | 5.8 | S15 |
| G18 | UTC handling, code/reg validation, units pref, reporter confidentiality + reveal audit | 6 domain | S16 |
| G19 | a11y sweep in-suite (axe per route once Chrome available in CI), keyboard matrix/tables | 6 a11y | S17 |
| G20 | ESLint(+jsx-a11y,react-hooks)+Prettier, Vitest unit suites, GH Actions CI, file-size cap, dep prune | 6 quality | S18 |
| G21 | CSP/rate-limit UX/sanitisation review, retention & export path | 6 security | S19 |
| G22 | README rewrite (tokens, routes, roles, demo creds, reset, real-API switch) | Docs | S20 |
| G23 | landing activity-map decision + final acceptance sweep vs checklist | 3/acceptance | S21 |

## 4. Decisions needed from the owner

- **D1 — landing global-activity map (661 ln + `gen-world-land.mjs`):** not in master-prompt §3.1 structure;
  costs bundle weight and competes with the hero. Recommendation: **remove** (principle: quiet by default,
  one hero per screen). Alternative: keep as a fifth "product section" crop only if it shows real product data.
- **D2 — trust boxes count:** smoke census sees 4 trust boxes; master §3.1(6) says three true statements
  (+ anonymous-report link). Confirm the 4th is the link block, else trim.
- **D3 — Chrome-dependent suites:** approve adding GitHub Actions (S18) so flows/shots/axe/Lighthouse run
  on every PR; until then those gates run only on your machine.
- **D4 — backend:** `docs/BACKEND_PLAN.md` (S0) follows master Appendix A (Django+DRF+Postgres). The earlier
  Qwen plan documents (`/SkyShield_Project_Plan.md`, ML phase incl. Kaggle flight-delay model) remain the
  *post-frontend* programme; the ML/prediction work slots in **after** backend M4 as milestone M7 — no
  frontend step depends on it.
