/**
 * Interactive flow checks. Drives the real app in headless Chrome over CDP and
 * asserts that multi-step forms, filters and dialogs actually work — the class
 * of defect a static screenshot cannot reveal.
 *
 * Usage: node scripts/flows.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const PORT = 9400 + Math.floor(Math.random() * 300)

// Network mode: the served app was built with VITE_USE_MOCK=false and talks
// to the real Django API through the vite proxy. The suite then bootstraps
// its session with a real login instead of relying on the mock's seeded
// localStorage session, and role swaps become real re-logins (the server
// re-validates every guard against the session user — swapping storage alone
// would be a client-side lie the API would refuse).
const NETWORK = process.env.VITE_USE_MOCK === 'false' || process.env.FLOWS_NETWORK === '1'

// Preflight: the app must actually be served before a browser is spawned —
// otherwise every wait below would time out against a dead origin and the
// failure would look like an app bug instead of a missing server.
try {
  const res = await fetch(`${BASE}/`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
} catch (e) {
  console.error(
    `flows: ${BASE} is not serving the app (${e.message}).\n` +
      'Start it first:  npm run dev    (or:  npm run build && npm run preview -- --port 5173)',
  )
  process.exit(2)
}

// Hermetic run: a fresh profile per invocation, so no storage or state can
// leak between runs.
const PROFILE_DIR = mkdtempSync(path.join(tmpdir(), 'skyshield-flows-'))

const chrome = spawn(
  '/usr/bin/google-chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--metrics-recording-only',
    '--mute-audio',
    // The suite drives a single tab: cap the renderer pool so the whole
    // stack (Django + preview + Chrome) stays inside small CI/sandbox memory
    // budgets — an OOM-killed renderer mid-run shows up as a mysterious
    // "Promise was collected", not as a memory error.
    '--renderer-process-limit=4',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

// No orphans: if the suite dies (uncaught CDP error, signal), Chrome must die
// with it — a stray headless browser silently eats the next run's memory.
process.on('exit', () => {
  try {
    chrome.kill()
  } catch {
    /* already gone */
  }
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let wsUrl
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    const j = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    wsUrl = j.webSocketDebuggerUrl
  } catch {
    await sleep(250)
  }
}

const sock = new WebSocket(wsUrl)
await new Promise((res, rej) => {
  sock.onopen = res
  sock.onerror = rej
})

let id = 0
const pend = new Map()
const consoleErrors = []
// Main-frame commit counter: go() must not probe readiness before the NEW
// document commits — on a same-URL reload the old document still satisfies
// every ready condition, and interacting "on the new page" then lands on a
// context Chrome is about to swap out ("Promise was collected").
let navCount = 0
sock.onmessage = (m) => {
  const x = JSON.parse(m.data)
  if (x.id && pend.has(x.id)) {
    const { res, rej } = pend.get(x.id)
    pend.delete(x.id)
    if (x.error) rej(new Error(JSON.stringify(x.error)))
    else res(x.result)
  } else if (x.method === 'Page.frameNavigated' && !x.params.frame.parentId) {
    navCount++
    console.error(`flows: [cdp] main-frame committed -> ${x.params.frame.url}`)
  } else if (x.method === 'Page.javascriptDialogOpening') {
    console.error(`flows: [cdp] dialog opened (${x.params.type}): ${x.params.message}`)
  } else if (x.method === 'Inspector.targetCrashed') {
    console.error('flows: [cdp] TARGET CRASHED')
  } else if (x.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(
      String(
        x.params.exceptionDetails?.exception?.description ?? x.params.exceptionDetails?.text,
      ).slice(0, 240),
    )
  } else if (x.method === 'Runtime.consoleAPICalled' && x.params.type === 'error') {
    consoleErrors.push(
      x.params.args
        ?.map((a) => a.value ?? a.description)
        .join(' ')
        .slice(0, 240),
    )
  }
}

const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const n = ++id
    pend.set(n, { res, rej })
    sock.send(JSON.stringify({ id: n, method, params, sessionId }))
  })

/** send() with a hard deadline — a wedged renderer must fail the suite, not stall it. */
const sendT = (method, params, sessionId, ms = 25000) =>
  Promise.race([
    send(method, params, sessionId),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`CDP timeout: ${method} did not answer within ${ms}ms`)), ms),
    ),
  ])

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)

await S('Page.enable')
await S('Runtime.enable')
await S('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1100,
  deviceScaleFactor: 1,
  mobile: false,
})

/** Evaluate in page and return a JSON value. */
// A document swap (browser-level navigation committing while an eval is in
// flight) answers with a context error or collects the awaited promise
// outright. The swap is transient — retrying after it settles recovers, and
// crashing the whole suite does not. Helpers survive the swap because they
// are also registered via Page.addScriptToEvaluateOnNewDocument.
const CONTEXT_RACE =
  /Promise was collected|Inspected target navigated or closed|Target closed|Cannot find context|Context was destroyed/i
const evalJs = async (expression, attempts = 2) => {
  for (let i = 0; ; i++) {
    try {
      const { result, exceptionDetails } = await sendT(
        'Runtime.evaluate',
        {
          expression: `(async () => { ${expression} })()`,
          returnByValue: true,
          awaitPromise: true,
        },
        sessionId,
      )
      if (exceptionDetails)
        throw new Error(exceptionDetails.exception?.description ?? 'eval failed')
      return result?.value
    } catch (e) {
      if (i >= attempts || !CONTEXT_RACE.test(String(e?.message ?? e))) throw e
      console.error(`flows: [cdp] context race on eval — retry ${i + 1}`)
      await sleep(350)
    }
  }
}

/** Poll `probe` until truthy; on timeout throw with a page-state diagnosis. */
const waitFor = async (label, probe, timeoutMs = 25000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const v = await probe().catch(() => null)
    if (v) return v
    await sleep(200)
  }
  const diag = await evalJs(`
    return {
      url: location.href,
      ready: document.readyState,
      spinner: !!document.querySelector('.animate-spin'),
      shell: !!document.querySelector('aside[aria-label="Primary"]'),
      session: !!(localStorage.getItem('skyshield.auth.session') ||
        sessionStorage.getItem('skyshield.auth.session')),
      authKeys: Object.keys(localStorage).filter((k) => k.startsWith('skyshield.auth')),
      body: (document.body.innerText || '').slice(0, 160),
    }
  `).catch((e) => ({ probeError: String(e?.message ?? e).slice(0, 160) }))
  throw new Error(`flows: timeout waiting for ${label} — page state: ${JSON.stringify(diag)}`)
}

