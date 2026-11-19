// Keyboard focus visibility: timeline toggles, opening form (cashier, masked no-shift read), Cortes filters (manager).
import { chromium } from '@playwright/test'
import { open, settle, shot, makeLog, BASE } from './lib.mjs'
const log = makeLog('step11-keyboard')
const browser = await chromium.launch({ headless: true })
const focusInfo = (page) => page.evaluate(() => {
  const e = document.activeElement; if (!e) return null
  const cs = getComputedStyle(e)
  return { tid: e.getAttribute('data-testid') || e.closest('[data-testid]')?.getAttribute('data-testid'), tag: e.tagName, type: e.type || '', role: e.getAttribute('role') || '', label: (e.getAttribute('aria-label') || e.innerText || e.value || '').replace(/\s+/g, ' ').slice(0, 40), outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, shadow: cs.boxShadow.slice(0, 60), fv: e.matches(':focus-visible') }
})
async function tabTo(page, pred, max, tag) {
  for (let i = 0; i < max; i++) { await page.keyboard.press('Tab'); const f = await focusInfo(page); if (f && pred(f)) { log(`${tag} after ${i + 1} tabs: ${JSON.stringify(f)}`); return f } }
  log(`${tag}: not reached in ${max} tabs`); return null
}
// cashier, no-shift (masked read) -> opening form
let s = await open(log, { role: 'cashier', browser }); let page = s.page
await page.route(/\/cash-sessions\?/, async (route) => {
  const u = new URL(route.request().url())
  if (u.searchParams.get('drawerOpen') === 'true' && u.searchParams.get('limit') === '1') { const res = await route.fetch(); const body = await res.json(); return route.fulfill({ response: res, json: { ...body, items: [], total: 0 } }) }
  return route.continue()
})
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.getByTestId('cash-own-shift-open').click(); await settle(page, 500)
await page.getByTestId('cash-step-toggle-apertura').first().focus()
log('apertura toggle focus: ' + JSON.stringify(await focusInfo(page)))
await shot(page, '59-focus-apertura-toggle-1440-light', log)
await tabTo(page, (f) => f.role === 'radio' || f.type === 'radio', 10, 'cashier register radio')
await shot(page, '60-focus-register-radio-1440-light', log)
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown')
await page.waitForTimeout(200); log('after 6x ArrowDown: ' + JSON.stringify(await focusInfo(page)))
await page.keyboard.press('Space'); await settle(page, 400)
await page.getByLabel('Fondo inicial (pesos)').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
log('amount focus: ' + JSON.stringify(await focusInfo(page)))
await shot(page, '61-focus-amount-1440-light', log)
await tabTo(page, (f) => /cash-opening-confirmed/.test(f.tid || ''), 10, 'confirm button')
await shot(page, '62-focus-confirm-1440-light', log)
await s.ctx.close()
// cashier real shift: timeline toggles
s = await open(log, { role: 'cashier', browser }); page = s.page
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.getByTestId('cash-own-shift-select').focus().catch(() => {})
await tabTo(page, (f) => /cash-step-toggle-/.test(f.tid || '') || /cash-step-/.test(f.tid || ''), 60, 'timeline toggle')
await shot(page, '63-focus-timeline-1440-light', log)
await page.keyboard.press('Tab'); log('next: ' + JSON.stringify(await focusInfo(page)))
await page.keyboard.press('Enter'); await settle(page, 500); log('after Enter focus: ' + JSON.stringify(await focusInfo(page)))
await shot(page, '64-focus-timeline-enter-1440-light', log)
await s.ctx.close()
// manager dark: Cortes filters
s = await open(log, { role: 'manager', browser, theme: 'dark' }); page = s.page
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.getByRole('button', { name: /Cortes/ }).first().click(); await settle(page, 1200)
await page.getByTestId('cash-closings-list').focus().catch(() => {})
await page.locator('#cash-cortes-title').focus().catch(() => {})
await tabTo(page, (f) => /cash-closings-register|cash-closings-cashier/.test(f.tid || ''), 15, 'cortes filter')
await shot(page, '65-focus-cortes-filter-1440-dark', log)
await tabTo(page, (f) => /cash-closing-row/.test(f.tid || ''), 15, 'cortes row')
await shot(page, '66-focus-cortes-row-1440-dark', log)
// manager 390: what does the «Abrir caja» bar do?
await s.ctx.close()
s = await open(log, { role: 'manager', browser, width: 390, height: 844 }); page = s.page
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await page.getByTestId('cash-workspace-bar').getByRole('button').first().click(); await settle(page, 600)
log('manager bar click -> ' + (await page.locator('[data-testid="cash-opening-forbidden"]').isVisible().catch(() => false) ? 'opening-forbidden callout' : 'other') + ' focus=' + JSON.stringify(await focusInfo(page)))
await shot(page, '67-manager-abrir-caja-bar-no-permission-390-light', log)
await s.ctx.close()
await browser.close()
