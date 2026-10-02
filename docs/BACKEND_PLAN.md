# SkyShield — Backend Plan

Status: **M1–M6 implemented** (`backend/` — Django 5.2 + DRF, SQLite; the SPA passes
its full interactive flows suite against the real API via `npm run api:flows`).
Milestones M4 (file uploads & media serving), M5 (offline replay + idempotency),
and M6 (server-side metrics/analytics) are complete. M7 (Kaggle-2015 flight-delay ML)
and M8 (assistant chatbot) remain owner-blocked pending dataset variant confirmation
and provider selection. Companion status report: `docs/BACKEND_REPORT.md`.

## 0. Where the frontend stands today

The app is fully functional against a **typed service layer** over a localStorage store
(`skyshield.store.v1`). Every page talks to `src/services/*`, never to storage directly.
That boundary is the integration seam:

| Piece | Location | Backend relevance |
| --- | --- | --- |
| HTTP client | `src/services/client.ts` | Single boundary: `VITE_USE_MOCK !== 'false'` flips mock → network; `VITE_API_BASE_URL` (default `/api/v1`); `ApiError` with status, 429 + `Retry-After`, timeouts, JSON parse guards |
| URL map | `ENDPOINTS` in `client.ts` | The server must answer these shapes: `/incidents/`, `/incidents/:id/`, `/investigations/`, `/rca/`, `/capa/`, `/compliance/requirements/`, `/notifications/`, `/audit-log/`, `/dashboard/metrics/`, `/analytics/`, `/users/`, `/aircraft/` |
| Contracts | `src/types/index.ts` | Source of truth for payload shapes → 1:1 DRF serializers |
| Domain rules | `src/lib/workflow.ts`, `src/lib/validation.ts`, `src/lib/domain.ts` | Pure functions — re-implement server-side; client keeps them for optimistic UI |
| Concurrency | `version` field + 409 handling (workflow transitions, detail save) | Server: `select_for_update` / `If-Match`-style version compare |
| Offline | `src/lib/offline-queue.ts` + replay | Server must accept idempotency keys (client generates them) |
| Auth | `src/services/auth.ts` (PBKDF2 210k mock, 24 h sessions, remember → local vs session storage) | Replace with Django auth (session or JWT via djoser); keep the same `Session/User` contract |
| Audit | audit entries written **in the same transaction** as mutations (S12) | Server: signal/middleware writes `AuditLog` rows atomically |
| Time | All timestamps UTC; display formatting in `HH:MMZ` (S16) | Server stores/emits ISO-8601 UTC only |

## 1. Milestones

- **M1 — Django skeleton + auth.** ✅ *implemented (`backend/skyshield`, `backend/accounts`).* DRF project, `User` model mapped to `src/types` (`id`,
  `name`, `email`, `role`, `department`), login/logout/session endpoints matching
  `services/auth.ts`, CORS + the security headers from `docs/DEPLOY.md`.
- **M2 — Core entities.** ✅ *implemented (`backend/core` — models, serializers, list envelopes).* `Incident`, `Investigation`, `RCA`, `CAPA`, `ComplianceRequirement`,
  `Aircraft`, `Airport`, `AuditLog`, `Notification`, `Comment`. List endpoints must accept the
  query params the register already sends (filter/sort/page/pageSize/status/owner/date range)
  and return `{ items, total }`-style envelopes the services expect.
- **M3 — Workflow server-side.** ✅ *implemented (`backend/core/workflow.py`, `permissions.py`; 422/409 + same-transaction audit).* Port `lib/workflow.ts` transition guards; same-transaction
  audit writes; optimistic-lock 409s; role permissions per `SAFETY_ROLES` matrix (README).
- **M4 — Files.** ✅ *implemented (`backend/core/views.py` `MediaUploadView`/`MediaDownloadView`, `models.py`, `settings.py`).* Evidence attachments (S9 compliance evidence, CAPA completion evidence)
  are real uploads: `POST /api/v1/media/` → local storage under `SKYSHIELD_MEDIA_ROOT` with SHA-256 validation; authenticated streaming downloads via `GET /api/v1/media/<path>/`.
- **M5 — Offline replay + idempotency.** ✅ *implemented (`backend/core/models.py` `IdempotencyRecord`, `backend/skyshield/middleware.py`).* Honors `Idempotency-Key` on create/update; replays
  stored 2xx responses with `Idempotency-Replayed: true`; scoped to Django session keys.
- **M6 — Metrics/analytics server-side.** ✅ *implemented (`backend/core/analytics.py`, `DashboardMetricsView`, `AnalyticsView`).* Aggregated `/dashboard/metrics/` + `/analytics/` payloads
  computed server-side from live database tables mirroring client domain maths.
- **M7 — Kaggle-2015 flight-delay ML** (per ROADMAP). *Owner-blocked.* Offline training → served by Django →
  predictions + detections. See §3.