const go = async (route) => {
  // Page.navigate can collide with a renderer-initiated navigation (a late
  // reload, a leave-guard dialog): Chrome then answers the command with a
  // navigation error instead of frame/loader ids. Navigating again is
  // idempotent, so retry the race instead of crashing the suite.
  const seenNav = navCount
  for (let attempt = 0; ; attempt++) {
    try {
      await S('Page.navigate', { url: `${BASE}${route}` })
      break
    } catch (e) {
      const msg = String(e?.message ?? e)
      if (
        attempt >= 2 ||
        !/Inspected target navigated or closed|Target closed|Cannot find context/i.test(msg)
      )
        throw e
      await sleep(400)
    }
  }

  // Wait for the new document to COMMIT before probing readiness — see the
  // navCount comment. On a same-URL reload every ready probe below would
  // otherwise pass on the stale document, and later evals would land on a
  // context Chrome is about to swap out.
  const wantPath = route.split('?')[0]
  await waitFor(
    `commit:${route}`,
    async () => {
      if (navCount > seenNav) return true
      // Fallback: the commit event was missed (navigate raced a renderer
      // navigation) — a live probe of the new URL proves the same thing.
      return await evalJs(
        `return location.pathname === ${JSON.stringify(wantPath)} ? true : null`,
      ).catch(() => null)
    },
    15000,
  )

  // Real readiness instead of "shell appeared + 600ms":
  //  - app routes: the shell renders AND the demo session exists in storage.
  //    mockAuth.init() writes the seeded session before the provider leaves
  //    'loading', and RequireAuth renders the shell only after status
  //    resolves — so both together prove authentication finished.
  //  - public routes (login/signup/report): no spinner, document complete and
  //    content painted; a session is not required there (signed-out section).
  await waitFor(`ready:${route}`, () =>
    evalJs(`
      const spinner = !!document.querySelector('.animate-spin');
      const shell = !!document.querySelector('aside[aria-label="Primary"]') &&
        document.querySelectorAll('#skyshield-main h1').length > 0;
      const session = !!(localStorage.getItem('skyshield.auth.session') ||
        sessionStorage.getItem('skyshield.auth.session'));
      if (shell && session) return 'app';
      if (!spinner && document.readyState === 'complete' &&
          (document.querySelector('form') || document.querySelector('h1')))
        return 'public';
      return null;
    `),
  )

  // Settle, then re-verify once: a cold vite start can perform a
  // dependency-optimisation full reload right after first paint — never
  // interact mid-reload.
  await sleep(500)
  await waitFor(
    `stable:${route}`,
    () =>
      evalJs(
        `return document.readyState === 'complete' && !document.querySelector('.animate-spin')`,
      ),
    15000,
  )
}

/**
 * Session helpers. The seeded demo session lives in localStorage
 * (remember=true), but a UI demo login writes sessionStorage (remember=false)
 * — mirror getCurrentSession(): read either, write back where it lives, and
 * fail with a diagnosis instead of a bare null-property TypeError.
 */
const requireSession = async (where) => {
  const raw = await evalJs(`
    return window.localStorage.getItem('skyshield.auth.session') ??
      window.sessionStorage.getItem('skyshield.auth.session');
  `)
  if (!raw)
    throw new Error(
      `flows: no demo session in either storage at "${where}". The seeded session is written by ` +
        'mockAuth.init() during the first authenticated load and go() waits for it; something ' +
        'signed out or cleared storage unexpectedly.',
    )
  return raw
}

/**
 * Network mode only: log in through the real API (same-origin fetch so the
 * session cookie lands on the app's host) and cache the SessionData exactly
 * where realAuth reads it — the storage rules of mockAuth.saveSession().
 */
const apiLogin = async (email, password, remember) =>
  evalJs(`
    const res = await fetch('/api/v1/auth/login/', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ${JSON.stringify(email)}, password: ${JSON.stringify(password)}, remember: ${remember ? 'true' : 'false'} }),
    });
    if (!res.ok) return { error: res.status, body: (await res.text().catch(() => '')).slice(0, 200) };
    const session = await res.json();
    const KEY = 'skyshield.auth.session';
    window.localStorage.removeItem('skyshield.auth.logged_out');
    if (session.remember) {
      window.localStorage.setItem(KEY, JSON.stringify(session));
      window.sessionStorage.removeItem(KEY);
    } else {
      window.sessionStorage.setItem(KEY, JSON.stringify(session));
      window.localStorage.removeItem(KEY);
    }
    return { ok: true, user: session.user };
  `)

const INVESTIGATOR_PATCH =
  "id: 'usr_003', name: 'R. Singh', initials: 'RS', role: 'investigator', title: 'Aircraft Accident Investigator', email: 'r.singh@skysafety.aero'"

const swapSessionUser = async (where, userPatch) => {
  if (NETWORK) {
    // Real re-login as the patched identity — the server session must match
    // what the storage cache claims, or every guarded call would 403.
    const email = (userPatch.match(/email: '([^']+)'/) || [])[1]
    const expectedId = (userPatch.match(/id: '([^']+)'/) || [])[1]
    if (!email) throw new Error(`flows: cannot swap session at "${where}": no email in patch`)
    const res = await apiLogin(email, 'demo1234', true)
    if (!res?.ok)
      throw new Error(`flows: session swap login failed at "${where}": ${JSON.stringify(res)}`)
    if (expectedId && res.user?.id !== expectedId)
      throw new Error(
        `flows: session swap at "${where}" logged in ${res.user?.id}, expected ${expectedId}`,
      )
    return
  }
  await requireSession(where)
  await evalJs(`
    const KEY = 'skyshield.auth.session';
    const store = window.localStorage.getItem(KEY) !== null ? window.localStorage : window.sessionStorage;
    const raw = store.getItem(KEY);
    store.setItem(KEY + '.bak', raw);
    const s = JSON.parse(raw);
    s.user = { ...s.user, ${userPatch} };
    store.setItem(KEY, JSON.stringify(s));
  `)
}

