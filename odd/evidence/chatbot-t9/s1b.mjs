import { open, shot, BASE } from './lib.mjs'
const { browser, page, log } = await open()
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
const rows = (groups?.items ?? groups?.groups ?? []).flatMap((g) => g.requests ?? g.items ?? [])
console.log(Object.keys(groups ?? {}))
for (const r of rows) console.log(r.folio, r.subtype, r.type, r.displayStatus, r.slaLevel, 'wcs=', r.windowClosingSoon, 'closes=', r.whatsappWindowClosesAt, 'unread=', r.unreadCustomerMessages)
const now = new Date(); console.log('now', now.toISOString())
// toggle filter «Ventana por cerrar»
await page.getByRole('button', { name: /Ventana por cerrar/ }).click().catch(async()=>{ await page.getByText('Ventana por cerrar').first().click() })
await page.waitForTimeout(1500)
console.log('after filter url', page.url()); console.log((await page.locator('body').innerText()).split('\n').slice(28,60).join(' | '))
await shot(page, '01b-inbox-window-filter-1440')
console.log(log.requests.filter(x=>x.includes('chatbot')).join('\n')); console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
