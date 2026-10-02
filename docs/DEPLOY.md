# SkyShield — Deployment & Security Configuration

Frontend deployment contract (S19). The Django REST backend plan lives in
`docs/BACKEND_PLAN.md`; this file owns the **static-serving configuration,
security headers and the privacy paths** for the SPA.

---

## 1. Content Security Policy

The app is a static SPA: no third-party scripts, no remote fonts (Fontsource
packages are bundled), self-hosted icons only. That permits a strict CSP.

**One deliberate exception:** `index.html` carries an inline pre-paint theme
script (prevents a dark/light flash). Under a hash-based CSP it must be
allow-listed by its SHA-256 hash — regenerate the hash after any edit to that
script:

```bash
# extract the inline script, then:
openssl dgst -sha256 -binary theme-script.js | openssl base64
```

### nginx

```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'sha256-REPLACE_WITH_THEME_SCRIPT_HASH';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  font-src 'self';
  connect-src 'self' https://api.your-operator.aero;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
" always;

add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

Notes:

- `style-src 'unsafe-inline'` is required because components set `style={{…}}`
  props (band colours, chart strokes). Tailwind itself emits no inline
  `<style>`; if you move all dynamic colours to CSS variables, `'unsafe-inline'`
  can be dropped from `style-src`.
- `connect-src` must list the DRF origin when the API is served from a
  different host than the SPA.
- The service worker (`/sw.js`) is same-origin and needs no extra directive.

### Vercel / Netlify equivalents

`vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'sha256-REPLACE_WITH_THEME_SCRIPT_HASH'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## 2. Rate limiting — server contract and client UX

The public anonymous intake (`POST /api/v1/anonymous-reports/`) and auth
endpoints must be rate-limited **server-side** (DRF throttles + IP aware); the
client-side throttle in `services/incidents.ts` (2-minute window, 10/day per
browser) is a courtesy, never the control.

Contract the frontend already implements (`services/client.ts`):

- 429 responses are surfaced as `HttpError` with `retryAfterSeconds` parsed
  from `Retry-After` (delta-seconds **or** HTTP-date forms).
- `isRateLimited()` / `rateLimitMessage()` render a human message that states
  the wait; the anonymous intake shows it inline (`data-throttle-error`).
- Auth lockout (5 attempts / 10 minutes) is enforced by the backend in
  production; the demo mock mirrors the same UX.

---

## 3. localStorage policy — what is stored, and never after API switch

| Key | Contents | Mode |
| --- | --- | --- |
| `skyshield.theme`, `skyshield.prefs.v1:*` | UI preferences only | both |
| `skyshield.store.v1` | demo register (incidents, CAPAs, …) | **mock only** |
| `skyshield.report.draft.v1` | unsent report draft | both |
| `skyshield.offline.queue.v1` | queued offline reports | both |
| `skyshield.anon.throttle` | intake throttle timestamps | both |
| `skyshield.auth.users.v1`, `skyshield.auth.session` | **demo credentials store** (salt + PBKDF2 hashes, session object) | **mock only — labelled demo-only in the README security notice** |

With `VITE_USE_MOCK=false`, `authService` delegates every call to the backend
and **stores nothing auth-related**: sessions must live in `HttpOnly`,
`Secure`, `SameSite=Lax` cookies set by Django; no tokens in
localStorage/sessionStorage. Before a production launch, confirm with:

```js
// console, API mode, after sign-in:
Object.keys(localStorage).filter(k => k.startsWith('skyshield.auth'))  // → []
```

The demo credential store never leaves the browser and contains no real
secrets (fixture accounts, `demo1234`); it must not be shipped as the
production auth path — that is what the DRF switch is for.

---

## 4. Data export & erasure paths (GDPR-shaped)

- **Export:** every register view exports its filtered set to CSV
  (incidents, CAPA, compliance, analytics, risk register). The audit history
  tab exports per record. In API mode these become backend-generated exports
  (`GET /api/v1/export/*`) so large sets never page through the client.
- **Erasure (demo):** Settings → System → **Reset demo data** wipes
  `skyshield.store.v1` (and the reset button on the report draft clears
  `skyshield.report.draft.v1`).
- **Erasure (production):** reporter-identity reveal is already audited
  (`revealReporter`); the backend must add (a) per-record erasure with a
  retained audit stub, (b) account erasure cascading sessions, and (c) an
  export archive endpoint. Confidentiality classifications
  (`internal / restricted / open`) drive who can see narratives; the frontend
  already withholds reporter identities on restricted records until an
  audited reveal.
- **Retention:** the compliance register states the operator retention policy
  (7 years, CAR 5.12); the backend enforces it — the frontend never deletes
  records silently.

---

## 5. Build & serve checklist

1. `npm ci && npm run build` (typecheck + bundle).
2. `npm run size-gate` — bundle budgets.
3. Serve `dist/` statically behind TLS with the headers above; SPA fallback
   to `/index.html` for all non-asset routes.
4. Set `VITE_API_BASE_URL` and `VITE_USE_MOCK=false` **at build time** (Vite
   inlines env) and rebuild.
5. Smoke the deployment: `BASE=https://your-host npm run smoke`.
6. Verify CSP in the browser console (no violations on load, theme script
   hash accepted) and confirm §3's empty-auth-storage check in API mode.