const restoreSession = async () => {
  if (NETWORK) {
    const res = await apiLogin('demo@skyshield.aero', 'demo1234', true)
    if (!res?.ok) throw new Error(`flows: session restore login failed: ${JSON.stringify(res)}`)
    return
  }
  await evalJs(`
    const KEY = 'skyshield.auth.session';
    for (const store of [window.localStorage, window.sessionStorage]) {
      const bak = store.getItem(KEY + '.bak');
      if (bak !== null) {
        store.setItem(KEY, bak);
        store.removeItem(KEY + '.bak');
      }
    }
  `)
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail && !ok ? ` — ${detail}` : ''}`)
}

/* ------------------------------------------------------ helpers in page */

const HELPERS = `
  window.__t = (sel) => document.querySelector(sel);
  window.__all = (sel) => [...document.querySelectorAll(sel)];
  window.__byText = (sel, text) =>
    window.__all(sel).find((e) => (e.textContent || '').trim().toLowerCase().includes(text.toLowerCase()));
  window.__click = (el) => {
    if (!el) return false;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
  };
  window.__setInput = (el, value) => {
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  window.__type = async (el, value) => {
    if (!el) return false;
    el.focus();
    window.__setInput(el, value);
    await new Promise((r) => setTimeout(r, 60));
    return true;
  };
  // Register re-fetch settle: absorb the 220ms filter debounce, then poll
  // until the table shows the FILTERED result — not merely "a table". Under
  // CPU load the debounce can fire after the pre-wait expires, and a plain
  // skeleton check would break on the stale unfiltered rows (the server is
  // already answering the search while the DOM still shows the old page).
  // Every row of a ref search carries the ref; stale rows do not. The mock
  // store resolves in one pass; over the network this covers the round trip.
  window.__settleTable = async (query = '', debounceMs = 220) => {
    await new Promise((r) => setTimeout(r, debounceMs + 200));
    const deadline = Date.now() + 15000;
    let rows = [];
    for (;;) {
      rows = window.__all('tbody tr');
      const skeleton = !!document.querySelector('tbody .animate-pulse');
      const matches =
        query === ''
          ? rows.some((r) => (r.innerText || '').trim().length > 0)
          : rows.every((r) => (r.innerText || '').includes(query));
      if (!skeleton && (rows.length === 0 || matches)) break;
      if (Date.now() > deadline) break;
      await new Promise((r) => setTimeout(r, 150));
    }
    return { n: rows.length, text: rows.map((r) => r.innerText).join(' ') };
  };
`

// Helpers must survive document swaps (see evalJs retry): registering them
// for every new document means a retried eval never lands on a bare window.
await S('Page.addScriptToEvaluateOnNewDocument', { source: HELPERS })

if (NETWORK) {
  // The network-mode app boots signed-out (no mock seed session): log in
  // through the real endpoint on the app's origin so the session cookie AND
  // the cached SessionData exist before the first authenticated route loads.
  await S('Page.navigate', { url: `${BASE}/login` })
  await waitFor('network bootstrap: login page', () =>
    evalJs(
      `return document.readyState === 'complete' && !!document.querySelector('input[type="email"]')`,
    ),
  )
  const boot = await apiLogin('demo@skyshield.aero', 'demo1234', true)
  if (!boot?.ok) throw new Error(`flows: network bootstrap login failed: ${JSON.stringify(boot)}`)
  if (boot.user?.id !== 'usr_001')
    throw new Error(`flows: bootstrap expected usr_001, got ${JSON.stringify(boot.user)}`)
  console.log(`\nnetwork mode: bootstrapped a real API session for ${boot.user?.email}`)
}

await go('/dashboard')
await evalJs(HELPERS)

/* ================================================ 1. report form wizard */

console.log('\nReport incident wizard (guided mode)')
await evalJs(`window.localStorage.removeItem('skyshield.report.draft.v1')`)
await go('/incidents/report?mode=guided')
await evalJs(HELPERS)

const hasStep = async (label) =>
  evalJs(
    `return (document.body.innerText || '').toLowerCase().includes(${JSON.stringify(label.toLowerCase())});`,
  )

check('step 1 visible', await hasStep('Basic Information'))
// Continue stays enabled; an invalid step answers with a validation summary.
await evalJs(`
  const b = window.__all('button').find(x => /continue/i.test(x.textContent||''));
  window.__click(b);
`)
await sleep(400)
check(
  'invalid step shows a validation summary',
  await evalJs(`
  const sum = document.querySelector('[data-step-summary]');
  return !!sum && /field/i.test(sum.textContent||'');
`),
)
check('invalid step does not advance', await hasStep('Basic Information'))

// Fill step 1
await evalJs(`
  const inputs = window.__all('input');
  const date = inputs.find(i => i.type === 'date');
  const time = inputs.find(i => i.type === 'time');
  if (date) window.__setInput(date, '2026-09-27');
  if (time) window.__setInput(time, '14:35');
`)
await sleep(400)

// Aircraft registration is a Radix select — open it and pick an option.
await evalJs(`
  const trigger = window.__all('[role="combobox"]').find(b => /select registration/i.test(b.textContent||''));
  window.__click(trigger);
`)
await sleep(450)
const pickedReg = await evalJs(`
  const opt = window.__all('[role="option"]').find(o => /VT-ALB/.test(o.textContent||''));
  if (!opt) return false;
  opt.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  window.__click(opt);
  return true;
`)
await sleep(600)
check('aircraft registration selectable', pickedReg === true)

const typeAutoFilled = await evalJs(`
  const inputs = window.__all('input');
  const t = inputs.find(i => (i.placeholder||'').includes('aircraft first'));
  return t ? t.value : 'missing';
`)
check(
  'aircraft type auto-fills from fleet',
  typeAutoFilled === 'A320neo',
  `got "${typeAutoFilled}"`,
)

const cont1 = await evalJs(`
  const b = window.__all('button').find(x => /continue/i.test(x.textContent||'') && !x.disabled);
  window.__click(b);
  return !!b;
`)
await sleep(700)
check('advance to step 2', cont1 && (await hasStep('Incident Classification')))

// Step 2: classification -> risk score should compute
await evalJs(`
  const type = window.__byText('button', 'Runway Excursion');
  window.__click(type);
`)
await sleep(250)
// Severity and likelihood render as separate rows; match on the row, not the
// first descendant, so the exact control is clicked.
await evalJs(`
  const sevRow = (label) => window.__all('button').find(b =>
    (b.textContent||'').replace(/\\s+/g,' ').trim().endsWith(label) && b.className.includes('rounded-md'));
  window.__click(sevRow('4'));
`)
await sleep(300)
await evalJs(`
  const likRow = (label) => window.__all('button').find(b =>
    (b.textContent||'').replace(/\\s+/g,' ').trim().endsWith(label) && b.className.includes('rounded-md'));
  window.__click(likRow('Likely'));
`)
await sleep(500)

const risk = await evalJs(`
  const txt = document.body.innerText;
  const i = txt.toLowerCase().indexOf('computed risk');
  return txt.slice(i, i + 130).replace(/\\n+/g, ' | ');
`)
check('risk score computed (High=4 x Likely=4 => 16)', /\b16\b/.test(String(risk)), String(risk))

// Continue to step 3 (needs category + severity)
const cont2 = await evalJs(`
  const b = window.__all('button').find(x => /continue/i.test(x.textContent||'') && !x.disabled);
  window.__click(b);
  return !!b;
`)
await sleep(700)
check('advance to step 3 (description)', cont2 && (await hasStep('Description')))

/* ============================================= 2. review step + submit */

await evalJs(`
  const ta = window.__all('textarea')[0];
  window.__type(ta, 'During the landing roll the aircraft veered right after touchdown and departed the paved surface, coming to rest on the shoulder approximately ninety metres past the design touchdown zone.');
`)
await sleep(1400) // autosave debounce is 800ms

// reload — the draft must come back (S5 exit criterion: autosave restore)
await go('/incidents/report?mode=guided')
await evalJs(HELPERS)
const restored = await evalJs(`
  const banner = (document.body.innerText||'').includes('Restored an unsaved draft');
  const ta = window.__all('textarea')[0];
  return { banner, kept: !!ta && /veered right/.test(ta.value||'') };
`)
check(
  'autosave restores the draft after reload',
  restored.banner === true && restored.kept === true,
  JSON.stringify(restored),
)
await sleep(300)

await evalJs(`
  const b = window.__all('button').find(x => /continue/i.test(x.textContent||'') && !x.disabled);
  window.__click(b); return !!b;
`)
await sleep(600)
await evalJs(
  `window.__click(window.__all('button').find(x=>/continue/i.test(x.textContent||'') && !x.disabled));`,
)
await sleep(600) // step 5

// M4: drop a real File into the evidence input. The wizard must compute the
// genuine SHA-256 chain-of-custody hash in the page (no more decorative
// random hex) — 4353a1de… is the digest of these exact 12 bytes.
const evInjected = await evalJs(`
  const input = window.__all('input').find(i => i.type === 'file');
  if (!input) return 'no-file-input';
  const dt = new DataTransfer();
  dt.items.add(new File([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])], 'arff-scene.png', { type: 'image/png' }));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'injected';
`)
await sleep(900)
const evHashed = await evalJs(`
  const t = document.body.innerText;
  const m = t.match(/hash\\s*\\n?\\s*([0-9a-f]{8}…|computing…)/);
  return { listed: t.includes('arff-scene.png'), shown: m ? m[1] : null };
`)
check(
  'evidence step registers the real SHA-256 of the dropped file',
  evInjected === 'injected' && evHashed.listed === true && evHashed.shown === '4353a1de…',
  JSON.stringify(evHashed),
)

await evalJs(
  `window.__click(window.__all('button').find(x=>/continue/i.test(x.textContent||'') && !x.disabled));`,
)
await sleep(600) // step 6
await evalJs(`
  const ta = window.__all('textarea').pop();
  window.__type(ta, 'Aircraft recovered under ARFF actions. Brake temperature sensor removed and tested. Aircraft returned to service after rectification.');
