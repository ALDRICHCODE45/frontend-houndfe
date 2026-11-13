import { open, shot, BASE } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
await page.route(/:3003\/(chatbot-|notifications)/, (route) => route.request().method() !== 'GET' ? (console.log('BLOCKED', route.request().method(), route.request().url()), route.abort()) : route.continue())
let list = []
page.on('response', async (r) => { if (/\/notifications\?/.test(r.url())) { const j = await r.json().catch(() => null); list.push(...(j?.items ?? [])) } })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
await page.getByRole('button', { name: /Notificaciones/ }).click(); await page.waitForTimeout(2500)
const dlg = page.locator('[role=dialog]').last()
await shot(page, `notifications-panel-${w}`)
console.log((await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 6000))
// scroll the list to the bottom a few times to load older pages
for (let i = 0; i < 4; i++) { await dlg.evaluate(e => { const s=[...e.querySelectorAll('*')].find(x=>x.scrollHeight>x.clientHeight+5&&['auto','scroll'].includes(getComputedStyle(x).overflowY)); s && (s.scrollTop = s.scrollHeight) }); await page.waitForTimeout(700) }
const more = page.getByRole('button', { name: /Ver anteriores|Cargar/ }); if (await more.count()) { await more.first().click(); await page.waitForTimeout(1500) }
console.log('--- items from API:', list.length)
const types = {}; for (const n of list) { types[n.type] = (types[n.type]||0)+1 }
console.log(JSON.stringify(types))
for (const n of list.slice(0, 40)) console.log(n.type, n.folio, n.subtype, 'cause=', n.cause, 'reason=', n.reason, 'open=', n.requestOpen, 'level=', n.level, '|', (n.title ?? '').slice(0, 50), '|', (n.body ?? '').slice(0, 60))
await shot(page, `notifications-panel-scrolled-${w}`)
console.log('PANEL TEXT AFTER SCROLL:', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 9000))
console.log('CONSOLE', log.console, log.failed)
await browser.close()
