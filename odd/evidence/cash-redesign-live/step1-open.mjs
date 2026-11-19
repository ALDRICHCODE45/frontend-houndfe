import { open, settle, shot, makeLog, BASE, logBodies } from './lib.mjs'
const log = makeLog('step1-open')
const { browser, page, issues } = await open(log, { role: 'cashier' })
logBodies(page, log)
// The dev cashier already has 4 drawer-open sessions on every active register (pre-existing dev data),
// so the no-shift state is unreachable. Only the «Tu turno» read (?drawerOpen=true&limit=1) is
// answered empty until the shift is opened; every write stays real.
let maskOwnShift = true
await page.route(/\/cash-sessions\?/, async (route) => {
  const u = new URL(route.request().url())
  if (maskOwnShift && u.searchParams.get('drawerOpen') === 'true' && u.searchParams.get('limit') === '1') {
    const res = await route.fetch(); const body = await res.json()
    log('MASK own-shift read -> empty (keys ' + Object.keys(body).join(',') + ')')
    return route.fulfill({ response: res, json: { ...body, items: [], total: 0 } })
  }
  return route.continue()
})
await page.goto(`${BASE}/pos/caja`); await settle(page, 1200)
const own = page.getByTestId('cash-own-shift')
log('own-shift text: ' + (await own.innerText()).replace(/\s+/g, ' '))
log('steps: ' + (await page.locator('[data-testid^="cash-step-who-"]').allInnerTexts()).join(' | '))
log('step count: ' + await page.locator('[data-testid^="cash-step-state-"]').count())
log('next: ' + (await page.getByTestId('cash-next-action').innerText().catch(() => 'none')).replace(/\s+/g, ' '))
await shot(page, '01-cashier-no-shift-1440-light', log)
// opening
log('head (no shift): ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await page.getByTestId('cash-head-title').innerText())
const openBtn = page.getByTestId('cash-own-shift-open')
log('own-shift-open visible: ' + await openBtn.isVisible())
if (await openBtn.isVisible()) await openBtn.click()
await settle(page)
await shot(page, '02-cashier-apertura-1440-light', log)
await page.getByRole('radio', { name: /Caja QA rediseño T6/ }).click()
await settle(page, 400)
await page.getByLabel('Fondo inicial (pesos)').fill('500')
const conf = page.getByTestId('cash-opening-confirmed')
log('confirm label: ' + await conf.innerText())
await conf.click()
await page.waitForTimeout(300)
log('submit label: ' + await page.getByTestId('cash-open-submit').innerText())
await shot(page, '03-cashier-apertura-confirmada-1440-light', log)
maskOwnShift = false
await page.getByTestId('cash-open-submit').click()
await settle(page, 1500)
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await page.getByTestId('cash-head-title').innerText())
log('url ' + page.url())
await shot(page, '04-cashier-open-1440-light', log)
log('ISSUES ' + JSON.stringify(issues))
await browser.close()