`)
await sleep(500)
await evalJs(
  `window.__click(window.__all('button').find(x=>/continue/i.test(x.textContent||'') && !x.disabled));`,
)
await sleep(800)

const onReview = await hasStep('Review & Submit')
check('reaches review step', onReview)

const reviewHas = await evalJs(`
  const t = document.body.innerText;
  // The right-hand live risk rail and the step-7 review panel both state the
  // score, so assert against the whole document plus the review grid region.
  const i = t.indexOf('Basic information');
  const review = i >= 0 ? t.slice(i - 700, i) : t;
  return {
    risk: /16/.test(review),
    // 16 sits in the CRITICAL band (15-25); HIGH is 10-14. Assert the band
    // actually derived from the score rather than a hard-coded label.
    band: (review.match(/\\b(LOW|MODERATE|HIGH|CRITICAL)\\b/i) || [])[0] || null,
    reg: /VT-ALB/.test(t),
    sections: ['Basic information', 'Classification', 'Description', 'People & organisations', 'Evidence', 'Immediate actions']
      .filter(s => t.toLowerCase().includes(s.toLowerCase())).length,
  };
`)
check('review shows risk score 16', reviewHas.risk || reviewHas.anywhere, JSON.stringify(reviewHas))
check(
  'review derives the correct risk band for 16',
  String(reviewHas.band).toUpperCase() === 'CRITICAL',
  `band=${reviewHas.band}`,
)
check('review shows aircraft', reviewHas.reg)
check('review summarises all sections', reviewHas.sections >= 5, `${reviewHas.sections}/6`)

const submitted = await evalJs(`
  const b = window.__all('button').find(x => /submit occurrence/i.test(x.textContent||'') && !x.disabled);
  if (!b) return 'no-submit-button';
  window.__click(b);
  return 'clicked';
`)
await sleep(1800)
const filed = await evalJs(`return (document.body.innerText||'').includes('Occurrence filed');`)
check('submits and confirms filing', filed === true, String(submitted))

// Stateful store (S11): the filed record must survive a full page reload.
const filedRef = await evalJs(`
  const m = (document.body.innerText.match(/P_006-\\d{3}/) || []);
  return m[0] || null;
`)
await go('/incidents')
await evalJs(HELPERS)
const survives = await evalJs(`
  const s = window.__all('input').find(i => (i.getAttribute('aria-label')||'').includes('Search'));
  const typed = window.__type(s, ${JSON.stringify(filedRef)});
  const r = await window.__settleTable(${JSON.stringify(filedRef)});
  return { n: r.n, text: r.text, typed, val: s ? s.value : null };
`)
check(
  'filed report survives a reload (stateful store)',
  filedRef !== null && survives.n === 1 && survives.text.includes(String(filedRef)),
  `ref=${filedRef} rows=${survives.n} typed=${survives.typed} val=${survives.val}`,
)
await evalJs(`
  const s = window.__all('input').find(i => (i.getAttribute('aria-label')||'').includes('Search'));
  window.__setInput(s, '');
`)
await sleep(700)

/* ============================================ 2b. quick report (default) */

console.log('\nQuick report')
await evalJs(`window.localStorage.removeItem('skyshield.report.draft.v1')`)
await go('/incidents/report')
await evalJs(HELPERS)

check(
  'quick report is the default mode',
  (await evalJs(`
    return (document.body.innerText||'').includes('Quick report') &&
      !!window.__byText('button', 'File occurrence');
  `)) === true,
)

// Filing an incomplete quick report answers with a summary, not silence.
await evalJs(`window.__click(window.__byText('button', 'File occurrence'))`)
await sleep(400)
check(
  'incomplete quick report shows a validation summary',
  (await evalJs(`return !!document.querySelector('[data-quick-summary]')`)) === true,
)

/** Open a Radix select by trigger text and pick an option (pointerup + click). */
const pickOption = async (triggerText, optionText) => {
  await evalJs(`
    const t = window.__all('[role="combobox"]').find(b => (b.textContent||'').includes(${JSON.stringify(triggerText)}));
    window.__click(t);
  `)
  await sleep(450)
  const ok = await evalJs(`
    const opt = window.__all('[role="option"]').find(o => (o.textContent||'').includes(${JSON.stringify(optionText)}));
    if (!opt) return false;
    opt.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    window.__click(opt);
    return true;
  `)
  await sleep(400)
  return ok === true
}

const picked =
  (await pickOption('Select registration', 'VT-ALB')) &&
  (await pickOption('Select incident type', 'Runway Excursion')) &&
  (await pickOption('Assess severity', 'High'))
check('quick report selects register', picked === true, String(picked))

await evalJs(`
  const ta = window.__all('textarea')[0];
  window.__type(ta, 'During pushback the tow tractor shear pin failed and the aircraft contacted the ground power unit, causing minor skin damage.');
`)
await sleep(500)

// Live risk: High (4) × default likelihood 3 = 12 in the sticky rail.
const quickRisk = await evalJs(`
  const txt = document.body.innerText;
  const i = txt.toLowerCase().indexOf('computed risk');
  return txt.slice(i, i + 120).replace(/\\n+/g, ' | ');
`)
check(
  'quick report computes live risk (4 × 3 = 12)',
  /\b12\b/.test(String(quickRisk)),
  String(quickRisk),
)

await evalJs(`window.__click(window.__byText('button', 'File occurrence'))`)
await sleep(1800)
const quickFiled = await evalJs(
  `return (document.body.innerText||'').includes('Occurrence filed');`,
)
check('quick report files the occurrence', quickFiled === true, String(quickFiled))
const draftCleared = await evalJs(
  `return window.localStorage.getItem('skyshield.report.draft.v1') === null`,
)
check('draft cleared after filing', draftCleared === true, String(draftCleared))

/* ================================================ 3. table filters/sort */

console.log('\nIncident register')
await go('/incidents')
await evalJs(HELPERS)

const initialRows = await evalJs(`return window.__all('tbody tr').length`)
check('table renders rows', initialRows > 0, String(initialRows))

// search — settled deterministically: every visible row must carry the ref
// (a fixed sleep can sample the pre-filter table under load)
const searched = await evalJs(`
  const s = window.__all('input').find(i => (i.getAttribute('aria-label')||'').includes('Search'));
  window.__type(s, 'P_006-258');
  return await window.__settleTable('P_006-258');
`)
check(
  'search narrows the table',
  searched.n === 1 && searched.text.includes('P_006-258'),
  JSON.stringify(searched).slice(0, 120),
)

// clear
await evalJs(`
  const s = window.__all('input').find(i => (i.getAttribute('aria-label')||'').includes('Search'));
  window.__setInput(s, '');
`)
await sleep(800)

// saved views (S4)
const viewTabs = await evalJs(
  `return window.__all('[role="tab"]').map(t => (t.textContent||'').trim())`,
)
check(
  'saved-view tabs render',
  ['All', 'Open', 'Critical'].every((v) => viewTabs.some((t) => t.startsWith(v))),
  JSON.stringify(viewTabs),
)

// single Filters popover → apply Critical → removable chip round-trip (S4 exit criterion)
await evalJs(`window.__click(window.__t('[data-filters-trigger]'));`)
await sleep(500)
const sevApplied = await evalJs(`
  const box = window.__all('[role="checkbox"]').find(o => (o.closest('label')?.textContent||'').trim().startsWith('Critical'));
  if (!box) return 'no-option';
  window.__click(box);
  return true;
`)
await sleep(1000)
await evalJs(`document.body.dispatchEvent(new MouseEvent('click', {bubbles:true}));`)
await sleep(400)
const chipState = await evalJs(`
  const chips = window.__all('[data-filter-chip]');
  return { n: chips.length, text: chips.map(c => c.textContent).join('|'), rows: window.__all('tbody tr').length };
