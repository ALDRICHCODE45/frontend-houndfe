// Step 1: sort select «Ordenar:» + «Más recientes» by default; an unmatched header sort -> «Orden personalizado».
import { makeLog, open, settle, shot, BASE } from './lib.mjs'
const log = makeLog('step1-sort')
const { browser, page, foreign } = await open(log)
page.setDefaultTimeout(10000)
await page.goto(`${BASE}/pos/ventas`, { waitUntil: 'domcontentloaded' })
await settle(page, 1200)
const sel = page.getByTestId('sales-sort-select')
log('LABEL ' + JSON.stringify(await page.getByTestId('sales-sort-label').innerText()))
log('SELECT default ' + JSON.stringify((await sel.innerText()).trim()))
log('URL ' + new URL(page.url()).search)
await shot(page, '01-list-sort-default-1440', log)
log('HEADERS ' + JSON.stringify((await page.locator('thead th').allInnerTexts()).map((h) => h.trim())))
// Only «Total» and «Fecha» render a SortableHeader (useSalesColumns + SalesListView slots); «Deuda» is
// enableSorting:true but has no header slot. Cycle each sortable header and log the select per click.
let n = 0
for (const [col, label] of [['totalCents', 'Total'], ['totalCents', 'Total'], ['totalCents', 'Total'], ['confirmedAt', 'Fecha'], ['confirmedAt', 'Fecha'], ['confirmedAt', 'Fecha']]) {
  const h = page.locator(`[data-hf-header][data-column-id="${col}"]`)
  const sortBtn = h.getByRole('button').first()
  const req = page.waitForRequest((r) => r.url().includes('/sales?'), { timeout: 4000 }).catch(() => null)
  await ((await sortBtn.count()) ? sortBtn : h).click()
  const r = await req
  await settle(page, 500)
  const q = r ? new URL(r.url()).searchParams : null
  log(`CLICK ${label} #${++n}: request sortBy=${q?.get('sortBy') ?? '(none)'} sortOrder=${q?.get('sortOrder') ?? '(none)'} header=${JSON.stringify(await h.getAttribute('aria-label'))} select=${JSON.stringify((await sel.innerText()).trim())}`)
  await shot(page, `02-sort-click-${n}-${label}`, log)
}
// Deuda header: does a click sort?
const debt = page.locator('[data-hf-header][data-column-id="debtCents"]')
const req2 = page.waitForRequest((r) => r.url().includes('/sales?'), { timeout: 3000 }).catch(() => null)
await debt.click(); const r2 = await req2; await page.keyboard.press('Escape')
log('CLICK Deuda: request ' + (r2 ? new URL(r2.url()).search : 'none (no sort)'))
log('FOREIGN ' + JSON.stringify([...foreign]))
await browser.close()
