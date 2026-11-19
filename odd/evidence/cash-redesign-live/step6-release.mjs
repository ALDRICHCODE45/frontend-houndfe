import { open, settle, shot, makeLog, BASE, logBodies } from './lib.mjs'
const log = makeLog('step6-release')
const { browser, page, issues } = await open(log, { role: 'cashier' })
logBodies(page, log)
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await page.getByTestId('cash-head-title').innerText())
log('next: ' + (await page.getByTestId('cash-next-action').innerText().catch(() => 'none')).replace(/\s+/g, ' '))
const rel = page.getByTestId('cash-drawer-release')
if (!(await rel.isVisible().catch(() => false))) { await page.getByTestId('cash-next-primary').click().catch(() => {}); await settle(page, 600) }
if (!(await rel.isVisible().catch(() => false))) { await page.getByTestId('cash-step-toggle-liberar').first().click().catch(() => {}); await settle(page, 600) }
log('release visible=' + await rel.isVisible() + ' disabled=' + await rel.isDisabled())
await rel.scrollIntoViewIfNeeded(); await shot(page, '16-cashier-release-ready-1440-light', log)
await rel.click(); await settle(page, 800)
// possible confirm dialog
const dlg = page.getByRole('alertdialog').or(page.getByRole('dialog'))
if (await dlg.isVisible().catch(() => false)) { log('dialog: ' + (await dlg.innerText()).replace(/\s+/g, ' ')); await shot(page, '16b-cashier-release-confirm-1440-light', log); await dlg.getByRole('button', { name: /liberar/i }).last().click(); await settle(page, 1500) }
log('released: ' + (await page.getByTestId('cash-drawer-released').innerText().catch(() => 'NONE')))
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await page.getByTestId('cash-head-title').innerText())
log('own shift: ' + (await page.getByTestId('cash-own-shift').innerText()).replace(/\s+/g, ' '))
await shot(page, '17-cashier-after-release-1440-light', log)
log('ISSUES ' + JSON.stringify(issues))
await browser.close()
