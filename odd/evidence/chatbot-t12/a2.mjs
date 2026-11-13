// Item 2: template cost on a MOCK live request (S-000018 patched to IN_PROGRESS + liveSession, window closed).
// node a2.mjs <w> detail|null|real  — detail: detail carries a distinctive templateCostText; null: detail forces null; real: whatever the BE sends.
// Opens the «Enviar plantilla» confirmation and closes it with Escape. Nothing is confirmed; real POSTs are aborted by the guard.
import { open, shot, BASE, blocked, settle, installLiveMockWithCost, currentUser } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const scenario = process.argv[3] ?? 'detail'
const mobile = w < 500
const MARK = 'COSTO-DETALLE-T12: cada plantilla cuesta 1.50 MXN al negocio.'
const SMARK = 'COSTO-AJUSTES-T12: plantilla de ajustes (GET mock).'
const costText = { detail: MARK, null: null, nullset: null, real: undefined }[scenario]
const { browser, page, log } = await open({ width: w, height: mobile ? 844 : 900 })
let groups, settingsBody
page.on('response', async (r) => {
  if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null)
  if (/:3003\/chatbot-settings(\?|$)/.test(r.url()) && r.request().method() === 'GET') settingsBody = await r.json().catch(() => null)
})
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await settle(page, 500)
const id = groups.items.flatMap((g) => g.requests ?? g.items ?? []).find((r) => r.folio === 'S-000018').id
const user = await currentUser(page)
let detailBody
page.on('response', async (r) => { if (new RegExp(`chatbot-requests/${id}(\\?|$)`).test(r.url()) && r.request().method() === 'GET') detailBody = await r.json().catch(() => null) })
if (scenario === 'nullset') await page.route(/:3003\/chatbot-settings(\?.*)?$/, async (route) => { if (route.request().method() !== 'GET') return route.fallback(); const res = await route.fetch(); const j = await res.json(); await route.fulfill({ response: res, json: { ...j, templateCostText: SMARK } }) })
const st = await installLiveMockWithCost(page, { requestId: id, user, sessionState: 'ACTIVE', windowOpen: false }, costText)
log.requests.length = 0
await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await settle(page, 2500)
if (mobile) { const o = page.getByTestId('live-card-open'); if (await o.count()) { await o.click(); await page.waitForTimeout(1200) } }
const tag = `a2-${scenario}-${w}`
await shot(page, `${tag}-live`)
console.log('detail.templateCostText as served to the page:', JSON.stringify(detailBody?.templateCostText), '| status', detailBody?.status)
await page.getByRole('button', { name: /Enviar plantilla/ }).first().click(); await page.waitForTimeout(1200)
await shot(page, `${tag}-sheet`)
const dlg = page.locator('[role=dialog]').last()
console.log('SHEET', (await dlg.innerText()).replace(/\n+/g, ' | '))
const cost = await page.getByTestId('template-confirm-cost').innerText()
console.log('COST TEXT SHOWN:', JSON.stringify(cost))
await page.keyboard.press('Escape'); await page.waitForTimeout(800)
const settingsGets = log.requests.filter((x) => /chatbot-settings/.test(x))
console.log('GET /chatbot-settings from the detail page:', JSON.stringify(settingsGets))
console.log('settings templateCostText (when read):', JSON.stringify(settingsBody?.templateCostText))
console.log('RESULT', scenario, scenario === 'detail' ? (cost === MARK && settingsGets.length === 0 ? 'PASS' : 'FAIL') : scenario === 'nullset' ? (settingsGets.length === 1 && cost === SMARK ? 'PASS' : 'FAIL') : scenario === 'null' ? (settingsGets.length > 0 && settingsBody?.templateCostText && cost === settingsBody.templateCostText.trim() ? 'PASS' : 'CHECK') : 'INFO')
console.log('template POSTs (mock)', st.templatePosts.length, '| dialogs left', await page.locator('[role=dialog]').count())
console.log('REAL non-GET attempted (must be empty):', blocked)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
