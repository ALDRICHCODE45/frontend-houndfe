#!/usr/bin/env node
// O1 T10 runtime check: the "Inventario" task against the real backend (README §7 data).
// Playwright (@playwright/test chromium), one page at a time. Logs in through the real
// login form as manager@houndfe.com (Sucursal Centro) and cashier@houndfe.com; the dev
// passwords are read from the backend seed at runtime and are never printed or written.
// This run DOES write: it creates adjustments (the dev DB is disposable by human decision).
// Output: shots/ (git-ignored) and report.json.
//
//   node odd/evidence/inventory-journal-o1/verify.mjs [--shots-only] [--no-shots]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth')
const REPORT = join(HERE, 'report.json')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3000'
const SEED = process.env.CAPTURE_SEED ?? join(HERE, '../../../../houndfe-backend/prisma/seed.ts')
const TENANT = 'Sucursal Centro'
const THEME_KEY = 'vueuse-color-scheme'
const argv = process.argv.slice(2)
const NO_SHOTS = argv.includes('--no-shots')

// README §7 (ids are stable; quantities are read at runtime, not assumed).
const P = {
  croquetas: 'c89a04e8-c39f-430b-b570-e8556a2993d2',
  desparasitante: '35971296-03f3-4e3b-b4fd-a85f3a1cbcd0',
  collar: '511634d0-5b59-4dfc-86f2-a43c3a59baf7',
  placa: 'e3e603c0-a84f-4bf8-8591-4b1ccc1c01e3',
}
const USERS = {
  manager: { email: 'manager@houndfe.com', seedKey: 'manager' },
  cashier: { email: 'cashier@houndfe.com', seedKey: 'cashier' },
}

mkdirSync(SHOTS, { recursive: true })
mkdirSync(AUTH, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (text) => Number(String(text).replace(/[^\d-−]/g, '').replace('−', '-'))
const pathOf = (url) => {
  try { const u = new URL(url); return u.pathname + u.search } catch { return url }
}

function devPassword(who) {
  const key = USERS[who].seedKey
  const m = readFileSync(SEED, 'utf8').match(new RegExp(`${key}:\\s*\\{[^}]*?password:\\s*'([^']+)'`, 's'))
  if (!m) throw new Error(`${who} dev password not found in the seed`)
  return m[1]
}

// ── Results ──────────────────────────────────────────────────────────────────
const checks = []
const notes = []
function check(id, name, pass, evidence) {
  checks.push({ id, name, result: pass ? 'PASS' : 'FAIL', evidence })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}  ${name}`)
  if (!pass) console.log('      ', JSON.stringify(evidence).slice(0, 600))
}

// ── Browser ──────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const newContext = (who, extra = {}) =>
  browser.newContext({
    viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'es-MX',
    storageState: existsSync(join(AUTH, `state-${who}.json`)) ? join(AUTH, `state-${who}.json`) : undefined, ...extra,
  })

async function loginViaUi(who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'es-MX' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', USERS[who].email)
  await page.fill('#password', devPassword(who))
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(page.url()) === '/select-tenant') {
    await page.getByText(TENANT, { exact: false }).first().click()
    await page.getByRole('button', { name: /continuar/i }).click()
    await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  const landed = pathOf(page.url())
  await ctx.storageState({ path: join(AUTH, `state-${who}.json`) })
  await ctx.close()
  return landed
}

// A fresh login per run: the session must be valid for this run's token and tenant.
const landed = {}
for (const who of Object.keys(USERS)) landed[who] = await loginViaUi(who)
notes.push({ landed })

// ── Page helpers ─────────────────────────────────────────────────────────────
function instrument(page, log) {
  page.on('request', (req) => {
    if (!req.url().startsWith(API)) return
    const p = pathOf(req.url())
    page.__lastAuth = req.headers().authorization ?? page.__lastAuth
    if (/^\/inventory\//.test(p) || (req.method() === 'PATCH' && /^\/products\//.test(p))) {
      let body = null
      try { body = req.postDataJSON() } catch { /* no body */ }
      const headers = req.headers()
      log.push({
        method: req.method(), path: p, body,
        hasIdempotencyKey: Boolean(headers['idempotency-key']), authorization: Boolean(headers.authorization),
      })
    }
  })
  page.on('response', async (res) => {
    const req = res.request()
    if (!req.url().startsWith(API)) return
    const p = pathOf(req.url())
    if (!(/^\/inventory\//.test(p) || (req.method() === 'PATCH' && /^\/products\//.test(p)))) return
    const entry = [...log].reverse().find((e) => e.method === req.method() && e.path === p && e.status === undefined)
    if (!entry) return
    entry.status = res.status()
    if (res.status() >= 400) entry.error = await res.json().then((b) => b?.error ?? null).catch(() => null)
  })
}

async function setTheme(page, theme) {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [THEME_KEY, theme])
}

async function openProduct(page, id) {
  await page.goto(`${BASE}/pos/products/${id}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[name="name"], [data-testid="not-found"], .product-task-navigation', { timeout: 30000 })
  await page.waitForSelector('.product-task-navigation', { timeout: 30000 })
}

