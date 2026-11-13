// Item 1: «Por reagendar» banner copy per cause (detail) + «Agendadas» row markers (title/aria). Read-only.
import { open, shot, BASE, blocked, FOLIOS, settle } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
for (const [k, id] of Object.entries(FOLIOS)) {
  let detail
  const h = async (r) => { if (new RegExp(`chatbot-requests/${id}(\\?|$)`).test(r.url()) && r.request().method() === 'GET') detail = await r.json().catch(() => null) }
  page.on('response', h)
  await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await settle(page)
  page.off('response', h)
  console.log(`\n=== ${k} @${w}`, JSON.stringify({ folio: detail?.folio, status: detail?.status, needsReschedule: detail?.needsReschedule, needsRescheduleReason: detail?.needsRescheduleReason, scheduledFor: detail?.scheduledFor, allowed: detail?.allowedActions }))
  const b = page.getByTestId('reschedule-banner')
  console.log('banner count', await b.count())
  if (await b.count()) {
    await b.scrollIntoViewIfNeeded()
    console.log('BANNER', (await b.innerText()).replace(/\n+/g, ' | '))
    console.log('REASON', await page.getByTestId('reschedule-reason').innerText())
    await b.screenshot({ path: `${process.cwd()}/shots/a1-${k}-banner-${w}.png` })
  }
  await shot(page, `a1-${k}-detail-${w}`)
  await shot(page, `a1-${k}-detail-${w}-full`, true)
  console.log('overflowX', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
}
// inbox → Agendadas
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await settle(page, 1500)
const tab = page.getByRole('tab', { name: /Agendadas/ }).or(page.getByRole('button', { name: /Agendadas/ })).first()
console.log('\nagendadas control', await tab.count())
await tab.click(); await settle(page, 2000)
await shot(page, `a1-agendadas-${w}`); await shot(page, `a1-agendadas-${w}-full`, true)
const tags = await page.getByTestId('reschedule-tag').evaluateAll((els) => els.map((e) => { const row = e.closest('a, [class*=chatbot-row], [class*=chatbot-card], tr, li'); return { visible: e.getBoundingClientRect().width > 0, text: e.innerText.trim(), title: e.getAttribute('title'), aria: e.getAttribute('aria-label'), row: (row?.innerText || '').match(/S-\d+/)?.[0] ?? null } }))
console.log('MARKERS', JSON.stringify(tags, null, 1))
const vis = page.getByTestId('reschedule-tag').locator('visible=true').first()
if (await vis.count()) { await vis.scrollIntoViewIfNeeded(); await vis.hover().catch(() => {}); await page.waitForTimeout(1200); await shot(page, `a1-agendadas-marker-hover-${w}`) }
console.log('BLOCKED non-GET (must be empty):', blocked)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
