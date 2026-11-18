// node run.mjs [screen ...] — screens: envios validaciones solicitudes receipt zone perfil catalog chatbotcfg (default: all)
// Each screen × 1440/390 × light/dark against a Playwright-mocked API. Vite must be up on :5194 (see README).
// ONLY=390-dark limits to one viewport/theme; SUFFIX=x appends -x to shot names and the results file.
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
import { audit, focusCheck } from './lib.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT ?? '5194'
const BASE = `http://127.0.0.1:${PORT}`, API = 'http://127.0.0.1:3999'
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }
const PERMS = ['manage:all']
const ALL = ['envios', 'validaciones', 'solicitudes', 'receipt', 'zone', 'perfil', 'catalog', 'chatbotcfg']
const want = process.argv.slice(2).filter((a) => ALL.includes(a))
const screens = want.length ? want : ALL
const SUFFIX = process.env.SUFFIX ? `-${process.env.SUFFIX}` : ''
mkdirSync(join(HERE, 'shots'), { recursive: true })
const results = []

const wait = (page, ms = 600) => page.waitForTimeout(ms)
// Retries: another worker editing src/ makes Vite HMR reload the page (net::ERR_NETWORK_CHANGED, blank page).
const go = async (page, path, sel = 'h1') => {
  for (let i = 0; i < 3; i++) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
    if (sel) await page.waitForSelector(sel, { timeout: 20000 }).catch(() => {})
    await wait(page, 1500)
    if (!sel || (await page.locator('h1').count())) return
    page.__retries = (page.__retries ?? 0) + 1
  }
}
// mode is read by the route handler on every request, so set it before navigating.
const state = async (page, S, path, mode, name, sel) => { page.__opts.mode = mode; await go(page, path, sel); await S(name, { fullPage: true }) }
const SCREENS = {
  async envios(page, S) {
    await state(page, S, '/sistema/envios', 'loaded', 'loaded')
    await S.focus('focus', 1)
    await state(page, S, '/sistema/envios', 'empty', 'empty')
    await state(page, S, '/sistema/envios', 'error', 'error')
  },
  async validaciones(page, S) {
    await state(page, S, '/sistema/envios/validaciones', 'loaded', 'loaded')
    await S.focus('focus', 1)
    await state(page, S, '/sistema/envios/validaciones', 'empty', 'empty')
    await state(page, S, '/sistema/envios/validaciones', 'error', 'error')
  },
  async solicitudes(page, S) {
    await state(page, S, '/chatbot/solicitudes', 'loaded', 'loaded')
    await S.focus('focus', 1)
    await state(page, S, '/chatbot/solicitudes', 'empty', 'empty')
    await state(page, S, '/chatbot/solicitudes', 'error', 'error')
  },
  async receipt(page, S) {
    await state(page, S, '/chatbot/solicitudes/req-rcpt', 'loaded', 'loaded', '[data-testid=request-decision]')
    await S.focus('focus', 1)
    await state(page, S, '/chatbot/solicitudes/req-missing', 'error', 'not-found')
  },
  async zone(page, S) {
    await state(page, S, '/chatbot/solicitudes/req-zone', 'loaded', 'loaded', '[data-testid=request-decision]')
    await S.focus('focus', 1)
  },
  async perfil(page, S) {
    await state(page, S, '/perfil', 'loaded', 'loaded')
    await S.focus('focus', 1)
    await S.focus('switch-focus', 0, '[role=switch]')
    await state(page, S, '/perfil', 'error', 'error')
  },
  async catalog(page, S) {
    await state(page, S, '/catalogo/centro/p/p1', 'loaded', 'loaded')
    await S.focus('focus', 1)
    await state(page, S, '/catalogo/centro/p/p1', 'error', 'not-found')
  },
  async chatbotcfg(page, S) {
    await state(page, S, '/sistema/atencion-chatbot', 'loaded', 'loaded')
    await S.focus('focus', 1)
    await S.focus('switch-focus', 0, '[role=switch]')
    await state(page, S, '/sistema/atencion-chatbot', 'error', 'error')
  },
}
const PUBLIC = new Set(['catalog'])

