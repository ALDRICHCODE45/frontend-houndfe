#!/usr/bin/env node
// Runtime screenshot harness for the system redesign review (S4, S10).
// Every routed screen x {data, empty, loading, error} x {1440, 390} x {light, dark}.
// See README.md. The dev password is read from the backend seed at runtime and is
// never printed or written; the session lives in .auth/ (git-ignored).
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth')
const MEMORY_FILE = join(AUTH, 'memory.json')
const REPORT_FILE = join(HERE, 'report.json')

const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3000'
const SEED = process.env.CAPTURE_SEED ?? join(HERE, '../../../../houndfe-backend/prisma/seed.ts')
const USERS = {
  manager: { email: 'manager@houndfe.com', seedKey: 'manager' },
  admin: { email: 'admin@houndfe.com', seedKey: 'superAdmin' },
}
const TENANT = 'Sucursal Centro'
const MAX_HEIGHT = 6000
const THEME_KEY = 'vueuse-color-scheme'

const ALL_STATES = ['data', 'empty', 'loading', 'error']
const VIEWPORTS = [
  { name: '1440', size: { width: 1440, height: 900 } },
  { name: '390', size: { width: 390, height: 844 } },
]
const THEMES = ['light', 'dark']

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const flag = (name) => argv.includes(`--${name}`)
const opt = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined)
const onlySlugs = csv(opt('only'))
const states = csv(opt('states')) ?? ALL_STATES
const themes = csv(opt('themes')) ?? THEMES
const viewports = VIEWPORTS.filter((v) => (csv(opt('viewports')) ?? VIEWPORTS.map((x) => x.name)).includes(v.name))
const WHO = opt('user') ?? 'manager'
if (!USERS[WHO]) throw new Error(`unknown --user ${WHO} (manager | admin)`)
const USER = USERS[WHO].email
const STATE_FILE = join(AUTH, `state-${WHO}.json`)
const FORCE = flag('force')
const RETAKE_FLAGGED = flag('retake-flagged')
const INVENTORY = flag('inventory')
if (flag('help')) {
  console.log('node capture.mjs [--user manager|admin] [--only slug,slug] [--states data,empty,loading,error] [--themes light,dark] [--viewports 1440,390] [--force] [--retake-flagged] [--inventory]')
  process.exit(0)
}
for (const s of states) if (!ALL_STATES.includes(s)) throw new Error(`unknown state ${s}`)

