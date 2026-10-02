/**
 * Bundle-size fail-gate (S18). Run after `npm run build`: gzips every JS
 * asset in dist and fails when an individual chunk or the total exceeds its
 * budget. Vendor chunks are recognised by name and get their own ceilings.
 *
 * Budgets are set slightly above the current measured sizes so ordinary work
 * passes but accidents (a heavy dep landing in a route chunk, a duplicated
 * vendor) fail the build.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = path.resolve('dist/assets')
let files
try {
  files = readdirSync(dist).filter((f) => f.endsWith('.js'))
} catch {
  console.error('dist/assets missing — run `npm run build` first.')
  process.exit(1)
}

const VENDOR_BUDGETS = [
  [/^react-/, 115_000, 'react vendor'],
  [/^radix-/, 55_000, 'radix vendor'],
  [/^charts-/, 140_000, 'recharts vendor (route-lazy)'],
]
const DEFAULT_CHUNK_BUDGET = 40_000
const TOTAL_BUDGET = 520_000

let total = 0
const failures = []
const rows = []

for (const f of files.sort()) {
  const raw = readFileSync(path.join(dist, f))
  const gz = gzipSync(raw).length
  total += gz
  const vendor = VENDOR_BUDGETS.find(([re]) => re.test(f))
  const budget = vendor ? vendor[1] : DEFAULT_CHUNK_BUDGET
  const label = vendor ? vendor[2] : 'app chunk'
  rows.push([f, (gz / 1024).toFixed(1), (budget / 1024).toFixed(0), label])
  if (gz > budget) failures.push(`${f}: ${(gz / 1024).toFixed(1)} kB gzip > ${(budget / 1024).toFixed(0)} kB (${label})`)
}

console.log('Bundle gate (gzip):')
for (const [f, gz, budget, label] of rows) {
  const flag = Number(gz) > Number(budget) ? '✗' : '✓'
  console.log(`  ${flag} ${f.padEnd(44)} ${String(gz).padStart(7)} kB / ${budget} kB  ${label}`)
}
console.log(`  total: ${(total / 1024).toFixed(1)} kB gzip (budget ${(TOTAL_BUDGET / 1024).toFixed(0)} kB)`)
if (total > TOTAL_BUDGET) failures.push(`total JS ${(total / 1024).toFixed(1)} kB gzip exceeds ${(TOTAL_BUDGET / 1024).toFixed(0)} kB budget`)

// Also stat the CSS so a token accident is visible (informational).
try {
  for (const f of readdirSync(dist).filter((x) => x.endsWith('.css'))) {
    const gz = gzipSync(readFileSync(path.join(dist, f))).length
    console.log(`  i ${f.padEnd(44)} ${(gz / 1024).toFixed(1)} kB gzip (css)`)
  }
} catch {
  /* css optional */
}
void statSync

if (failures.length) {
  console.error('\nBUDGET EXCEEDED:')
  for (const f of failures) console.error('  -', f)
  process.exit(1)
}
console.log('\nAll chunks within budget.')