const browser = await chromium.launch({ headless: true })
for (const W of [1440, 390]) for (const theme of ['light', 'dark']) {
  if (process.env.ONLY && process.env.ONLY !== `${W}-${theme}`) continue
  const ctx = await browser.newContext({ viewport: { width: W, height: W < 500 ? 844 : 900 }, reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  for (const name of screens) {
    const page = await ctx.newPage(); page.__opts = {}
    const log = { console: [], blocked: [], unmocked: [], external: [], failed: [] }
    page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /\[Vue warn\]/.test(m.text()))) log.console.push(`[${page.__opts.mode ?? 'loaded'}] ${m.type()}: ${m.text().slice(0, 240)}${m.location()?.url ? ' @' + m.location().url.replace(API, '') : ''}`) })
    page.on('pageerror', (e) => log.console.push(`[${page.__opts.mode ?? 'loaded'}] pageerror: ` + e.message.slice(0, 240)))
    page.on('request', (r) => { const u = r.url(); if (!/^(data|blob):/.test(u) && !u.startsWith(BASE) && !u.startsWith(API)) log.external.push(`${r.method()} ${u.slice(0, 160)}`) })
    page.on('requestfailed', (r) => { if (!r.url().startsWith(API)) log.failed.push(`${r.url().slice(0, 160)} ${r.failure()?.errorText}`) })
    await page.addInitScript(([u, t, p, th, pub]) => {
      const s = localStorage
      if (!pub) {
        s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r')
        s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', JSON.stringify(p)); s.setItem('hound.auth.currentTenant', JSON.stringify(t))
        s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false')
      }
      s.setItem('vueuse-color-mode', th); s.setItem('vueuse-color-scheme', th)
    }, [USER, TENANT, PERMS, theme, PUBLIC.has(name)])
    // Everything that is not the dev server or the mocked API is aborted (and logged as external above).
    await page.route((url) => !url.href.startsWith(BASE) && !url.href.startsWith(API) && !/^(data|blob):/.test(url.href), (route) => route.abort())
    const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-allow-credentials': 'true' }
    await page.route(`${API}/**`, async (route) => {
      const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method()
      if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
      if (m !== 'GET') { log.blocked.push(`${m} ${p}`); return route.abort() }
      const hit = fixtures({ USER, PERMS, API }, page.__opts)(p, u.searchParams)
      if (hit && hit.__svg) return route.fulfill({ status: 200, headers: cors, contentType: 'image/svg+xml', body: hit.__svg })
      if (hit && hit.__status) return route.fulfill({ status: hit.__status, headers: cors, contentType: 'application/json', body: JSON.stringify(hit.body) })
      if (hit !== undefined) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(hit) })
      log.unmocked.push(p)
      return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: 'unmocked', statusCode: 404 }) })
    })
    await page.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '#__vue-devtools-container__,.vue-devtools__anchor{display:none!important}'; document.head.appendChild(st) }) })
    const tag = `${name}-${W}-${theme}`
    const states = []
    const S = async (st, o = {}) => {
      const file = `${tag}-${st}${SUFFIX}.png`
      const vp = page.viewportSize()
      if (o.fullPage) {
        const tall = await page.evaluate(() => Math.max(...[...document.querySelectorAll('*')].filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 4).map((e) => e.scrollHeight - e.clientHeight), 0))
        if (tall > 0) { await page.setViewportSize({ width: vp.width, height: Math.min(vp.height + tall + 40, 7000) }); await wait(page, 400) }
      }
      await page.screenshot({ path: join(HERE, 'shots', file), fullPage: !!o.fullPage })
      const a = await audit(page)
      a.url = new URL(page.url()).pathname
      a.h1 = await page.locator('h1').first().innerText({ timeout: 500 }).catch(() => null)
      states.push({ state: st, file, ...a })
      if (o.fullPage) { await page.setViewportSize(vp); await wait(page, 200) }
    }
    S.focus = async (st, presses, sel) => { const f = await focusCheck(page, presses, sel); const file = `${tag}-${st}${SUFFIX}.png`; await page.screenshot({ path: join(HERE, 'shots', file) }); states.push({ state: st, file, focus: f }) }
    let error = null
    try { await SCREENS[name](page, S) } catch (e) { error = e.message.split('\n')[0].slice(0, 300); await page.screenshot({ path: join(HERE, 'shots', `${tag}-ERROR.png`) }).catch(() => {}) }
    results.push({ screen: name, W, theme, error, states, console: [...new Set(log.console)], blocked: [...new Set(log.blocked)], unmocked: [...new Set(log.unmocked)], external: [...new Set(log.external)], failed: [...new Set(log.failed)] })
    console.log(`${tag}: ${error ? 'ERROR ' + error : states.length + ' states'}`)
    await page.close()
  }
  await ctx.close()
}
await browser.close()
writeFileSync(join(HERE, `results-${screens.join('_')}${process.env.ONLY ? '-' + process.env.ONLY : ''}${SUFFIX}.json`), JSON.stringify(results, null, 1))