// ── Routes ───────────────────────────────────────────────────────────────────
// gets: the screen's main API calls (matched on method + URL path). `empty` is how
// the empty state is built: 'list' keeps the real envelope with arrays emptied,
// 'zero' also zeroes numbers (dashboards), 'zerofill' keeps zero-filled buckets, 404 answers not found (detail records),
// 'real' lets the live response through (responses whose contract headers a mock cannot reproduce).
// idFrom: the list route whose first item supplies :id. static: no API call.
const UUID = '[^/]+'
const g = (re, empty = 'list', method = 'GET') => ({ re, empty, method })
const ROUTES = [
  { slug: 'login', path: '/login', anon: true, gets: [g(/^\/auth\/login$/, null, 'POST')], act: 'login' },
  { slug: 'select-tenant', path: '/select-tenant', static: true },
  { slug: 'forbidden-403', path: '/403', static: true },
  { slug: 'not-found-404', path: '/this-page-does-not-exist', static: true },
  { slug: 'public-catalog', path: '/catalogo', anon: true, gets: [g(/^\/public\/catalog\/branches$/)] },
  { slug: 'public-catalog-branch', path: '/catalogo/centro', anon: true, gets: [g(/^\/public\/catalog\/[^/]+\/products$/)] },

  { slug: 'dashboard', path: '/dashboard', gets: [g(/^\/analytics\/sales\/summary$/, 'zero'), g(/^\/analytics\/sales\/timeseries$/, 'zerofill'), g(/^\/sales$/), g(/^\/sales\/refunds\/pending$/)] },

  { slug: 'pos-products', path: '/pos/products', gets: [g(/^\/products$/)], idSource: true },
  { slug: 'pos-product-create', path: '/pos/products/new', gets: [g(/^\/categories$/), g(/^\/brands$/)] },
  { slug: 'pos-product-detail', path: '/pos/products/:id', idFrom: 'pos-products', gets: [g(new RegExp(`^/products/${UUID}$`), 404)] },
  { slug: 'pos-product-editorial', path: '/pos/products/:id/editorial', idFrom: 'pos-products', gets: [g(new RegExp(`^/products/${UUID}/editorial$`), 404), g(/^\/catalog-editorial\/vocabulary$/, 'real')] },
  { slug: 'pos-customers', path: '/pos/customers', gets: [g(/^\/customers$/)], idSource: true },
  { slug: 'pos-cash-register', path: '/pos/caja', gets: [g(/^\/cash-registers$/), g(/^\/cash-sessions$/)] },
  { slug: 'pos-cash-reception', path: '/pos/caja/recepciones', gets: [g(/^\/cash-handovers\/custody$/)] },
  { slug: 'pos-sales-list', path: '/pos/ventas', gets: [g(/^\/sales$/)], idSource: true },
  { slug: 'pos-sales-new', path: '/pos/ventas/nueva', gets: [g(/^\/sales\/pos-catalog$/)] }, // /sales/drafts stays real: an empty draft list makes the POS create a draft
  { slug: 'pos-sale-detail', path: '/pos/ventas/:id', idFrom: 'pos-sales-list', gets: [g(/^\/sales\/(?!drafts$|pos-catalog|payment-methods$|refunds)[^/]+$/, 404)] },
  { slug: 'pos-human-decisions', path: '/pos/decisiones-pendientes', gets: [g(/^\/human-decisions$/)] },
  { slug: 'pos-promotions', path: '/pos/promociones', gets: [g(/^\/promotions$/)], idSource: true },
  { slug: 'pos-promotion-create', path: '/pos/promociones/crear/PRODUCT_DISCOUNT', gets: [g(/^\/promotions\/bot-eligibility-capabilities$/)] },
  { slug: 'pos-promotion-detail', path: '/pos/promociones/:id', idFrom: 'pos-promotions', gets: [g(/^\/promotions\/(?!bot-)[^/]+$/, 404)] },
  { slug: 'pos-quotations-list', path: '/pos/cotizaciones', gets: [g(/^\/quotations$/)], idSource: true },
  {
    slug: 'pos-quotations-create', path: '/pos/cotizaciones/nueva', skip: 'Opening it POSTs a new draft quotation and redirects to /pos/cotizaciones/:id, which pos-quotation-detail covers; capturing it would create one draft per shot.',
  },
  { slug: 'pos-quotation-detail', path: '/pos/cotizaciones/:id', idFrom: 'pos-quotations-list', gets: [g(new RegExp(`^/quotations/${UUID}$`), 404)] },

  { slug: 'admin-employees-list', path: '/admin/colaboradores', gets: [g(/^\/admin\/employees$/)], idSource: true },
  { slug: 'admin-employee-detail', path: '/admin/colaboradores/:id', idFrom: 'admin-employees-list', gets: [g(new RegExp(`^/admin/employees/${UUID}$`), 404)] },
  { slug: 'admin-employees-expiring-documents', path: '/admin/colaboradores/documentos-vencer', gets: [g(/^\/admin\/employees-documents\/expiring$/)] },
  { slug: 'admin-employees-pending-approvals', path: '/admin/colaboradores/aprobaciones-pendientes', gets: [g(/^\/admin\/employees-time-off\/pending-approvals$/)] },
  { slug: 'admin-users', path: '/admin/users', gets: [g(/^\/admin\/users$/)], idSource: true },
  { slug: 'admin-roles', path: '/admin/roles', gets: [g(/^\/admin\/roles$/)] },
  { slug: 'admin-tenants', path: '/admin/tenants', gets: [g(/^\/admin\/tenants$/)], idSource: true },
  { slug: 'admin-tenant-members', path: '/admin/tenants/:id/members', idFrom: 'admin-tenants', gets: [g(/^\/admin\/tenants\/[^/]+\/members$/)] },
  { slug: 'admin-payment-details', path: '/admin/payment-details', gets: [g(/^\/admin\/payment-details$/)] },
  { slug: 'admin-payment-methods', path: '/admin/payment-methods', gets: [g(/^\/admin\/payment-methods$/)] },

  { slug: 'procurement-purchase-orders', path: '/procurement/purchase-orders', gets: [g(/^\/procurement\/purchase-orders$/)] },
  { slug: 'procurement-suppliers', path: '/procurement/suppliers', gets: [g(/^\/procurement\/suppliers$/)] },

  { slug: 'pos-delivery-routes-list', path: '/pos/rutas-de-entrega', gets: [g(/^\/delivery-routes$/)], idSource: true },
  { slug: 'pos-delivery-route-detail', path: '/pos/rutas-de-entrega/:id', idFrom: 'pos-delivery-routes-list', gets: [g(new RegExp(`^/delivery-routes/${UUID}$`), 404)] },

  { slug: 'sistema-notification-config', path: '/sistema/configuracion/notificaciones', gets: [g(/^\/notification-config$/)] },
  { slug: 'system-catalog-settings', path: '/system/catalog-settings', gets: [g(/^\/tenants\/[^/]+\/catalog-settings$/)] },
]
const bySlug = Object.fromEntries(ROUTES.map((r) => [r.slug, r]))

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Path of a URL, '' when it does not parse. */
function pathOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const readJson = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback)
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n')