`)
check(
  'severity filter applies and shows a chip',
  sevApplied === true && chipState.n >= 1 && /Critical/.test(chipState.text),
  JSON.stringify(chipState).slice(0, 140),
)

await evalJs(`window.__click(window.__t('[data-filter-chip] button'));`)
await sleep(1000)
const afterChip = await evalJs(`
  return { chips: window.__all('[data-filter-chip]').length, rows: window.__all('tbody tr').length };
`)
check(
  'chip removal clears the filter',
  afterChip.chips === 0 && afterChip.rows >= initialRows,
  JSON.stringify(afterChip),
)

// column show/hide persists across reload (S4 exit criterion)
await evalJs(`window.__click(window.__t('[data-columns-trigger]'));`)
await sleep(500)
await evalJs(`
  const box = window.__all('[role="checkbox"]').find(o => (o.closest('label')?.textContent||'').includes('Investigator'));
  window.__click(box);
`)
await sleep(400)
const headerGone = await evalJs(
  `return !(document.body.innerText||'').includes('Assigned Investigator')`,
)
check('column toggle hides the column', headerGone === true, String(headerGone))
await go('/incidents')
await evalJs(HELPERS)
const persisted = await evalJs(
  `return !(document.body.innerText||'').includes('Assigned Investigator')`,
)
check('column choice survives reload', persisted === true, String(persisted))
// restore the default column set so later flows see the stock table.
// Best-effort cleanup: this is the suite's only in-page awaited eval at a
// page boundary, where a context swap answers "Promise was collected" — a
// cleanup step must not be able to crash the whole run.
try {
  await evalJs(`
    window.__click(window.__t('[data-columns-trigger]'));
    await new Promise(r => setTimeout(r, 300));
    window.__click(window.__byText('button', 'Reset'));
  `)
} catch (e) {
  console.error(`flows: column restore skipped (${String(e?.message ?? e).slice(0, 120)})`)
  await go('/incidents')
  await evalJs(HELPERS)
}
await sleep(400)

/* ================================================= 4. incident tabs */

console.log('\nIncident detail tabs')
await go('/incidents/inc_001')
await evalJs(HELPERS)
/** Click an element with a real trusted mouse sequence at its centre. */
const realClick = async (selector) => {
  const box = await evalJs(`
    const el = ${selector};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 220));
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `)
  if (!box) return false
  for (const type of ['mousePressed', 'mouseReleased']) {
    await S('Input.dispatchMouseEvent', {
      type,
      x: box.x,
      y: box.y,
      button: 'left',
      clickCount: 1,
    })
  }
  return true
}

// Radix activates a tab on mousedown, so drive real input rather than a
// synthetic click. Each tab asserts on content unique to it.
// Assert on content that lives inside the panel, not on the tab bar.
const TABS = [
  ['Risk Assessment', 'Matrix position'],
  ['Investigation', 'Investigation team'],
  ['Evidence', 'QAR-2214_Event_Report.pdf'],
  ['Timeline', 'Occurrence reported'],
  ['RCA', 'Uncommanded thrust surge — engine control unit'],
  ['CAPA', 'Embody SB-ENG-441'],
  ['Audit History', 'Investigation opened'],
]
for (const [label, expect] of TABS) {
  const clicked = await realClick(
    `[...document.querySelectorAll('[role="tab"]')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)}))`,
  )
  await sleep(650)
  const shown = await evalJs(`
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    return { len: panel ? panel.innerText.length : 0, has: panel ? panel.innerText.includes(${JSON.stringify(expect)}) : false };
  `)
  if (!shown.has) {
    const dump = await evalJs(`
      const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
      return panel ? panel.innerText.slice(0, 260) : 'no panel';
    `)
    console.log(`      content: ${String(dump).replace(/\n/g, ' / ').slice(0, 240)}`)
  }
  check(
    `tab "${label}" shows "${expect}"`,
    clicked && shown.has === true,
    `clicked=${clicked} len=${shown.len}`,
  )
}

/* ================================== 4a. filed evidence round-trip (M4) */

console.log('\nFiled evidence (M4)')
// The wizard filed an occurrence carrying arff-scene.png. In network mode the
// bytes must now live server-side with the real hash and stream back down;
// in mock mode the local registry holds the identical record.
const EXPECTED_SHA = '4353a1de7e0dcc4e87350e22d5c9ee9f3e70e8ce9c31533ec991bee8870c4814'
let filedDetailPath = null
if (NETWORK) {
  const m4 = await evalJs(`
    const ref = ${JSON.stringify(filedRef)};
    const list = await (await fetch('/api/v1/incidents/?search=' + encodeURIComponent(ref), { credentials: 'include' })).json();
    const inc = (list.items || [])[0];
    if (!inc) return { err: 'incident not found' };
    const ev = await (await fetch('/api/v1/incidents/' + inc.id + '/evidence/', { credentials: 'include' })).json();
    const item = ev.find((x) => x.name === 'arff-scene.png');
    if (!item) return { err: 'evidence missing', n: ev.length };
    const dl = await fetch(item.url, { credentials: 'include' });
    const bytes = new Uint8Array(await dl.arrayBuffer());
    return {
      id: inc.id, hash: item.hash, verified: item.verified, count: inc.evidenceCount,
      dlOk: dl.ok, dlMatch: bytes.length === 12 && bytes[0] === 137 && bytes[3] === 71,
    };
  `)
  check(
    'server stored the filed evidence and streams the exact bytes back',
    m4.hash === EXPECTED_SHA &&
      m4.verified === true &&
      m4.count >= 1 &&
      m4.dlOk === true &&
      m4.dlMatch === true,
    JSON.stringify(m4),
  )
  filedDetailPath = m4.id ? `/incidents/${m4.id}` : null
} else {
  const m4 = await evalJs(`
    const db = JSON.parse(window.localStorage.getItem('skyshield.store.v1') || '{}');
    for (const [id, items] of Object.entries(db.evidence || {})) {
      const item = (items || []).find((x) => x.name === 'arff-scene.png');
      if (item) return { id, hash: item.hash, verified: item.verified };
    }
    return { err: 'not registered' };
  `)
  check(
    'mock registry stored the filed evidence with its real hash',
    m4.hash === EXPECTED_SHA && m4.verified === true,
    JSON.stringify(m4),
  )
  filedDetailPath = m4.id ? `/incidents/${m4.id}` : null
}

if (filedDetailPath) {
  await go(filedDetailPath)
  await evalJs(HELPERS)
  await sleep(900)
  await realClick(
    `[...document.querySelectorAll('[role="tab"]')].find(x => x.textContent.trim().startsWith('Evidence'))`,
  )
  await sleep(900)
  const evTab = await evalJs(`
    const panel = [...document.querySelectorAll('[role="tabpanel"]')].find(p => !p.hidden);
    const t = panel ? panel.innerText : '';
    return {
      name: t.includes('arff-scene.png'),
      hash: t.includes('${EXPECTED_SHA.slice(0, 16)}'),
      download: t.includes('Download file'),
    };
  `)
  check(
    'filed evidence renders on the record with its chain-of-custody hash',
    evTab.name === true && evTab.hash === true,
    JSON.stringify(evTab),
  )
  if (NETWORK)
    check(
      'stored evidence offers an authenticated download',
      evTab.download === true,
      JSON.stringify(evTab),
    )
}

/* ======================================= 4b. CAPA complete → verify (S8) */

console.log('\nCAPA register')
await go('/actions')
await evalJs(HELPERS)

check(
  'summary line renders',
  (await evalJs(`
    const el = document.querySelector('[data-capa-summary]');
    return !!el && /actions in the register/.test(el.textContent || '');
  `)) === true,
)

// Mark-complete requires evidence, then Verify appears for the safety manager.
const markedId = await evalJs(`
  const b = window.__all('[data-mark-complete]')[0];
  if (!b) return null;
  const id = b.getAttribute('data-mark-complete');
  window.__click(b);
  return id;
