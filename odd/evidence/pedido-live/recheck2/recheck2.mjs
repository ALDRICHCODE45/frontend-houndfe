// Re-check 2 (D6 + qty>1 fixes): ONE new sale → quotation → sale, in one browser context.
// No tab clicks after the conversion. A guard refuses any mutation unless the active tab is the new draft.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const PRODUCT = "Croqueta Hill's Science Diet Gato Adulto 1.8 kg"
const log = makeLog('recheck2')
const out = {}
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const { browser, page, foreign } = await open(log)
const cart = page.locator('.sales-pos-cart-pane')
const total = async () => (await cart.getByTestId('total-amount').innerText()).trim()
const footer = async () => txt(cart.getByTestId('cart-footer'))
const activeTab = async () => {
  const tid = await page.locator('[data-testid^="tab-"][data-sales-pos-state="active"]').first().getAttribute('data-testid').catch(() => null)
  return tid ? tid.replace(/^tab-/, '') : null
}
const guard = async () => {
  const id = await activeTab()
  if (id !== out.newSaleId) throw new Error(`guard: active tab ${id} is not the converted draft; refusing to mutate`)
}
try {
  log('== 1 POS sale')
  await page.goto(`${BASE}/pos/ventas/nueva`)
  await settle(page, 1200)
  const [created] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/sales/drafts'),
    page.getByTestId('create-tab').click(),
  ])
  out.saleDraftId = (await created.json()).id
  await settle(page, 1200)
  await page.getByLabel('Buscar producto').first().fill("Hill's Science Diet Gato")
  await settle(page, 1200)
  await page.locator('.sales-pos-product-card').filter({ hasText: PRODUCT }).first().getByRole('button', { name: /Agregar/ }).click()
  await settle(page, 1500)
  out.posTotal = await total()
  log(`sale draft ${out.saleDraftId}: ${out.posTotal} | ${await footer()}`)
  await shot(page, 's01-pos-sale', log)

  log('== 2 sale → quotation')
  await cart.getByTestId('sale-to-quotation-trigger').click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor()
  await dlg.locator('textarea').fill('Re-check 2 T5')
  await dlg.getByTestId('sale-to-quotation-submit').click()
  const summary = page.getByTestId('sale-to-quotation-summary')
  await Promise.race([
    summary.waitFor({ timeout: 20000 }),
    page.waitForURL(/\/pos\/cotizaciones\/[0-9a-f-]{36}/, { timeout: 20000 }),
  ])
  if (await summary.isVisible().catch(() => false)) {
    out.dropped = await page.getByTestId('sale-to-quotation-dropped-item').allInnerTexts()
    log(`dropped: ${JSON.stringify(out.dropped)}`)
    await page.getByTestId('sale-to-quotation-open').click()
    await page.waitForURL(/\/pos\/cotizaciones\/[0-9a-f-]{36}/, { timeout: 20000 })
  }
  await settle(page, 1200)
  out.quotationId = new URL(page.url()).pathname.split('/').pop()
  out.quotationSidebar = await txt(page.getByTestId('quotation-detail-sidebar'))
  log(`quotation ${out.quotationId}: ${out.quotationSidebar}`)
  await shot(page, 's02-quotation', log)

  log('== 3 quotation → sale (no tab clicks)')
  await page.getByRole('button', { name: 'Más acciones de la cotización' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('menuitem', { name: /Convertir en venta/ }).click()
  const cd = page.getByRole('dialog')
  await cd.waitFor()
  const [convResp] = await Promise.all([
    page.waitForResponse((r) => /\/convert-to-sale$/.test(new URL(r.url()).pathname), { timeout: 20000 }),
    cd.getByTestId('convert-dialog-confirm').click(),
  ])
  out.newSaleId = (await convResp.json())?.sale?.id ?? null
  await page.waitForURL((u) => u.pathname.startsWith('/pos/ventas'), { timeout: 20000 })
  await settle(page, 2500)
  out.activeTabAfterConvert = await activeTab()
  out.storedTabAfterConvert = await page.evaluate(() => localStorage.getItem('pos:active-tab'))
  out.openedNewDraft = out.activeTabAfterConvert === out.newSaleId
  out.convertedTotal = await total()
  log(`converted sale ${out.newSaleId}; active tab ${out.activeTabAfterConvert}; pos:active-tab ${out.storedTabAfterConvert}; opened new draft: ${out.openedNewDraft}; total ${out.convertedTotal} | ${await footer()}`)
  const acc = cart.getByTestId('promociones-disponibles-accordion')
  out.accordionOpen = (await acc.getByRole('button', { name: /Promociones disponibles/ }).getAttribute('aria-expanded').catch(() => null)) === 'true'
  out.suppressed = await cart.locator('[data-testid^="promo-suppressed-note-"]').evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => ({ id: e.dataset.testid.replace('promo-suppressed-note-', ''), title: e.parentElement?.querySelector('[data-testid^="promo-title-"]')?.textContent?.trim(), note: e.textContent.trim() })))
  log(`accordion open: ${out.accordionOpen}; suppressed: ${JSON.stringify(out.suppressed)}`)
  await shot(page, 's03-converted-draft', log)
  if (!out.openedNewDraft) throw new Error('POS did not open the converted draft directly (D6); stopping before any mutation')

  log('== 4 Aplicar Buen Fin')
  await guard()
  const bf = out.suppressed.find((s) => /Buen Fin/.test(s.title ?? ''))
  if (!bf) throw new Error('Buen Fin suppressed row not visible')
  await cart.getByTestId(`promo-apply-${bf.id}`).click()
  await settle(page, 2000)
  out.afterApply = { total: await total(), footer: await footer(), suppressedLeft: await cart.locator('[data-testid^="promo-suppressed-note-"]').count() }
  log(`after apply: ${JSON.stringify(out.afterApply)}`)
  await shot(page, 's04-after-apply', log)

  log('== 5 quantities')
  const qty = cart.getByTestId('sale-item-qty-row').first().locator('input')
  for (const q of ['2', '3', '1']) {
    await guard()
    await qty.fill(q)
    await qty.press('Enter')
    await qty.blur()
    await settle(page, 2000)
    out[`qty${q}`] = { total: await total(), footer: await footer() }
    log(`qty ${q}: ${JSON.stringify(out[`qty${q}`])}`)
    await shot(page, `s05-qty-${q}`, log)
  }

  log('== 6 «Ver venta» from the quotation')
  await page.goto(`${BASE}/pos/cotizaciones/${out.quotationId}`)
  await settle(page, 1200)
  out.quotationStatus = await txt(page.getByTestId('status-badge').first())
  out.banner = await txt(page.getByTestId('converted-banner')).catch(() => null)
  log(`quotation status ${out.quotationStatus}; banner ${out.banner}`)
  await shot(page, 's06-quotation-converted', log)
  await page.getByTestId('converted-view-sale').click()
  await page.waitForURL((u) => u.pathname.startsWith('/pos/ventas'), { timeout: 15000 })
  await settle(page, 2500)
  out.viewSale = { path: new URL(page.url()).pathname, activeTab: await activeTab(), total: await total() }
  out.viewSale.opensSameDraft = out.viewSale.activeTab === out.newSaleId
  log(`«Ver venta»: ${JSON.stringify(out.viewSale)}`)
  await shot(page, 's07-view-sale', log)
} catch (e) {
  log(`ERROR ${String(e).slice(0, 600)}`)
  await shot(page, 'recheck2-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  log(`foreign: ${out.foreign.join(', ') || 'none'}`)
  writeFileSync(join(HERE, 'recheck2.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
