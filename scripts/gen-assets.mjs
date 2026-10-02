import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PORT = 9550 + Math.floor(Math.random() * 200)

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
    'about:blank',
  ],
  { stdio: 'ignore' },
)

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
sock.onmessage = (m) => {
  const x = JSON.parse(m.data)
  if (x.id && pend.has(x.id)) {
    const { res, rej } = pend.get(x.id)
    pend.delete(x.id)
    if (x.error) rej(new Error(JSON.stringify(x.error)))
    else res(x.result)
  }
}

const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const n = ++id
    pend.set(n, { res, rej })
    sock.send(JSON.stringify({ id: n, method, params, sessionId }))
  })

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)

await S('Page.enable')
await S('Runtime.enable')

async function renderHtmlToPng(html, width, height, outFile) {
  await S('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })
  const dataUrl = `data:text/html;base64,${Buffer.from(html).toString('base64')}`
  await S('Page.navigate', { url: dataUrl })
  await sleep(600)
  const { data } = await S('Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width, height, scale: 1 },
  })
  await writeFile(outFile, Buffer.from(data, 'base64'))
  console.log(`Generated ${outFile} (${width}x${height})`)
}

// 1. 32x32 favicon
const iconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%">
    <rect width="24" height="24" rx="5" fill="#D6A24C" />
    <path
      d="M5 12.5 17.5 6.5l-3.8 1.9 3.1 4-10 3 1.1-3.1-2.9-1.1Z"
      fill="none"
      stroke="#14100A"
      stroke-width="1.8"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
`

await renderHtmlToPng(
  `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:transparent;">${iconSvg}</body></html>`,
  32,
  32,
  path.join(root, 'public/favicon-32x32.png')
)

// 2. 180x180 apple touch icon
await renderHtmlToPng(
  `<!DOCTYPE html><html><body style="margin:0;padding:0;overflow:hidden;background:#0F1114;display:flex;align-items:center;justify-content:center;width:180px;height:180px;">
    <div style="width:144px;height:144px;">${iconSvg}</div>
  </body></html>`,
  180,
  180,
  path.join(root, 'public/apple-touch-icon.png')
)

// 3. 1200x630 OG image
const ogHtml = `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1200px;
    height: 630px;
    background: #0F1114;
    color: #ECEAE6;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 80px;
    border: 1px solid #262A30;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .mark {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: #D6A24C;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-text {
    font-size: 32px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #ECEAE6;
  }
  .badge {
    margin-left: auto;
    background: #2A2214;
    color: #D6A24C;
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid #363B43;
  }
  .content {
    margin-top: 40px;
  }
  .title {
    font-size: 52px;
    line-height: 1.15;
    font-weight: 600;
    color: #ECEAE6;
    letter-spacing: -0.02em;
    max-width: 960px;
    margin: 0 0 20px 0;
  }
  .desc {
    font-size: 22px;
    line-height: 1.5;
    color: #8C8A85;
    max-width: 860px;
    margin: 0;
  }
  .footer {
    display: flex;
    align-items: center;
    gap: 32px;
    padding-top: 32px;
    border-top: 1px solid #262A30;
    font-size: 15px;
    color: #66645F;
  }
  .footer span {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #B9B6AF;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="mark">
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#14100A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 12.5 17.5 6.5l-3.8 1.9 3.1 4-10 3 1.1-3.1-2.9-1.1Z" />
      </svg>
    </div>
    <div class="logo-text">SkyShield</div>
    <div class="badge">Aviation Safety Intelligence</div>
  </div>
  <div class="content">
    <h1 class="title">Every safety report, followed through to a closed action.</h1>
    <p class="desc">Occurrence reporting, incident investigations, root cause analysis, CAPA and compliance monitoring in graphite and brass.</p>
  </div>
  <div class="footer">
    <span>Occurrence Reporting</span>
    <span>•</span>
    <span>5 Whys Root Cause</span>
    <span>•</span>
    <span>CAPA Tracking</span>
    <span>•</span>
    <span>5×5 Risk Matrix</span>
    <span>•</span>
    <span>Audit Trails</span>
  </div>
</body>
</html>`

await renderHtmlToPng(ogHtml, 1200, 630, path.join(root, 'public/og-image.png'))

// Also write public/favicon.svg
await writeFile(
  path.join(root, 'public/favicon.svg'),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="6" fill="#D6A24C" />
  <path
    d="M5 12.5 17.5 6.5l-3.8 1.9 3.1 4-10 3 1.1-3.1-2.9-1.1Z"
    fill="none"
    stroke="#14100A"
    stroke-width="1.8"
    stroke-linejoin="round"
    stroke-linecap="round"
  />
</svg>
`
)

sock.close()
chrome.kill()
process.exit(0)
