// Prints what pending refunds exist (no ids), to decide what data to create.
import { launch } from './lib.mjs'

const { browser, api, token } = await launch()
if (!token()) throw new Error('no token learned')
const pending = await api('GET', '/sales/refunds/pending?page=1&limit=50')
console.log('pending status', pending.status)
const rows = pending.json?.data ?? pending.json?.items ?? pending.json
console.log('envelope keys', Object.keys(pending.json ?? {}))
if (Array.isArray(rows)) {
  console.log('count', rows.length)
  console.log('row keys', rows[0] && Object.keys(rows[0]))
  for (const r of rows) console.log(r.reason, r.method, r.amountCents, r.settledCents, r.outstandingCents, r.createdAt)
}
const canceled = await api('GET', '/sales?status=CANCELED&page=1&limit=5')
console.log('canceled status', canceled.status, canceled.json?.pagination)
for (const s of canceled.json?.data ?? []) console.log(s.folio, s.customer?.name, s.total ?? s.totalCents)
await browser.close()
