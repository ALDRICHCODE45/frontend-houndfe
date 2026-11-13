// T11 item 3: element crops of the blocked window box (MOCK closed window) at real size, 1440 and 390.
import { open, shot, BASE, blocked, settle, installLiveMock, currentUser } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440); const mobile = w < 500
const { browser, page, log } = await open({ width: w, height: mobile ? 844 : 900 })
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await settle(page, 500)
const id = groups.items.flatMap((g) => g.requests ?? g.items ?? []).find((r) => r.folio === 'S-000018').id
await installLiveMock(page, { requestId: id, user: await currentUser(page), sessionState: 'ACTIVE', windowOpen: false })
await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await settle(page, 2500)
if (mobile) await page.getByTestId('live-card-open').click().then(() => page.waitForTimeout(1200))
const box = page.getByTestId('live-blocked')
console.log('live-blocked', await box.count())
const target = (await box.count()) ? box.first() : page.locator('[data-testid=detail-conversation]')
await target.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
console.log('BOX text', (await target.innerText()).replace(/\n+/g, ' | '))
console.log('BOX icons', JSON.stringify(await target.evaluate((r) => [...r.querySelectorAll('svg')].map((e) => { const b = e.getBoundingClientRect(); const p = e.parentElement.getBoundingClientRect(); return { w: b.width, h: b.height, parentW: Math.round(p.width), inlineWithText: e.parentElement.className.slice(0, 40) } }))))
await target.screenshot({ path: `${process.cwd()}/shots/l2-blocked-box-${w}.png` })
await shot(page, `l2-blocked-scrolled-${w}`)
console.log('btn viewport', JSON.stringify(await page.getByRole('button', { name: /Enviar plantilla/ }).first().evaluate((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight } })))
console.log('BLOCKED non-GET:', blocked, 'CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
