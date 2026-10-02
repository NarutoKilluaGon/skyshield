/**
 * Export the frontend demo fixtures (src/data/*.ts) as a single JSON document
 * for the Django backend seed (`python manage.py seed_demo`).
 *
 * Usage: node scripts/export-fixtures.mjs [outFile]
 * Default output: backend/fixtures/demo-seed.json
 *
 * The JSON carries the RAW fixture dates (no rebasing) — the server rebases
 * them to "today" at seed time so the demo register always looks live, the
 * same way services/store.ts does in the browser.
 */
import { build } from 'esbuild'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outFile = resolve(root, process.argv[2] ?? 'backend/fixtures/demo-seed.json')

const entry = `
import { USERS } from '@/data/users'
import { AIRCRAFT } from '@/data/aircraft'
import { INCIDENTS } from '@/data/incidents'
import { INVESTIGATIONS, EVIDENCE, TIMELINE } from '@/data/investigations'
import { RCAS } from '@/data/rca'
import { CAPAS } from '@/data/capas'
import { NOTIFICATIONS } from '@/data/notifications'
import { AUDIT_LOG, COMPLIANCE_REQUIREMENTS, COMPLIANCE_SUMMARY } from '@/data/compliance'
import { COMPLIANCE_TREND } from '@/data/dashboard'

export const seed = {
  users: USERS,
  aircraft: AIRCRAFT,
  incidents: INCIDENTS,
  investigations: INVESTIGATIONS,
  evidence: EVIDENCE,
  timeline: TIMELINE,
  rcas: RCAS,
  capas: CAPAS,
  notifications: NOTIFICATIONS,
  auditLog: AUDIT_LOG,
  compliance: COMPLIANCE_REQUIREMENTS,
  complianceSummary: COMPLIANCE_SUMMARY,
  complianceTrend: COMPLIANCE_TREND,
}
`

const result = await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'export-fixtures-entry.ts' },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  alias: { '@': resolve(root, 'src') },
  logLevel: 'warning',
})

// Evaluate the bundle and dump the seed object.
const bundlePath = resolve(root, '.tmp-seed-bundle.mjs')
writeFileSync(bundlePath, result.outputFiles[0].text)
try {
  const mod = await import(pathToFileURL(bundlePath).href)
  const seed = mod.seed
  mkdirSync(dirname(outFile), { recursive: true })
  writeFileSync(outFile, JSON.stringify(seed, null, 1) + '\n')
  const counts = Object.fromEntries(
    Object.entries(seed).map(([k, v]) => [k, Array.isArray(v) ? v.length : 'obj']),
  )
  console.log(`wrote ${outFile}`)
  console.log(JSON.stringify(counts))
} finally {
  const { rmSync } = await import('node:fs')
  rmSync(bundlePath, { force: true })
}