const COUNT_KEY = /^(total|count|totalItems|totalCount|totalPages|pageCount|total[A-Z].*|.*Count)$/
const PAGING_KEY = /^(page|limit|pageSize|pageIndex)$/
const FLAG_KEY = /^(hasMore|hasNext|hasNextPage)$/

/** Same envelope with every collection emptied; `zero` also zeroes numbers, and
 * `zerofill` keeps the buckets (a series the contract wants zero-filled). */
function emptied(value, zero, key = '', keepRows = false) {
  if (Array.isArray(value)) return keepRows ? value.map((v) => emptied(v, zero, key, keepRows)) : []
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, emptied(v, zero, k, keepRows)]))
  }
  if (/cursor/i.test(key)) return null
  if (typeof value === 'boolean') return FLAG_KEY.test(key) ? false : value
  if (typeof value === 'number') return (zero && !PAGING_KEY.test(key)) || COUNT_KEY.test(key) ? 0 : value
  if (typeof value === 'string' && zero && /^-?\d+(\.\d+)?$/.test(value)) return value.replace(/\d/g, '0').replace(/^-/, '')
  return value
}

function firstId(body) {
  const rows = Array.isArray(body) ? body : Object.values(body ?? {}).find((v) => Array.isArray(v) && v.length) ?? body?.data
  const first = Array.isArray(rows) ? rows[0] : undefined
  const id = first?.id
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
}

function devPassword() {
  const pick = (text) => text.match(new RegExp(`${USERS[WHO].seedKey}:\\s*\\{[^}]*?password:\\s*'([^']+)'`, 's'))?.[1]
  const fromSeed = existsSync(SEED) ? pick(readFileSync(SEED, 'utf8')) : undefined
  if (!fromSeed) throw new Error(`${WHO} dev password not found in ${SEED}`)
  return fromSeed
}

async function waitForUrl(url, label, timeoutMs) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (r.status > 0) return
    } catch {
      /* not up yet */
    }
    await sleep(3000)
  }
  throw new Error(`${label} (${url}) did not come up within ${timeoutMs / 1000}s`)
}

const slugOf = (r) => r.slug
const fileName = (slug, state, vp, theme) => `${slug}__${state}__${vp}__${theme}.png`