async function openInventory(page) {
  await page.click('[data-task="inventory"]')
  await page.waitForSelector('[data-testid="stock-panel"]')
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="stock-panel"]')
    return el && !el.querySelector('[data-testid="stock-skeleton"]')
  }, null, { timeout: 30000 })
  await page.waitForSelector('[data-testid="stock-panel"] .kardex tbody tr, [data-testid="stock-panel"] [data-testid="kardex-card"], [data-testid="stock-state"]', { timeout: 30000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await sleep(300)
}

const stockRows = (page) => page.$$eval('[data-testid="stock-panel"] [data-testid="stock-row"]', (rows) =>
  rows.map((r) => ({
    label: r.querySelector('[data-testid="stock-label"]')?.textContent?.trim() ?? '',
    qty: r.querySelector('[data-testid="stock-quantity"]')?.textContent?.trim() ?? '',
    badge: /Vencido/.test(r.textContent ?? ''), canAdjust: Boolean(r.querySelector('[data-testid="stock-adjust"]')),
    text: (r.textContent ?? '').replace(/\s+/g, ' ').trim(),
  })))
const qtyOf = async (page, label) => num((await stockRows(page)).find((r) => r.label === label)?.qty)
const kardexRows = (page, limit = 8) => page.$$eval('[data-testid="stock-panel"] .kardex tbody tr', (rows, n) =>
  rows.slice(0, n).map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()), limit)
const totals = async (page) => ({
  total: num(await page.textContent('[data-testid="stock-total"]').catch(() => 'NaN')),
  sellable: await page.textContent('[data-testid="stock-sellable"]').then(num).catch(() => null),
})

async function clickAdjust(page, label) {
  const row = page.locator('[data-testid="stock-panel"] [data-testid="stock-row"]').filter({
    has: page.locator('[data-testid="stock-label"]', { hasText: new RegExp(`^${label}$`) }),
  })
  await row.locator('[data-testid="stock-adjust"]').click()
  await page.waitForSelector('[role="dialog"] [data-testid="adjustment-summary"]')
}
const dialog = (page) => page.locator('[role="dialog"]')
async function chooseMode(page, label) { await dialog(page).getByText(label, { exact: true }).first().click() }
async function chooseReason(page, label) {
  await dialog(page).locator('button[role="combobox"], [name="reason"]').first().click()
  await page.getByRole('option', { name: label, exact: true }).click()
}
async function closeDialog(page) {
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 }).catch(() => {})
}
const waitIdle = (page) => page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})

