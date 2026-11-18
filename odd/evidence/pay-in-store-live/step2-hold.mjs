// Step 2: 000077 detail, «Apartado» card, «Cambiar plazo» (past date first, then a future one).
import { makeLog, open, settle, shot, BASE, logBodies } from './lib.mjs'
const log = makeLog('step2-hold')
const ID = '6e64f7bc-f7a8-48cb-8c5f-8902ef000233'
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
logBodies(page, log)
await page.goto(`${BASE}/pos/ventas/${ID}`, { waitUntil: 'domcontentloaded' })
await settle(page, 1200)
const card = page.getByTestId('sale-detail-hold')
log('HOLD CARD visible=' + (await card.isVisible()) + ' line=' + JSON.stringify(await page.getByTestId('sale-detail-hold-line').innerText()))
await card.scrollIntoViewIfNeeded()
await shot(page, '03-detail-hold-1440', log)
await page.getByTestId('sale-detail-hold-edit').click()
const dlg = page.getByTestId('sale-hold-deadline-dialog')
await dlg.waitFor()
log('CURRENT ' + JSON.stringify(await page.getByTestId('hold-deadline-current').innerText()))
const segs = dlg.locator('[data-reka-date-field-segment]:not([data-reka-date-field-segment="literal"])')
log('SEGMENTS ' + JSON.stringify(await segs.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-reka-date-field-segment')}=${e.textContent}`))))
await shot(page, '04-dialog-open', log)
async function typeDate({ day, month, year, hour, minute }) {
  const vals = { day, month, year, hour, minute }
  const n = await segs.count()
  for (let i = 0; i < n; i++) {
    const kind = await segs.nth(i).getAttribute('data-reka-date-field-segment')
    if (!(kind in vals)) continue
    // focus(), not click(): a click on a segment toggles the calendar popover, which takes the focus (D1).
    await segs.nth(i).focus()
    await page.keyboard.type(String(vals[kind]).padStart(kind === 'year' ? 4 : 2, '0'))
    await page.waitForTimeout(80)
  }
  log('SEGMENTS now ' + JSON.stringify(await segs.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-reka-date-field-segment')}=${e.textContent}`))))
}
// Past: earlier today 2026-11-18 08:15 (Mexico City). (Attempts 1-2 clicked the segments: every other click opens the calendar and the typed digits are lost, so 19 nov 10:47 and 08:47/18:47 were saved instead; see outcome D1.)
await typeDate({ day: 18, month: 11, year: 2026, hour: 8, minute: 15 })
const save = page.getByTestId('hold-deadline-save')
log('save enabled (past) ' + (await save.isEnabled()))
if (await save.isEnabled()) await save.click()
await page.waitForTimeout(1200)
const dlgOpen = await dlg.isVisible()
log('dialog still open ' + dlgOpen)
const errText = dlgOpen ? await dlg.innerText() : ''
log('DIALOG after past save: ' + JSON.stringify(errText.replace(/\s+/g, ' ').slice(0, 400)))
await shot(page, '05-dialog-past-error', log)
// Future: 2026-11-20 18:30 Mexico City.
if (!dlgOpen) { await page.getByTestId('sale-detail-hold-edit').click(); await dlg.waitFor() }
await typeDate({ day: 20, month: 11, year: 2026, hour: 18, minute: 30 })
log('save enabled (future) ' + (await save.isEnabled()))
const patchResp = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/hold'), { timeout: 15000 }).catch(() => null)
await save.click()
const r = await patchResp
log('PATCH status ' + (r ? r.status() : 'none'))
if (r) { try { const b = await r.json(); log('PATCH hold ' + JSON.stringify(b.hold)) } catch {} }
const toast = page.getByText('Fecha límite actualizada')
log('TOAST ' + (await toast.first().isVisible({ timeout: 5000 }).catch(() => false)))
await shot(page, '06-after-save-toast', log)
await settle(page, 800)
log('HOLD LINE after ' + JSON.stringify(await page.getByTestId('sale-detail-hold-line').innerText()))
await card.scrollIntoViewIfNeeded()
await shot(page, '07-detail-hold-updated-1440', log)
await page.setViewportSize({ width: 390, height: 844 })
await settle(page, 600)
await card.scrollIntoViewIfNeeded()
await card.screenshot({ path: 'shots/08-hold-card-390.png' }); log('SHOT 08-hold-card-390.png')
log('390 overflow px ' + (await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)))
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