// ── Browser session ──────────────────────────────────────────────────────────
mkdirSync(SHOTS, { recursive: true })
mkdirSync(AUTH, { recursive: true })
await waitForUrl(`${API}/auth/me`, 'API', 5 * 60 * 1000)
await waitForUrl(`${BASE}/login`, 'dev server', 60 * 1000)

const browser = await chromium.launch({ headless: true })
const newContext = (storageState) =>
  browser.newContext({ viewport: VIEWPORTS[0].size, reducedMotion: 'reduce', locale: 'es-MX', storageState })

async function loginViaUi(ctx) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', USER)
  await page.fill('#password', devPassword())
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(page.url()) === '/select-tenant') {
    await page.getByText(TENANT, { exact: false }).first().click()
    await page.getByRole('button', { name: /continuar/i }).click()
    await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.close()
  await ctx.storageState({ path: STATE_FILE })
}

async function authedContext() {
  let ctx = await newContext(existsSync(STATE_FILE) ? STATE_FILE : undefined)
  if (existsSync(STATE_FILE)) {
    const probe = await ctx.newPage()
    await probe.goto(`${BASE}/pos/ventas`, { waitUntil: 'domcontentloaded' })
    await probe.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    const ok = pathOf(probe.url()) === '/pos/ventas'
    await probe.close()
    if (ok) return ctx
    await ctx.close()
    ctx = await newContext()
  }
  await loginViaUi(ctx)
  return ctx
}

const appCtx = await authedContext()
const anonCtx = await newContext()
const appPage = await appCtx.newPage()
const anonPage = await anonCtx.newPage()
for (const p of [appPage, anonPage]) await p.goto(`${BASE}/403`, { waitUntil: 'domcontentloaded' })

// ── Per-shot recording ───────────────────────────────────────────────────────
let cur = null
for (const page of [appPage, anonPage]) {
  page.on('console', (m) => {
    if (!cur || cur.closed || cur.page !== page || m.type() !== 'error') return
    const url = m.location()?.url ?? ''
    const fromInterception = cur.interceptedUrls.has(url) || /status of 500|status of 404/.test(m.text())
    cur.console.push({ text: m.text().slice(0, 300), expected: cur.state !== 'data' && fromInterception })
  })
  page.on('pageerror', (e) => cur?.page === page && !cur.closed && cur.console.push({ text: `pageerror: ${String(e.message).slice(0, 300)}`, expected: false }))
  page.on('requestfailed', (req) => {
    if (!cur || cur.closed || cur.page !== page || cur.intercepted.has(req) || !req.url().startsWith(API)) return
    cur.failed.push({ method: req.method(), path: pathOf(req.url()), failure: req.failure()?.errorText })
  })
  page.on('response', (res) => {
    if (!cur || cur.closed || cur.page !== page) return
    const req = res.request()
    if (res.status() < 400 || cur.intercepted.has(req)) return
    cur.failed.push({ method: req.method(), path: pathOf(res.url()), status: res.status() })
  })
  page.on('response', (res) => {
    if (!cur?.learn || cur.page !== page) return
    const req = res.request()
    if (req.method() !== 'GET' || !res.url().startsWith(API) || res.status() !== 200) return
    const path = pathOf(res.url())
    cur.gets.add(path)
    const get = cur.route.gets?.find((x) => x.method === 'GET' && x.re.test(path))
    if (!get) return
    cur.pending.push(
      res.json().then((body) => {
        const shape = (memory.shapes[cur.route.slug] ??= {})
        shape[path] = { list: emptied(body, false), zero: emptied(body, true), zerofill: emptied(body, true, '', true), alreadyEmpty: JSON.stringify(emptied(body, false)) === JSON.stringify(body) }
        if (cur.route.idSource) {
          const id = firstId(body)
          if (id) memory.ids[cur.route.slug] = id
        }
      }).catch(() => {}),
    )
  })
}

const memory = readJson(MEMORY_FILE, { shapes: {}, ids: {} })
const report = readJson(REPORT_FILE, { routes: {}, shots: {} })
const save = () => {
  writeJson(MEMORY_FILE, memory)
  writeJson(REPORT_FILE, { ...report, generatedAt: new Date().toISOString(), base: BASE, api: API })
}

