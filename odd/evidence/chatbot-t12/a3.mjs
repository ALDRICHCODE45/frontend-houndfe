// Item 3: no regression on a clarification detail (S-000004) and S-000018 (64 messages, real, not mocked). Read-only.
import { open, shot, BASE, blocked, settle } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
let groups
const convSeqs = new Set(); let convCalls = 0
page.on('response', async (r) => {
  if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null)
  if (/chatbot-requests\/[0-9a-f-]+\/conversation/.test(r.url()) && r.request().method() === 'GET') { convCalls++; const j = await r.json().catch(() => null); for (const m of j?.items ?? []) convSeqs.add(m.seq) }
})
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await settle(page, 500)
const rows = groups.items.flatMap((g) => g.requests ?? g.items ?? [])
const id = (f) => rows.find((r) => r.folio === f).id
for (const [folio, label] of [['S-000004', 'clarif'], ['S-000018', 'conv']]) {
  convSeqs.clear(); convCalls = 0
  let detail
  const h = async (r) => { if (new RegExp(`chatbot-requests/${id(folio)}(\\?|$)`).test(r.url()) && r.request().method() === 'GET') detail = await r.json().catch(() => null) }
  page.on('response', h)
  await page.goto(`${BASE}/chatbot/solicitudes/${id(folio)}`, { waitUntil: 'domcontentloaded' }); await settle(page, 2500)
  page.off('response', h)
  console.log(`\n=== ${folio} (${label}) @${w}`, JSON.stringify({ kind: detail?.kind, subtype: detail?.subtype, status: detail?.status, templateCostText: detail?.templateCostText, needsReschedule: detail?.needsReschedule, allowed: detail?.allowedActions }))
  console.log('BODY', (await page.locator('main').first().innerText().catch(() => page.locator('body').innerText())).replace(/\n+/g, ' | ').slice(0, 1500))
  await shot(page, `a3-${label}-detail-${w}`); await shot(page, `a3-${label}-detail-${w}-full`, true)
  console.log('overflowX', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), '| reschedule-banner', await page.getByTestId('reschedule-banner').count(), '| schedule-block', await page.getByTestId('schedule-block').count())
  if (label === 'conv') {
    const older = page.getByTestId('conversation-older')
    let clicks = 0
    console.log('initial loaded seqs', convSeqs.size, '| older button', await older.count())
    while (await older.count() && clicks < 10) { await older.click(); clicks++; await page.waitForTimeout(1500) }
    await page.waitForTimeout(800)
    const bubbles = await page.locator('[role=log]').first().evaluate((l) => [...l.children].filter((c) => c.getAttribute('role') !== 'separator').length)
    console.log('after loading older: clicks', clicks, '| unique seqs from API', convSeqs.size, '| bubbles in DOM', bubbles, '| older button left', await older.count())
    await shot(page, `a3-${label}-all-loaded-${w}`)
    const first = page.locator('[role=log]').first(); await first.evaluate((e) => { e.scrollTop = 0 }); await page.waitForTimeout(400)
    await shot(page, `a3-${label}-top-${w}`)
  }
}
console.log('\nBLOCKED non-GET (must be empty):', blocked)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
