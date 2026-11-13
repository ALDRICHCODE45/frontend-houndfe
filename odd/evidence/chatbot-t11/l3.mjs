// T11 item 7 at 390 (MOCK live): the «Esta conversación» card must not render on the mobile detail page nor in the full-screen live view.
import { open, shot, BASE, blocked, settle, installLiveMock, currentUser } from './lib.mjs'
const { browser, page, log } = await open({ width: 390, height: 844 })
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await settle(page, 500)
const id = groups.items.flatMap((g) => g.requests ?? g.items ?? []).find((r) => r.folio === 'S-000018').id
await installLiveMock(page, { requestId: id, user: await currentUser(page), sessionState: 'ACTIVE' })
await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await settle(page, 2500)
const full = (await page.locator('body').innerText())
console.log('detail: "Esta conversación" in text:', /Esta conversación/.test(full), '| session-panel visible:', await page.getByTestId('session-panel').first().isVisible().catch(() => false), '| overflow-x', await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
await shot(page, 'l3-detail-390'); await shot(page, 'l3-detail-390-full', true)
console.log('BLOCKED non-GET:', blocked, 'CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
