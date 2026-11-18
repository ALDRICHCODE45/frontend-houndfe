// Exploration (read-mostly): login, Promociones list, POS landing; dumps visible text.
import { BASE, makeLog, open, settle, shot } from './lib.mjs'

const log = makeLog('explore')
const { browser, page, foreign } = await open(log)
await page.goto(`${BASE}/pos/promociones`)
await settle(page)
await shot(page, '00-explore-promociones', log)
const row = page.getByText("10% en croquetas Hill's").first()
log(`promo row visible: ${await row.isVisible().catch(() => false)}`)
await page.goto(`${BASE}/pos/ventas/nueva`)
await settle(page, 1500)
await shot(page, '00-explore-pos', log)
log(`url ${new URL(page.url()).pathname}`)
log((await page.locator('body').innerText()).slice(0, 1500))
log(`foreign: ${[...foreign].join(', ') || 'none'}`)
await browser.close()
