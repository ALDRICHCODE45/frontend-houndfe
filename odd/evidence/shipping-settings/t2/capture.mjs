#!/usr/bin/env node
// T2: Zonas tab and Validaciones de zona in real data, empty, loading and error
// × 1440/390 × light/dark. The dev password is read from the backend seed at
// runtime, never printed or written. Read-only unless a scene says otherwise.
// Usage: node capture.mjs --scenes a,b [--tag t2] [--vp 1440,390] [--themes light,dark] [--h 1400]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, login, password } from '../../design-pass-2/t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')
const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 't2'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', 'manager.json')
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const empty = { data: [], pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 } }
const isApi = (re) => (u) => u.origin === API && re.test(u.pathname)
const ZONES = /^\/delivery-zones$/
const VALS = /^\/delivery-zone-validations$/
const VAL = /^\/delivery-zone-validations\/[^/]+$/
const mock = {
  empty: (re, body) => ({ re, fn: (r) => r.request().method() === 'OPTIONS' ? r.continue() : r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) }) }),
  error: (re) => ({ re, fn: (r) => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) }) : r.continue() }),
  loading: (re) => ({ re, fn: async (r) => { if (r.request().method() !== 'GET') return r.continue(); await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) } }),
}

// Ids are looked up at runtime and only go into URLs, never into output.
const { token } = await login('manager@houndfe.com', 'manager')
const pendingList = await call('GET', '/delivery-zone-validations', token)
const byZip = (zip) => pendingList.data.find((v) => v.zipCode === zip)?.id
const zone11000 = (await call('GET', '/delivery-zones/11000', token)).sourceValidationId

const zonas = '/sistema/envios?tab=zonas'
const vals = '/sistema/envios/validaciones'
const scenes = {
  zonas: { path: zonas },
  'zonas-empty': { path: zonas, routes: [mock.empty(ZONES, empty)] },
  'zonas-loading': { path: zonas, routes: [mock.loading(ZONES)], wait: 1200 },
  'zonas-error': { path: zonas, routes: [mock.error(ZONES)] },
  'zonas-nomatch': { path: zonas, act: async (p) => { await p.getByPlaceholder('Buscar por código postal o colonia...').fill('99999'); await p.waitForTimeout(900) } },
  'zonas-form': { path: zonas, act: async (p) => { await p.getByTestId('zone-create').click(); await p.waitForTimeout(400); await p.getByRole('radio', { name: 'Con cargo' }).click(); await p.waitForTimeout(300) } },
  'zonas-form-errors': { path: zonas, act: async (p) => { await p.getByTestId('zone-create').click(); await p.waitForTimeout(400); await p.getByRole('radio', { name: 'Con cargo' }).click(); await p.locator('#zone-zip').fill('067'); await p.getByTestId('zone-submit').click(); await p.waitForTimeout(300) } },
  'zonas-deactivate': { path: zonas, act: async (p) => { await p.locator('button[aria-haspopup="menu"]').filter({ visible: true }).nth(1).click(); await p.waitForTimeout(300); await p.getByRole('menuitem', { name: /Desactivar/ }).click(); await p.waitForTimeout(400) } },
  vals: { path: vals },
  'vals-empty': { path: vals, routes: [mock.empty(VALS, empty)] },
  'vals-loading': { path: vals, routes: [mock.loading(VALS)], wait: 1200 },
  'vals-error': { path: vals, routes: [mock.error(VALS)] },
  'vals-drawer': { path: `${vals}?validation=${byZip('06600')}` },
  'vals-drawer-critical': { path: `${vals}?validation=${byZip('03900')}`, act: async (p) => { await p.getByRole('radio', { name: 'Con cargo' }).click(); await p.getByTestId('resolve-submit').click(); await p.waitForTimeout(300) } },
  'vals-drawer-resolved': { path: `${vals}?validation=${zone11000}` },
  'vals-drawer-error': { path: `${vals}?validation=${byZip('06600')}`, routes: [mock.error(VAL)] },
  'vals-zip-none': { path: `${vals}?zipCode=11000` },
}
const wanted = (opt('scenes') ?? 'zonas,vals').split(',')
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const launch = () => chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })
let browser = await launch()

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}${vals}`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = pathOf(p.url()) === vals
    await p.close()
    if (ok) return ctx
    await ctx.close()
  }
  const ctx = await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`)
  await p.fill('#email', 'manager@houndfe.com')
  await p.fill('#password', password('manager'))
  await p.click('button[type=submit]')
  await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(p.url()) === '/select-tenant') {
    await p.getByText('Sucursal Centro').first().click()
    await p.getByRole('button', { name: /continuar/i }).click()
    await p.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  await p.close()
  await ctx.storageState({ path: AUTH })
  return ctx
}

let ctx = await session()
async function shoot(name, scene, theme, vp) {
  const page = await ctx.newPage()
  await page.setViewportSize(sizes[vp])
  await page.goto(`${BASE}/403`)
  await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
  for (const r of scene.routes ?? []) await page.route(isApi(r.re), r.fn)
  await page.goto(`${BASE}${scene.path}`)
  if (!scene.wait) await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(600)
  try {
    if (scene.act) await scene.act(page)
    if (scene.wait) await page.waitForTimeout(scene.wait)
    else await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(400)
  } catch (error) {
    console.log(`${name}: act failed ${String(error.message).slice(0, 160)}`)
  }
  const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
  const file = `${tag}__${name}__${vp}__${theme}.png`
  await page.setViewportSize({ width: sizes[vp].width, height: Number(opt('h') ?? 1100) })
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(SHOTS, file) })
  const text = await page.evaluate(() => document.body.innerText)
  const ids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-/g)
  const english = text.match(/\b(must|should|not found|Internal server|Unauthorized|Bad Request)\b/gi)
  await page.close()
  console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}${english ? `  EN ${english.join(',')}` : ''}`)
}
for (const name of wanted) {
  const scene = scenes[name]
  if (!scene) { console.log(`unknown scene ${name}`); continue }
  for (const theme of themes) {
    for (const vp of vps) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { await shoot(name, scene, theme, vp); break } catch (error) {
          console.log(`${name} ${vp} ${theme}: attempt ${attempt} failed ${String(error.message).slice(0, 80)}`)
          await ctx.close().catch(() => {})
          if (!browser.isConnected()) browser = await launch()
          await new Promise((res) => setTimeout(res, 2000))
          ctx = await session()
        }
      }
    }
  }
}
await browser.close()
