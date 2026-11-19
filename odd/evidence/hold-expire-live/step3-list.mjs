// Step 3: list rows #79 (cancelled by expiry) and #80 (expired -> review) at 1440 light.
import { makeLog, open, settle, shot, BASE } from './lib.mjs'
const log = makeLog('step3-list')
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
await page.goto(`${BASE}/pos/ventas`, { waitUntil: 'domcontentloaded' })
await settle(page, 1500)
const rows = await page.$$eval('tbody tr', (trs) => trs.slice(0, 6).map((r) => ({
  folio: r.querySelector('[data-testid^="sale-link-"]')?.textContent?.trim() ?? '',
  pago: r.children[2]?.textContent?.replace(/\s+/g, ' ').trim(),
  hold: r.querySelector('[data-testid="sale-hold-line"]')?.textContent?.trim() ?? null,
  canceled: r.querySelector('[data-testid="sale-canceled-status"]')?.textContent?.trim() ?? null,
  note: r.querySelector('.sale-cancel-note')?.textContent?.trim() ?? null,
  noteAria: r.querySelector('.sale-cancel-note')?.getAttribute('aria-label') ?? null,
})))
for (const r of rows) log('ROW ' + JSON.stringify(r))
await shot(page, '20-list-after-1440', log)
// The default list omits CANCELED (backend default); filter «Estado: Cancelada» through the URL.
const req = page.waitForRequest((r) => /\/sales\?/.test(r.url()) && r.url().includes('status='), { timeout: 8000 }).catch(() => null)
await page.goto(`${BASE}/pos/ventas?status=CANCELED`, { waitUntil: 'domcontentloaded' })
const rq = await req
log('FILTER request ' + (rq ? [...new URL(rq.url()).searchParams.entries()].map(([k, v]) => k + '=' + v).join('&') : 'none'))
await settle(page, 1500)
const rows2 = await page.$$eval('tbody tr', (trs) => trs.slice(0, 4).map((r) => ({
  folio: r.querySelector('[data-testid^="sale-link-"]')?.textContent?.trim() ?? '',
  canceled: r.querySelector('[data-testid="sale-canceled-status"]')?.textContent?.trim() ?? null,
  note: r.querySelector('.sale-cancel-note')?.textContent?.trim() ?? null,
  noteAria: r.querySelector('.sale-cancel-note')?.getAttribute('aria-label') ?? null,
})))
for (const r of rows2) log('CANCELED ROW ' + JSON.stringify(r))
await shot(page, '21-list-canceled-1440', log)
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
