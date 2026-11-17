// node run.mjs <width> [provided] [slow|err404|err500]
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const W = Number(process.argv[2] ?? 1440), provided = process.argv.includes('provided')
const saleMode = process.argv.find((a) => ['slow', 'err404', 'err500'].includes(a)) ?? 'ok'
const BASE = 'http://127.0.0.1:5198', API = 'http://127.0.0.1:3999'
const tag = `${W}${provided ? '-provided' : ''}${saleMode === 'ok' ? '' : '-' + saleMode}`
const shot = (page, n) => page.screenshot({ path: join(HERE, 'shots', `${tag}-${n}.png`) })
const jpeg = readFileSync(join(HERE, 'receipt.jpg'))
const USER = { id: 'e2e-user-0001', email: 'e2e@hound.test', name: 'Sesión E2E', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 'e2e-tenant-0001', name: 'Tienda E2E Centro', slug: 'e2e-centro' }
const PERMS = ['read:ChatbotRequest', 'update:ChatbotRequest', 'read:Sale', 'read:ReceiptEvidence', 'read:ChatbotConversation', 'read:CustomerPhone']
const row = {
  id: 'req-1', folio: 'S-000123', customerKey: 'k1.abc', kind: 'DECISION', subtype: 'TRANSFER_RECEIPT', status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS',
  summary: 'Comprobante de transferencia de la venta V-1042', assignee: { id: USER.id, displayName: USER.name }, createdAt: '2026-11-16T17:00:00.000Z',
  claimDeadlineAt: null, resolveDeadlineAt: '2026-11-16T20:00:00.000Z', overdueAt: null, slaPaused: false, slaResumesAt: null, whatsappWindowClosesAt: null,
  unreadCustomerMessages: 0, scheduledFor: null, scheduleVersion: 0, requiresTemplateAtStart: false, needsReschedule: false, liveSession: null,
  closedAt: null, resolvedBy: null, version: 3, cancelReason: null, staffCancelReason: null, mergedInto: null, slaLevel: 'OK',
  allowedActions: ['RESOLVE', 'RELEASE', 'CANCEL'], deniedActions: [],
}
const detail = {
  ...row, templateCostText: null, needs: 'El cliente mandó su comprobante de la venta V-1042.', context: { saleId: 'sale-1' },
  customer: { id: 'cus-1', displayName: 'Juan Pérez', phone: '+5233 **** 5678', customerSince: '2025-03-02T10:00:00.000Z', isTrusted: true, priceList: { id: 'pl-1', name: 'Mayoreo' }, ambiguous: false, candidates: [], recentOrders: [] },
  otherOpenRequests: [],
  decision: {
    subtype: 'TRANSFER_RECEIPT', receiptId: 'rec-1', saleId: 'sale-1', saleFolio: 'V-1042',
    declaredAmountCents: provided ? 184000 : 0, declaredAmountProvided: provided, declaredDate: '2026-11-11', declaredReference: '9988776',
    saleTotalCents: 184000, salePaidCents: 0, saleDebtCents: 184000,
    file: { mimeType: 'image/jpeg', sizeBytes: jpeg.length, previewStatus: 'READY', originalUrl: '/sales/sale-1/receipts/rec-1/file', previewUrl: '/sales/sale-1/receipts/rec-1/preview' },
    extracted: null, mismatch: null, resolution: null,
  },
  zoneImpact: null, deliveries: [], audit: [], auditNextCursor: null,
}
const sale = {
  id: 'sale-1', folio: 'V-1042', status: 'CONFIRMED', channel: 'CHATBOT', register: 'Caja 1', confirmedAt: '2026-11-09T17:00:00.000Z', dueDate: null,
  subtotalCents: 205000, discountCents: 21000, totalCents: 184000, paidCents: 0, debtCents: 184000, changeDueCents: 0, paymentStatus: 'PENDING', deliveryStatus: 'PENDING',
  customer: { id: 'cus-1', name: 'Juan Pérez' }, cashier: { id: 'u1', name: 'Caja' }, seller: null, payments: [], timeline: [],
  items: [
    { productName: 'Croquetas Premium Adulto 15 kg', variantName: 'Pollo y arroz', imageUrl: null, unitPriceCents: 78000, quantity: 2, discountCents: 0, subtotalCents: 156000 },
    { productName: 'Arena sanitaria aglomerante con aroma a lavanda para gatos 10 kg', variantName: null, imageUrl: null, unitPriceCents: 32000, quantity: 1, discountCents: 16000, subtotalCents: 16000 },
    { productName: 'Collar antipulgas', variantName: 'Talla M · Azul', imageUrl: null, unitPriceCents: 16000, quantity: 2, discountCents: 5000, subtotalCents: 27000 },
  ],
}
const log = { console: [], unmocked: [], blocked: [], failed: [] }
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: W < 500 ? 844 : 900 }, reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City' })
const page = await ctx.newPage()
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 300)}`) })
page.on('pageerror', (e) => log.console.push('pageerror: ' + e.message.slice(0, 300)))
await page.addInitScript(([u, t, p]) => {
  const s = localStorage; s.setItem('hound.auth.accessToken', 'e2e-access-token-0001'); s.setItem('hound.auth.refreshToken', 'e2e-refresh-token-0001')
  s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', JSON.stringify(p)); s.setItem('hound.auth.currentTenant', JSON.stringify(t))
  s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false')
}, [USER, TENANT, PERMS])
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-allow-credentials': 'true' }
const json = (route, body, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) })
await page.route(`${API}/**`, async (route) => {
  const req = route.request(), u = new URL(req.url()), path = u.pathname, m = req.method()
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (m !== 'GET') { log.blocked.push(`${m} ${path}`); return route.abort() }
  if (path === '/auth/me/permissions') return json(route, { permissionCodes: PERMS })
  if (path === '/auth/me') return json(route, { user: USER, ...USER })
  if (path === '/chatbot-requests/req-1') return json(route, detail)
  if (path === '/sales/sale-1/receipts/rec-1/preview') return route.fulfill({ status: 200, headers: cors, contentType: 'image/jpeg', body: jpeg })
  if (path === '/sales/sale-1') {
    if (saleMode === 'slow') await new Promise((r) => setTimeout(r, 6000))
    if (saleMode === 'err404') return json(route, { message: 'Not found' }, 404)
    if (saleMode === 'err500') return json(route, { message: 'boom' }, 500)
    return json(route, sale)
  }
  if (path.endsWith('/conversation')) return json(route, { items: [], hasMoreBefore: false })
  if (path === '/notifications/unread-count') return json(route, { count: 0 })
  log.unmocked.push(`${m} ${path}`)
  return json(route, path.endsWith('s') || path.includes('list') ? { items: [] } : {}, 200)
})
await page.route(/\/events|\/stream|text\/event-stream/, (r) => r.fallback())
await page.goto(`${BASE}/chatbot/solicitudes/req-1`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('[data-testid=receipt-preview]', { timeout: 30000 })
await page.waitForSelector('[data-testid=receipt-zoom]', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(800)
const res = []
const pass = (n, ok, extra = '') => { res.push(`${ok ? 'PASS' : 'FAIL'} ${n} ${extra}`) }
const panel = page.getByTestId('request-decision')
await panel.scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
await shot(page, '01-card'); await panel.screenshot({ path: join(HERE, 'shots', `${tag}-01-card-crop.png`) })
pass('zoom button visible', await page.getByTestId('receipt-zoom').isVisible())
pass('Ver venta visible', await page.getByTestId('receipt-sale-open').isVisible())
pass('doc no h-overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1))
// zoom
await page.getByTestId('receipt-zoom').click(); await page.waitForTimeout(700)
let dlg = page.getByRole('dialog')
pass('zoom dialog title', (await dlg.innerText()).includes('Comprobante ampliado'))
const img = page.getByTestId('receipt-zoom-image'); const box = await img.boundingBox(); const vp = page.viewportSize()
pass('zoom image fits viewport', !!box && box.height <= vp.height * 0.8 + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1, JSON.stringify(box && { w: Math.round(box.width), h: Math.round(box.height), x: Math.round(box.x) }))
pass('zoom image loaded', await img.evaluate((i) => i.complete && i.naturalWidth > 0))
await shot(page, '02-zoom')
await page.keyboard.press('Escape'); await page.waitForTimeout(600)
pass('Esc closes zoom', (await page.getByRole('dialog').count()) === 0)
await page.getByTestId('receipt-zoom').click(); await page.waitForTimeout(500)
const closeBtn = page.getByRole('dialog').getByRole('button', { name: /cerrar|close/i }).first()
pass('close button exists', (await closeBtn.count()) > 0)
await closeBtn.click().catch(() => {}); await page.waitForTimeout(600)
pass('close button closes zoom', (await page.getByRole('dialog').count()) === 0)
// sale modal
await page.getByTestId('receipt-sale-open').click()
if (saleMode === 'slow') { await page.waitForTimeout(700); await shot(page, '03-sale-loading') ; await page.waitForTimeout(6000) }
await page.waitForTimeout(900)
dlg = page.getByRole('dialog'); const txt = (await dlg.innerText()).replace(/\n+/g, ' | ')
console.log('SALE MODAL TEXT:', txt)
await shot(page, saleMode === 'ok' ? '03-sale' : '03-sale-state')
if (saleMode === 'ok') {
  pass('sale title', txt.includes('Venta V-1042'))
  pass('lines + variant', txt.includes('Croquetas Premium') && txt.includes('Pollo y arroz') && txt.includes('Talla M'))
  pass('totals', /Subtotal/i.test(txt) && /Total/.test(txt) && txt.includes('1,840.00'))
  const db = await dlg.boundingBox(); pass('sale modal within viewport', db.x >= 0 && db.x + db.width <= vp.width + 1 && db.y >= 0 && db.y + db.height <= vp.height + 1, JSON.stringify({ x: db.x, y: db.y, w: db.width, h: db.height }))
  pass('sale modal no h-scroll', await dlg.evaluate((d) => [...d.querySelectorAll('*')].every((e) => e.scrollWidth <= e.clientWidth + 1 || getComputedStyle(e).overflowX !== 'visible') ))
  // scroll the modal to bottom for totals
  await dlg.evaluate((d) => { const s = [...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (s) s.scrollTop = s.scrollHeight }); await page.waitForTimeout(300)
  await shot(page, '04-sale-scrolled')
}
await page.keyboard.press('Escape'); await page.waitForTimeout(600)
pass('Esc closes sale modal', (await page.getByRole('dialog').count()) === 0)
// resolver
if (saleMode === 'ok') {
  const rb = page.getByTestId(W < 500 ? 'bar-primary' : 'action-RESOLVE')
  await rb.click(); await page.waitForTimeout(900)
  await shot(page, '05a-resolver-open'); console.log('DIALOGS', await page.getByRole('dialog').count(), (await page.locator('body').innerText()).slice(-300).replace(/\n+/g,' | '))
  await page.getByText('Confirmar comprobante', { exact: false }).first().click(); await page.waitForTimeout(500)
  const help = await page.getByRole('dialog').innerText()
  const want = provided ? 'El cliente dijo que transfirió $1,840.00.' : 'El cliente no indicó monto. Escribe lo que recibiste en la cuenta.'
  pass(`copy exact (${provided ? 'provided' : 'not provided'})`, help.includes(want), `want «${want}» | contains declaró: ${help.includes('declaró')}`)
  console.log('RESOLVER TEXT:', help.replace(/\n+/g, ' | ').slice(0, 600))
  await shot(page, '05-resolver')
}
console.log(res.join('\n'))
console.log('unmocked:', JSON.stringify([...new Set(log.unmocked)]), '| blocked non-GET:', JSON.stringify(log.blocked))
console.log('CONSOLE:', JSON.stringify(log.console, null, 1))
await browser.close()
