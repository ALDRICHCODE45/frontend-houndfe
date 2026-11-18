// Re-check after D1–D5 fixes, one browser context (suppressedPromotions live in localStorage).
// Creates ONE new sale → quotation → sale; never touches earlier test drafts/quotations.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const PRODUCT = "Croqueta Hill's Science Diet Gato Adulto 1.8 kg"
const log = makeLog('recheck')
const out = {}
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const { browser, page, foreign } = await open(log)
const cart = page.locator('.sales-pos-cart-pane')
// The draft the POS is SHOWING = the last draft whose applicable-promotions it fetched
// (localStorage pos:active-tab can disagree with the screen, see attempt2).
let shownDraft = null
page.on('request', (req) => {
  const m = new URL(req.url()).pathname.match(/^\/sales\/drafts\/([0-9a-f-]{36})\/applicable-promotions$/)
  if (m) shownDraft = m[1]
})
const total = async () => (await cart.getByTestId('total-amount').innerText()).trim()
const footer = async () => txt(cart.getByTestId('cart-footer'))
try {
  log('== A: POS sale')
  await page.goto(`${BASE}/pos/ventas/nueva`)
  await settle(page, 1200)
  await page.getByTestId('create-tab').click()
  await settle(page, 1200)
  await page.getByLabel('Buscar producto').first().fill("Hill's Science Diet Gato")
  await settle(page, 1200)
  await page.locator('.sales-pos-product-card').filter({ hasText: PRODUCT }).first().getByRole('button', { name: /Agregar/ }).click()
  await settle(page, 1500)
  out.posTotal = await total()
  log(`POS total: ${out.posTotal} | ${await footer()}`)
  await shot(page, 'r01-pos-sale', log)

  log('== B: sale → quotation')
  await cart.getByTestId('sale-to-quotation-trigger').click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor()
  await page.waitForTimeout(400)
  out.dialogText = await txt(dlg)
  out.dialogDescribedBy = await dlg.evaluate((d) => {
    const ids = (d.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    return ids.map((id) => document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? null)
  })
  out.consequenceCount = (out.dialogText.match(/La venta en curso se descarta/g) ?? []).length
  log(`dialog: ${out.dialogText}`)
  log(`aria-describedby text: ${JSON.stringify(out.dialogDescribedBy)}; «La venta en curso se descarta» occurrences in innerText: ${out.consequenceCount}`)
  await shot(page, 'r02-sale-to-quotation-dialog', log)
  await dlg.locator('textarea').fill('Re-check T5')
  await dlg.getByTestId('sale-to-quotation-submit').click()
  const summary = page.getByTestId('sale-to-quotation-summary')
  await Promise.race([
    summary.waitFor({ timeout: 20000 }),
    page.waitForURL(/\/pos\/cotizaciones\/[0-9a-f-]{36}/, { timeout: 20000 }),
  ])
  if (await summary.isVisible().catch(() => false)) {
    out.dropped = await page.getByTestId('sale-to-quotation-dropped-item').allInnerTexts()
    log(`dropped: ${JSON.stringify(out.dropped)}`)
    await shot(page, 'r03-dropped-summary', log)
    await page.getByTestId('sale-to-quotation-open').click()
    await page.waitForURL(/\/pos\/cotizaciones\/[0-9a-f-]{36}/, { timeout: 20000 })
  }
  await settle(page, 1200)
  out.quotationId = new URL(page.url()).pathname.split('/').pop()
  out.quotationSidebar = await txt(page.getByTestId('quotation-detail-sidebar'))
  log(`quotation ${out.quotationId}: ${out.quotationSidebar}`)
  await shot(page, 'r04-quotation', log)

  log('== C: quotation → sale')
  await page.getByRole('button', { name: 'Más acciones de la cotización' }).click()
  await page.waitForTimeout(400)
  await page.getByRole('menuitem', { name: /Convertir en venta/ }).click()
  const cd = page.getByRole('dialog')
  await cd.waitFor()
  out.convertDialog = await txt(cd)
  log(`convert dialog: ${out.convertDialog}`)
  const [convResp] = await Promise.all([
    page.waitForResponse((r) => /\/convert-to-sale$/.test(new URL(r.url()).pathname), { timeout: 20000 }),
    cd.getByTestId('convert-dialog-confirm').click(),
  ])
  out.newSaleId = (await convResp.json())?.sale?.id ?? null
  log(`convert-to-sale response sale.id: ${out.newSaleId}`)
  await page.waitForURL((u) => u.pathname.startsWith('/pos/ventas'), { timeout: 20000 })
  await settle(page, 2000)
  // Which draft did the POS open? The active tab id is persisted in pos:active-tab.
  out.activeTabAfterConvert = await page.evaluate(() => localStorage.getItem('pos:active-tab'))
  out.shownDraftAfterConvert = shownDraft
  out.openedRightDraft = shownDraft === out.newSaleId
  log(`after convert: pos:active-tab=${out.activeTabAfterConvert}, draft shown=${shownDraft} (right draft: ${out.openedRightDraft}); shown total ${await total()}`)
  await shot(page, 'r05a-pos-after-convert-landing', log)
  if (!out.openedRightDraft) {
    log('DEFECT: POS opened another draft; selecting the converted draft tab manually')
    await page.getByTestId(`tab-${out.newSaleId}`).click()
    await settle(page, 1500)
  }
  out.shownDraftForChecks = shownDraft
  log(`draft shown for the checks: ${shownDraft}`)
  out.convertedTotal = await total()
  out.convertedCart = await txt(cart.getByTestId('cart-body'))
  log(`converted total: ${out.convertedTotal} | ${await footer()}`)
  log(`converted cart: ${out.convertedCart}`)
  const acc = cart.getByTestId('promociones-disponibles-accordion')
  await acc.scrollIntoViewIfNeeded()
  out.accordionExpandedOnLoad = (await acc.getByRole('button', { name: /Promociones disponibles/ }).getAttribute('aria-expanded')) === 'true'
  out.suppressed = await cart.locator('[data-testid^="promo-suppressed-note-"]').evaluateAll((els) => els.filter((e) => e.offsetParent !== null).map((e) => ({ id: e.dataset.testid.replace('promo-suppressed-note-', ''), title: e.parentElement?.querySelector('[data-testid^="promo-title-"]')?.textContent?.trim(), note: e.textContent.trim() })))
  log(`accordion expanded on load (no click): ${out.accordionExpandedOnLoad}; visible suppressed rows: ${JSON.stringify(out.suppressed)}`)
  await shot(page, 'r05-converted-draft-accordion-open', log)

  const guard = async () => {
    const id = shownDraft
    if (id !== out.newSaleId) throw new Error(`guard: active draft ${id} is not the new draft; refusing to mutate`)
  }
  log('== D: Aplicar')
  await guard()
  const buenFin = out.suppressed.find((s) => /Buen Fin/.test(s.title ?? ''))
  if (!buenFin) throw new Error('Buen Fin suppressed row not visible')
  await cart.getByTestId(`promo-apply-${buenFin.id}`).click()
  await settle(page, 2000)
  out.afterApplyTotal = await total()
  out.suppressedAfter = await cart.locator('[data-testid^="promo-suppressed-note-"]').count()
  log(`after apply total: ${out.afterApplyTotal} | ${await footer()}; suppressed notes left: ${out.suppressedAfter}`)
  log(`after apply cart: ${await txt(cart.getByTestId('cart-body'))}`)
  await shot(page, 'r06-after-apply', log)

  log('== E: quantity 2 then 1')
  const qtyInput = cart.getByTestId('sale-item-qty-row').first().locator('input')
  for (const q of ['2', '1']) {
    await guard()
    await qtyInput.fill(q)
    await qtyInput.press('Enter')
    await qtyInput.blur()
    await settle(page, 2000)
    out[`qty${q}Total`] = await total()
    out[`qty${q}Cart`] = await txt(cart.getByTestId('cart-body'))
    log(`qty ${q}: total ${out[`qty${q}Total`]} | ${await footer()}`)
    log(`qty ${q} cart: ${out[`qty${q}Cart`]}`)
    await shot(page, `r07-qty-${q}`, log)
  }

  log('== F: list badge')
  await page.goto(`${BASE}/pos/cotizaciones`)
  await settle(page, 1000)
  await page.getByRole('button', { name: 'Convertidas' }).or(page.getByRole('tab', { name: 'Convertidas' })).first().click()
  await settle(page, 1000)
  out.badges = await page.locator('tbody tr').first().evaluate((tr) => [...tr.querySelectorAll('*')].filter((e) => /Convertida/.test(e.textContent) && e.children.length === 0).map((e) => ({ text: e.textContent.trim(), clipped: e.scrollWidth > e.clientWidth + 1 })))
  log(`first row badge: ${JSON.stringify(out.badges)}`)
  await shot(page, 'r08-list-convertidas-badge', log)
} catch (e) {
  log(`ERROR ${String(e).slice(0, 600)}`)
  await shot(page, 'recheck-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  log(`foreign: ${out.foreign.join(', ') || 'none'}`)
  writeFileSync(join(HERE, 'recheck.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
