// Step 4d (optional): manager charges 000078's remaining $94.50 by debit card without a till.
import { makeLog, open, settle, shot, BASE, logBodies } from './lib.mjs'
const log = makeLog('step4d-card-78')
const ID = 'c146d74e-06bc-486d-8fbf-8f3a06a0e6ae'
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
logBodies(page, log)
await page.goto(`${BASE}/pos/ventas/${ID}`, { waitUntil: 'domcontentloaded' })
await settle(page, 1000)
await page.getByRole('button', { name: 'Registrar pago' }).first().click()
await page.getByTestId('payment-method-tile-card_debit').click()
await settle(page, 500)
log('cash section count (expect 0) ' + (await page.getByTestId('debt-cash-session').count()))
// The card entry starts at $0.00 (cash starts at the full debt), so type the amount.
const amt = page.getByTestId('payment-amount-0')
const amtInput = (await amt.evaluate((e) => e.tagName)) === 'INPUT' ? amt : amt.locator('input')
await amtInput.fill('94.50'); await amtInput.blur()
await page.getByTestId('payment-reference-0').locator('input').fill('LIVE-T4').catch(async () => page.getByTestId('payment-reference-0').fill('LIVE-T4'))
log('confirm enabled ' + (await page.getByTestId('confirm-debt-payment').isEnabled()))
await shot(page, '19-card-78', log)
const resp = page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(`/sales/${ID}/payments`), { timeout: 15000 }).catch(() => null)
await page.getByTestId('confirm-debt-payment').click()
const r = await resp
log('POST payments ' + (r ? r.status() : 'none'))
if (r) { try { const b = await r.json(); log('RESULT ' + JSON.stringify({ paidCents: b.paidCents, debtCents: b.debtCents, paymentStatus: b.paymentStatus })) } catch {} }
await settle(page, 1200)
await shot(page, '20-sale-78-paid', log)
await page.goto(`${BASE}/pos/ventas`, { waitUntil: 'domcontentloaded' })
await settle(page, 1200)
const rows = await page.$$eval('tbody tr', (trs) => trs.slice(0, 3).map((r) => ({
  folio: r.querySelector('[data-testid^="sale-link-"]')?.textContent?.trim(),
  hold: r.querySelector('[data-testid="sale-hold-line"]')?.textContent?.trim() ?? null,
  status: r.querySelector('[data-testid="sale-payment-status"],[data-testid="sale-canceled-status"]')?.textContent?.trim() ?? null,
})))
log('LIST after ' + JSON.stringify(rows))
await shot(page, '21-list-after', log)
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
