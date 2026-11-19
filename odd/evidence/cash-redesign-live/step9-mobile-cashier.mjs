// Shift 2, driven at 390 dark by the cashier: opening, movement, count, declaration, handover.
import { open, settle, shot, makeLog, BASE, logBodies, overflow } from './lib.mjs'
const log = makeLog('step9-mobile-cashier')
const { browser, page, issues } = await open(log, { role: 'cashier', width: 390, height: 844, theme: 'dark' })
page.setDefaultTimeout(10000)
logBodies(page, log, ['amountCents', 'openingCents', 'declaredCents', 'channelKey'])
let maskOwnShift = true
await page.route(/\/cash-sessions\?/, async (route) => {
  const u = new URL(route.request().url())
  if (maskOwnShift && u.searchParams.get('drawerOpen') === 'true' && u.searchParams.get('limit') === '1') {
    const res = await route.fetch(); const body = await res.json()
    return route.fulfill({ response: res, json: { ...body, items: [], total: 0 } })
  }
  return route.continue()
})
const bar = page.getByTestId('cash-workspace-bar')
const state = async (tag) => {
  const o = await overflow(page)
  const b = await bar.isVisible().catch(() => false) ? await bar.evaluate((e) => `${getComputedStyle(e).position}@${Math.round(e.getBoundingClientRect().bottom)} "${e.innerText.replace(/\s+/g, ' ')}"`) : 'none'
  log(`${tag}: overflowX=${o.sw > o.cw} (${o.sw}/${o.cw}) bar=${b}`)
}
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await state('no-shift'); await shot(page, '40-m-cashier-no-shift-390-dark', log)
if (await bar.isVisible().catch(() => false)) await bar.getByRole('button').first().click(); else await page.getByTestId('cash-own-shift-open').click()
await settle(page, 600)
await page.getByRole('radio', { name: /Caja QA rediseño T6/ }).click(); await settle(page, 300)
await page.getByLabel('Fondo inicial (pesos)').fill('300')
await page.getByTestId('cash-opening-confirmed').click(); await page.waitForTimeout(300)
await state('apertura'); await page.getByTestId('cash-open-submit').scrollIntoViewIfNeeded(); await shot(page, '41-m-cashier-apertura-confirmada-390-dark', log)
maskOwnShift = false
await page.getByTestId('cash-open-submit').click(); await settle(page, 1500)
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await page.getByTestId('cash-head-title').innerText())
await page.evaluate(() => window.scrollTo(0, 0)); await state('open'); await shot(page, '42-m-cashier-open-390-dark', log)
// movement
await page.getByTestId('cash-step-toggle-movimientos').first().click(); await settle(page, 400)
await page.getByTestId('cash-movement-amount').fill('20')
await page.getByTestId('cash-movement-reason').fill('Cambio QA T6 móvil')
await page.getByTestId('cash-in-submit').click(); await settle(page, 1000)
log('last: ' + (await page.getByTestId('cash-movement-last').innerText().catch(() => 'NONE')).replace(/\s+/g, ' ') + ' table=' + await page.getByTestId('cash-movements-table').isVisible().catch(() => false))
await page.getByTestId('cash-movement-last').scrollIntoViewIfNeeded(); await state('movement'); await shot(page, '43-m-cashier-movement-confirm-390-dark', log)
// freeze
await page.getByTestId('cash-step-toggle-conteo').first().click(); await settle(page, 400)
await page.getByTestId('cash-session-freeze').click(); await settle(page, 1500)
await state('frozen')
// open declaration via next action
await page.getByTestId('cash-next-primary').click().catch(() => {}); await settle(page, 600)
if (!(await page.getByTestId('cash-count-form').isVisible().catch(() => false))) { await page.getByTestId('cash-step-toggle-declaracion').first().click(); await settle(page, 600) }
await page.getByTestId('cash-count-submit').click(); await page.waitForTimeout(500)
log('summary: ' + (await page.getByTestId('cash-count-error-summary').innerText().catch(() => 'NONE')).replace(/\s+/g, ' '))
const geo = await page.evaluate(() => { const f = document.querySelector('[data-testid="cash-count-form"]'); const r = f.getBoundingClientRect(); return { h: Math.round(r.height), scrollH: f.scrollHeight, bg: getComputedStyle(f).backgroundColor, cls: f.className } })
log('count form geometry: ' + JSON.stringify(geo))
await page.getByTestId('cash-count-error-summary').scrollIntoViewIfNeeded().catch(() => {})
await state('count-error'); await shot(page, '44-m-cashier-count-empty-error-390-dark', log)
await page.getByTestId('cash-count-input-CASH').fill('320')
await page.getByTestId('cash-count-denom-20000').fill('1'); await page.getByTestId('cash-count-denom-10000').fill('1'); await page.getByTestId('cash-count-denom-2000-billete').fill('1')
await page.waitForTimeout(300)
log('denom match=' + await page.getByTestId('cash-count-denomination-match').isVisible().catch(() => false))
await page.getByTestId('cash-count-denomination-sum').scrollIntoViewIfNeeded().catch(() => {}); await shot(page, '45-m-cashier-count-denoms-390-dark', log)
await page.getByTestId('cash-count-submit').click(); await settle(page, 1500)
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' '))
await page.evaluate(() => window.scrollTo(0, 0)); await state('submitted'); await shot(page, '46-m-cashier-submitted-390-dark', log)
// handover
await page.getByTestId('cash-next-primary').click().catch(() => {}); await settle(page, 600)
if (!(await page.getByTestId('cash-handover-form').isVisible().catch(() => false))) { if (await bar.isVisible()) await bar.getByRole('button').last().click(); await settle(page, 600) }
const form = page.getByTestId('cash-handover-form')
await form.getByText('Retiro', { exact: true }).click(); await settle(page, 500)
await page.locator('[data-testid^="cash-handover-recipient-card-"]', { hasText: 'Manager Centro' }).click()
await page.getByTestId('cash-handover-amount').fill('320')
await page.getByTestId('cash-handover-notes').fill('Retiro QA T6 móvil')
await form.scrollIntoViewIfNeeded(); await state('handover'); await shot(page, '47-m-cashier-handover-390-dark', log)
await page.getByTestId('cash-handover-submit').click(); await settle(page, 1200)
log('list: ' + (await page.getByTestId('cash-handover-list').innerText().catch(() => 'NONE')).replace(/\s+/g, ' '))
await page.getByTestId('cash-handover-list').scrollIntoViewIfNeeded(); await state('handover-done'); await shot(page, '48-m-cashier-handover-done-390-dark', log)
log('ISSUES ' + JSON.stringify(issues))
await browser.close()
