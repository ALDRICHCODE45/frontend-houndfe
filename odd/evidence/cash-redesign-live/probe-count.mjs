import { open, settle, shot, makeLog, BASE } from './lib.mjs'
const log = makeLog('probe-count')
const { browser, page } = await open(log, { role: 'cashier' })
await page.goto(`${BASE}/pos/caja`); await settle(page, 1200)
log('forms=' + await page.getByTestId('cash-count-form').count() + ' visible=' + await page.getByTestId('cash-count-form').isVisible())
log('denoms count=' + await page.locator('.cash-denoms').count())
log('denom50000 count=' + await page.getByTestId('cash-count-denom-50000').count() + ' tag=' + await page.getByTestId('cash-count-denom-50000').first().evaluate((e) => e.tagName + ' vis ' + (e.offsetParent !== null)).catch((e) => e.message.slice(0, 80)))
log('denom testids: ' + (await page.locator('[data-testid^="cash-count-denom"]').evaluateAll((els) => els.map((e) => e.dataset.testid + ':' + e.tagName))).join(' '))
await browser.close()
