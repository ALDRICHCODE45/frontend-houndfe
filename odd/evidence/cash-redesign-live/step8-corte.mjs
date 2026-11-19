import { open, settle, shot, makeLog, BASE, SHOTS } from './lib.mjs'
import { join } from 'node:path'
import { statSync, readFileSync } from 'node:fs'
const SID = 'd74d78fe-df73-4e91-a359-6e1a36090ba5'
const log = makeLog('step8-corte')
const { browser, page, issues } = await open(log, { role: 'manager' })
page.setDefaultTimeout(8000)
const line = async (tid, root = page) => (await root.getByTestId(tid).first().innerText().catch(() => 'NONE')).replace(/\s+/g, ' ')
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.locator('input[data-testid="cash-sessions-status-CLOSED"]').check({ force: true }); await settle(page, 800)
await page.locator(`[data-testid="cash-session-open-${SID}"]:visible`).first().click(); await settle(page, 1500)
log('head: ' + (await page.locator('.cash-head-meta').innerText()).replace(/\s+/g, ' ') + ' / ' + await line('cash-head-title'))
log('next: ' + await line('cash-next-action'))
log('states: ' + (await page.locator('[data-testid^="cash-step-state-"]').allInnerTexts()).join(' | '))
if (!(await page.getByTestId('cash-closing-detail').isVisible().catch(() => false))) { await page.getByTestId('cash-step-toggle-corte').first().click().catch((e) => log('corte toggle ' + e.message.slice(0, 60))); await settle(page, 1500) }
const det = page.getByTestId('cash-closing-detail').first()
log('corte header: ' + await line('cash-closing-header'))
log('corte facts: ' + await line('cash-closing-facts'))
log('corte totals: ' + await line('cash-closing-totals'))
log('corte channels: ' + (await page.getByTestId('cash-closing-channel').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ')).join(' || '))
log('corte handovers: ' + (await page.getByTestId('cash-closing-handover').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ')).join(' || '))
log('corte notes: ' + await line('cash-closing-notes'))
await det.scrollIntoViewIfNeeded().catch(() => {})
await shot(page, '25-manager-corte-1440-light', log)
await shot(page, '25b-manager-corte-full-1440-light', log, true)
const popupP = page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null)
await page.getByTestId('cash-closing-pdf-view').first().click()
const popup = await popupP
log('pdf view popup url scheme: ' + (popup ? popup.url().split(':')[0] : 'none') + ' err=' + await line('cash-closing-pdf-error'))
if (popup) { await popup.waitForTimeout(1500); await popup.screenshot({ path: join(SHOTS, '26-pdf-view-popup.png') }).catch((e) => log('popup shot ' + e.message.slice(0, 60))); await popup.close() }
const dl = page.waitForEvent('download', { timeout: 10000 }).catch(() => null)
await page.getByTestId('cash-closing-pdf-download').first().click()
const d = await dl
if (d) { const p = join(SHOTS, '..', d.suggestedFilename()); await d.saveAs(p); log(`download: ${d.suggestedFilename()} bytes=${statSync(p).size} magic=${readFileSync(p).subarray(0, 5).toString()}`) } else log('download: none, err=' + await line('cash-closing-pdf-error'))
// Cortes list
await page.getByRole('button', { name: /Cortes/ }).first().click(); await settle(page, 1500)
const list = page.getByTestId('cash-closings-list')
log('cortes list visible=' + await list.isVisible() + ' rows=' + await page.getByTestId('cash-closing-row').count())
log('rows: ' + (await page.getByTestId('cash-closing-row').allInnerTexts()).slice(0, 6).map((s) => s.replace(/\s+/g, ' ')).join(' || '))
await shot(page, '27-manager-cortes-list-1440-light', log)
// filters
for (const [tid, kind] of [['cash-closings-register', 'select'], ['cash-closings-cashier', 'select']]) {
  const el = page.getByTestId(tid)
  log(`${tid}: tag=${await el.evaluate((e) => e.tagName).catch(() => '?')}`)
}
const reg = page.getByTestId('cash-closings-register')
await reg.click().catch(() => {}); await page.waitForTimeout(400)
const opt = page.getByRole('option', { name: /Caja QA rediseño T6/ })
if (await opt.isVisible().catch(() => false)) { await opt.click(); await settle(page, 1200) } else log('register option not found')
log('after register filter rows=' + await page.getByTestId('cash-closing-row').count() + ' : ' + (await page.getByTestId('cash-closing-row').allInnerTexts()).map((s) => s.replace(/\s+/g, ' ')).join(' || '))
await shot(page, '28-manager-cortes-filter-register-1440-light', log)
const cas = page.getByTestId('cash-closings-cashier')
await cas.click().catch(() => {}); await page.waitForTimeout(400)
log('cashier options: ' + (await page.getByRole('option').allInnerTexts()).join(' | '))
const copt = page.getByRole('option', { name: /Cajero Centro/ })
if (await copt.isVisible().catch(() => false)) { await copt.click(); await settle(page, 1200) } else { await page.keyboard.press('Escape'); log('cashier option not found') }
log('after cashier filter rows=' + await page.getByTestId('cash-closing-row').count())
await page.getByTestId('cash-closings-from').fill('2026-11-18').catch((e) => log('from fill ' + e.message.slice(0, 60))); await settle(page, 1000)
log('after from filter rows=' + await page.getByTestId('cash-closing-row').count())
await shot(page, '29-manager-cortes-filters-all-1440-light', log)
await page.getByTestId('cash-closing-row-open').first().click(); await settle(page, 1500)
log('row opened detail header: ' + await line('cash-closing-header'))
await shot(page, '30-manager-cortes-row-detail-1440-light', log)
log('ISSUES ' + JSON.stringify(issues))
await browser.close()
