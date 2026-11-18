// Phase A (steps 1–2): promotion check in Promociones, POS sale with the promoted
// product, «Pasar a cotización» with a note, land on the quotation.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const PRODUCT = "Croqueta Hill's Science Diet Gato Adulto 1.8 kg"
const PROMO = "10% en croquetas Hill's"
const NOTE = 'Live check T5: precios válidos 7 días'
const log = makeLog('phase-a')
const out = {}
const { browser, page, foreign } = await open(log)
try {
  // Step 1 — Promociones
  log('== STEP 1')
  await page.goto(`${BASE}/pos/promociones`)
  await settle(page)
  const promoRow = page.getByText(PROMO).first()
  await promoRow.scrollIntoViewIfNeeded()
  out.promoVisible = await promoRow.isVisible()
  await shot(page, '01-promociones-list', log)
  log(`promotion «${PROMO}» visible in list: ${out.promoVisible}`)

  // Step 2 — POS
  log('== STEP 2')
  await page.goto(`${BASE}/pos/ventas/nueva`)
  await settle(page, 1200)
  await page.getByTestId('create-tab').click()
  await settle(page, 1200)
  await page.getByRole('searchbox', { name: 'Buscar producto' }).or(page.getByLabel('Buscar producto')).first().fill('Hill\'s Science Diet Gato')
  await settle(page, 1200)
  const card = page.locator('.sales-pos-product-card').filter({ hasText: PRODUCT }).first()
  await card.getByRole('button', { name: /Agregar/ }).click()
  await settle(page, 1500)
  const cart = page.locator('.sales-pos-cart-pane')
  out.posTotal = (await cart.getByTestId('total-amount').innerText()).trim()
  out.cartText = (await cart.getByTestId('cart-body').innerText()).replace(/\s+/g, ' ').slice(0, 600)
  out.footerText = (await cart.getByTestId('cart-footer').innerText()).replace(/\s+/g, ' ').slice(0, 600)
  log(`POS total: ${out.posTotal}`)
  log(`cart: ${out.cartText}`)
  log(`footer: ${out.footerText}`)
  await shot(page, '02-pos-cart-with-promo', log)

  await cart.getByTestId('sale-to-quotation-trigger').click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForTimeout(500)
  out.dialogCopy = (await dialog.innerText()).replace(/\s+/g, ' ')
  log(`dialog: ${out.dialogCopy}`)
  await shot(page, '03-sale-to-quotation-dialog', log)
  await dialog.locator('textarea').fill(NOTE)
  await shot(page, '04-sale-to-quotation-dialog-note', log)
  await dialog.getByTestId('sale-to-quotation-submit').click()
  // Either a summary (dropped adjustments) or navigation to the quotation.
  const summary = page.getByTestId('sale-to-quotation-summary')
  await Promise.race([
    summary.waitFor({ timeout: 20000 }),
    page.waitForURL(/\/pos\/cotizaciones\/[0-9a-f-]{36}/, { timeout: 20000 }),
  ])
  if (await summary.isVisible().catch(() => false)) {
    out.dropped = await page.getByTestId('sale-to-quotation-dropped-item').allInnerTexts()
    out.summaryCopy = (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ')
    log(`summary: ${out.summaryCopy}`)
    await shot(page, '05-sale-to-quotation-dropped-summary', log)
    await page.getByTestId('sale-to-quotation-open').click()
    await page.waitForURL(/\/pos\/cotizaciones\/[0-9a-f-]{36}/, { timeout: 20000 })
  } else {
    out.dropped = []
    log('no dropped-adjustments summary; navigated directly')
  }
  await settle(page, 1200)
  out.quotationId = new URL(page.url()).pathname.split('/').pop()
  log(`quotation id: ${out.quotationId}`)
  out.quotationStatus = (await page.getByTestId('status-badge').first().innerText()).trim()
  out.quotationItems = (await page.getByTestId('items-section').innerText()).replace(/\s+/g, ' ').slice(0, 800)
  out.quotationSidebar = (await page.getByTestId('quotation-detail-sidebar').innerText()).replace(/\s+/g, ' ').slice(0, 1200)
  log(`quotation status: ${out.quotationStatus}`)
  log(`quotation items: ${out.quotationItems}`)
  log(`quotation sidebar: ${out.quotationSidebar}`)
  await shot(page, '06-quotation-from-sale', log)
  await page.getByTestId('quotation-detail-sidebar').screenshot({ path: join(HERE, 'shots', '06b-quotation-totals.png') })
} catch (e) {
  log(`ERROR ${String(e).slice(0, 500)}`)
  await shot(page, 'phase-a-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  log(`foreign: ${out.foreign.join(', ') || 'none'}`)
  writeFileSync(join(HERE, 'phase-a.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
