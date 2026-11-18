// node verify-t8.mjs [width] [theme] — T8 re-check of the L18 defects D1–D10 with numbers, not only shots.
// Vite must be up on :5197 (see README). Writes shots/t8-*-fixed.png and results-t8-<w>-<theme>-fixed.json.
import { chromium } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const W = Number(process.argv[2] ?? 390)
const THEME = process.argv[3] ?? 'light'
const BASE = 'http://127.0.0.1:5197', API = 'http://127.0.0.1:3999'
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }
const tag = `${W}-${THEME}`
const out = { W, theme: THEME, checks: {}, console: [] }
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 900 }, reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City' })
const page = await ctx.newPage(); const opts = {}
page.on('console', (m) => { if (m.type() === 'error' || /\[Vue warn\]/.test(m.text())) out.console.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => out.console.push('pageerror: ' + e.message.slice(0, 200)))
await page.addInitScript(([u, t, th]) => { const s = localStorage; s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r'); s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', '["manage:all"]'); s.setItem('hound.auth.currentTenant', JSON.stringify(t)); s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false'); s.setItem('vueuse-color-mode', th); s.setItem('vueuse-color-scheme', th) }, [USER, TENANT, THEME])
await page.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#__vue-devtools-container__,.vue-devtools__anchor{display:none!important}'; document.head.appendChild(st) }) })
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
await page.route(`${API}/**`, (route) => { const r = route.request(); if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); if (r.method() !== 'GET') return route.abort(); const u = new URL(r.url()); const hit = fixtures({ USER, PERMS: ['manage:all'] }, opts)(u.pathname, u.searchParams); return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(hit ?? []) }) })
const wait = (ms = 600) => page.waitForTimeout(ms)
const go = async (path, sel) => { await page.goto(BASE + path, { waitUntil: 'domcontentloaded' }); if (sel) await page.waitForSelector(sel, { timeout: 20000 }); await wait(1200) }
const shot = async (name, locator) => { const path = join(HERE, 'shots', `t8-${name}-${tag}-fixed.png`); try { if (locator) await locator.screenshot({ path, timeout: 5000 }); else await page.screenshot({ path }) } catch { await page.screenshot({ path }) } }
const check = async (key, fn) => { try { out.checks[key] = await fn() } catch (e) { out.checks[key] = { error: e.message.split('\n')[0].slice(0, 200) } } console.log(key, JSON.stringify(out.checks[key])) }
// Contrast of an element's text against its effective background (WCAG).
const contrastOf = (loc) => loc.evaluate((e) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
  const lum = ([r, g, bb]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bb) }
  let bg = null; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0.5) { bg = c; break } }
  bg ??= document.documentElement.classList.contains('dark') ? [0, 0, 0, 1] : [255, 255, 255, 1]
  const fg = rgba(getComputedStyle(e).color); const m = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]))
  const [x, y] = [lum(m), lum(bg)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2)
})
const placeholderContrast = (loc) => loc.evaluate((e) => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true })
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255] }
  const lum = ([r, g, bb]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bb) }
  let bg = null; for (let n = e; n; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0.5) { bg = c; break } }
  const s = getComputedStyle(e, '::placeholder'); const fg = rgba(s.color); const op = parseFloat(s.opacity || '1')
  const m = fg.slice(0, 3).map((v, i) => v * fg[3] * op + bg[i] * (1 - fg[3] * op))
  const [x, y] = [lum(m), lum(bg)].sort((p, q) => q - p); return { color: s.color, ratio: +((x + 0.05) / (y + 0.05)).toFixed(2) }
})
const overlap = (a, c) => a.right > c.left + 0.5 && c.right > a.left + 0.5 && a.bottom > c.top + 0.5 && c.bottom > a.top + 0.5

