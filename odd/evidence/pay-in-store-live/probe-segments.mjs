// Diagnose how the «Nueva fecha límite» segments take keyboard input (no save).
import { makeLog, open, settle, BASE } from './lib.mjs'
const log = makeLog('probe-segments')
const { browser, page } = await open(log)
page.setDefaultTimeout(10000)
await page.goto(`${BASE}/pos/ventas/6e64f7bc-f7a8-48cb-8c5f-8902ef000233`, { waitUntil: 'domcontentloaded' })
await settle(page, 1000)
await page.getByTestId('sale-detail-hold-edit').click()
const dlg = page.getByTestId('sale-hold-deadline-dialog'); await dlg.waitFor()
const seg = (k) => dlg.locator(`[data-reka-date-field-segment="${k}"]`)
const dump = async (t) => log(t + ' ' + JSON.stringify(await dlg.locator('[data-reka-date-field-segment]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-reka-date-field-segment')}=${e.textContent}${e.hasAttribute('data-invalid') ? '!' : ''}`))))
await dump('start')
const state = async (t) => log(t + ' calendarOpen=' + (await page.locator('[role="dialog"] [role="grid"], [data-reka-popper-content-wrapper] [role="grid"]').count()) + ' focus=' + (await page.evaluate(() => { const a = document.activeElement; return (a?.getAttribute('data-reka-date-field-segment') ?? a?.tagName + ':' + (a?.getAttribute('aria-label') ?? a?.textContent?.trim().slice(0, 20))) })))
for (const k of ['day', 'month', 'hour', 'minute']) {
  await seg(k).click(); await page.waitForTimeout(300); await state('after click ' + k)
  await page.keyboard.type('2'); await page.waitForTimeout(100); await dump('  typed 2 into ' + k)
}
await page.screenshot({ path: 'shots/09-segment-click-calendar.png' })
log('focused ' + await page.evaluate(() => document.activeElement?.getAttribute('data-reka-date-field-segment')))
await browser.close()
