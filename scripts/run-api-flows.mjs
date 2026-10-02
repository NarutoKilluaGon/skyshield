#!/usr/bin/env node
/**
 * Network-mode flows orchestrator.
 *
 * Brings up the real stack — fresh Django database (migrate + seed_demo),
 * runserver, and vite dev with VITE_USE_MOCK=false — runs scripts/flows.mjs
 * against it, then tears everything down. Exit code is the flows exit code,
 * so this doubles as the CI gate for "the SPA works against the real API".
 *
 * Usage: node scripts/run-api-flows.mjs
 * Env:
 *   PYTHON              interpreter with the Django deps (default: python3)
 *   API_PORT            Django port (default: 8000)
 *   DEV_PORT            vite port (default: 5173)
 *   API_FLOWS_VERBOSE=1 stream API/dev-server output live instead of
 *                       only dumping tails on failure
 */
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND = path.join(ROOT, 'backend')
const PYTHON = process.env.PYTHON ?? 'python3'
const API_PORT = Number(process.env.API_PORT ?? 8000)
const DEV_PORT = Number(process.env.DEV_PORT ?? 5173)
const VERBOSE = process.env.API_FLOWS_VERBOSE === '1'
const API_ORIGIN = `http://127.0.0.1:${API_PORT}`
const DEV_ORIGIN = `http://localhost:${DEV_PORT}`
const TAIL_LINES = 2000

/** Memory-capped NODE_OPTIONS for child servers — see the Chrome flags in
 *  flows.mjs: the whole stack must coexist inside ~1 GiB on small runners. */
const nodeOptions = (mb) =>
  [process.env.NODE_OPTIONS, `--max-old-space-size=${mb}`].filter(Boolean).join(' ')

const children = []
let shuttingDown = false

function fail(msg) {
  console.error(`api-flows: ${msg}`)
  for (const c of children) dump(c)
  teardown(1)
}

function dump(child) {
  if (!child._buf?.length) return
  console.error(`\n--- ${child._name} output (tail) ---`)
  console.error(child._buf.join('\n'))
  console.error(`--- end ${child._name} ---\n`)
}

function teardown(code) {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) {
    try {
      c.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
  // Give runserver a beat to release the port, then exit hard.
  setTimeout(() => process.exit(code), 300)
}

process.on('SIGINT', () => teardown(130))
process.on('SIGTERM', () => teardown(143))

/** One-shot command that must succeed before we continue. */
function run(name, cmd, args, opts = {}) {
  return new Promise((resolve) => {
    console.log(`api-flows: ${name}`)
    const child = spawn(cmd, args, { cwd: ROOT, stdio: VERBOSE ? 'inherit' : 'pipe', ...opts })
    const buf = []
    const collect = (d) => {
      buf.push(...d.toString().split('\n'))
      if (buf.length > TAIL_LINES) buf.splice(0, buf.length - TAIL_LINES)
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.on('error', (e) => {
      console.error(buf.join('\n'))
      fail(`${name}: cannot spawn ${cmd} (${e.message})`)
    })
    child.on('exit', (code) => {
      if (code !== 0) {
        console.error(buf.join('\n'))
        fail(`${name} exited with code ${code}`)
      }
      resolve()
    })
  })
}

/** Long-lived server whose output is ring-buffered (dumped on failure). */
function serve(name, cmd, args, opts = {}) {
  const child = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts })
  child._name = name
  child._buf = []
  const collect = (stream) => (d) => {
    child._buf.push(...d.toString().split('\n'))
    if (child._buf.length > TAIL_LINES) child._buf.splice(0, child._buf.length - TAIL_LINES)
    if (VERBOSE) stream.write(`[${name}] ${d}`)
  }
  child.stdout.on('data', collect(process.stdout))
  child.stderr.on('data', collect(process.stderr))
  child.on('exit', (code) => {
    if (!shuttingDown) fail(`${name} exited unexpectedly with code ${code}`)
  })
  children.push(child)
  return child
}

async function waitFor(label, url, { timeoutMs, expect = (r) => r.ok } = {}) {
  const deadline = Date.now() + timeoutMs
  let last = 'no response'
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (expect(res)) {
        console.log(`api-flows: ${label} ready`)
        return
      }
      last = `HTTP ${res.status}`
    } catch (e) {
      last = e.message
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  fail(`${label} did not become ready within ${timeoutMs}ms (last: ${last})`)
}

// 0. Refuse occupied ports: a stale stack from a crashed run would silently
//    share them (or the suite would talk to the wrong server), and two stacks
//    do not fit in small CI/sandbox memory budgets.
const portFree = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
for (const [name, port] of [
  ['API', API_PORT],
  ['dev', DEV_PORT],
]) {
  if (!(await portFree(port)))
    fail(`port ${port} (${name}) is already in use — kill the stale stack first`)
}

// 1. Fresh database every run: deterministic seed, no throttle/session drift.
rmSync(path.join(BACKEND, 'db.sqlite3'), { force: true })
await run('migrate', PYTHON, ['manage.py', 'migrate', '--noinput'], { cwd: BACKEND })
await run('seed demo data', PYTHON, ['manage.py', 'seed_demo'], { cwd: BACKEND })

// 2. Django API.
serve('api', PYTHON, ['manage.py', 'runserver', `127.0.0.1:${API_PORT}`, '--noreload'], {
  cwd: BACKEND,
})
await waitFor('API', `${API_ORIGIN}/api/health/`, { timeoutMs: 30_000 })

// 3. Production build served by vite preview — the same serving mode the
//    mock-mode CI flows use. Dev mode is a flake farm on small runners:
//    on-demand transforms race first interactions and HMR/dep-optimisation
//    can hard-reload the page mid-check ("Promise was collected"), plus the
//    dev server's module graph costs ~250 MB this stack does not have.
//    VITE_USE_MOCK is baked at build time, so the build itself runs in
//    network mode.
await run(
  'build (network mode)',
  process.execPath,
  [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
  {
    env: {
      ...process.env,
      VITE_USE_MOCK: 'false',
      VITE_PROXY_TARGET: API_ORIGIN,
      NODE_OPTIONS: nodeOptions(600),
    },
  },
)
serve(
  'preview',
  process.execPath,
  [
    path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview',
    '--port',
    String(DEV_PORT),
    '--strictPort',
  ],
  {
    env: {
      ...process.env,
      VITE_USE_MOCK: 'false',
      VITE_PROXY_TARGET: API_ORIGIN,
      NODE_OPTIONS: nodeOptions(256),
    },
  },
)
await waitFor('preview server', `${DEV_ORIGIN}/`, { timeoutMs: 30_000 })

// 4. The flows suite itself — this is the acceptance gate.
console.log(`api-flows: running flows against ${DEV_ORIGIN} (network mode)`)
const flows = spawn(process.execPath, [path.join(ROOT, 'scripts', 'flows.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env, VITE_USE_MOCK: 'false', BASE: DEV_ORIGIN, NODE_OPTIONS: nodeOptions(320) },
})
flows.on('exit', (code) => {
  // Surface server logs on failure — a wedged API/dev server must be
  // diagnosable from the orchestrator output alone.
  if (code !== 0) for (const c of children) dump(c)
  teardown(code ?? 1)
})