// D1 — route picker rows
await go('/pos/rutas-de-entrega', 'h1')
await page.getByRole('button', { name: 'Nueva ruta' }).first().click(); await page.waitForSelector('[data-testid=eligible-sales-picker-list] [role=option]'); await wait(800)
await check('D1 picker rows', () => page.$$eval('[data-testid=eligible-sales-picker-list] [role=option]', (os) => {
  const rs = os.map((o) => ({ client: o.clientHeight, content: o.scrollHeight, top: o.offsetTop, h: o.offsetHeight }))
  const squeezed = rs.filter((r) => r.content > r.client + 1).length
  const overlapping = rs.slice(1).filter((r, i) => r.top < rs[i].top + rs[i].h - 1).length
  return { rows: rs.length, squeezed, overlapping, heights: rs.map((r) => r.h) }
}))
await shot('routes-picker', page.getByTestId('eligible-sales-picker-list'))

// D2/D3/D4 — notifications
await go('/sistema/configuracion/notificaciones', '.hf-switch-row__button')
await check('D2 promociones band', async () => {
  const band = page.getByTestId('module-group-promotions').locator('.nc-mod__label')
  const r = await band.evaluate((l) => { const box = (q) => l.querySelector(q).getBoundingClientRect().toJSON(); const name = l.querySelector('.nc-mod__name'); return { name: box('.nc-mod__name'), all: box('.nc-mod__all'), nameClipped: name.scrollWidth > name.clientWidth + 1 } }).catch(async () => {
    const l = page.locator('.nc-mod__label', { hasText: 'Promociones' }); return l.evaluate((x) => { const box = (q) => x.querySelector(q).getBoundingClientRect().toJSON(); const name = x.querySelector('.nc-mod__name'); return { name: box('.nc-mod__name'), all: box('.nc-mod__all'), nameClipped: name.scrollWidth > name.clientWidth + 1 } })
  })
  return { overlap: overlap(r.name, r.all), nameClipped: r.nameClipped, allBelowName: r.all.top >= r.name.bottom - 1 }
})
await shot('notif-promos-band', page.locator('.nc-mod', { hasText: 'Promociones' }).first())
await page.getByRole('switch', { name: /Solicitud de validación/ }).click(); await wait()
await check('D4 save bar primary', () => page.locator('.hf-save-bar .hf-primary-control').last().evaluate((btn) => { const l = btn.querySelector('[data-slot=label]') || btn; return { text: btn.innerText.replace(/\n/g, ' '), truncated: l.scrollWidth > l.clientWidth + 1, ellipsis: getComputedStyle(l).textOverflow, height: Math.round(btn.getBoundingClientRect().height) } }))
await shot('notif-savebar-dirty', page.locator('.hf-save-bar').last())
opts.notifOff = true
await go('/sistema/configuracion/notificaciones', '.hf-switch-row__button')
await check('D3 paused notice', () => page.getByTestId('actions-paused').evaluate((n) => { const t = n.querySelector('.nc-notice__text').getBoundingClientRect(); const a = n.querySelector('.nc-notice__action')?.getBoundingClientRect(); return { textWidth: Math.round(t.width), noticeWidth: Math.round(n.getBoundingClientRect().width), linkBelowText: a ? a.top >= t.bottom - 1 : null } }))
await shot('notif-paused-notice', page.getByTestId('actions-paused'))
opts.notifOff = false

// D5/D10 — promotion form
await go('/pos/promociones/crear/PRODUCT_DISCOUNT', 'form, .hf-switch-row__button')
await check('D5 method radios', async () => {
  const radios = page.getByRole('radiogroup', { name: 'Cómo se aplica' }).getByRole('radio')
  const n = await radios.count(); const checked = await radios.evaluateAll((rs) => rs.map((r) => r.getAttribute('aria-checked')))
  const manual = radios.nth(1); await manual.hover(); await wait(200)
  const hover = await manual.evaluate((r) => { const card = r.closest('.hf-radio-card'); return { selectedAttr: card.dataset.selected, bg: getComputedStyle(card).backgroundColor } })
  const auto = await radios.nth(0).evaluate((r) => getComputedStyle(r.closest('.hf-radio-card')).backgroundColor)
  return { radios: n, checked, hoverLooksSelected: hover.bg === auto, hover }
})
await shot('promo-method-hover', page.getByRole('radiogroup', { name: 'Cómo se aplica' }))
for (const n of ['Limitar a ciertos clientes', 'Limitar a ciertas listas de precio']) { await page.getByRole('switch', { name: new RegExp(n) }).click({ timeout: 3000 }).catch(() => {}); await wait(300) }
await page.getByRole('option', { name: /Mayoreo/ }).first().click({ timeout: 3000 }).catch(() => {}); await wait(500)
await check('D5 scope segments', () => page.getByTestId('customer-scope').locator('[role=radio]').evaluateAll((rs) => rs.map((r) => ({ text: r.innerText, truncated: r.scrollWidth > r.clientWidth + 1 || [...r.querySelectorAll('*')].some((c) => c.scrollWidth > c.clientWidth + 1) }))))
await shot('promo-scope', page.getByTestId('customer-scope'))
await check('D5/D10 summary', async () => { const card = page.getByTestId('summary-card'); return { visible: await card.isVisible(), items: await card.locator('.promotions-summary-item').allInnerTexts() } })
await page.getByTestId('summary-card').scrollIntoViewIfNeeded(); await wait(200)
await shot('promo-summary', page.getByTestId('summary-card'))

