// Step 4b: open a till for the manager in Caja (dev data, allowed) with a $100.00 fund. Explores the row menus first.
import { makeLog, open, settle, shot, BASE, logBodies } from './lib.mjs'
const log = makeLog('step4b-open-till')
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
logBodies(page, log, ['openingCents', 'registerId'])
await page.goto(`${BASE}/pos/caja`, { waitUntil: 'domcontentloaded' })
await settle(page, 1200)
let chosen = null
for (const name of ['Caja Express', 'Caja nueva ui', 'Caja Mostrador 2', 'Caja Principal']) {
  const row = page.locator('tbody tr').filter({ hasText: name }).first()
  await row.getByRole('button').last().click()
  await page.waitForTimeout(400)
  const items = await page.getByRole('menuitem').allInnerTexts()
  log(`MENU ${name} ${JSON.stringify(items.map((t) => t.trim()))}`)
  if (items.some((t) => /Abrir caja/.test(t))) { chosen = name; await page.getByRole('menuitem', { name: /Abrir caja/ }).click(); break }
  await page.keyboard.press('Escape'); await page.waitForTimeout(200)
}
log('CHOSEN ' + chosen)
if (!chosen) { await shot(page, '14-no-openable', log); await browser.close(); process.exit(0) }
await settle(page, 800)
const form = page.getByTestId('cash-open-session')
await form.waitFor()
log('FORM register ' + JSON.stringify(await page.getByTestId('cash-open-register').innerText().catch(() => null)))
await page.getByTestId('cash-opening-cents').locator('input').fill('100')
await page.getByTestId('cash-opening-confirmed').click()
await shot(page, '14-open-till-form', log)
const resp = page.waitForResponse((r) => r.request().method() === 'POST' && /cash-sessions/.test(r.url()), { timeout: 15000 }).catch(() => null)
await page.getByTestId('cash-open-submit').click()
const r = await resp
log('OPEN status ' + (r ? `${new URL(r.url()).pathname} -> ${r.status()}` : 'none'))
await settle(page, 1200)
log('errors ' + JSON.stringify(await page.locator('[data-testid="cash-open-error"],[data-testid="cash-open-local-error"]').allInnerTexts()))
await shot(page, '15-till-opened', log)
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
