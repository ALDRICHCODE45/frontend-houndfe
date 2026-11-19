import { open, settle, makeLog, BASE } from './lib.mjs'
const SID = 'd74d78fe-df73-4e91-a359-6e1a36090ba5'
const log = makeLog('step8b-pdfview')
const { browser, page, issues } = await open(log, { role: 'manager' })
page.setDefaultTimeout(8000)
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.locator('input[data-testid="cash-sessions-status-CLOSED"]').check({ force: true }); await settle(page, 800)
await page.locator(`[data-testid="cash-session-open-${SID}"]:visible`).first().click(); await settle(page, 1200)
await page.getByTestId('cash-next-primary').click(); await settle(page, 1200)
const popupP = page.context().waitForEvent('page', { timeout: 8000 })
await page.getByTestId('cash-closing-pdf-view').first().click()
const popup = await popupP
const navs = []; popup.on('framenavigated', (f) => navs.push(f.url().split(':')[0] + ':' + (f.url().startsWith('blob:') ? '<blob>' : f.url().slice(5, 30))))
let dl = null; popup.on('download', (d) => { dl = d.suggestedFilename() })
await popup.waitForTimeout(3000)
log(`popup final scheme=${popup.url().split(':')[0]} navs=${JSON.stringify(navs)} download=${dl}`)
log('ISSUES ' + JSON.stringify(issues))
await browser.close()
