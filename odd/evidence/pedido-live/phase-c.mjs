// Phase C (step 5 leftovers + step 6): converted quotation read-only checks, list row,
// then charge the converted draft in cash (exact) ONLY if an own open cash session is offered.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const [QID, SID] = process.argv.slice(2)
if (!QID || !SID) throw new Error('usage: node phase-c.mjs <quotationId> <saleId>')
const log = makeLog('phase-c')
const out = { quotationId: QID, saleId: SID }
const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, ' ').trim()
const { browser, page, foreign } = await open(log)
const cart = page.locator('.sales-pos-cart-pane')
try {
  log('== STEP 5 (leftovers)')
  await page.goto(`${BASE}/pos/cotizaciones/${QID}`)
  await settle(page, 1000)
  const notes = page.getByTestId('customer-notes-textarea')
  out.notesEditable = (await notes.count()) ? await notes.locator('textarea').or(notes).first().isEditable().catch(() => null) : null
  out.sendVisible = await page.getByRole('button', { name: /Enviar/ }).count()
  out.deleteVisible = await page.getByRole('button', { name: /Eliminar/ }).count()
  out.cancelVisible = await page.getByRole('button', { name: /Cancelar cotización/ }).count()
  log(`notes editable: ${out.notesEditable}; send buttons: ${out.sendVisible}; delete: ${out.deleteVisible}; cancel: ${out.cancelVisible}`)
  await page.goto(`${BASE}/pos/cotizaciones`)
  await settle(page, 1000)
  await page.getByRole('button', { name: 'Convertidas' }).or(page.getByRole('tab', { name: 'Convertidas' })).first().click()
  await settle(page, 1000)
  out.convertidasRows = await page.locator('tbody tr').count()
  log(`Convertidas rows: ${out.convertidasRows}`)
  const rowMenu = page.locator('tbody tr').first().getByRole('button').last()
  await rowMenu.click()
  await page.waitForTimeout(400)
  out.rowMenu = await txt(page.getByRole('menu')).catch(() => null)
  log(`row ⋮ menu: ${out.rowMenu}`)
  await shot(page, '15-quotations-convertidas-tab', log)
  await page.keyboard.press('Escape')

  log('== STEP 6')
  await page.goto(`${BASE}/pos/ventas/nueva`)
  await settle(page, 1500)
  await page.getByTestId(`tab-${SID}`).click()
  await settle(page, 1200)
  out.draftTotal = (await cart.getByTestId('total-amount').innerText()).trim()
  log(`draft total before charge: ${out.draftTotal}`)
  await cart.getByRole('button', { name: /Cobrar/ }).first().click()
  const modal = page.getByRole('dialog')
  await modal.waitFor()
  await settle(page, 1000)
  const sessionSel = modal.getByTestId('cash-session-select')
  out.sessionPickerPresent = (await sessionSel.count()) > 0
  out.sessionEmpty = await modal.getByTestId('cash-session-empty').isVisible().catch(() => false)
  log(`session picker: ${out.sessionPickerPresent}; empty notice: ${out.sessionEmpty}`)
  await shot(page, '16-checkout-modal', log)
  let sessionChosen = false
  if (out.sessionPickerPresent && !out.sessionEmpty) {
    await sessionSel.click()
    await page.waitForTimeout(500)
    const options = page.getByRole('option')
    out.sessionOptions = await options.allInnerTexts()
    log(`own open sessions offered: ${JSON.stringify(out.sessionOptions)}`)
    if (out.sessionOptions.length) {
      await options.first().click()
      sessionChosen = true
    } else {
      await page.keyboard.press('Escape')
    }
  }
  if (!sessionChosen) {
    out.charged = false
    out.skipReason = 'no own open cash session offered to the manager'
    log(`SKIP charge: ${out.skipReason}`)
    await modal.getByRole('button', { name: 'Cancelar' }).click().catch(() => {})
  } else {
    await modal.getByTestId('add-payment-entry').click()
    await page.waitForTimeout(500)
    out.cashAmount = await modal.getByTestId('payment-amount-0').locator('input').or(modal.getByTestId('payment-amount-0')).first().inputValue().catch(() => null)
    log(`cash amount prefilled: ${out.cashAmount}`)
    await shot(page, '17-checkout-cash-exact', log)
    const confirm = modal.getByTestId('confirm-charge')
    out.confirmLabel = (await confirm.innerText()).trim()
    out.confirmEnabled = await confirm.isEnabled()
    log(`confirm: «${out.confirmLabel}» enabled=${out.confirmEnabled}`)
    if (out.confirmEnabled) {
      await confirm.click()
      await settle(page, 2500)
      out.charged = true
      await shot(page, '18-charged', log)
      out.afterChargeDialog = await txt(page.getByRole('dialog')).catch(() => null)
      log(`after charge dialog: ${out.afterChargeDialog}`)
      await page.keyboard.press('Escape')
    } else {
      out.charged = false
      out.skipReason = 'confirm disabled'
    }
  }

  if (out.charged) {
    await page.goto(`${BASE}/pos/cotizaciones/${QID}`)
    await settle(page, 1200)
    out.bannerAfterCharge = await txt(page.getByTestId('converted-banner')).catch(() => null)
    log(`banner after charge: ${out.bannerAfterCharge}`)
    await page.getByTestId('converted-view-sale').click()
    await page.waitForURL((u) => /\/pos\/ventas\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 15000 }).catch(() => {})
    await settle(page, 1500)
    out.viewSaleAfterCharge = new URL(page.url()).pathname
    const fromQ = page.getByText('Desde cotización').first()
    out.fromQuotationVisible = await fromQ.isVisible().catch(() => false)
    if (out.fromQuotationVisible) await fromQ.scrollIntoViewIfNeeded()
    out.fromQuotationText = out.fromQuotationVisible ? (await fromQ.locator('xpath=..').innerText()).replace(/\s+/g, ' ') : null
    log(`«Ver venta» after charge → ${out.viewSaleAfterCharge}; «Desde cotización»: ${out.fromQuotationVisible} (${out.fromQuotationText})`)
    await shot(page, '19-sale-detail-desde-cotizacion', log)
    const link = page.getByRole('link', { name: 'Ver cotización' }).or(page.getByRole('button', { name: 'Ver cotización' })).first()
    if (await link.isVisible().catch(() => false)) {
      await link.click()
      await page.waitForURL((u) => u.pathname.includes('/pos/cotizaciones/'), { timeout: 15000 }).catch(() => {})
      out.verCotizacionLanded = new URL(page.url()).pathname
      log(`«Ver cotización» → ${out.verCotizacionLanded}`)
    }
  }
} catch (e) {
  log(`ERROR ${String(e).slice(0, 600)}`)
  await shot(page, 'phase-c-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  log(`foreign: ${out.foreign.join(', ') || 'none'}`)
  writeFileSync(join(HERE, 'phase-c.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