`)
await sleep(600)
check(
  'complete dialog opened',
  markedId !== null &&
    (await evalJs(`
  return (document.body.innerText || '').includes('Mark action complete');
`)) === true,
  String(markedId),
)

// Confirm stays disabled until real evidence is typed.
const disabledEmpty = await evalJs(`
  const b = window.__t('[data-confirm-complete]');
  return b ? b.disabled : 'missing';
`)
check('confirm blocked without evidence', disabledEmpty === true, String(disabledEmpty))

await evalJs(`
  const ta = window.__all('textarea').find(t => (t.getAttribute('aria-label') || '') === 'Evidence of completion');
  window.__type(ta, 'Work order 4412 closed; seal replacement torque-checked and logged.');
`)
await sleep(200)
await evalJs(`window.__click(window.__t('[data-confirm-complete]'))`)
await sleep(900)

const rowAfterComplete = await evalJs(`
  const row = document.querySelector('[data-capa-row="' + ${JSON.stringify(markedId)} + '"]');
  return row ? { hasVerify: !!row.querySelector('[data-verify]'), text: (row.innerText||'').slice(0,160) } : null;
`)
check(
  'completed row offers Verify to the safety manager',
  rowAfterComplete?.hasVerify === true,
  JSON.stringify(rowAfterComplete).slice(0, 160),
)

await evalJs(`
  const row = document.querySelector('[data-capa-row="' + ${JSON.stringify(markedId)} + '"]');
  window.__click(row && row.querySelector('[data-verify]'));
`)
await sleep(900)
const rowAfterVerify = await evalJs(`
  const row = document.querySelector('[data-capa-row="' + ${JSON.stringify(markedId)} + '"]');
  return row ? /verified/i.test(row.innerText || '') : false;
`)
check(
  'verify seals the action (complete → verify round-trip)',
  rowAfterVerify === true,
  String(rowAfterVerify),
)

// Role gating: an investigator must never see Verify (capa.verify absent).
await swapSessionUser('CAPA role-swap', INVESTIGATOR_PATCH)
await go('/actions')
await evalJs(HELPERS)
const gate = await evalJs(`
  return { verify: window.__all('[data-verify]').length, complete: window.__all('[data-mark-complete]').length };
`)
check(
  'role-gated verify hidden for investigator (edit still allowed)',
  gate.verify === 0 && gate.complete > 0,
  JSON.stringify(gate),
)
// restore the safety-manager session for the remaining sections
await restoreSession()

/* ================================================= 5. risk matrix nav */

console.log('\nRisk matrix + navigation')
await go('/rca/risk-matrix')
await evalJs(HELPERS)
const markerNav = await evalJs(`
  const m = window.__t('button[aria-label^="P_"]');
  if (!m) return 'no-marker';
  window.__click(m);
  await new Promise(r=>setTimeout(r,700));
  return location.pathname;
`)
check(
  'matrix marker navigates to the incident',
  String(markerNav).startsWith('/incidents/'),
  String(markerNav),
)

/* ================================================= 6. sidebar collapse */

await go('/dashboard')
await evalJs(HELPERS)
const railWidth = () =>
  evalJs(`
  const wrapper = document.querySelector('aside')?.parentElement;
  return wrapper ? Math.round(wrapper.getBoundingClientRect().width) : -1;
`)

const wBefore = await railWidth()
const collapsed = await evalJs(`
  const b = window.__all('button').find(x => /collapse navigation/i.test(x.getAttribute('aria-label')||''));
  if (!b) return 'no-toggle';
  window.__click(b);
  await new Promise(r=>setTimeout(r,600));
  return true;
`)
const wAfter = await railWidth()
const restore = await evalJs(`
  const b = window.__all('button').find(x => /expand navigation/i.test(x.getAttribute('aria-label')||''));
  if (!b) return 'no-expand';
  window.__click(b);
  await new Promise(r=>setTimeout(r,600));
  return true;
`)
check(
  'sidebar collapses and expands',
  collapsed === true && restore === true && wAfter < wBefore - 100 && wAfter <= 80,
  `before ${wBefore} → collapsed ${wAfter}px`,
)

/* ------------------------------------------------------- report */

/* ================================================= 7. reports hub (S9) */

console.log('\nReports hub')
await go('/reports?tab=analytics')
await evalJs(HELPERS)

const takeaways = await evalJs(`
  const els = window.__all('[data-takeaway]');
  return { n: els.length, sample: els.slice(0, 2).map((e) => (e.textContent || '').trim()).join(' | ') };
`)
check(
  'analytics renders computed takeaways',
  takeaways.n >= 8,
  JSON.stringify(takeaways).slice(0, 180),
)

const countOf = () =>
  evalJs(`
    const m = (document.body.innerText.match(/([\\d,]+) occurrences/) || []);
    return m[1] ? Number(m[1].replace(/,/g, '')) : -1;
  `)
const beforeFilter = await countOf()
await evalJs(`
  const t = window.__all('[role="combobox"]').find((b) => /all severities/i.test(b.textContent || ''));
  window.__click(t);
`)
await sleep(500)
const pickedSev = await evalJs(`
  const opt = window.__all('[role="option"]').find((o) => /critical/i.test(o.textContent || ''));
  if (!opt) return false;
  opt.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  window.__click(opt);
  return true;
`)
await sleep(800)
const afterFilter = await countOf()
check(
  'severity filter really scopes the register',
  pickedSev === true && afterFilter >= 0 && afterFilter < beforeFilter,
  `before=${beforeFilter} after=${afterFilter}`,
)

// CSV export must produce a real file (capture the blob instead of downloading).
const csvOut = await evalJs(`
  let captured = null;
  const origUrl = URL.createObjectURL;
  const origClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = (b) => { captured = b; return 'blob:mock'; };
  HTMLAnchorElement.prototype.click = function () { window.__dl = true; };
  const btn = window.__byText('button', 'Export CSV');
  window.__click(btn);
  await new Promise((r) => setTimeout(r, 500));
  URL.createObjectURL = origUrl;
  HTMLAnchorElement.prototype.click = origClick;
  const text = captured && captured.text ? await captured.text() : '';
  return { clicked: window.__dl === true, bytes: text.length, head: text.split('\\n').slice(0, 2).join(' ~ ') };