function expectedPath(route) {
  if (!route.path.includes(':id')) return route.path
  const id = memory.ids[route.idFrom]
  return id ? route.path.replace(':id', encodeURIComponent(id)) : undefined
}

/** Install the interception for one state; returns a cleanup function. */
async function intercept(page, route, state) {
  const gate = { release: () => {} }
  const released = new Promise((r) => (gate.release = r))
  const gets = route.gets ?? []
  await page.route((u) => u.origin === API, async (r) => {
    const req = r.request()
    const path = pathOf(req.url())
    const get = gets.find((x) => x.method === req.method() && x.re.test(path))
    // 'real': the empty state keeps the live response (the editorial vocabulary carries its contract headers, which a fulfilled mock would drop)
    if (!get || state === 'data' || (state === 'empty' && get.empty === 'real')) return r.continue().catch(() => {})
    cur.intercepted.add(req)
    cur.interceptedUrls.add(req.url())
    cur.hits += 1
    const cors = { 'access-control-allow-origin': new URL(BASE).origin, 'access-control-allow-credentials': 'true', 'access-control-expose-headers': '*' }
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) }).catch(() => {})
    if (state === 'error') return json(500, { statusCode: 500, message: 'Error interno del servidor', error: 'Internal Server Error' })
    if (state === 'loading') {
      await Promise.race([released, sleep(30000)])
      return r.abort().catch(() => {})
    }
    // empty
    if (get.empty === 404) return json(404, { statusCode: 404, message: 'No encontrado', error: 'Not Found' })
    const shape = memory.shapes[route.slug]?.[path]
    if (!shape) {
      cur.unwired.add(path)
      return r.continue().catch(() => {})
    }
    const body = structuredClone(shape[get.empty === 'list' ? 'list' : get.empty])
    // a response that echoes its query (range, interval) must echo this request's
    const query = new URL(req.url()).searchParams
    if (body && !Array.isArray(body)) for (const k of ['from', 'to', 'interval']) if (k in body && query.has(k)) body[k] = query.get(k)
    return json(200, body)
  })
  return async () => {
    gate.release()
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
  }
}

/** Store the theme; retries when a late client-side redirect destroys the context. */
async function setTheme(page, theme) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await page.waitForLoadState('domcontentloaded')
      return await page.evaluate(([k, t]) => localStorage.setItem(k, t), [THEME_KEY, theme])
    } catch (e) {
      if (attempt >= 3 || !/context was destroyed/.test(String(e.message))) throw e
      await sleep(1000)
    }
  }
}

/** The app shell scrolls inside its own container, which a full-page shot misses:
 * grow the viewport height until no scroll container has hidden height left. */
async function revealScrollContent(page, vp) {
  let height = vp.size.height
  for (let pass = 0; pass < 3; pass += 1) {
    const hidden = await page.evaluate(() => {
      let max = 0
      for (const el of document.body.querySelectorAll('*')) {
        if (el.scrollHeight - el.clientHeight <= max || !/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue
        max = el.scrollHeight - el.clientHeight
      }
      return max
    })
    if (hidden <= 8 || height >= MAX_HEIGHT) break
    height = Math.min(height + hidden, MAX_HEIGHT)
    await page.setViewportSize({ width: vp.size.width, height })
    await sleep(400)
  }
  return height
}

/** goto that survives a client-side redirect aborting the first navigation. */
async function go(page, url) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await page.goto(url, { waitUntil: 'domcontentloaded' })
    } catch (e) {
      if (attempt >= 2 || !/ERR_ABORTED|interrupted by another navigation/.test(String(e.message))) throw e
      await sleep(1000)
    }
  }
}

async function loginAct(page, state) {
  if (state === 'data' || state === 'empty') return // the login has nothing to empty: its empty shot is the idle form
  await page.fill('#email', 'prueba@ejemplo.com')
  await page.fill('#password', 'Prueba-123!')
  await page.click('button[type=submit]')
}

