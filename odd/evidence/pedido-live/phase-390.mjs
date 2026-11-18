// 390 pass (no mutations): «Pasar a cotización» dialog opened on an existing draft and
// cancelled; converted quotation detail.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, HERE, makeLog, open, settle, shot } from './lib.mjs'

const [QID, SID] = process.argv.slice(2)
const log = makeLog('phase-390')
const out = {}
const { browser, page, foreign } = await open(log, { width: 390, height: 844 })
try {
  await page.goto(`${BASE}/pos/ventas/nueva`)
  await settle(page, 1500)
  await page.getByTestId(`tab-${SID}`).click()
  await settle(page, 1000)
  // The dev-only Vue DevTools pill sits over the FAB centre; click its «Ver carrito» end.
  const fab = page.getByTestId('mobile-cart-fab')
  const fb = await fab.boundingBox()
  await fab.click({ position: { x: fb.width - 40, y: fb.height / 2 } })
  await page.waitForTimeout(800)
  await shot(page, '20-390-pos-cart-sheet', log)
  const drawer = page.getByTestId('mobile-cart-drawer').or(page.getByRole('dialog')).first()
  await drawer.getByTestId('sale-to-quotation-trigger').click()
  await page.waitForTimeout(800)
  const dlg = page.getByRole('dialog').filter({ hasText: '¿Pasar esta venta a cotización?' })
  await dlg.waitFor()
  out.dialog = (await dlg.innerText()).replace(/\s+/g, ' ')
  log(`390 dialog: ${out.dialog}`)
  await shot(page, '21-390-sale-to-quotation-dialog', log)
  const box = await dlg.getByTestId('sale-to-quotation-submit').boundingBox()
  out.submitBox = box
  log(`submit box: ${JSON.stringify(box)}`)
  await dlg.getByTestId('sale-to-quotation-cancel').click()
  await page.waitForTimeout(500)
  out.overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

  await page.goto(`${BASE}/pos/cotizaciones/${QID}`)
  await settle(page, 1500)
  await shot(page, '22-390-quotation-converted-top', log)
  await page.getByTestId('converted-banner').scrollIntoViewIfNeeded()
  await shot(page, '23-390-quotation-converted-banner', log)
  await page.screenshot({ path: join(HERE, 'shots', '24-390-quotation-converted-full.png'), fullPage: true })
  out.quotationOverflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  out.mobileActionBar = await page.getByTestId('mobile-action-bar').isVisible().catch(() => false)
  log(`overflowX pos=${out.overflowX} quotation=${out.quotationOverflowX}; mobile action bar visible: ${out.mobileActionBar}`)
} catch (e) {
  log(`ERROR ${String(e).slice(0, 600)}`)
  await shot(page, 'phase-390-error', log)
  process.exitCode = 1
} finally {
  out.foreign = [...foreign]
  log(`foreign: ${out.foreign.join(', ') || 'none'}`)
  writeFileSync(join(HERE, 'phase-390.json'), JSON.stringify(out, null, 2))
  await browser.close()
}
