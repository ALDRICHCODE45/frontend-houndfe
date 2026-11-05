// Prints a readable summary of the inbox data (no ids).
import { BASE, open, pathOf } from './lib.mjs'

const { browser, page } = await open()
const res = page.waitForResponse((r) => /\/human-decisions$/.test(pathOf(r.url())) && r.request().method() === 'GET')
await page.goto(`${BASE}/pos/decisiones-pendientes`, { waitUntil: 'domcontentloaded' })
const body = await (await res).json()
const rows = body.data ?? body.items ?? []
console.log('keys', Object.keys(body), 'rows', rows.length)
for (const r of rows) console.log(r.type, r.status, '|', r.title, '|', r.snapshot?.productName, '|', r.snapshot?.sku, '|', r.snapshot?.branchName)
await browser.close()