async function overflowOf(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement
    const iw = window.innerWidth
    const out = { scrollWidth: el.scrollWidth, innerWidth: iw, overflows: el.scrollWidth > iw, offenders: [] }
    if (out.overflows) {
      for (const n of document.body.querySelectorAll('*')) {
        const r = n.getBoundingClientRect()
        if (r.width > 0 && r.right > iw + 1 && out.offenders.length < 5) {
          const cls = typeof n.className === 'string' ? n.className.split(/\s+/).slice(0, 3).join('.') : ''
          out.offenders.push(`${n.tagName.toLowerCase()}${cls ? '.' + cls : ''}@${Math.round(r.right)}`)
        }
      }
    }
    return out
  })
}

/** Load a screen once (1440, light) to learn its response shapes and ids. */
async function learn(route) {
  const target = expectedPath(route) ?? route.path
  const page = route.anon ? anonPage : appPage
  cur = { page, route, state: 'data', learn: true, console: [], failed: [], intercepted: new Set(), interceptedUrls: new Set(), hits: 0, unwired: new Set(), gets: new Set(), pending: [] }
  await page.setViewportSize(VIEWPORTS[0].size)
  const cleanup = await intercept(page, route, 'data')
  await go(page, `${BASE}${target}`)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(500)
  await Promise.allSettled(cur.pending)
  cur.closed = true
  const got = [...cur.gets].sort()
  const finalPath = pathOf(page.url())
  await cleanup()
  cur = null
  return { got, finalPath, redirected: finalPath !== target }
}

function needsMemory(route, wanted) {
  const idMissing = route.path.includes(':id') && !memory.ids[route.idFrom]
  const shapeMissing = wanted.some((s) => s !== 'data') && (route.gets ?? []).some((x) => x.method === 'GET' && x.empty !== 404 && x.empty !== 'real' && !Object.keys(memory.shapes[route.slug] ?? {}).some((p) => x.re.test(p)))
  const idSourceMissing = route.idSource === true && !memory.ids[route.slug] && ROUTES.some((r) => r.idFrom === route.slug)
  // --force also relearns the response shapes, so seeded data replaces a shape (and its alreadyEmpty flag) cached while the screen was empty
  const stale = FORCE && wanted.some((s) => s !== 'data') && (route.gets ?? []).length > 0
  return idMissing || shapeMissing || idSourceMissing || stale
}

async function capture(route, state, vp, theme) {
  const file = fileName(slugOf(route), state, vp.name, theme)
  const page = route.anon ? anonPage : appPage
  const target = expectedPath(route)
  cur = { page, route, state, learn: false, console: [], failed: [], intercepted: new Set(), interceptedUrls: new Set(), hits: 0, unwired: new Set(), gets: new Set(), pending: [] }
  const entry = { file, route: route.slug, user: WHO, path: target, state, viewport: vp.name, theme }
  await page.setViewportSize(vp.size)
  await setTheme(page, theme)
  const cleanup = await intercept(page, route, state)
  try {
    await go(page, `${BASE}${target}`)
    if (route.act === 'login') await loginAct(page, state)
    if (state === 'loading') {
      const end = Date.now() + 10000
      while (cur.hits === 0 && Date.now() < end) await sleep(100)
      await sleep(1500)
    } else {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await sleep(700)
    }
    const finalPath = pathOf(page.url())
    entry.finalPath = finalPath
    const redirected = finalPath !== target
    const status = report.routes[route.slug]?.status
    if (redirected && status !== 'captured' && state === 'data') {
      await markSkippedByRedirect(route, target, finalPath)
      return 'skipped'
    }
    await page.addStyleTag({ content: '#vue-devtools-anchor,.vue-devtools__anchor,vite-error-overlay{display:none!important}' })
    await page.waitForFunction((dark) => document.documentElement.classList.contains('dark') === dark, theme === 'dark', { timeout: 3000 }).catch(() => {})
    entry.themeApplied = (await page.evaluate(() => document.documentElement.classList.contains('dark'))) === (theme === 'dark')
    entry.overflow = await overflowOf(page)
    entry.height = await revealScrollContent(page, vp)
    await page.screenshot({ path: join(SHOTS, file), fullPage: true })
    Object.assign(entry, {
      consoleErrors: cur.console.filter((c) => !c.expected).map((c) => c.text),
      expectedConsoleErrors: cur.console.filter((c) => c.expected).length,
      failedRequests: [...cur.failed],
      intercepted: cur.hits,
      unwired: [...cur.unwired],
    })
    report.shots[file] = entry
    return 'ok'
  } finally {
    cur.closed = true // late aborts from the held requests must not count
    await cleanup()
    await sleep(300)
    cur = null
  }
}


