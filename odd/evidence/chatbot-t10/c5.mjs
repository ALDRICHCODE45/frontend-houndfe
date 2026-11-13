// Regression (item 5) + icon size probe + design reference renders. GET only.
import { open, shot, BASE, blocked } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1000)
const rows = groups.items.flatMap((g) => g.requests ?? g.items ?? [])
const by = (f) => rows.find((r) => r.folio === f)
// S-000018
const convReqs = []
page.on('request', (r) => { if (/conversation/.test(r.url())) convReqs.push(r.url().replace(/^https?:\/\/[^/]+/, '')) })
await page.goto(`${BASE}/chatbot/solicitudes/${by('S-000018').id}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(2500)
const older = page.getByTestId('conversation-older'); console.log('S-18 older btn', await older.count(), (await older.innerText().catch(() => '')).trim())
const n1 = await page.locator('[role=log]').evaluate((el) => el.children.length)
console.log('S-18 log children before older', n1)
await shot(page, `c5-s18-${w}`)
if (await older.count()) { await older.click(); await page.waitForTimeout(2500) }
const n2 = await page.locator('[role=log]').evaluate((el) => el.querySelectorAll('[data-testid=conversation-day]').length)
const total = await page.locator('[role=log]').evaluate((el) => Array.from(el.children).filter((c) => c.getAttribute('role') !== 'separator').length)
console.log('S-18 after older: messages', total, 'day separators', n2, 'older btn left', await older.count(), 'reqs', convReqs.join(' ; '))
await shot(page, `c5-s18-older-${w}`)
console.log('S-18 actions', JSON.stringify(await page.getByRole('button').evaluateAll((els) => els.map((e) => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter((t) => /Atender|Liberar|Finalizar|Responder|Reagendar|Cancelar|Reasignar/.test(t)))))
// Clarification
const clar = rows.find((r) => r.kind === 'CLARIFICATION' && r.status !== 'RESOLVED')
console.log('clarification', clar?.folio)
await page.goto(`${BASE}/chatbot/solicitudes/${clar.id}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(2000)
const btns = await page.getByRole('button').evaluateAll((els) => els.map((e) => ({ t: (e.innerText || '').trim().replace(/\s+/g, ' '), c: e.className.toString().includes('primary') || getComputedStyle(e).backgroundColor, dis: e.disabled })).filter((b) => /Responder|Atender|Cancelar sol|Reagendar|Resolver|Liberar/.test(b.t)))
console.log('CLARIF buttons', JSON.stringify(btns))
await shot(page, `c5-clarif-${w}`)
// settings
await page.goto(`${BASE}/sistema/atencion-chatbot`, { waitUntil: 'domcontentloaded' }).catch(() => {})
console.log('settings url try', page.url())
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500)
if (!/chatbot/.test(page.url()) || (await page.locator('body').innerText()).includes('Página no encontrada')) console.log('NOT FOUND at /sistema/atencion-chatbot')
const body = (await page.locator('body').innerText())
console.log('SETTINGS has «Aún sin efecto»:', /Aún sin efecto/.test(body), '| template text:', body.replace(/\n+/g, ' | ').match(/.{0,120}[Pp]lantilla.{0,200}/)?.[0])
await shot(page, `c5-settings-${w}`); await shot(page, `c5-settings-${w}-full`, true)
console.log('BLOCKED', blocked, 'CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