- **M8 — Assistant chatbot.** *Owner-blocked.* Conversational interface grounded in the register + delay-risk
  model + reference material. See §4.

## 2. Non-negotiables carried from the frontend

1. **Never bypass guards.** Server re-validates every transition/permission; client-side
   `workflow.ts` is UX only.
2. **Reporter privacy.** Anonymous-reporter reveal is audited (S16); the backend must keep
   `reporter.revealAudit` semantics and never leak PII in list endpoints to unauthorized roles.
3. **Sanitization.** `lib/sanitize.ts` escapes user content in print documents server-side too
   (PDF/export generation moves server-side with M4).
4. **Rate limits.** Client already handles 429/`Retry-After`; server enforces per-IP and
   per-user throttles (anonymous intake throttle exists client-side — mirror it).
5. **UTC everywhere.** No naive datetimes; the frontend formats, the backend stores.

## 3. M7 — Kaggle-2015 flight-delay ML

Dataset: Kaggle **2015 flight delays** corpus (~5.9 M US domestic flights; the two common
variants are *Flight Delay Prediction v2* and *2015 Flight Delays and Cancellations* —
confirm the exact file with the owner before training). Features: carrier, origin/dest,
scheduled departure hour, day-of-week, month, distance; target: arrival delay (regression)
and delay ≥ 15 min (classification); cancellations as a secondary target.

Pipeline (all offline; the browser never trains):

1. `notebooks/` or `ml/` — pandas + scikit-learn/LightGBM; train/validate on 2015 split by
   month; export metrics + serialized model (ONNX or joblib).
2. Django management command `import_kaggle2015` → parquet/SQLite aggregate tables
   (per route × carrier × hour delay stats) — these power both the model features and the
   chatbot's factual grounding (§4).
3. DRF endpoint `GET /api/v1/ml/delay-risk?carrier=&origin=&dest=&hour=` →
   `{ probability, p50_delay_minutes, sample_size, model_version }`.
4. Frontend consumption (only once the endpoint exists — **no dead UI**, S13 rule):
   a `delayRisk` service module + one card in the report wizard's flight step
   ("this route/carrier/hour historically delays X% of the time") and an analytics
   overlay. Behind `VITE_USE_MOCK=false` so the demo build never shows it.
5. "Detections" (ROADMAP wording): a nightly job flags register incidents whose flight
   matches high-risk patterns → creates a notification via the existing
   `notifications` service contract (`forUserId` targeting already exists).

## 4. M8 — Assistant chatbot (grounded in the 2015 aviation data)

Product shape: a role-aware assistant. Two surfaces:

- **Staff assistant** (inside the shell): answers questions about the live register
  ("what's overdue?", "summarize INC-2026-0258"), historical delay statistics from the
  Kaggle-2015 aggregates ("how reliable is carrier X on DEL→BLR evenings?"), and SMS
  procedure guidance (ICAO Doc 9859 / DGCA CAR references).
- **Public FAQ variant** (landing/anonymous report): intake help only — what to report,
  how triage works. No register data.

Architecture:

1. Django app `assistant`: `POST /api/v1/assistant/chat` `{ thread_id, message }` →
   streamed or JSON `{ reply, citations[], actions[] }`. Thread persistence + rate limits.
2. **LLM provider is pluggable** (env-configured: hosted API or local model). The provider
   is an implementation detail; the contract above is what the frontend codes against.
3. **Grounding (RAG + tools, read-only):**
   - Kaggle-2015 aggregate tables (§3.2) → SQL/tool queries, never raw hallucination;
   - live register access via **the same service functions the UI uses**, executed with
     the *chatting user's* permissions (role matrix enforced — the bot has no identity of
     its own);
   - static reference corpus (Doc 9859 excerpts, CAR sections, `docs/DEPLOY.md` policies)
     embedded for retrieval with citations returned to the UI.
4. **Actions:** initially read-only. Any mutation the assistant proposes ("close CAPA-088")
   renders as a confirmation card that calls the existing guarded endpoints as the real
   user — the workflow/audit path is never bypassed.
5. **Privacy:** reporter identities and personal data are stripped from LLM context unless
   the requesting role is permitted (mirror the reporter-reveal audit); chat transcripts
   stored with a retention policy; PII redaction before provider calls.
6. Frontend seam (when M8 lands): `src/services/assistant.ts` following the client/ENDPOINTS
   pattern + a shell-level chat widget component. Nothing is added to the UI before the
   endpoint exists.

## 5. Testing strategy for the backend phase

- Contract tests generated from `src/types` (serializer ↔ TS type drift check).
- The existing `flows.mjs` E2E suite runs unchanged against `VITE_USE_MOCK=false` +
  `VITE_API_BASE_URL` — it is storage-agnostic since OR-2 and asserts behaviour, not mocks.
- Load fixture: export `skyshield.store.v1` seed (fixtures) as a Django data migration so
  demo environments match the frontend's seeded register.
