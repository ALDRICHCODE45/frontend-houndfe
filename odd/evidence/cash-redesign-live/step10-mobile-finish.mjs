// Shift 2 at 390: manager (light) receives, cashier (dark) releases, manager verifies + closes.
import { chromium } from '@playwright/test'
import { open, settle, shot, makeLog, BASE, logBodies, overflow } from './lib.mjs'
const SID = '4997a2fe-4194-4a68-b052-ddc110b18641'
const log = makeLog('step10-mobile-finish')
const browser = await chromium.launch({ headless: true })
const state = async (page, tag) => {
  const bar = page.getByTestId('cash-workspace-bar'); const o = await overflow(page)
  const b = await bar.isVisible().catch(() => false) ? await bar.evaluate((e) => `${getComputedStyle(e).position}@${Math.round(e.getBoundingClientRect().bottom)} "${e.innerText.replace(/\s+/g, ' ')}"`) : 'none'
  log(`${tag}: overflowX=${o.sw > o.cw} (${o.sw}/${o.cw}) bar=${b}`)
}
// 1. manager receives
let s = await open(log, { role: 'manager', width: 390, height: 844, theme: 'light', browser }); let page = s.page
page.setDefaultTimeout(10000); logBodies(page, log, ['receivedCents'])
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.getByTestId('cash-receive-entry').click(); await settle(page, 800)
const card = page.locator('[data-testid^="cash-custody-pending-"]').filter({ hasText: 'QA T6 móvil' }).first()
const id = (await card.getAttribute('data-testid')).replace('cash-custody-pending-', '')
await page.getByTestId(`cash-custody-received-input-${id}`).fill('320')
await card.scrollIntoViewIfNeeded(); await state(page, 'receive'); await shot(page, '49-m-manager-receive-390-light', log)
log('receive btn: ' + await page.getByTestId(`cash-custody-receive-${id}`).innerText())
await page.getByTestId(`cash-custody-receive-${id}`).click(); await settle(page, 1500)
log('MGR1 ISSUES ' + JSON.stringify(s.issues)); await s.ctx.close()
// 2. cashier releases
s = await open(log, { role: 'cashier', width: 390, height: 844, theme: 'dark', browser }); page = s.page
page.setDefaultTimeout(10000); logBodies(page, log)
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await page.getByTestId('cash-head-title').innerText())
await state(page, 'pre-release')
await page.getByTestId('cash-next-primary').click().catch(() => {}); await settle(page, 600)
await page.getByTestId('cash-drawer-release').scrollIntoViewIfNeeded(); await shot(page, '50-m-cashier-release-390-dark', log)
await page.getByTestId('cash-drawer-release').click(); await settle(page, 1500)
log('released: ' + (await page.getByTestId('cash-drawer-released').innerText().catch(() => 'NONE')))
log('CASH ISSUES ' + JSON.stringify(s.issues)); await s.ctx.close()
// 3. manager verifies + closes
s = await open(log, { role: 'manager', width: 390, height: 844, theme: 'light', browser }); page = s.page
page.setDefaultTimeout(10000); logBodies(page, log, ['amountCents', 'channelKey'])
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.locator(`[data-testid="cash-session-open-${SID}"]:visible`).first().click(); await settle(page, 1500)
await state(page, 'mgr-selected'); await shot(page, '51-m-manager-selected-390-light', log)
await page.getByTestId('cash-next-primary').click().catch(() => {}); await settle(page, 600)
const v = page.getByTestId('cash-verification')
await v.getByTestId('cash-count-input-CASH').fill('320')
await v.scrollIntoViewIfNeeded(); await shot(page, '52-m-manager-verify-390-light', log)
await v.getByTestId('cash-count-submit').click(); await settle(page, 1500)
log('verified: ' + (await page.getByTestId('cash-verification-verified').innerText().catch(() => 'NONE')))
await page.getByTestId('cash-next-primary').click().catch(() => {}); await settle(page, 600)
if (!(await page.getByTestId('cash-close-step').isVisible().catch(() => false))) { await page.getByTestId('cash-step-toggle-cierre').first().click().catch(() => {}); await settle(page, 600) }
log('close reqs: ' + (await page.locator('[data-testid^="cash-close-requirement-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('cash-close-requirement-', '') + '=' + e.dataset.state))).join(', '))
await page.getByTestId('cash-close-step').scrollIntoViewIfNeeded(); await state(page, 'close'); await shot(page, '53-m-manager-close-checklist-390-light', log)
await page.getByTestId('cash-close-submit').click(); await settle(page, 600)
const dlg = page.getByRole('alertdialog').or(page.getByRole('dialog'))
await shot(page, '54-m-manager-close-confirm-390-light', log)
await dlg.getByRole('button', { name: /cerrar caja/i }).last().click(); await settle(page, 2000)
await page.getByTestId('cash-close-view-closing').click().catch(() => {}); await settle(page, 1500)
log('corte header: ' + (await page.getByTestId('cash-closing-header').first().innerText().catch(() => 'NONE')).replace(/\s+/g, ' '))
await page.getByTestId('cash-closing-detail').first().scrollIntoViewIfNeeded().catch(() => {}); await state(page, 'corte'); await shot(page, '55-m-manager-corte-390-light', log)
log('MGR2 ISSUES ' + JSON.stringify(s.issues)); await s.ctx.close()
await browser.close()
