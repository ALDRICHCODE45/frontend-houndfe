// Phase B (steps 3–5) in ONE browser context (suppressedPromotions live in localStorage):
// convert the quotation, check the exact total + suppressed rows, «Aplicar», then the
// converted quotation (banner, «Ver venta», read-only actions, PDF, «Convertidas» tab).
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const QID = process.argv[2]
if (!QID) throw new Error('usage: node phase-b.mjs <quotationId>')
const log = makeLog('phase-b')
const out = { quotationId: QID }
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const { browser, page, foreign } = await open(log)
const cart = page.locator('.sales-pos-cart-pane')
try {
  log('== STEP 3')
  await page.goto(`${BASE}/pos/cotizaciones/${QID}`)
  await settle(page, 1000)
  out.statusBefore = await txt(page.getByTestId('status-badge').first())
  out.headerButtonsBefore = await page.getByTestId('detail-header-actions').innerText()
  log(`status before: ${out.statusBefore}; header: ${out.headerButtonsBefore.replace(/\s+/g, ' ')}`)
  const headerConvert = page.getByTestId('convert-to-sale-button')
  if (await headerConvert.isVisible().catch(() => false)) {
    log('convert via header primary')
    await headerConvert.click()
  } else {
    await page.getByRole('button', { name: 'Más acciones de la cotización' }).click()
    await page.waitForTimeout(400)
    out.menuBefore = await txt(page.getByRole('menu'))
    log(`⋮ menu (before): ${out.menuBefore}`)
    await shot(page, '07-quotation-menu-before', log)
    await page.getByRole('menuitem', { name: /Convertir en venta/ }).click()
  }
  const dialog = page.getByRole('dialog')
  await dialog.waitFor()
  await page.waitForTimeout(400)
  out.convertDialog = await txt(dialog)
  log(`convert dialog: ${out.convertDialog}`)
  await shot(page, '08-convert-dialog', log)
  await dialog.getByTestId('convert-dialog-confirm').click()
  await page.waitForURL((u) => u.pathname.startsWith('/pos/ventas'), { timeout: 20000 })
  await settle(page, 2000)
  log(`landed ${new URL(page.url()).pathname}`)
  out.convertedTotal = (await cart.getByTestId('total-amount').innerText()).trim()
  out.convertedCart = await txt(cart.getByTestId('cart-body'))
  out.convertedFooter = await txt(cart.getByTestId('cart-footer'))
  log(`converted total: ${out.convertedTotal}`)
  log(`converted cart: ${out.convertedCart}`)
  log(`converted footer: ${out.convertedFooter}`)
  const acc = cart.getByTestId('promociones-disponibles-accordion')
  out.accordionVisible = await acc.isVisible().catch(() => false)
  if (out.accordionVisible) {
    await acc.scrollIntoViewIfNeeded()
    const trigger = acc.getByRole('button', { name: /Promociones disponibles/ })
    out.accordionExpandedOnLoad = (await trigger.getAttribute('aria-expanded')) === 'true'
    log(`accordion expanded on load: ${out.accordionExpandedOnLoad}`)
    await shot(page, '09-pos-converted-exact-total', log)
    if (!out.accordionExpandedOnLoad) {
      await trigger.click()
      await page.waitForTimeout(500)
    }
    out.accordion = await txt(acc)
    log(`promociones disponibles: ${out.accordion}`)
  }
  out.suppressedNotes = await cart.locator('[data-testid^="promo-suppressed-note-"]').evaluateAll((els) => els.map((e) => ({ id: e.dataset.testid.replace('promo-suppressed-note-', ''), title: e.parentElement?.querySelector('[data-testid^="promo-title-"]')?.textContent?.trim(), note: e.textContent.trim() })))
  log(`suppressed rows: ${JSON.stringify(out.suppressedNotes)}`)
  await shot(page, '09b-pos-converted-suppressed-row', log)

  log('== STEP 4')
  // Prefer the line-level promotion targeted at the product; fall back to the first suppressed row.
  const target = out.suppressedNotes.find((s) => /Hill/.test(s.title ?? '')) ?? out.suppressedNotes[0]
  if (!target) throw new Error('no suppressed promotion row to apply')
  out.appliedPromotion = target
  await cart.getByTestId(`promo-apply-${target.id}`).click()
  await settle(page, 2000)
  out.afterApplyTotal = (await cart.getByTestId('total-amount').innerText()).trim()
  out.afterApplyCart = await txt(cart.getByTestId('cart-body'))
  out.afterApplyFooter = await txt(cart.getByTestId('cart-footer'))
  out.suppressedAfterApply = await cart.locator('[data-testid^="promo-suppressed-note-"]').evaluateAll((els) => els.map((e) => e.dataset.testid))
  out.targetRowStillThere = await cart.getByTestId(`promo-row-${target.id}`).count()
  log(`after apply total: ${out.afterApplyTotal}`)
  log(`after apply cart: ${out.afterApplyCart}`)
  log(`after apply footer: ${out.afterApplyFooter}`)
  log(`suppressed notes left: ${JSON.stringify(out.suppressedAfterApply)}; applied row count: ${out.targetRowStillThere}`)
  await shot(page, '10-pos-after-apply', log)

  // Optional: apply remaining suppressed rows? No — keep one change per the spec.

  log('== STEP 5')
  await page.goto(`${BASE}/pos/cotizaciones/${QID}`)
  await settle(page, 1200)
  out.statusAfter = await txt(page.getByTestId('status-badge').first())
  out.banner = await txt(page.getByTestId('converted-banner')).catch(() => null)
  out.headerAfter = await txt(page.getByTestId('detail-header-actions'))
  out.pdfVisible = await page.getByTestId('preview-pdf-button').isVisible().catch(() => false)
  out.sidebarAfter = await txt(page.getByTestId('quotation-detail-sidebar')).catch(() => null)
  out.addProductVisible = await page.getByTestId('add-product-button').isVisible().catch(() => false)
  out.notesTextareaVisible = await page.getByTestId('customer-notes-textarea').isVisible().catch(() => false)
  log(`status after: ${out.statusAfter}; banner: ${out.banner}; header: ${out.headerAfter}; pdf: ${out.pdfVisible}; addProduct: ${out.addProductVisible}; notesTextarea: ${out.notesTextareaVisible}`)
  log(`sidebar after: ${out.sidebarAfter}`)
  await shot(page, '11-quotation-converted', log)
  const more = page.getByRole('button', { name: 'Más acciones de la cotización' })
  if (await more.isVisible().catch(() => false)) {
    await more.click()
    await page.waitForTimeout(400)
    out.menuAfter = await txt(page.getByRole('menu')).catch(() => null)
    log(`⋮ menu (after): ${out.menuAfter}`)
    await shot(page, '12-quotation-converted-menu', log)
    await page.keyboard.press('Escape')
  } else {
    out.menuAfter = '(no ⋮ menu)'
    log('⋮ menu hidden after conversion')
  }
  // PDF still available
  if (out.pdfVisible) {
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/quotations\/.+\/pdf/.test(r.url()), { timeout: 15000 }).catch(() => null),
      page.getByTestId('preview-pdf-button').click(),
    ])
    out.pdfStatus = resp?.status() ?? null
    await page.waitForTimeout(800)
    log(`PDF response: ${out.pdfStatus}`)
    await shot(page, '13-quotation-converted-pdf', log)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }
  // «Ver venta» → draft in the POS
  await page.getByTestId('converted-view-sale').click()
  await page.waitForURL((u) => u.pathname.startsWith('/pos/ventas'), { timeout: 15000 }).catch(() => {})
  await settle(page, 1500)
  out.viewSaleLanded = new URL(page.url()).pathname
  out.viewSaleTotal = await cart.getByTestId('total-amount').innerText().catch(() => null)
  log(`«Ver venta» landed ${out.viewSaleLanded}, total ${out.viewSaleTotal}`)
  await shot(page, '14-view-sale-opens-draft', log)
  // «Convertidas» tab
  await page.goto(`${BASE}/pos/cotizaciones`)
  await settle(page, 1000)
  await page.getByRole('tab', { name: /Convertidas/ }).or(page.getByRole('button', { name: /Convertidas/ })).first().click()
  await settle(page, 1000)
  out.convertidasHasIt = await page.getByText(/Live check T5|Cotización sin cliente/).first().isVisible().catch(() => false)
  out.convertidasText = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 900)
  log(`Convertidas: ${out.convertidasText}`)
  await shot(page, '15-quotations-convertidas-tab', log)
} catch (e) {
  log(`ERROR ${String(e).slice(0, 600)}`)
  await shot(page, 'phase-b-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  log(`foreign: ${out.foreign.join(', ') || 'none'}`)
  writeFileSync(join(HERE, 'phase-b.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
