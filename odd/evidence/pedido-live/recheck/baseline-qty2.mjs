// Baseline: a FRESH (non-converted) sale with the same product at qty 2, then qty 1;
// closes (discards) ONLY the draft it created. Compares with the converted draft.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const PRODUCT = "Croqueta Hill's Science Diet Gato Adulto 1.8 kg"
const log = makeLog('baseline-qty2')
const out = {}
const { browser, page, foreign } = await open(log)
const cart = page.locator('.sales-pos-cart-pane')
const footer = async () => (await cart.getByTestId('cart-footer').innerText()).replace(/\s+/g, ' ')
try {
  await page.goto(`${BASE}/pos/ventas/nueva`)
  await settle(page, 1200)
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/sales/drafts'),
    page.getByTestId('create-tab').click(),
  ])
  out.saleId = (await created.json()).id
  log(`baseline draft: ${out.saleId}`)
  await settle(page, 1200)
  await page.getByLabel('Buscar producto').first().fill("Hill's Science Diet Gato")
  await settle(page, 1200)
  await page.locator('.sales-pos-product-card').filter({ hasText: PRODUCT }).first().getByRole('button', { name: /Agregar/ }).click()
  await settle(page, 1500)
  log(`qty 1: ${await footer()}`)
  const qty = cart.getByTestId('sale-item-qty-row').first().locator('input')
  await qty.fill('2')
  await qty.press('Enter')
  await qty.blur()
  await settle(page, 2000)
  out.qty2 = await footer()
  log(`qty 2: ${out.qty2}`)
  await shot(page, 'b01-fresh-sale-qty-2', log)
  await page.getByTestId(`close-tab-${out.saleId}`).click()
  await settle(page, 1500)
  out.closed = (await page.getByTestId(`tab-${out.saleId}`).count()) === 0
  log(`baseline draft closed: ${out.closed}`)
} catch (e) {
  log(`ERROR ${String(e).slice(0, 500)}`)
  await shot(page, 'baseline-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  writeFileSync(join(HERE, 'baseline-qty2.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
