# SkyShield — Backend Report

Date: 2026-10-01 · Scope: status after the owner-requested UI/UX pass (landing hero
redesign, internal scroll fixes, data-density/typography cleanup). The server-side
plan itself lives in **`docs/BACKEND_PLAN.md`** (milestones M1–M8).

> **Addendum 2026-10-02 — the server now exists.** Milestones **M1–M3 are
> implemented** in `backend/` (Django 5.2 + DRF + SQLite): session-cookie auth with
> the demo roster, every core entity with register-shaped envelopes, and the full
> workflow/permission engine re-validated server-side (422 refusals, 409 version
> conflicts, same-transaction audit). The SPA runs against it unchanged through the
> existing `client.ts` boundary: `npm run api:flows` boots a freshly seeded API +
> production preview with `VITE_USE_MOCK=false` and drives the **same 65-check
> interactive flows suite — 65/65 green**, alongside 91 Django tests. The sections
> below describe the pre-backend state and remain accurate for mock mode, which is
> still the default. §1's "there is still no server" is superseded by this note.

## 1. Bottom line

- **There is still no server.** All data flows through the typed service layer
  (`src/services/*`) over the stateful demo store (`skyshield.store.v1` in
  localStorage), behind the single `client.ts` boundary (`VITE_USE_MOCK`,
  `VITE_API_BASE_URL`, `ENDPOINTS`). That boundary is intact and unchanged.
- **Every change in this pass is client-only and backend-neutral.** Nothing was
  added that a Django integration will have to unwind; two changes actually
  *reduce* future backend work (§2).
- **The chatbot trained on the Kaggle 2015 aviation data is planned, not built.**
  The ROADMAP has always carried the Kaggle-2015 flight-delay ML as backlog
  milestone **M7**; this pass formalises it — plus the chatbot as **M8** — in
  `docs/BACKEND_PLAN.md` §3–§4. Per the S13 rule (*no dead UI*), no chat widget or
  ML card is rendered until the endpoints exist.

## 2. This pass, change by change

| Change | Files | Backend impact |
| --- | --- | --- |
| Giant centred wordmark hero + radar sweep + tracked-aircraft route arc | `components/landing/hero.tsx`, `index.css` (hero kit) | None — pure presentation on existing tokens |
| **Departure-board strip** on the landing (flight · route · occurred `HH:MMZ` · status, flip-in rows) | `hero.tsx` | Reads through `services/incidents` (dynamic import, lazy chunk) — same contract the authenticated register uses. When the backend lands, the board shows real data with **zero changes**: it consumes `getAllIncidents()` |
| Scroll fixes: anchor `scroll-padding`, smooth scroll (reduced-motion safe), `overscroll-behavior: contain` + `scrollbar-gutter: stable` on the app scrollport | `index.css` | None |
| Scroll-lock leak guard (Radix modal unmounting mid-navigation could strand `body{overflow:hidden}`) | `layout/app-shell.tsx`, `pages/landing.tsx` | None |
| **Sticky table headers** inside bounded scrollports (`max-h-[70vh]`, print-released) | `data/data-table.tsx`, `capa/capa-management.tsx`, `compliance.tsx`, `index.css` (print) | None — but it removes the main UX pressure to add server-side pagination *page-size hacks*; the register's existing `page/pageSize` params stay the contract |
| Density default flipped **compact → comfortable**; compact padding 4px → 6px | `main.tsx`, `pages/settings.tsx`, `index.css` | None — `ui.compactTables` stays a client-only pref (`skyshield.prefs.v1:*`); deliberately *not* a server-persisted setting |
| Roomier cells (px-3/py-2.5 → px-4/py-3), KPI numbers 20px → 24px condensed, dashboard grid rhythm 12px → 16px | `data-table.tsx`, tables, `dashboard/kpi-strip.tsx`, `pages/dashboard.tsx` | None |
| Scroll-reveal wiring for landing sections (`.reveal` → `.reveal-in` kit contract, IO failsafe visible) | `pages/landing.tsx` | None |

## 3. Integration status snapshot (unchanged seams, re-verified)

Ready for M1–M2 the day a server exists:

- **Endpoint map** — `ENDPOINTS`: incidents, investigations, rca, capa,
  compliance requirements, notifications, audit-log, dashboard metrics, analytics,
  users, aircraft.
- **Query contract** — register sends filter/sort/page/pageSize; expects
  `{ items, total, page, pageSize }`.
- **Mutations + concurrency** — `version` compare → 409; audit rows written in the
  same transaction as the mutation (S12) — server must mirror atomically.
- **Offline** — queue replay with client-generated idempotency keys; 429/`Retry-After`
  already handled.
- **Auth shape** — `Session/User` contract (role matrix in README); mock PBKDF2
  210k to be replaced by Django auth without touching call sites.
- **Time discipline** — UTC storage/emit; `HH:MMZ` display (S16). The new
  departure board inherits this.

Still mock-only (server work required): evidence *files* (metadata-only today → M4),
dashboard/analytics computed client-side from the full register (→ M6), auth crypto,
notification delivery (in-store only).

## 4. Verification evidence for this pass

| Gate | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run test:unit` | 83/83, 11 files |
| `npm run smoke` (jsdom, 12-route sweep incl. landing census) | No problems found — all landing copy/census contracts kept by the redesign |
| `npm run build` | ok — entry + hero chunks within budget |
| `npm run size-gate` | **469.9 kB gzip total** (budget 508 kB) — +4.0 kB for the hero board/radar |
| `npm run flows` (headless Chrome 154, real CDP clicks) | **65/65** — including register sort/filter, CAPA status transitions and the reporting loop with the new sticky-header scrollports |

## 5. The chatbot + Kaggle-2015 question, answered directly

**Yes — it is kept in mind, and it is now written down.** Concretely:

1. `docs/ROADMAP.md` already parks *Kaggle-2015 flight-delay ML (train offline →
   serve in Django → predictions + detections)* as milestone **M7**, explicitly
   non-blocking for the frontend steps.
2. `docs/BACKEND_PLAN.md` §3 specifies M7 end-to-end: dataset ingest
   (`import_kaggle2015` → aggregate tables), offline training (sklearn/LightGBM,
   delay ≥ 15 min classifier + delay regression), the
   `GET /api/v1/ml/delay-risk` contract, the two frontend surfaces that may light
   up afterwards (wizard flight-step risk card, analytics overlay), and the
   nightly high-risk-pattern detector that files notifications through the
   existing contract.
3. §4 specifies **M8, the assistant chatbot**: `POST /api/v1/assistant/chat`
   contract; RAG grounded in (a) the Kaggle-2015 aggregates, (b) the live register
   accessed through the *same* service functions with the *chatting user's*
   permissions, (c) static SMS reference material with citations; pluggable LLM
   provider; read-only first, mutations only as user-confirmed actions through
   the guarded workflow endpoints; PII/retention rules mirroring the S16
   reporter-reveal audit.
4. The frontend has kept every seam this needs: one HTTP boundary, one URL map,
   role-gated services, notification targeting (`forUserId`), and the no-dead-UI
   rule so nothing chat-related ships before M8 exists.

**One open question for the owner:** "2015 aviation data from Kaggle" matches two
common datasets — *Flight Delay Prediction v2* and *2015 Flight Delays and
Cancellations* (both ~5.9 M US domestic flights, same feature family). Confirm
which file you have so M7's ingest command targets it exactly.

## 6. Recommended next steps

1. Owner: confirm the Kaggle file + LLM provider preference (hosted API vs local)
   + target hosting for Django.
2. M1 skeleton (auth + User contract) — the flows suite can then run against
   `VITE_USE_MOCK=false` as the acceptance gate (it is storage-agnostic).
3. Frontend leftovers register (tail of `docs/STEP_LOG.md`) stays independent of
   all of this: S11b TanStack Query, dashboard-metrics fixture → store-live, bulk
   transitions through `transitionIncident`.

---

## 7. Addendum 2026-10-02 — BE-2: M4–M6 Implementation & Verification

Milestones **M4–M6** are implemented and verified. The backend now supports full media file management, session-scoped request idempotency, and server-side aggregation for dashboard metrics and analytics.

### 7.1 Architecture & Implementation Summary

1. **M4 — Real File Uploads & Media Serving (`backend/core/views.py`, `backend/core/models.py`):**
   - **Upload Endpoint (`POST /api/v1/media/`):** Accepts `multipart/form-data` uploads. Computes the SHA-256 hash server-side and compares it with the client-supplied hash to guarantee chain-of-custody integrity. Files are saved in `SKYSHIELD_MEDIA_ROOT` with collision-safe filenames (`uuid_original_name`). Enforces `SKYSHIELD_MAX_UPLOAD_MB` (default: 25 MB).
   - **Download Endpoint (`GET /api/v1/media/<path:filename>/`):** Authenticated media delivery via session authentication. Streams the file bytes with proper MIME `Content-Type` and `Content-Disposition`.
   - **Model Fields:** `EvidenceItem.file`, `EvidenceItem.content_type`, and `CAPA.attachments` (`0002_capa_attachments_evidenceitem_content_type_and_more.py`).
   - **Frontend Utilities:** `src/lib/hash.ts` computes SHA-256 via browser WebCrypto `crypto.subtle.digest`.

2. **M5 — Offline Replay & Idempotency (`backend/skyshield/middleware.py`, `backend/core/models.py`):**
   - **Storage:** `IdempotencyRecord` model stores `key`, `session_key`, `request_path`, `request_method`, `request_hash`, `response_status`, `response_headers`, and `response_body`.
   - **Middleware:** `IdempotencyMiddleware` detects incoming `Idempotency-Key` headers. When a duplicate key arrives within the same session, the middleware replays the stored 2xx response directly, appending `Idempotency-Replayed: true`. In-flight concurrency is guarded to avoid race conditions.

3. **M6 — Server-Side Metrics & Analytics Calculations (`backend/core/analytics.py`):**
   - **Metrics Endpoint (`GET /api/v1/dashboard/metrics/`):** Returns live active investigation counts, overdue CAPAs, open critical incidents, occurrence counts, severity breakdowns, 5×5 risk matrix cell distributions, and recent incident lists.
   - **Analytics Endpoint (`GET /api/v1/analytics/`):** Computes time-series occurrence trends, CAPA SLA resolution trends, Pareto factors, 5 Whys depth distributions, and category breakdowns with support for filtering by date window, severity, aircraft, and occurrence type.
   - **Demo Fixtures:** `seed_demo` updated and fixture data rebased to generate continuous historical distributions.

### 7.2 Verification Gates Matrix

| Gate | Target / Expected | Result | Notes |
| --- | --- | --- | --- |
| `vitest run` | 87/87 | **87/87 passed** (11 test files) | Includes 4 offline-queue tests |
| `npm run api:test` | 118/118 | **118/118 passed** | 27 new tests for media, idempotency, analytics |
| `npm run api:flows` | Network integration | **72/72 passed** | Live Django API + Vite preview proxy |
| `npm run flows` | Browser mock flows | **68/68 passed** | Headless Chrome over CDP |
| `npm run smoke` | DOM smoke sweep | **Passed** | 12 routes, click sweeps, zero errors |
| `npm run typecheck` | Strict TypeScript | **Clean** | Zero errors |
| `npm run lint` | ESLint | **0 errors** | 11 pre-existing warnings OK |
| `npm run build` | Production bundle | **Passed** | Chunks generated cleanly |
| `npm run size-gate` | $\le$ 508 kB gzip | **471.7 kB gzip** | All chunk limits met |

### 7.3 Status of Remaining Milestones

- **M7 (Kaggle-2015 Flight-Delay ML):** Owner-blocked. Offline training pipeline and `/api/v1/ml/delay-risk` design specified in `BACKEND_PLAN.md` §3. Awaiting owner selection of the exact Kaggle 2015 flight delays dataset variant.
- **M8 (Assistant Chatbot):** Owner-blocked. Grounded RAG architecture and `/api/v1/assistant/chat` contract specified in `BACKEND_PLAN.md` §4. Awaiting owner selection of LLM provider.
