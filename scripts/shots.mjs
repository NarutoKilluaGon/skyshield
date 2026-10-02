/**
 * Screenshot capture. Drives headless Chrome over CDP (no puppeteer needed)
 * and writes PNGs to /tmp/opencode/shots.
 *
 * Usage: node scripts/shots.mjs [route ...]
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.BASE ?? 'http://localhost:5173'
const OUT = process.env.OUT ?? '/tmp/opencode/shots'

const DEFAULT = [
  ['landing', '/', 1600, 1200],
  ['dashboard', '/dashboard', 1600, 1400],
  ['incidents', '/incidents', 1600, 1100],
  ['incident-detail', '/incidents/inc_001', 1600, 1500],
  ['report', '/incidents/report', 1600, 1200],
  ['investigations', '/investigations', 1600, 1200],
  ['rca', '/rca', 1600, 1500],
  ['five-whys', '/rca/five-whys', 1600, 1100],
  ['risk-matrix', '/rca/risk-matrix', 1600, 1200],
  ['capa', '/capa', 1600, 1200],
  ['analytics', '/analytics', 1600, 1800],
  ['compliance', '/compliance', 1600, 1200],
  ['settings', '/settings', 1600, 1000],
  ['landing-tablet', '/', 834, 1200],
  ['dashboard-mobile', '/dashboard', 390, 1500],
  ['landing-mobile', '/', 390, 1200],
  ['incidents-tablet', '/incidents', 820, 1200],
]

const routes = process.argv.slice(2).length
  ? process.argv.slice(2).map((r, i) => [r.replace(/\W+/g, '-').replace(/^-|-$/g, '') || `r${i}`, r, 1600, 1200])
  : DEFAULT

await mkdir(OUT, { recursive: true })

const PORT = 9222 + Math.floor(Math.random() * 400)
const chrome = spawn(
  '/usr/bin/google-chrome',
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      const j = await r.json()
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging endpoint')
}

const url = await wsUrl()
const sock = new WebSocket(url)
await new Promise((res, rej) => {
  sock.onopen = res
  sock.onerror = rej
})

let id = 0
const pending = new Map()
const events = []
sock.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    const { res, rej } = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) rej(new Error(JSON.stringify(msg.error)))
    else res(msg.result)
  } else if (msg.method) {
    events.push(msg)
  }
}

const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    sock.send(JSON.stringify({ id: n, method, params, sessionId }))
  })

// Attach to a page target
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)

await S('Page.enable')
await S('Runtime.enable')
await S('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
})

async function capture(name, route, width, height) {
  await S('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  })
  await S('Page.navigate', { url: `${BASE}${route}` })
  await sleep(Number(process.env.SETTLE_MS ?? 3000)) // fonts, lazy chunks, chart animations

  // The shell is a fixed-viewport app (h-dvh + an inner scroller), so a plain
  // full-page capture paints an empty gutter. Temporarily switch it to document
  // flow — a capture-only override, never shipped — then take one full shot.
  await S('Runtime.evaluate', {
    expression: `(() => {
      let s = document.getElementById('ss-capture-css')
      if (!s) {
        s = document.createElement('style')
        s.id = 'ss-capture-css'
        document.head.appendChild(s)
      }
      s.textContent = \`
        #root > div { height: auto !important; min-height: 100dvh; }
        #skyshield-main { overflow: visible !important; height: auto !important; }
        #root > div > div:first-child > aside { position: sticky; top: 0; align-self: flex-start; max-height: 100dvh; }
        html, body { height: auto !important; overflow: visible !important; }
      \`
      return true
    })()`,
  })
  await sleep(650)

  // The override above changes layout, so ResponsiveContainer re-measures its
  // charts. Nudge one more layout pass and give Recharts a frame to repaint,
  // otherwise a chart can be captured in the gap between measure and paint.
  await S('Runtime.evaluate', { expression: 'window.dispatchEvent(new Event("resize"))' })
  await sleep(900)

  const { result } = await S('Runtime.evaluate', {
    expression: 'Math.ceil(document.documentElement.scrollHeight)',
    returnByValue: true,
  })
  const contentHeight = Math.min(8000, Math.max(height, Number(result?.value ?? height)))

  const { data } = await S('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: contentHeight, scale: 1 },
  })

  // Restore the real app layout.
  await S('Runtime.evaluate', {
    expression: `document.getElementById('ss-capture-css')?.remove()`,
  })

  const file = path.join(OUT, `${name}.png`)
  await writeFile(file, Buffer.from(data, 'base64'))
  console.log(`  ${name.padEnd(20)} ${route.padEnd(26)} ${width}×${contentHeight}`)
  return file
}

console.log('Capturing:')
for (const [name, route, w, h] of routes) {
  try {
    await capture(name, route, w, h)
  } catch (e) {
    console.log(`  FAILED ${name}: ${e.message}`)
  }
}

// Console errors from the last pass
const errs = events
  .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params?.type === 'error')
  .map((e) => e.params.args?.map((a) => a.value ?? a.description).join(' '))
if (errs.length) {
  console.log('\nConsole errors:')
  for (const e of errs.slice(0, 12)) console.log('  -', String(e).slice(0, 200))
} else {
  console.log('\nNo console errors.')
}

sock.close()
chrome.kill()
process.exit(0)