`)
check(
  'CSV export produces a real file',
  csvOut.clicked === true && csvOut.bytes > 200 && /SkyShield Analytics Export/.test(csvOut.head),
  JSON.stringify(csvOut).slice(0, 160),
)

if (NETWORK) {
  /* ------------------------------------------- idempotency replay (M5) */
  const idem = await evalJs(`
    const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
    const post = (key) =>
      fetch('/api/v1/incidents/inc_001/comments/', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf, 'Idempotency-Key': key },
        body: JSON.stringify({ body: 'Idempotency probe comment' }),
      }).then(async (r) => ({ status: r.status, replayed: r.headers.get('Idempotency-Replayed'), data: await r.json() }));
    const key = crypto.randomUUID();
    const a = await post(key);
    const b = await post(key);
    const c = await post(crypto.randomUUID());
    const list = await (await fetch('/api/v1/incidents/inc_001/comments/', { credentials: 'include' })).json();
    return {
      sameId: a.data.id === b.data.id,
      replayFlag: b.replayed,
      distinct: c.data.id !== a.data.id,
      probes: list.filter((x) => /Idempotency probe/.test(x.body)).length,
    };
  `)
  check(
    'Idempotency-Key replays the stored answer instead of re-executing',
    idem.sameId === true &&
      idem.replayFlag === 'true' &&
      idem.distinct === true &&
      idem.probes === 2,
    JSON.stringify(idem),
  )

  /* -------------------------------------- server-side analytics (M6) */
  const m6 = await evalJs(`
    const j = (u) => fetch(u, { credentials: 'include' }).then((r) => r.json());
    const metrics = await j('/api/v1/dashboard/metrics/');
    const active = await j('/api/v1/incidents/?status=reported,investigation,rca_pending,capa&pageSize=200');
    const all = await j('/api/v1/analytics/?period=12m');
    const crit = await j('/api/v1/analytics/?period=12m&severity=critical');
    const critList = await j('/api/v1/incidents/?severity=critical&pageSize=200');
    const critInWindow = (critList.items || []).filter((i) => i.status !== 'draft' && i.occurredAt >= all.since).length;
    return {
      kpiIds: metrics.kpis.map((k) => k.id).join(','),
      activeMatch: metrics.kpis[0].value === active.total &&
        metrics.severityMix.reduce((a, m) => a + m.value, 0) === metrics.kpis[0].value,
      shapeOk: metrics.trend.length === 12 && (metrics.capaSlaSeries || []).length === 6,
      analyticsKpis: all.kpis.map((k) => k.id).join(','),
      weeklySums: all.counts.rows === all.weekly.reduce((s2, w) => s2 + w.reported, 0),
      critMatch: crit.counts.rows === critInWindow && crit.severity.every((s2) => s2.key === 'critical'),
    };
  `)
  check(
    'dashboard metrics are computed from the live tables',
    m6.kpiIds === 'kpi_active,kpi_investigation,kpi_rca,kpi_capa_overdue' &&
      m6.activeMatch === true &&
      m6.shapeOk === true,
    JSON.stringify(m6),
  )
  check(
    'analytics aggregation matches the register and its filters',
    m6.analyticsKpis === 'a_total,a_closure,a_risk,a_capa' &&
      m6.weeklySums === true &&
      m6.critMatch === true,
    JSON.stringify(m6),
  )
}

await go('/reports?tab=compliance')
await evalJs(HELPERS)
// The tab lazy-loads its chunk and then fetches the register — poll instead of racing.
const gapList = await waitFor(
  'compliance gap list',
  () => evalJs(`return !!document.querySelector('[data-gap-list]')`),
  20000,
).catch(() => false)
check('compliance shows the ranked gap list', gapList === true, String(gapList))
const compControls = await waitFor(
  'compliance controls',
  () =>
    evalJs(`
      return (!!window.__byText('button', 'Print') &&
        !!window.__byText('button', 'Export register') &&
        window.__all('[data-attach]').length > 0) || null;
    `),
  10000,
).catch(() => false)
check(
  'compliance offers print + export + per-row attach',
  compControls === true,
  String(compControls),
)

/* ============================================ 8. command palette (S10) */

console.log('\nCommand palette')
await go('/dashboard')
await evalJs(HELPERS)
await evalJs(`
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
`)
await sleep(700)
check(
  'palette opens on Ctrl-K',
  (await evalJs(`return !!document.querySelector('[data-command-palette]')`)) === true,
)
const palNav = await evalJs(`
  const input = document.querySelector('[data-command-input]');
  window.__setInput(input, 'risk matrix');
  await new Promise((r) => setTimeout(r, 300));
  const item = document.querySelector('[data-command-item="pg-matrix"]');
  if (!item) return 'no-item';
  window.__click(item);
  await new Promise((r) => setTimeout(r, 1000));
  return location.pathname + location.search;
`)
check(
  'palette navigates to a page item',
  String(palNav).includes('/reports') && String(palNav).includes('risk-matrix'),
  String(palNav),
)
const palEntity = await evalJs(`
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
  const input = document.querySelector('[data-command-input]');
  window.__setInput(input, 'P_006-258');
  await new Promise((r) => setTimeout(r, 600));
  const item = document.querySelector('[data-command-item^="inc-"]');
  if (!item) return 'no-item';
  window.__click(item);
  await new Promise((r) => setTimeout(r, 1200));
  return location.pathname;
`)
check(
  'palette navigates to an incident entity',
  String(palEntity).startsWith('/incidents/inc_'),
  String(palEntity),
)

// Notifications are grouped by day.
await go('/notifications')
await evalJs(HELPERS)
check(
  'notifications grouped by day',
  (await evalJs(`return window.__all('[data-day-group]').length >= 1`)) === true,
)

/* ======================================== 9. reporting loop (S14) */

console.log('\nReporting loop')
await evalJs(`window.localStorage.removeItem('skyshield.anon.throttle')`)
await go('/report')
await evalJs(HELPERS)
await evalJs(`
  const setV = (el, v) => { window.__setInput(el, v); };
  setV(document.querySelector('textarea#what'), 'Hydraulic seepage observed around the right main gear bay during the transit walk-around at the stand.');
  setV(document.querySelector('input#where'), 'DEL — stand 47');
  setV(document.querySelector('input#when'), '2026-09-30T05:40');
`)
await sleep(200)
await evalJs(`window.__click(window.__byText('button', 'Submit report'))`)
await sleep(2200)
const anonRef = await evalJs(`
  const m = (document.body.innerText.match(/P_006-\\d{3}/) || []);
  return m[0] || null;
`)
check('anonymous report confirms with a register reference', anonRef !== null, String(anonRef))

// The report must be searchable in the register after a full reload.
await go('/incidents')
await evalJs(HELPERS)
const anonRow = await evalJs(`
  const s = window.__all('input').find(i => (i.getAttribute('aria-label')||'').includes('Search'));
  const typed = window.__type(s, ${JSON.stringify(anonRef)});
  const r = await window.__settleTable(${JSON.stringify(anonRef)});
  return { n: r.n, anon: r.text.includes('Anonymous'), typed, val: s ? s.value : null };
`)
check(
  'anonymous report entered the register for triage',
  anonRow.n === 1 && anonRow.anon === true,
  JSON.stringify(anonRow).slice(0, 200),
)

// Comment as J. Miller mentioning R. Singh; then sign in as R. Singh and
// confirm the targeted notification is delivered to the mentioned user only.
await go('/incidents/inc_001')
await evalJs(HELPERS)
await evalJs(`
  const ta = document.querySelector('textarea[aria-label="New comment"]');
  window.__type(ta, 'Brake fan wiring chafing — @R. Singh please bring the borescope kit to the hangar.');
  await new Promise(r=>setTimeout(r,300));
  window.__click(document.querySelector('[data-send-comment]'));
`)
await sleep(1200)
const mentioned = await evalJs(`
  return (document.querySelector('[data-comments]')?.innerText || '').includes('Will notify') === false &&
    (document.querySelector('[data-comments]')?.innerText || '').includes('Brake fan wiring');