// ── Manager checks ───────────────────────────────────────────────────────────
const mgrCtx = await newContext('manager')
const log = []
const page = await mgrCtx.newPage()
instrument(page, log)
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 300)}`))

// C1 Croquetas: stock panel (untracked, lots, expired badge).
await openProduct(page, P.croquetas)
const tasks = await page.$$eval('.product-task-button', (b) => b.map((x) => x.textContent?.trim()))
check('T6-visible-manager', 'manager sees the fifth task "Inventario" on a saved product',
  tasks.length === 5 && tasks[4] === 'Inventario', { tasks })
await openInventory(page)
const rows0 = await stockRows(page)
const t0 = await totals(page)
const sinLote = rows0.find((r) => r.label === 'Sin lote')
const expired = rows0.find((r) => /L-2026-08/.test(r.label))
check('croquetas-stock', 'Croquetas stock panel: untracked units, 3 lots, expired lot with "Vencido"',
  Boolean(sinLote) && rows0.filter((r) => /^Lote /.test(r.label)).length === 3 && expired?.badge === true &&
  rows0.filter((r) => r.badge).length === 1,
  { rows: rows0.map((r) => ({ label: r.label, qty: r.qty, vencido: r.badge })), totals: t0 })
check('croquetas-sellable', 'Croquetas: sellable excludes the expired lot (total - expired)',
  t0.sellable === t0.total - num(expired?.qty ?? '0'), t0)

// C2 Kardex: INITIAL rows on Croquetas; OPENING rows with "Sistema" on an older product.
// "Cargar más" (cursor paging) until the oldest rows are in.
let pages = 1
while (await page.locator('[data-testid="kardex-load-more"]').count() && pages < 20) {
  await page.locator('[data-testid="kardex-load-more"]').click()
  await waitIdle(page); await sleep(400)
  pages += 1
}
const k0 = await kardexRows(page, 400)
check('croquetas-kardex-initial', 'Croquetas kardex starts with INITIAL rows ("Inicial")',
  k0.some((r) => /Inicial/.test(r)), { pagesLoaded: pages, rows: k0.length, oldestRows: k0.slice(-4) })

// Find an older product (OPENING movements) through the real API, with the page's own token.
const token = page.__lastAuth
let openingProduct = null
if (token) {
  const headers = { authorization: token }
  const listRes = await mgrCtx.request.get(`${API}/products?limit=100`, { headers })
  const list = await listRes.json().catch(() => ({}))
  const items = Array.isArray(list) ? list : list.items ?? list.data ?? []
  for (const prod of items) {
    if ([P.croquetas, P.collar, P.placa].includes(prod.id) || prod.useStock === false) continue
    const mv = await (await mgrCtx.request.get(`${API}/inventory/movements?productId=${prod.id}&limit=100`, { headers })).json().catch(() => null)
    if (mv?.items?.some((m) => m.type === 'OPENING')) { openingProduct = { id: prod.id, name: prod.name }; break }
  }
}
// Observation (not a check): what the product record says next to what the journal says.
if (token) {
  const seen = {}
  for (const [name, id] of Object.entries(P)) {
    const rec = await (await mgrCtx.request.get(`${API}/products/${id}`, { headers: { authorization: token } })).json().catch(() => ({}))
    const st = await (await mgrCtx.request.get(`${API}/inventory/products/${id}/stock`, { headers: { authorization: token } })).json().catch(() => ({}))
    seen[name] = { productStatus: rec.status, productQuantity: rec.quantity, useStock: rec.useStock, useLots: rec.useLotsAndExpirations, journalTotal: st.product?.quantity ?? null, journalSellable: st.product?.sellable ?? null }
  }
  notes.push({ productRecordVsJournal: seen })
}
if (openingProduct) {
  await openProduct(page, openingProduct.id)
  await openInventory(page)
  const ok = await kardexRows(page, 100)
  const opening = ok.filter((r) => /Apertura/.test(r))
  check('opening-sistema', 'OPENING kardex rows show "Apertura" with "Sistema" as the actor',
    opening.length > 0 && opening.every((r) => /Sistema/.test(r)), { product: openingProduct.name, rows: opening.slice(0, 3) })
} else {
  check('opening-sistema', 'OPENING kardex rows show "Apertura" with "Sistema" as the actor', false, { reason: 'no product with OPENING rows found', hadToken: Boolean(token) })
}

// C2b The saved total (fix a886791 BE, d67d2ef9 FE): Croquetas has lots plus an untracked portion, and the
// product record, the detail header and summary, the list and the Inventario panel must all say the journal total.
const croqRecord = token ? await (await mgrCtx.request.get(`${API}/products/${P.croquetas}`, { headers: { authorization: token } })).json().catch(() => ({})) : {}
const croqJournal = token ? await (await mgrCtx.request.get(`${API}/inventory/products/${P.croquetas}/stock`, { headers: { authorization: token } })).json().catch(() => ({})) : {}
const journalTotal = croqJournal.product?.quantity ?? null
check('croquetas-record-total', 'API: GET /products/:id quantity equals the /inventory total for Croquetas',
  journalTotal !== null && croqRecord.quantity === journalTotal, { recordQuantity: croqRecord.quantity, recordStatus: croqRecord.status, journalTotal })

// Detail: no "Sin stock" badge in the header, and the summary stock is the journal total.
await openProduct(page, P.croquetas)
await page.waitForSelector('.product-header-meta [data-tone]', { timeout: 15000 }).catch(() => {})
await page.waitForSelector('[data-summary="stock"]', { timeout: 15000 }).catch(() => {})
await waitIdle(page); await sleep(500)
const detail = await page.evaluate(() => ({
  headerBadges: [...document.querySelectorAll('.product-header-meta [data-tone]')].map((b) => ({ label: b.textContent.trim(), tone: b.dataset.tone })),
  summaryStock: document.querySelector('[data-summary="stock"]')?.textContent?.trim() ?? null,
}))
check('croquetas-detail-no-sin-stock', 'Croquetas detail: the header shows no "Sin stock" badge',
  detail.headerBadges.length > 0 && !detail.headerBadges.some((b) => /Sin stock/i.test(b.label)), detail)
check('croquetas-detail-summary-total', 'Croquetas detail: the summary stock equals the /inventory total',
  journalTotal !== null && num(detail.summaryStock) === journalTotal, { summaryStock: detail.summaryStock, journalTotal })

// List: the stock column reads the total and the badge tone follows the stock rule (0 danger, <= min warning, healthy plain text).
await page.goto(`${BASE}/pos/products`, { waitUntil: 'domcontentloaded' })
const search = page.getByPlaceholder('Buscar productos...').first()
await search.waitFor({ timeout: 30000 })
await search.fill(croqRecord.name ?? 'Croquetas')
await waitIdle(page); await sleep(800)
const list = await page.evaluate((name) => {
  const heads = [...document.querySelectorAll('table thead th')].map((th) => th.textContent.trim())
  const col = heads.findIndex((h) => /^Stock/.test(h))
  const rows = [...document.querySelectorAll('table tbody tr')].filter((tr) => tr.textContent.includes(name))
  const cell = rows[0]?.children[col]
  const badge = cell?.querySelector('[data-tone]')
  return { heads, col, matchingRows: rows.length, cellText: cell?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    badgeTone: badge?.dataset.tone ?? null, rowBadges: [...(rows[0]?.querySelectorAll('[data-tone]') ?? [])].map((b) => ({ label: b.textContent.trim(), tone: b.dataset.tone })) }
}, croqRecord.name ?? 'Croquetas')
const expectedTone = journalTotal === null ? null : journalTotal === 0 ? 'danger' : journalTotal <= (croqRecord.minQuantity ?? 10) ? 'warning' : null
check('croquetas-list-stock', 'Croquetas list: the stock reads the /inventory total',
  journalTotal !== null && list.matchingRows === 1 && num(list.cellText) === journalTotal, { cellText: list.cellText, journalTotal, matchingRows: list.matchingRows, col: list.col })
check('croquetas-list-tone', 'Croquetas list: the stock badge tone is correct for the total (healthy stock reads as plain text; the status badge is not "Sin stock")',
  list.badgeTone === expectedTone || (expectedTone === null && !list.rowBadges.some((b) => /Sin stock/i.test(b.label)) && list.badgeTone === null),
  { total: journalTotal, minQuantity: croqRecord.minQuantity, expectedTone, stockCellBadgeTone: list.badgeTone, rowBadges: list.rowBadges })

// Inventario panel: the same total, and the rows add up to it.
await openProduct(page, P.croquetas)
await openInventory(page)
const panelRows = await stockRows(page)
const panelTotals = await totals(page)
const rowSum = panelRows.reduce((s, r) => s + num(r.qty), 0)
check('croquetas-panel-matches', 'Croquetas Inventario panel: total equals the /inventory total, the summary and the sum of its rows',
  panelTotals.total === journalTotal && rowSum === journalTotal && num(await page.textContent('[data-summary="stock"]').catch(() => 'NaN')) === journalTotal,
  { panelTotals, rowSum, journalTotal, summaryStock: await page.textContent('[data-summary="stock"]').catch(() => null) })

await openProduct(page, P.croquetas)
await openInventory(page)
// Kardex fit at 1440 (design system, Table row/Fit: up to 8 columns, no horizontal scroll inside the card).
const fit = await page.evaluate(() => {
  const kardex = document.querySelector('[data-testid="stock-panel"] .kardex')
  const clipped = [...kardex.querySelectorAll('*')].filter((el) => el.scrollWidth > el.clientWidth + 1 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowX))
  const table = kardex.querySelector('table')
  const heads = table ? [...table.querySelectorAll('thead th')].map((th) => ({ t: th.textContent.trim(), right: Math.round(th.getBoundingClientRect().right) })) : []
  return { cardWidth: Math.round(kardex.getBoundingClientRect().width), tableWidth: table ? Math.round(table.getBoundingClientRect().width) : null,
    scrollers: clipped.map((el) => ({ cls: String(el.className).slice(0, 60), scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })), heads,
    kardexRight: Math.round(kardex.getBoundingClientRect().right) }
})
check('kardex-fit-1440', 'kardex at 1440: every column (incl. "Responsable") is visible with no horizontal scroll', fit.scrollers.length === 0 && fit.heads.every((h) => h.right <= fit.kardexRight + 1), fit)

// Date, actor and location are short and must be readable whole (no ellipsis). The free-text
// reason/note under the movement type may be ellipsized.
// Measured with a Range over the text (an element's scrollWidth does not see an ellipsis).
const clipped = await page.evaluate(() => {
  const out = []
  for (const tr of document.querySelectorAll('[data-testid="stock-panel"] .kardex tbody tr')) {
    for (const i of [1, 2]) {
      const walker = document.createTreeWalker(tr.children[i], NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        const box = node.parentElement.getBoundingClientRect()
        const text = range.getBoundingClientRect()
        if (text.right > box.right + 1 || node.parentElement.scrollWidth > node.parentElement.clientWidth + 1) out.push(node.textContent.trim().slice(0, 40))
      }
    }
  }
  return out
})
check('kardex-no-ellipsis-1440', 'kardex at 1440: date, actor and location are not cut off with an ellipsis', clipped.length === 0, { clipped: [...new Set(clipped)] })

// C3 adjustments on Croquetas "Sin lote".
await openProduct(page, P.croquetas)
await openInventory(page)
const q0 = await qtyOf(page, 'Sin lote')
const totalBefore = (await totals(page)).total
const log0 = log.length

// 3a. Restar 2 · Merma/daño.
await clickAdjust(page, 'Sin lote')
await chooseMode(page, 'Restar')
await dialog(page).locator('input[name="quantity"]').fill('2')
await chooseReason(page, 'Merma/daño')
const preview = await dialog(page).locator('[data-testid="adjustment-result"]').textContent().catch(() => null)
await dialog(page).locator('[data-testid="adjustment-submit"]').click()
await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15000 }).catch(() => {})
await waitIdle(page); await sleep(500)
const post1 = log.slice(log0).find((e) => e.method === 'POST' && e.path === '/inventory/adjustments')
const q1 = await qtyOf(page, 'Sin lote')
const total1 = (await totals(page)).total
const kFirst = (await kardexRows(page, 3))[0] ?? ''
check('adjust-restar-2', 'Restar 2 · Merma/daño: 201, stock -2, kardex gets the new row first',
  post1?.status === 201 && q1 === q0 - 2 && total1 === totalBefore - 2 && /Ajuste/.test(kFirst) && /Merma\/daño/.test(kFirst) && /[−-]2/.test(kFirst),
  { request: post1 && { delta: post1.body?.delta, reason: post1.body?.reason, expectedVersion: post1.body?.expectedVersion, idempotencyKey: post1.hasIdempotencyKey, status: post1.status },
    before: q0, after: q1, totalBefore, totalAfter: total1, previewText: preview?.replace(/\s+/g, ' ').trim(), firstKardexRow: kFirst })

// 3b. Would go negative: refused locally with readable copy, nothing sent, stock unchanged.
const log1 = log.length
await clickAdjust(page, 'Sin lote')
await chooseMode(page, 'Restar')
await dialog(page).locator('input[name="quantity"]').fill(String(q1 + 5))
await chooseReason(page, 'Merma/daño')
await dialog(page).locator('[data-testid="adjustment-submit"]').click()
await sleep(400)
const negCopy = await dialog(page).locator('[data-testid="quantity-error"]').textContent().catch(() => null)
const sentNeg = log.slice(log1).filter((e) => e.method === 'POST' && e.path === '/inventory/adjustments')
const dialogStillOpen = await dialog(page).count()
await closeDialog(page)
check('adjust-negative-local', 'a subtraction below zero is refused next to the field with readable copy; nothing sent; stock unchanged',
  Boolean(negCopy) && /negativo/i.test(negCopy) && sentNeg.length === 0 && dialogStillOpen > 0 && (await qtyOf(page, 'Sin lote')) === q1,
  { copy: negCopy, postsSent: sentNeg.length, stock: await qtyOf(page, 'Sin lote') })

// 3c. The real backend 409 INSUFFICIENT_STOCK: the UI validated, then the request is rewritten
// to a delta the stock cannot cover, so the FE meets the real BE refusal and its mapping.
await clickAdjust(page, 'Sin lote')
await chooseMode(page, 'Restar')
await dialog(page).locator('input[name="quantity"]').fill('1')
await chooseReason(page, 'Merma/daño')
await page.route(`${API}/inventory/adjustments`, async (route) => {
  let body = {}
  try { body = JSON.parse(route.request().postData() ?? '{}') } catch { /* keep the request as it is */ }
  await route.continue({ postData: JSON.stringify({ ...body, delta: -(q1 + 1000) }) })
}, { times: 1 })
const log2 = log.length
await dialog(page).locator('[data-testid="adjustment-submit"]').click()
await sleep(1200)
const post409 = log.slice(log2).find((e) => e.method === 'POST' && e.path === '/inventory/adjustments')
const serverCopy = await dialog(page).locator('[data-testid="quantity-error"]').textContent().catch(() => null)
await closeDialog(page)
check('adjust-insufficient-409', 'real BE answers 409 INSUFFICIENT_STOCK and the dialog shows readable copy at the field; stock unchanged',
  post409?.status === 409 && post409?.error === 'INSUFFICIENT_STOCK' && /suficiente/i.test(serverCopy ?? '') && (await qtyOf(page, 'Sin lote')) === q1,
  { status: post409?.status, error: post409?.error, copy: serverCopy, stock: await qtyOf(page, 'Sin lote') })

// 3d. "Otro" with no note is blocked (and nothing is sent).
const log3 = log.length
await clickAdjust(page, 'Sin lote')
await chooseMode(page, 'Sumar')
await dialog(page).locator('input[name="quantity"]').fill('1')
await chooseReason(page, 'Otro')
await dialog(page).locator('[data-testid="adjustment-submit"]').click()
await sleep(400)
const noteCopy = await dialog(page).locator('[data-testid="note-error"]').textContent().catch(() => null)
const sentOtro = log.slice(log3).filter((e) => e.method === 'POST' && e.path === '/inventory/adjustments')
await closeDialog(page)
check('adjust-otro-no-note', '"Otro" with no note is blocked: copy at the Nota field, nothing sent',
  Boolean(noteCopy) && sentOtro.length === 0, { copy: noteCopy, postsSent: sentOtro.length })

// 3e. Conteo físico: counting the original quantity computes +2 and restores the stock.
const log4 = log.length
await clickAdjust(page, 'Sin lote')
await chooseMode(page, 'Conteo físico')
await dialog(page).locator('input[name="quantity"]').fill(String(q0))
await sleep(200)
const deltaText = await dialog(page).locator('[data-testid="count-delta"]').textContent().catch(() => null)
const reasonPre = await dialog(page).locator('[name="reason"]').first().textContent().catch(() => '')
await dialog(page).locator('[data-testid="adjustment-submit"]').click()
await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15000 }).catch(() => {})
await waitIdle(page); await sleep(500)
const postCount = log.slice(log4).find((e) => e.method === 'POST' && e.path === '/inventory/adjustments')
const q2 = await qtyOf(page, 'Sin lote')
const kCount = (await kardexRows(page, 3))[0] ?? ''
check('adjust-conteo-fisico', 'Conteo físico computes the delta from the shown stock (+2), sends PHYSICAL_COUNT and restores the stock',
  /\+2/.test(deltaText ?? '') && postCount?.status === 201 && postCount.body?.delta === 2 && postCount.body?.reason === 'PHYSICAL_COUNT' && q2 === q0 && /Conteo físico/.test(kCount),
  { deltaText, reasonPreselected: reasonPre?.trim(), body: postCount && { delta: postCount.body?.delta, reason: postCount.body?.reason }, stockBefore: q0, stockAfter: q2, firstKardexRow: kCount })

// The stock table at 390 must show its "Ajustar" buttons without a horizontal scroll.
const phoneStock = await mgrCtx.newPage()
await phoneStock.setViewportSize({ width: 390, height: 844 })
await openProduct(phoneStock, P.croquetas)
await openInventory(phoneStock)
const stockFit = await phoneStock.$eval('[data-testid="stock-panel"] .stock-scroll', (el) => {
  const buttons = [...el.querySelectorAll('[data-testid="stock-adjust"]')].map((b) => Math.round(b.getBoundingClientRect().right))
  return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, buttonsRight: buttons, scrollRight: Math.round(el.getBoundingClientRect().right) }
})
check('stock-table-fit-390', 'stock table at 390: no horizontal scroll, every "Ajustar" button fully visible',
  stockFit.scrollWidth <= stockFit.clientWidth && stockFit.buttonsRight.length === 4 && stockFit.buttonsRight.every((r) => r <= stockFit.scrollRight), stockFit)
await phoneStock.close()

// C4 Collar: variants listed, adjust one.
await openProduct(page, P.collar)
await openInventory(page)
const collarRows = await stockRows(page)
const chico = collarRows.find((r) => /Chico/.test(r.label))
const cq0 = num(chico?.qty)
const logC = log.length
if (chico) {
  await clickAdjust(page, chico.label)
  await chooseMode(page, 'Sumar')
  await dialog(page).locator('input[name="quantity"]').fill('1')
  await chooseReason(page, 'Corrección de captura')
  await dialog(page).locator('[data-testid="adjustment-submit"]').click()
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15000 }).catch(() => {})
  await waitIdle(page); await sleep(500)
}
const postC = log.slice(logC).find((e) => e.method === 'POST' && e.path === '/inventory/adjustments')
const cq1 = chico ? await qtyOf(page, chico.label) : null
const kC = (await kardexRows(page, 3))[0] ?? ''
check('collar-variants', 'Collar: both variants listed; adjusting one variant works (+1, variant target, kardex row first)',
  collarRows.length === 2 && Boolean(chico) && postC?.status === 201 && Boolean(postC.body?.target?.variantId) && !postC.body?.target?.lotId && cq1 === cq0 + 1 && /Ajuste/.test(kC),
  { variants: collarRows.map((r) => ({ label: r.label, qty: r.qty })), target: postC?.body?.target, before: cq0, after: cq1, firstKardexRow: kC })
// Put the +1 back so the showcase quantity is the README's.
if (chico && cq1 === cq0 + 1) {
  await clickAdjust(page, chico.label)
  await chooseMode(page, 'Restar')
  await dialog(page).locator('input[name="quantity"]').fill('1')
  await chooseReason(page, 'Corrección de captura')
  await dialog(page).locator('[data-testid="adjustment-submit"]').click()
  await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 15000 }).catch(() => {})
  await waitIdle(page)
}

// C5 Placa (useStock false): not-tracked state, no adjust action.
await openProduct(page, P.placa)
await openInventory(page)
const placaText = (await page.textContent('[data-testid="stock-panel"]'))?.replace(/\s+/g, ' ').trim()
check('placa-not-tracked', 'Placa (useStock false): not-tracked state, no "Ajustar" action',
  /no lleva control de stock/i.test(placaText ?? '') && (await page.locator('[data-testid="stock-adjust"]').count()) === 0,
  { panelText: placaText?.slice(0, 200) })

// C6 Editing: quantity is read-only with the hint, and the PATCH body carries no quantity.
for (const [name, id] of [['Croquetas', P.croquetas], ['Desparasitante', P.desparasitante], ['Collar', P.collar]]) {
  await openProduct(page, id)
  const stockEl = page.locator('[data-testid="product-detail-stock-readonly"]')
  await page.click('[data-task="presentations"]')
  await sleep(300)
  const hint = (await stockEl.first().textContent().catch(() => null))?.replace(/\s+/g, ' ').trim() ?? null
  const hasQuantityInput = await page.locator('input[name="quantity"]').count()
  // A product with lots keeps its quantity in the lots table: figures, no inputs, no hint to show.
  const lotCells = name === 'Croquetas' ? await page.locator('[data-testid="product-lots-table"] tbody tr').count() : 0
  const lotInputs = name === 'Croquetas' ? await page.locator('[data-testid="product-lots-table"] input').count() : 0
  const logP = log.length
  await page.evaluate(() => document.getElementById('product-detail-form')?.requestSubmit())
  await sleep(2000)
  const patch = log.slice(logP).find((e) => e.method === 'PATCH' && e.path === `/products/${id}`)
  check(`edit-readonly-${name.toLowerCase()}`, `${name}: quantity read-only${name === 'Desparasitante' ? ' ("Se ajusta desde Inventario")' : ''} and the PATCH body has no quantity`,
    name === 'Collar'
      ? Boolean(patch) && patch.status < 400 && !('quantity' in (patch.body ?? {}))
      : name === 'Croquetas'
      ? lotCells === 3 && lotInputs === 0 && hasQuantityInput === 0 && Boolean(patch) && patch.status < 400 && !('quantity' in (patch.body ?? {}))
      : /Se ajusta desde Inventario/.test(hint ?? '') && hasQuantityInput === 0 && Boolean(patch) && patch.status < 400 && !('quantity' in (patch.body ?? {})),
    { hint, quantityInputs: hasQuantityInput, ...(name === 'Croquetas' && { lotRows: lotCells, lotInputs }), patch: patch && { status: patch.status, keys: Object.keys(patch.body ?? {}), hasQuantity: 'quantity' in (patch.body ?? {}) } })
}
// Collar's variants: the figures are read-only (no inline stock input).
await openProduct(page, P.collar)
await page.click('[data-task="presentations"]')
await sleep(500)
const variantReadonly = await page.locator('[data-testid="variant-stock-readonly"]').count()
const variantInputs = await page.locator('input[aria-label^="Existencias de"]').count()
check('edit-readonly-collar-variants', 'Collar variants: stock shown read-only, no inline stock input',
  variantReadonly === 2 && variantInputs === 0, { readonlyCells: variantReadonly, stockInputs: variantInputs })

// C7 The task strip at 390: fits with scroll and fade; nothing makes the page scroll sideways.
const phone = await mgrCtx.newPage()
await phone.setViewportSize({ width: 390, height: 844 })
instrument(phone, [])
await openProduct(phone, P.croquetas)
const strip = await phone.$eval('.product-task-navigation', (nav) => {
  const buttons = [...nav.querySelectorAll('button')].map((b) => ({ t: b.textContent.trim(), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))
  return {
    scrollWidth: nav.scrollWidth, clientWidth: nav.clientWidth, dataMore: nav.dataset.more, dataLess: nav.dataset.less,
    mask: getComputedStyle(nav).maskImage, overflowX: getComputedStyle(nav).overflowX, buttons,
    pageOverflow: document.scrollingElement.scrollWidth > innerWidth,
  }
})
await phone.click('[data-task="inventory"]')
await sleep(500)
const stripAfter = await phone.$eval('.product-task-navigation', (nav) => {
  const b = nav.querySelector('[data-task="inventory"]').getBoundingClientRect()
  const n = nav.getBoundingClientRect()
  return { inventoryFullyVisible: b.left >= n.left - 1 && b.right <= n.right + 1, scrollLeft: Math.round(nav.scrollLeft), dataMore: nav.dataset.more, dataLess: nav.dataset.less,
    pageOverflow: document.scrollingElement.scrollWidth > innerWidth }
})
check('strip-390', 'task strip at 390: five tasks in one scrolling strip with the fade; the active Inventario scrolls into view; no page overflow',
  strip.overflowX === 'auto' && strip.scrollWidth > strip.clientWidth && strip.dataMore === 'true' && strip.mask !== 'none' && strip.buttons.length === 5 &&
  strip.buttons.every((b) => b.h >= 44) && !strip.pageOverflow && stripAfter.inventoryFullyVisible && !stripAfter.pageOverflow,
  { before: strip, after: stripAfter })
await phone.close()

// One 409 console line is the INSUFFICIENT_STOCK probe above, on purpose.
const unexpectedErrors = consoleErrors.filter((e, i) => !(/status of 409/.test(e) && consoleErrors.findIndex((x) => /status of 409/.test(x)) === i))
check('console-errors', 'no console errors or page errors during the manager run (apart from the one deliberate 409)', unexpectedErrors.length === 0, { consoleErrors, unexpectedErrors })
await mgrCtx.close()

// ── Cashier: no Inventario task ──────────────────────────────────────────────
const cashCtx = await newContext('cashier')
const cash = await cashCtx.newPage()
const cashLog = []
instrument(cash, cashLog)
await cash.goto(`${BASE}/pos/products/${P.croquetas}`, { waitUntil: 'domcontentloaded' })
await cash.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await sleep(1000)
const cashPath = pathOf(cash.url())
const cashHasNav = await cash.locator('.product-task-navigation').count()
const cashTasks = cashHasNav ? await cash.$$eval('.product-task-button', (b) => b.map((x) => x.textContent?.trim())) : []
const cashInv = await cash.locator('[data-task="inventory"], [data-testid="stock-panel"]').count()
check('cashier-no-task', 'cashier: no Inventario task (and no inventory request is made)',
  cashInv === 0 && cashLog.filter((e) => /^\/inventory\//.test(e.path)).length === 0,
  { landedPath: cashPath, taskStripShown: Boolean(cashHasNav), tasks: cashTasks, inventoryRequests: cashLog.filter((e) => /^\/inventory\//.test(e.path)).length })
// And the real BE answers 403 to the same user on the three inventory endpoints (S8).
const cashAuth = cash.__lastAuth
const forbidden = {}
if (cashAuth) {
  const headers = { authorization: cashAuth }
  const probes = {
    stock: () => cashCtx.request.get(`${API}/inventory/products/${P.croquetas}/stock`, { headers }),
    movements: () => cashCtx.request.get(`${API}/inventory/movements?productId=${P.croquetas}`, { headers }),
    adjustments: () => cashCtx.request.post(`${API}/inventory/adjustments`, { headers: { ...headers, 'idempotency-key': crypto.randomUUID() }, data: {} }),
  }
  for (const [name, run] of Object.entries(probes)) {
    const res = await run()
    forbidden[name] = { status: res.status(), error: (await res.json().catch(() => ({}))).error ?? null }
  }
}
check('cashier-403', 'cashier: the three inventory endpoints answer 403 from the real BE',
  Object.keys(forbidden).length === 3 && Object.values(forbidden).every((r) => r.status === 403), { forbidden, hadToken: Boolean(cashAuth) })
await cashCtx.close()

// ── Screenshots: panel, kardex, dialog × 1440/390 × light/dark ───────────────
if (!NO_SHOTS) {
  const shotLog = []
  for (const vp of [{ n: '1440', w: 1440, h: 900 }, { n: '390', w: 390, h: 844 }]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await newContext('manager', { viewport: { width: vp.w, height: vp.h } })
      const pg = await ctx.newPage()
      await setTheme(pg, theme)
      await openProduct(pg, P.croquetas)
      await openInventory(pg)
      const dark = await pg.evaluate(() => document.documentElement.classList.contains('dark'))
      await pg.addStyleTag({ content: '.product-action-bar { display: none !important }' })
      const take = async (locator, file) => {
        const box = await locator.boundingBox()
        await pg.setViewportSize({ width: vp.w, height: Math.min(4000, Math.max(vp.h, Math.ceil((box?.height ?? 0) + 400))) })
        await sleep(200)
        await locator.scrollIntoViewIfNeeded()
        await locator.screenshot({ path: join(SHOTS, file) })
        await pg.setViewportSize({ width: vp.w, height: vp.h })
        shotLog.push({ file, viewport: vp.n, theme, darkClassMatches: dark === (theme === 'dark') })
      }
      await take(pg.locator('[data-testid="stock-panel"] .stock-block').nth(0), `panel__${vp.n}__${theme}.png`)
      await take(pg.locator('[data-testid="stock-panel"] .stock-block').nth(1), `kardex__${vp.n}__${theme}.png`)
      await clickAdjust(pg, 'Sin lote')
      await chooseMode(pg, 'Restar')
      await dialog(pg).locator('input[name="quantity"]').fill('2')
      await chooseReason(pg, 'Merma/daño')
      await sleep(300)
      await pg.screenshot({ path: join(SHOTS, `dialog__${vp.n}__${theme}.png`) })
      shotLog.push({ file: `dialog__${vp.n}__${theme}.png`, viewport: vp.n, theme, darkClassMatches: dark === (theme === 'dark') })
      const overflow = await pg.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      shotLog[shotLog.length - 1].pageOverflow = overflow
      await closeDialog(pg)
      if (vp.n === '390') {
        await pg.locator('.product-task-navigation').scrollIntoViewIfNeeded()
        await pg.locator('.product-task-navigation').screenshot({ path: join(SHOTS, `strip__390__${theme}.png`) })
        shotLog.push({ file: `strip__390__${theme}.png`, viewport: vp.n, theme })
      }
      await ctx.close()
    }
  }
  notes.push({ shots: shotLog })
}

await browser.close()
const summary = { pass: checks.filter((c) => c.result === 'PASS').length, fail: checks.filter((c) => c.result === 'FAIL').length }
writeFileSync(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, api: API, tenant: TENANT, summary, checks, notes }, null, 2) + '\n')
console.log(`\n${summary.pass} PASS / ${summary.fail} FAIL → ${REPORT}`)
process.exit(summary.fail ? 1 : 0)
