// node run.mjs [screen ...]  — screens: notif product promo roles cash employees sales routes (default: all)
// Runs each screen at 1440/390 × light/dark against a Playwright-mocked API. Vite must be up on :5197.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://127.0.0.1:5197', API = 'http://127.0.0.1:3999'
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }
const PERMS = ['manage:all']
const ALL = ['notif', 'product', 'promo', 'roles', 'cash', 'employees', 'sales', 'routes']
const want = process.argv.slice(2).filter((a) => ALL.includes(a))
const screens = want.length ? want : ALL
const results = []
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : '' // T8: SUFFIX=fixed keeps the first run's shots

// ── generic audit run in the page ──────────────────────────────────────────
async function audit(page) {
  return page.evaluate(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
    const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
    const alpha = (c) => { const m = c.match(/\/\s*([\d.]+%?)\s*\)$/) || c.match(/rgba\([^)]*,\s*([\d.]+)\)$/); if (c === 'transparent') return 0; if (!m) return 1; return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]) }
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0.05 }
    const bgOf = (e) => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (alpha(c) > 0.5) return rgba(c) } return document.documentElement.classList.contains('dark') ? [0, 0, 0] : [255, 255, 255] }
    const label = (e) => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}«${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)}»`
    const out = { dark: document.documentElement.classList.contains('dark') }
    // checkboxes
    const boxes = [...document.querySelectorAll('input[type=checkbox], [role=checkbox]')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 })
    out.checkboxes = boxes.map((e) => label(e) + ` r=${getComputedStyle(e).borderRadius}`)
    // switches
    const sw = [...document.querySelectorAll('[role=switch]')].filter(vis)
    out.switchRows = sw.filter((e) => e.classList.contains('hf-switch-row__button')).length
    out.smallSwitches = sw.filter((e) => !e.classList.contains('hf-switch-row__button')).map((e) => label(e.closest('label,div') || e) + ` w=${Math.round(e.getBoundingClientRect().width)}`)
    out.rowsNoState = sw.filter((e) => e.classList.contains('hf-switch-row__button') && !e.querySelector('.hf-switch-row__state')).map(label)
    // overflow
    const vw = document.documentElement.clientWidth
    out.docOverflow = document.documentElement.scrollWidth - vw
    const clipped = (e) => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.overflowX !== 'visible' && n.getBoundingClientRect().right <= vw + 1) return true } return false }
    out.offenders = [...document.querySelectorAll('body *')].filter(vis).filter((e) => e.getBoundingClientRect().right > vw + 1 && !clipped(e)).slice(0, 6).map((e) => label(e) + ` right=${Math.round(e.getBoundingClientRect().right)}`)
    // contrast of text
    const low = []; let checked = 0, minC = 99
    for (const e of document.querySelectorAll('body *')) {
      if (!vis(e) || e.closest('[aria-hidden=true]')) continue
      const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!own) continue
      const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight * 3) continue
      const s = getComputedStyle(e); const fg = rgba(s.color); const bg = bgOf(e)
      const fgm = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
      const c = ratio(fgm, bg); const big = parseFloat(s.fontSize) >= 18.6 || (parseFloat(s.fontSize) >= 14 && parseInt(s.fontWeight) >= 700)
      const disabled = e.closest('[disabled],[aria-disabled=true],[data-disabled]')
      if (!disabled) { checked++; minC = Math.min(minC, c) }
      if (!disabled && c < (big ? 3 : 4.5)) low.push(`${label(e)} ${c.toFixed(2)}`)
    }
    out.lowContrast = low.slice(0, 12); out.lowContrastCount = low.length; out.textChecked = checked; out.minContrast = +minC.toFixed(2)
    // white surfaces in dark
    out.lightSurfaces = out.dark ? [...document.querySelectorAll('body *')].filter(vis).filter((e) => { const c = getComputedStyle(e).backgroundColor; if (alpha(c) < 0.6) return false; const r = e.getBoundingClientRect(); return r.width * r.height > 12000 && lum(rgba(c)) > 0.6 }).slice(0, 6).map(label) : []
    return out
  })
}
async function focusCheck(page, presses = 1, sel = null) {
  // keyboard modality first, then put focus on the first focusable of the screen (open dialog, else the main panel), then Tab.
  await page.keyboard.press('Tab')
  await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role=dialog]')].pop(); const h1 = document.querySelector('h1')
    const f = [...(dlg || document).querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('header,aside,nav') && (dlg || !h1 || (h1.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) })
    f[0]?.focus()
  })
  if (sel) { await page.evaluate((q) => { const r = [...document.querySelectorAll('[role=dialog]')].pop() || document; const el = [...r.querySelectorAll(q)].find((e) => e.getBoundingClientRect().width > 0); el?.focus(); el?.scrollIntoView({ block: 'center' }) }, sel); presses = 0 }
  for (let i = 0; i < presses; i++) await page.keyboard.press('Tab')
  await page.waitForTimeout(150)
  return page.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body) return { ok: false, el: 'body' }
    const s = getComputedStyle(e); const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none')
    return { ok: !!ring, el: `${e.tagName.toLowerCase()}«${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)}»`, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, shadow: s.boxShadow.slice(0, 60), visible: e.matches(':focus-visible') }
  })
}

// ── screens ────────────────────────────────────────────────────────────────
const wait = (page, ms = 600) => page.waitForTimeout(ms)
const go = async (page, path, sel) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); if (sel) await page.waitForSelector(sel, { timeout: 20000 }); await wait(page, 1200) }
const clickText = (scope, re) => scope.getByText(re).first().click()
const SCREENS = {
  async notif(page, S) {
    await go(page, '/sistema/configuracion/notificaciones', '.hf-switch-row__button')
    await S('on', { fullPage: true })
    await page.locator('main').first().click({ position: { x: 5, y: 5 } }).catch(() => {})
    await S.focus('on-focus', 1)
    await S.focus('switch-row-focus', 0, '.hf-switch-row__button')
    await S.focus('selectable-row-focus', 0, '[role=option][tabindex="0"]')
    // dirty: toggle one action row
    await page.getByRole('switch', { name: /Solicitud de validación/ }).click(); await wait(page)
    await S('dirty-savebar')
    // no users: unselect the two selected recipients, then Guardar
    for (const n of ['Ana Auditora', 'Carla Gerente']) await page.getByRole('option', { name: new RegExp(n) }).first().click().catch(() => clickText(page.locator('main'), n))
    await wait(page, 300)
    await page.getByRole('button', { name: /^Guardar/ }).last().click().catch(() => {}); await wait(page)
    await S('no-users-error')
    // master off
    await page.getByRole('switch', { name: /Notificaciones por correo/ }).click(); await wait(page)
    await S('master-off-dirty', { fullPage: true })
    page.__opts.notifOff = true
    await go(page, '/sistema/configuracion/notificaciones', '.hf-switch-row__button')
    await S('master-off-saved', { fullPage: true })
    page.__opts.notifOff = false
  },
  async product(page, S) {
    await go(page, '/pos/products/p1', '.hf-switch-row__button')
    await page.getByRole('button', { name: /^Presentaciones/ }).first().click().catch(() => clickText(page, /^Presentaciones$/)); await wait(page, 900)
    await S('presentaciones', { fullPage: true })
    await S.focus('presentaciones-focus', 2)
    await S.focus('switch-row-focus', 0, '.hf-switch-row__button')
    await S.focus('segmented-focus', 0, '[role=radio], [role=tab][aria-selected]')
    await page.getByRole('button', { name: /Acciones de la variante .*Pollo/ }).first().click(); await wait(page, 400)
    await page.getByRole('menuitem', { name: /Más datos/ }).click(); await wait(page, 900)
    await S('variant-modal')
    await S.focus('variant-modal-focus', 1)
    await page.keyboard.press('Escape'); await wait(page)
  },
  async promo(page, S) {
    await go(page, '/pos/promociones/crear/PRODUCT_DISCOUNT', 'form, .hf-switch-row__button')
    await S('initial', { fullPage: true })
    for (const n of ['Limitar la cantidad de unidades', 'Limitar su uso a ciertas fechas', 'Limitar a ciertos clientes', 'Limitar a ciertas listas de precio', 'Limitar a ciertos días de la semana']) {
      await page.getByRole('switch', { name: new RegExp(n) }).click({ timeout: 3000 }).catch(() => {}); await wait(page, 300)
    }
    await page.locator('.hf-toggle-chip').nth(1).click({ timeout: 3000 }).catch(() => {})
    await page.locator('.hf-toggle-chip').nth(3).click({ timeout: 3000 }).catch(() => {})
    await page.getByRole('option', { name: /Mayoreo/ }).first().click({ timeout: 3000 }).catch(() => {})
    await wait(page, 600)
    await S('conditions-revealed', { fullPage: true })
    await S.focus('focus', 2)
    await S.focus('switch-row-focus', 0, '.hf-switch-row__button')
    await S.focus('chip-focus', 0, '.hf-toggle-chip, [aria-pressed]')
  },
  async roles(page, S) {
    await go(page, '/admin/roles', 'h1')
    await page.getByRole('button', { name: /Acciones de Cajero/ }).first().click(); await wait(page, 400)
    await page.getByRole('menuitem', { name: /Permisos/ }).click(); await wait(page, 1500)
    await S('permissions-slideover')
    await page.getByRole('button', { name: /Expandir todo/ }).click(); await wait(page, 700)
    await S('permissions-expanded')
    await page.getByRole('dialog').evaluate((d) => { const s = [...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (s) s.scrollTop = s.scrollHeight }).catch(() => {}); await wait(page, 300)
    await S('permissions-expanded-bottom')
    await S.focus('permissions-focus', 2)
    await S.focus('row-focus', 0, '[role=option][tabindex="0"]')
  },
  async cash(page, S) {
    await go(page, '/pos/caja', 'h1')
    await page.getByRole('button', { name: /^Apertura/ }).first().click().catch(() => {}); await wait(page)
    if (await page.getByRole('row', { name: /Caja 1/ }).count()) await page.getByRole('row', { name: /Caja 1/ }).first().click().catch(() => {})
    else await page.getByText('Caja 1', { exact: true }).first().click().catch(() => {})
    await wait(page)
    await page.getByRole('button', { name: /^Apertura/ }).first().click().catch(() => {}); await wait(page)
    const input = page.getByTestId('cash-opening-cents')
    await input.waitFor({ timeout: 6000 })
    await input.locator('input').first().fill('500').catch(() => input.fill('500')); await wait(page, 400)
    await page.getByTestId('cash-open-session').scrollIntoViewIfNeeded()
    await S('confirm-step')
    await page.getByTestId('cash-opening-confirmed').click(); await wait(page, 400)
    await page.getByTestId('cash-open-submit').scrollIntoViewIfNeeded(); await wait(page, 200)
    S.note('submit label: ' + (await page.getByTestId('cash-open-submit').innerText()) + ' | confirmation: ' + (await page.getByTestId('cash-opening-confirmation').innerText()).replace(/\n+/g, ' '))
    await S('confirmed-open-with')
    await S.focus('focus', 1)
  },
  async employees(page, S) {
    await go(page, '/admin/colaboradores', 'h1')
    const marks = page.locator('.hf-row-mark')
    if (!(await marks.first().isVisible().catch(() => false))) { S.note('no row marks rendered at this width (phone cards have no selection)'); await S('list-no-marks') }
    else {
    await marks.nth(1).click(); await wait(page, 300)
    await S('one-selected-header-mixed')
    await marks.nth(0).click(); await wait(page, 300)
    await S('all-selected')
    await S.focus('focus', 2)
    await S.focus('rowmark-focus', 0, '.hf-row-mark')
    }
    await go(page, '/admin/colaboradores/e-1', 'h1')
    await S('detail-resumen', { fullPage: true })
    await go(page, '/admin/colaboradores/e-1?tab=personal', 'h1')
    await S('detail-personal', { fullPage: true })
  },
  async sales(page, S) {
    await go(page, '/pos/ventas/s-1', 'text=Datos de la venta')
    await S('sale-detail', { fullPage: true })
    await S.focus('sale-detail-focus', 2)
    await go(page, '/pos/ventas/nueva', 'h1')
    if (!(await page.getByRole('button', { name: /Asignar cliente/ }).first().isVisible())) { await page.getByText('Ver carrito').first().click(); await wait(page, 900) }
    await page.locator('button:visible', { hasText: 'Asignar cliente' }).first().click(); await wait(page, 1200)
    await S('assign-customer')
    await go(page, '/pos/customers', 'h1')
    await page.getByRole('button', { name: /^Crear cliente/ }).first().click(); await wait(page, 1200)
    await S('customer-upsert')
    await page.getByRole('dialog').evaluate((d) => { const s = [...d.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (s) s.scrollTop = s.scrollHeight }).catch(() => {}); await wait(page, 300)
    await S('customer-upsert-bottom')
    await S.focus('customer-upsert-focus', 2)
  },
  async routes(page, S) {
    await go(page, '/pos/rutas-de-entrega', 'h1')
    await page.getByRole('button', { name: 'Nueva ruta' }).first().click(); await wait(page, 1500)
    await page.locator('[data-testid=eligible-sales-picker-list] [role=option]').first().click().catch(() => {}); await wait(page, 400)
    await S('picker-one-selected')
    await page.getByTestId('eligible-sales-picker-list').scrollIntoViewIfNeeded().catch(() => {})
    await S('picker-list')
    await S.focus('picker-focus', 2)
    await S.focus('option-focus', 0, '[data-testid=eligible-sales-picker-list] [role=option][tabindex="0"]')
  },
}

// ── driver ─────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
for (const W of [1440, 390]) for (const theme of ['light', 'dark']) {
  if (process.env.ONLY && process.env.ONLY !== `${W}-${theme}`) continue
  const ctx = await browser.newContext({ viewport: { width: W, height: W < 500 ? 844 : 900 }, reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  for (const name of screens) {
    const page = await ctx.newPage(); page.__opts = {}
    const log = { console: [], blocked: [], unmocked: [] }
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /\[Vue warn\]/.test(m.text()))) log.console.push(`${m.type()}: ${m.text().slice(0, 240)}`) })
    page.on('pageerror', (e) => log.console.push('pageerror: ' + e.message.slice(0, 240)))
    await page.addInitScript(([u, t, p, th]) => {
      const s = localStorage; s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r')
      s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', JSON.stringify(p)); s.setItem('hound.auth.currentTenant', JSON.stringify(t))
      s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false')
      s.setItem('vueuse-color-mode', th); s.setItem('vueuse-color-scheme', th)
    }, [USER, TENANT, PERMS, theme])
    const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-allow-credentials': 'true' }
    await page.route(`${API}/**`, async (route) => {
      const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method()
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (m !== 'GET') { log.blocked.push(`${m} ${p}`); return route.abort() }
      const hit = fixtures({ USER, PERMS }, page.__opts)(p, u.searchParams)
      if (hit !== undefined) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(hit) })
      log.unmocked.push(p)
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '[]' })
    })
    await page.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#__vue-devtools-container__,.vue-devtools__anchor{display:none!important}'; document.head.appendChild(st) }) })
    const tag = `${name}-${W}-${theme}`
    const states = []
    const S = async (state, o = {}) => {
      const file = `${tag}-${state}${SUFFIX}.png`
      const vp = page.viewportSize()
      if (o.fullPage) {
        const tall = await page.evaluate(() => Math.max(...[...document.querySelectorAll('*')].filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4).map((e) => e.scrollHeight - e.clientHeight), 0))
        if (tall > 0) { await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + tall + 40, 7000) }); await wait(page, 400) }
      }
      await page.screenshot({ path: join(HERE, 'shots', file) })
      states.push({ state, file, ...(await audit(page)) })
      if (o.fullPage) { await page.setViewportSize(vp); await wait(page, 200) }
    }
    S.note = (note) => states.push({ state: 'note', note })
    S.focus = async (state, presses, sel) => { const f = await focusCheck(page, presses, sel); const file = `${tag}-${state}${SUFFIX}.png`; await page.screenshot({ path: join(HERE, 'shots', file) }); states.push({ state, file, focus: f }) }
    let error = null
    try { await SCREENS[name](page, S) } catch (e) { error = e.message.split('\n')[0].slice(0, 300); await page.screenshot({ path: join(HERE, 'shots', `${tag}-ERROR.png`) }).catch(() => {}) }
    results.push({ screen: name, W, theme, error, states, console: [...new Set(log.console)], blocked: [...new Set(log.blocked)], unmocked: [...new Set(log.unmocked)] })
    console.log(`${tag}: ${error ? 'ERROR ' + error : states.length + ' states'}`)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
writeFileSync(join(HERE, `results-${screens.join('_')}${process.env.ONLY ? '-' + process.env.ONLY : ''}${SUFFIX}.json`), JSON.stringify(results, null, 1))