const isFlagged = (e) => !!e && (e.error || e.themeApplied === false || e.failedRequests?.length > 0 || e.consoleErrors?.length > 0)
const FORBIDDEN_EVIDENCE = ['dashboard', 'pos-promotions', 'admin-users']

/** A few shots of the forbidden redirect, as evidence of that state. */
async function forbiddenEvidence(route, target) {
  if (WHO !== 'manager' || !FORBIDDEN_EVIDENCE.includes(route.slug)) return
  const page = appPage
  for (const [vpName, theme] of [['1440', 'light'], ['390', 'dark']]) {
    const file = fileName(route.slug, 'forbidden-redirect', vpName, theme)
    if (existsSync(join(SHOTS, file))) continue
    cur = { page, route, state: 'data', learn: false, console: [], failed: [], intercepted: new Set(), interceptedUrls: new Set(), hits: 0, unwired: new Set(), gets: new Set(), pending: [] }
    await page.setViewportSize(VIEWPORTS.find((v) => v.name === vpName).size)
    await setTheme(page, theme)
    await go(page, `${BASE}${target}`)
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await sleep(700)
    await page.addStyleTag({ content: '#vue-devtools-anchor,.vue-devtools__anchor,vite-error-overlay{display:none!important}' })
    await page.screenshot({ path: join(SHOTS, file), fullPage: true })
    report.shots[file] = { file, route: route.slug, user: WHO, path: target, state: 'forbidden-redirect', viewport: vpName, theme, finalPath: pathOf(page.url()) }
    cur = null
    console.log('shot', file)
  }
}

async function markSkippedByRedirect(route, target, finalPath) {
  const forbidden = finalPath === '/403'
  const prev = report.routes[route.slug]
  report.routes[route.slug] = {
    path: target,
    status: 'skipped',
    user: WHO,
    managerForbidden: WHO === 'manager' ? forbidden : prev?.managerForbidden,
    reason: `${USER} is redirected to ${finalPath}${forbidden ? ' (missing permission)' : ''}`,
  }
  if (forbidden) await forbiddenEvidence(route, target)
}

// ── Main loop ────────────────────────────────────────────────────────────────
const counts = { captured: 0, existing: 0, skipped: 0, failed: 0 }
if (onlySlugs) for (const s of onlySlugs) if (!bySlug[s]) console.log(`unknown slug ${s}`)
const targetRoutes = ROUTES.filter((r) => {
  if (onlySlugs) return onlySlugs.includes(r.slug)
  // each user's pass owns its own routes: the admin pass revisits what the manager
  // was forbidden to open, and the manager pass leaves those alone
  const forbidden = report.routes[r.slug]?.managerForbidden === true
  return WHO === 'manager' ? !forbidden : forbidden
})

if (INVENTORY) {
  const inv = {}
  for (const route of targetRoutes.filter((r) => !r.skip)) {
    const idSrc = route.idFrom && !memory.ids[route.idFrom] ? bySlug[route.idFrom] : null
    if (idSrc) await learn(idSrc)
    if (route.path.includes(':id') && !memory.ids[route.idFrom]) continue
    const res = await learn(route)
    inv[route.slug] = res
    console.log(route.slug, res.redirected ? `[redirected ${res.finalPath}]` : '', res.got.join(' '))
  }
  writeJson(join(AUTH, `inventory-${WHO}.json`), inv)
  save()
  await browser.close()
  process.exit(0)
}