`)
check('comment posts to the incident thread', mentioned === true, String(mentioned))

await swapSessionUser('mention-delivery role-swap', INVESTIGATOR_PATCH)
await go('/notifications')
await evalJs(HELPERS)
// The re-logged-in user's scoped list arrives over the network — wait for a
// POSITIVE loaded state (day-groups rendered, or the empty/error panel),
// not just "no skeleton": right after the document commit the page has no
// skeleton yet either, and a bare absence check would pass on an empty DOM.
await waitFor('notifications list settles', () =>
  evalJs(`
    if (document.querySelector('.animate-spin') || document.querySelector('.animate-pulse')) return null;
    if (document.querySelector('[data-day-group]')) return 'items';
    const t = document.body.innerText || '';
    if (t.includes('Nothing to review') || t.includes('Notifications unavailable')) return 'empty';
    return null;
  `),
)
const delivered = await evalJs(`
  const t = document.body.innerText;
  return { mention: t.includes('mentioned you on P_006-258'), triage: t.includes('Anonymous report needs triage') };
`)
check(
  'mentioned user receives the targeted notification',
  delivered.mention === true,
  JSON.stringify(delivered),
)
await restoreSession()

/* ==================================== 10. offline quick report (S15) */

console.log('\nOffline quick report')
await go('/incidents/report')
await evalJs(HELPERS)
await evalJs(`window.localStorage.removeItem('skyshield.offline.queue.v1')`)
await evalJs(`Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })`)

await pickOption('Select registration', 'VT-ALB')
await pickOption('Select incident type', 'Runway Excursion')
await pickOption('Assess severity', 'High')
await evalJs(`
  window.__type(window.__all('textarea')[0], 'Offline probe: apron lighting failure observed during the evening transit walk-around at the stand.');
`)
await sleep(300)
await evalJs(`window.__click(window.__byText('button', 'File occurrence'))`)
await sleep(700)
check(
  'offline submit queues the report',
  (await evalJs(`
    const note = document.querySelector('[data-offline-note]');
    const q = JSON.parse(window.localStorage.getItem('skyshield.offline.queue.v1') || '[]');
    return !!note && /queued offline/i.test(note.textContent || '') && q.length === 1;
  `)) === true,
)

await evalJs(`
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  window.dispatchEvent(new Event('online'));
`)
await sleep(1800)
check(
  'reconnect files the queued report',
  (await evalJs(`
    const q = JSON.parse(window.localStorage.getItem('skyshield.offline.queue.v1') || '[]');
    const note = document.querySelector('[data-offline-note]');
    return q.length === 0 && !!note && /filed/i.test(note.textContent || '');
  `)) === true,
)

/* ================================================ 7. auth flows */

console.log('\nAuth flows')

// Start from a clean deterministic page (the previous section may leave the
// report form dirty with a leave-guard armed) — the user menu is in the shell,
// identical on every app route.
await go('/dashboard')
await evalJs(HELPERS)

// Sign out from user menu on dashboard — use realClick for Radix dropdown
const userMenuBtn = await evalJs(`
  const btn = window.__all('button').find(b => (b.getAttribute('aria-label')||'') === 'User menu');
  return btn ? true : false;
`)
if (userMenuBtn) {
  // Sign-out hard-navigates (topbar: `signOut(); location.href = '/'`), which
  // can destroy the context before this eval's result arrives — the retry
  // then lands on the menu-less landing page. A localStorage marker set
  // BEFORE the click survives same-origin navigation and still proves the
  // menu item was found and clicked.
  await evalJs(`window.localStorage.removeItem('skyshield.flows.signout')`)
  await realClick(
    `[...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'') === 'User menu')`,
  )
  await sleep(600)
  const signOutDone = await evalJs(`
    const item = window.__byText('[role="menuitem"]', 'Sign out') || window.__byText('div', 'Sign out');
    if (item) {
      window.localStorage.setItem('skyshield.flows.signout', '1');
      item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    }
    return window.localStorage.getItem('skyshield.flows.signout') === '1' ? 'clicked-before-reload' : false;
  `)
  await sleep(2000)
  const signOutPath = await evalJs(`return location.pathname`)
  check(
    'sign out navigates to landing page',
    (signOutDone === true || signOutDone === 'clicked-before-reload') && signOutPath === '/',
    `done=${signOutDone} path=${signOutPath}`,
  )
} else {
  check('sign out navigates to landing page', false, 'no-user-menu')
}

// Now unauthenticated — visit login page
await go('/login')
await evalJs(HELPERS)

const loginRendered = await evalJs(`
  return {
    hasEmail: !!document.querySelector('input[type="email"]'),
    hasPassword: !!document.querySelector('input[type="password"]'),
    hasSubmit: !!document.querySelector('button[type="submit"]'),
    hasDemo: (document.body.innerText || '').includes('Use demo account'),
  }
`)
check(
  'login page renders with email, password, submit and demo button',
  loginRendered.hasEmail &&
    loginRendered.hasPassword &&
    loginRendered.hasSubmit &&
    loginRendered.hasDemo,
  JSON.stringify(loginRendered),
)

// Demo login
const demoLogin = await evalJs(`
  const btn = window.__byText('button', 'Use demo account');
  if (!btn) return 'no-demo-button';
  window.__click(btn);
  await new Promise(r=>setTimeout(r,3000));
  return { path: location.pathname, error: document.querySelector('[role="alert"]')?.textContent || '' };
`)
check(
  'demo login navigates to dashboard',
  typeof demoLogin === 'object' && demoLogin.path === '/dashboard',
  JSON.stringify(demoLogin),
)

// Test PublicOnly guard (visiting /login while signed in redirects to /dashboard)
await go('/login')
await sleep(800)
const guardRedirect = await evalJs(`return location.pathname`)
check(
  'visiting /login while authenticated redirects to dashboard',
  guardRedirect === '/dashboard',
  guardRedirect,
)

/* ======================================= 11. auth pages (signed-out) */

// The auth pages are PublicOnly: with the seeded demo session they correctly
// redirect to /dashboard, so the form checks below could never see them.
// Sign out through the app's own mechanism — remove the session and set the
// logged-out flag mockAuth.init() honours — which exercises the guards as
// designed instead of weakening them.
await requireSession('before the signed-out auth-pages section')
await evalJs(`
  window.localStorage.removeItem('skyshield.auth.session');
  window.sessionStorage.removeItem('skyshield.auth.session');
  window.localStorage.setItem('skyshield.auth.logged_out', '1');
`)

// Signup page
await go('/signup')
await evalJs(HELPERS)
const signupRendered = await evalJs(`
  return {
    hasName: !!document.querySelector('input[id="name"]'),
    hasEmail: !!document.querySelector('input[type="email"]'),
    hasPassword: !!document.querySelector('input[type="password"]'),
    hasOrg: !!document.querySelector('input[id="organisation"]'),
    hasTerms: !!document.querySelector('input[type="checkbox"]'),
  }
`)
check(
  'signup page renders with all fields',
  signupRendered.hasName &&
    signupRendered.hasEmail &&
    signupRendered.hasPassword &&
    signupRendered.hasOrg &&
    signupRendered.hasTerms,
  JSON.stringify(signupRendered),
)

// Navigation between auth pages (from login to forgot-password)
await go('/login')
await evalJs(HELPERS)
const forgotLink = await evalJs(`
  const link = window.__byText('a', 'Forgot password?');
  if (!link) return 'no-link';
  window.__click(link);
  await new Promise(r=>setTimeout(r,600));
  return location.pathname;
`)
check('forgot password link navigates', forgotLink === '/forgot-password', String(forgotLink))

const real = results.filter((r) => !r.ok)
console.log(`\n${results.length - real.length}/${results.length} checks passed`)
if (consoleErrors.length) {
  console.log('\nConsole errors:')
  for (const e of [...new Set(consoleErrors)].slice(0, 10)) console.log('  -', e)
}
if (real.length) for (const r of real) console.log('  FAILED:', r.name, r.detail)

sock.close()
chrome.kill()
process.exit(real.length || consoleErrors.length ? 1 : 0)
