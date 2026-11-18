// Step 1: sales list rows (hold line, channel, expired hold) at 1440 and 390.
import { makeLog, open, settle, shot, BASE } from './lib.mjs'
const log = makeLog('step1-list')
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
await page.goto(`${BASE}/pos/ventas`, { waitUntil: 'domcontentloaded' })
await settle(page, 1200)
const headers = await page.locator('thead th').allInnerTexts()
log('HEADERS ' + JSON.stringify(headers.map((h) => h.trim())))
if (!headers.some((h) => /Canal/.test(h))) {
  // Show the «Canal» column through the table's column menu.
  const btn = page.getByTestId('toolbar-columns-button').first()
  log('column button count ' + (await btn.count()))
  if (await btn.count()) {
    await btn.click(); await page.waitForTimeout(400)
    await shot(page, '01a-column-menu', log)
    const item = page.getByTestId('columns-panel').getByLabel('Mostrar Canal')
    log('canal item count ' + (await item.count()))
    await item.first().click(); await page.keyboard.press('Escape'); await page.waitForTimeout(400)
  }
  log('HEADERS after ' + JSON.stringify((await page.locator('thead th').allInnerTexts()).map((h) => h.trim())))
}
const out = await page.$$eval('tbody tr', (trs) => trs.map((r) => ({
  folio: r.querySelector('[data-testid^="sale-link-"]')?.textContent?.trim() ?? '',
  hold: r.querySelector('[data-testid="sale-hold-line"]')?.textContent?.trim() ?? null,
  status: r.querySelector('[data-testid="sale-payment-status"],[data-testid="sale-canceled-status"]')?.textContent?.trim() ?? null,
  channel: r.querySelector('[data-testid="sale-channel"]')?.textContent?.trim() ?? null,
})))
for (const o of out.slice(0, 12)) log('ROW ' + JSON.stringify(o))
log('POS row sample ' + JSON.stringify(out.find((o) => o.channel === 'Punto de venta') ?? null))
await shot(page, '01-list-1440', log)
await page.setViewportSize({ width: 390, height: 844 })
await settle(page, 800)
const cards = page.locator('[data-testid="sale-card"]')
log('cards ' + (await cards.count()))
for (const f of ['#77', '#78']) {
  const c = cards.filter({ has: page.locator('[data-testid^="sale-link-"]', { hasText: f }) }).first()
  if (await c.count()) {
    log(`CARD ${f} hold=${JSON.stringify(await c.locator('[data-testid="sale-hold-line"]').innerText({ timeout: 2000 }).catch(() => null))}`)
    await c.scrollIntoViewIfNeeded()
    await c.screenshot({ path: `shots/02-card-${f.slice(1)}-390.png` }); log(`SHOT 02-card-${f.slice(1)}-390.png`)
  } else log(`CARD ${f} not found`)
}
const ov = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
log('390 horizontal overflow px ' + ov)
await shot(page, '02-list-390', log)
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