// D6/D7/D10 — product
await go('/pos/products/p1', '.hf-switch-row__button')
await check('D7 margin contrast', async () => { const dd = page.locator('[data-summary=margin]').first(); return { text: await dd.innerText(), ratio: await contrastOf(dd) } })
await check('D10 supports-all note', async () => { const note = page.getByTestId('supports-all-note'); return (await note.count()) ? { text: await note.innerText(), rowsOn: await page.locator('[data-testid=context-toggle][aria-checked=true]').count() } : 'not rendered' })
await page.locator('[data-summary=margin]').first().scrollIntoViewIfNeeded().catch(() => {})
await shot('product-summary', page.locator('.product-summary-values').first())
await page.getByTestId('supports-all-note').scrollIntoViewIfNeeded().catch(() => {})
await shot('product-contexts', page.getByTestId('supported-contexts'))
await page.getByRole('button', { name: /^Presentaciones/ }).first().click().catch(() => page.getByText(/^Presentaciones$/).first().click()); await wait(900)
await page.getByRole('button', { name: /Acciones de la variante .*Pollo/ }).first().click(); await wait(400)
await page.getByRole('menuitem', { name: /Más datos/ }).click(); await wait(900)
await check('D6 modal title vs close', () => page.locator('[role=dialog] [data-slot=header]').evaluate((h) => { const t = h.querySelector('[data-slot=title]').getBoundingClientRect(); const c = h.querySelector('[data-slot=close]')?.getBoundingClientRect() ?? h.querySelector('button').getBoundingClientRect(); return { overlap: t.right > c.left + 0.5 && t.bottom > c.top && c.bottom > t.top, titleRight: Math.round(t.right), closeLeft: Math.round(c.left) } }))
await shot('variant-modal-header', page.locator('[role=dialog] [data-slot=header]'))
await page.keyboard.press('Escape'); await wait()

// D8 — employee personal
await go('/admin/colaboradores/e-1?tab=personal', 'h1')
await check('D8 birth date', async () => { const item = page.locator('.employees-dl__item', { hasText: 'Fecha de nacimiento' }); return (await item.count()) ? (await item.locator('dd').innerText()) : 'not rendered' })
await shot('employee-personal', page.locator('section.hf-section-card').first())

// D9 — customer slideover
await go('/pos/customers', 'h1')
await page.getByRole('button', { name: /^Crear cliente/ }).first().click(); await wait(1200)
await check('D9 placeholder contrast', () => placeholderContrast(page.getByRole('dialog').locator('input[placeholder]').first()))
await check('D9 tab panel focus', async () => {
  await page.keyboard.press('Tab')
  const panel = page.getByRole('dialog').locator('[role=tabpanel]').first()
  await panel.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await wait(150)
  return panel.evaluate((p) => { const s = getComputedStyle(p); return { focused: document.activeElement === p, focusVisible: p.matches(':focus-visible'), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, tabindex: p.getAttribute('tabindex') } })
})
await shot('customer-panel-focus')
writeFileSync(join(HERE, `results-t8-${tag}-fixed.json`), JSON.stringify(out, null, 1))
await b.close()
