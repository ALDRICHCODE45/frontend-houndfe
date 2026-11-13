// MOCKED (browser-side route fulfilment only, nothing written to the API): CONVERSATION_* notices and windowClosingSoon variants.
import { open, shot, BASE } from './lib.mjs'
const { browser, page, log } = await open({ width: 1440, height: 900 })
await page.route(/:3003\/(chatbot-|notifications)/, (route) => route.request().method() !== 'GET' ? route.abort() : route.continue())
// notifications mock
await page.route(/:3003\/notifications\?/, async (route) => {
  const res = await route.fetch(); const j = await res.json()
  const base = j.items[0]
  const mk = (type, title, level, extra = {}) => ({ ...base, id: 'mock-' + type + level, type, title, level, readAt: null, createdAt: new Date().toISOString(), ...extra })
  j.items = [mk('CONVERSATION_UNANSWERED', 'Cliente esperando respuesta (5 min)', 5), mk('CONVERSATION_UNANSWERED', 'Cliente esperando respuesta (15 min)', 15), mk('CONVERSATION_UNANSWERED', 'Cliente esperando respuesta', null), mk('CONVERSATION_CUSTOMER_MESSAGE', 'Nuevo mensaje del cliente', null), ...j.items]
  await route.fulfill({ response: res, json: j })
})
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
await page.getByRole('button', { name: /Notificaciones/ }).click(); await page.waitForTimeout(2000)
const dlg = page.locator('[role=dialog]').last()
console.log('NOTIF MOCK:', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 900))
await shot(page, 'notifications-mock-conversation-1440')
await page.keyboard.press('Escape')
// windowClosingSoon mocks on groups
for (const [label, patch] of [
  ['flag-true-far-window', (r) => r.folio === 'S-000018' ? { windowClosingSoon: true } : {}],
  ['flag-false-near-window', (r) => r.folio === 'S-000018' ? { windowClosingSoon: false, whatsappWindowClosesAt: new Date(Date.now() + 30 * 60000).toISOString() } : {}],
  ['flag-absent-near-window', (r) => { if (r.folio !== 'S-000018') return {}; return { windowClosingSoon: undefined, whatsappWindowClosesAt: new Date(Date.now() + 30 * 60000).toISOString() } }],
]) {
  await page.unroute(/:3003\/chatbot-requests\/groups/)
  await page.route(/:3003\/chatbot-requests\/groups\?/, async (route) => {
    const res = await route.fetch(); const j = await res.json()
    for (const g of j.items) for (const k of ['requests', 'items']) if (g[k]) g[k] = g[k].map((r) => { const o = { ...r, ...patch(r) }; if ('windowClosingSoon' in patch(r) && patch(r).windowClosingSoon === undefined) delete o.windowClosingSoon; return o })
    await route.fulfill({ response: res, json: j })
  })
  await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
  const row = page.locator('[class*=chatbot-row]', { hasText: 'S-000018' }).first()
  console.log(label, '=>', (await row.innerText()).replace(/\n+/g, ' | '))
  await row.scrollIntoViewIfNeeded(); await shot(page, `window-tag-${label}-1440`)
}
console.log('CONSOLE', log.console, log.failed)
await browser.close()