for (const route of targetRoutes) {
  if (route.skip) {
    if (WHO === 'manager') report.routes[route.slug] = { path: route.path, status: 'skipped', reason: route.skip }
    continue
  }
  const wantedStates = route.static || !route.gets?.length ? states.filter((s) => s === 'data') : states.filter((s) => !(route.noEmpty && s === 'empty'))
  const notApplicable = states.filter((s) => !wantedStates.includes(s))
  try {
    // detail screens need an id; list screens need shapes for empty/error/loading.
    if (needsMemory(route, wantedStates)) {
      const idSrc = route.path.includes(':id') && !memory.ids[route.idFrom] ? bySlug[route.idFrom] : null
      if (idSrc) await learn(idSrc)
      if (route.path.includes(':id') && !memory.ids[route.idFrom]) {
        report.routes[route.slug] = { path: route.path, status: 'skipped', user: WHO, managerForbidden: WHO === 'manager' ? report.routes[route.idFrom]?.managerForbidden === true : report.routes[route.slug]?.managerForbidden, reason: `no ${route.idFrom} item available to open (the list is empty or ${USER} cannot open it)` }
        counts.skipped += 1
        continue
      }
      const res = await learn(route)
      if (res.redirected && report.routes[route.slug]?.status !== 'captured') {
        await markSkippedByRedirect(route, expectedPath(route) ?? route.path, res.finalPath)
        counts.skipped += 1
        console.log('SKIPPED route', route.slug, report.routes[route.slug].reason)
        save()
        continue
      }
    }
    let routeSkipped = false
    for (const state of wantedStates) {
      for (const theme of themes) {
        for (const vp of viewports) {
          const file = fileName(route.slug, state, vp.name, theme)
          if (!FORCE && existsSync(join(SHOTS, file)) && !(RETAKE_FLAGGED && isFlagged(report.shots[file]))) {
            counts.existing += 1
            continue
          }
          try {
            const res = await capture(route, state, vp, theme)
            if (res === 'skipped') {
              routeSkipped = true
              break
            }
            counts.captured += 1
            console.log('shot', file)
          } catch (e) {
            counts.failed += 1
            console.log('FAILED', file, String(e.message).split('\n')[0])
            report.shots[file] = { file, route: route.slug, user: WHO, state, viewport: vp.name, theme, error: String(e.message).split('\n')[0] }
          }
        }
        if (routeSkipped) break
      }
      if (routeSkipped) {
        counts.skipped += 1
        console.log('SKIPPED route', route.slug, report.routes[route.slug].reason)
        break
      }
    }
    if (!routeSkipped) {
      const alreadyEmpty = Object.entries(memory.shapes[route.slug] ?? {}).filter(([, s]) => s.alreadyEmpty).map(([p]) => p)
      const prev = report.routes[route.slug]
      report.routes[route.slug] = {
        path: expectedPath(route) ?? route.path,
        status: 'captured',
        user: WHO,
        managerForbidden: prev?.managerForbidden,
        notApplicableStates: notApplicable.length ? notApplicable : undefined,
        notApplicableReason: notApplicable.length ? (route.noEmpty ? 'the screen has no list or record to empty (idle form)' : route.static ? 'static screen, no API request' : 'screen has no API request to intercept') : undefined,
        dataAlreadyEmpty: alreadyEmpty.length ? alreadyEmpty : undefined,
      }
    }
  } catch (e) {
    counts.failed += 1
    console.log('ROUTE FAILED', route.slug, String(e.message).split('\n')[0])
  }
  save()
  await appCtx.storageState({ path: STATE_FILE }).catch(() => {})
}

save()
await appCtx.storageState({ path: STATE_FILE }).catch(() => {})
await browser.close()
console.log(JSON.stringify(counts))
