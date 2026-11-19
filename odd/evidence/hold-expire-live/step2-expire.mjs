// Step 2: hold card «Vencer apartado ahora» -> dialog -> «Vencer apartado» -> cancelled detail. ID via argv.
import { makeLog, open, settle, shot, BASE, logBodies } from './lib.mjs'
const ID = process.argv[2] ?? '6e64f7bc-f7a8-48cb-8c5f-8902ef000233'
const DO = process.argv[3] === 'expire'
const log = makeLog('step2-expire-' + ID.slice(0, 8))
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
logBodies(page, log)
await page.goto(`${BASE}/pos/ventas/${ID}`, { waitUntil: 'domcontentloaded' })
await settle(page, 1200)
const txt = async (tid) => (await page.getByTestId(tid).count()) ? (await page.getByTestId(tid).first().innerText()).replace(/\s+/g, ' ').trim() : null
log('HEADER ' + JSON.stringify((await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)))
log('HOLD CARD ' + JSON.stringify(await txt('sale-detail-hold')))
const btn = page.getByTestId('sale-detail-hold-expire')
log('EXPIRE BUTTON count=' + (await btn.count()) + ' text=' + JSON.stringify(await txt('sale-detail-hold-expire')))
if (await page.getByTestId('sale-detail-hold').count()) await page.getByTestId('sale-detail-hold').scrollIntoViewIfNeeded()
await shot(page, `10-detail-before-${ID.slice(0, 8)}`, log)
if (DO && (await btn.count())) {
  await btn.click()
  const dlg = page.getByRole('dialog').filter({ hasText: '¿Vencer el apartado ahora?' })
  await dlg.waitFor()
  log('DIALOG ' + JSON.stringify((await dlg.innerText()).replace(/\s+/g, ' ')))
  await shot(page, `11-expire-dialog-${ID.slice(0, 8)}`, log)
  const resp = page.waitForResponse((r) => r.request().method() === 'POST' && /\/hold\/expire$/.test(new URL(r.url()).pathname), { timeout: 20000 }).catch(() => null)
  await dlg.getByRole('button', { name: 'Vencer apartado', exact: true }).click()
  const r = await resp
  if (r) {
    const key = r.request().headers()['idempotency-key']
    log(`EXPIRE POST ${new URL(r.url()).pathname} -> ${r.status()} idempotencyKey=${key ? 'sent (len ' + key.length + ')' : 'MISSING'}`)
    try { const b = await r.json(); log('EXPIRE body ' + JSON.stringify({ outcome: b.outcome, status: b.sale?.status ?? b.status, cancelReason: b.sale?.cancelReason ?? b.cancelReason, canceledBy: (b.sale ?? b).canceledBy, hold: (b.sale ?? b).hold })) } catch {}
  } else log('EXPIRE POST none')
  const toast = page.getByText(/Apartado vencido:|el apartado se cerró|apartado/i).filter({ visible: true })
  await toast.first().waitFor({ timeout: 6000 }).catch(() => {})
  log('TOASTS ' + JSON.stringify(await page.locator('[data-sonner-toast],[role=status],li[role=alert],[data-state=open][role=alert]').allInnerTexts().catch(() => [])))
  log('TOAST CANCELLED=' + (await page.getByText('Apartado vencido: la venta se canceló.').first().isVisible().catch(() => false)) + ' REVIEW=' + (await page.getByText('Apartado vencido: la venta quedó para revisar.').first().isVisible().catch(() => false)))
  await shot(page, `12-after-expire-toast-${ID.slice(0, 8)}`, log)
  await settle(page, 1000)
  log('DIALOG still open ' + (await dlg.isVisible()))
  log('HEADER badges ' + JSON.stringify(await page.locator('[data-testid^="badge-"]').allInnerTexts()))
  log('HOLD-EXPIRED badge ' + JSON.stringify(await txt('badge-hold-expired')))
  await page.evaluate(() => window.scrollTo(0, 0)); await shot(page, `13-detail-header-after-${ID.slice(0, 8)}`, log)
  log('CANCEL CARD ' + JSON.stringify(await txt('sale-detail-cancellation')))
  log('EXPLANATION ' + JSON.stringify(await txt('sale-detail-cancel-explanation')))
  log('EXPIRED-AT ' + JSON.stringify(await txt('sale-detail-hold-expired-at')))
  await page.evaluate(() => window.scrollTo(0, 0)); log('BODY after ' + JSON.stringify((await page.locator('body').innerText()).replace(/\\s+/g, ' ').slice(150, 600)))
  log('HOLD CARD after ' + JSON.stringify(await txt('sale-detail-hold')))
  if (await page.getByTestId('sale-detail-cancellation').count()) await page.getByTestId('sale-detail-cancellation').scrollIntoViewIfNeeded()
  await shot(page, `14-detail-cards-after-${ID.slice(0, 8)}`, log)
}
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
