#!/usr/bin/env node
// T3: /sistema/envios Cajas, Origen, Horario in real data, empty, loading and
// error × 1440/390 × light/dark. The dev password is read from the backend seed
// at runtime (design-pass-2 lib.mjs), never printed or written.
// Usage: node capture.mjs --scenes a,b [--tag shot] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from '../../design-pass-2/t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')
const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 'shot'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', 'manager.json')
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const isApi = (re) => (u) => u.origin === API && re.test(u.pathname)
const BOXES = /\/shipping-boxes$/
const ORIGIN_RE = /\/shipping-origin$/
const HOURS = /\/opening-hours$/
const json = (body) => (r) => r.request().method() === 'GET'
  ? r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) })
  : r.continue()
const mock = {
  empty: (re, body) => ({ re, fn: json(body) }),
  error: (re) => ({ re, fn: (r) => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) }) : r.continue() }),
  loading: (re) => ({ re, fn: async (r) => { if (r.request().method() !== 'GET') return r.continue(); await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) } }),
}
const tab = (key) => `/sistema/envios?tab=${key}`
const click = (selector) => async (p) => { await p.locator(selector).first().click(); await p.waitForTimeout(600) }

const scenes = {
  cajas: { path: tab('cajas') },
  'cajas-empty': { path: tab('cajas'), routes: [mock.empty(BOXES, { data: [] })] },
  'cajas-loading': { path: tab('cajas'), routes: [mock.loading(BOXES)], wait: 1200 },
  'cajas-error': { path: tab('cajas'), routes: [mock.error(BOXES)] },
  'cajas-form': { path: tab('cajas'), act: click('[data-testid="create-box"]') },
  'cajas-form-invalid': { path: tab('cajas'), act: async (p) => {
    await click('[data-testid="create-box"]')(p)
    await p.fill('input[name="length"]', '10.25')
    await p.fill('input[name="weightKg"]', '0')
    await p.locator('[data-testid="box-form"] button[type="submit"]').click()
    await p.waitForTimeout(400)
  } },
  cajas_menu: { path: tab('cajas'), act: click('button[aria-label="Acciones de Caja chica"]') },
  'cajas-delete': { path: tab('cajas'), act: async (p) => {
    await click('button[aria-label="Acciones de Caja chica"]')(p)
    await p.getByRole('menuitem', { name: 'Eliminar…' }).click()
    await p.waitForTimeout(600)
  } },
  origen: { path: tab('origen') },
  'origen-empty': { path: tab('origen'), routes: [mock.empty(ORIGIN_RE, { configured: false, origin: null })] },
  'origen-loading': { path: tab('origen'), routes: [mock.loading(ORIGIN_RE)], wait: 1200 },
  'origen-error': { path: tab('origen'), routes: [mock.error(ORIGIN_RE)] },
  'origen-invalid': { path: tab('origen'), act: async (p) => {
    await p.fill('input[name="postalCode"]', '031')
    await p.fill('input[name="contactPhone"]', '12345')
    await p.getByRole('button', { name: 'Guardar', exact: true }).click()
    await p.waitForTimeout(400)
  } },
  horario: { path: tab('horario') },
  'horario-empty': { path: tab('horario'), routes: [mock.empty(HOURS, { configured: false, openingHours: null })] },
  'horario-loading': { path: tab('horario'), routes: [mock.loading(HOURS)], wait: 1200 },
  'horario-error': { path: tab('horario'), routes: [mock.error(HOURS)] },
  'horario-overlap': { path: tab('horario'), act: async (p) => {
    await p.fill('input[name="MONDAY-1-open"]', '14:00')
    await p.getByRole('button', { name: 'Guardar', exact: true }).click()
    await p.waitForTimeout(400)
  } },
}
const wanted = (opt('scenes') ?? 'cajas').split(',')
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}${tab('cajas')}`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = pathOf(p.url()) === '/sistema/envios'
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

const ctx = await session()
for (const name of wanted) {
  const scene = scenes[name]
  if (!scene) { console.log(`unknown scene ${name}`); continue }
  for (const theme of themes) {
    for (const vp of vps) {
      const page = await ctx.newPage()
      await page.setViewportSize(sizes[vp])
      await page.goto(`${BASE}/403`)
      await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
      for (const r of scene.routes ?? []) await page.route(isApi(r.re), r.fn)
      await page.goto(`${BASE}${scene.path}`)
      if (!scene.wait) await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(500)
      try {
        if (scene.act) await scene.act(page)
        if (scene.wait) await page.waitForTimeout(scene.wait)
      } catch (error) {
        console.log(`${name}: act failed ${String(error.message).slice(0, 160)}`)
      }
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      const text = await page.evaluate(() => document.body.innerText)
      const ids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-/g)
      const english = text.match(/must|not found|Internal server|Bad Request/gi)
      const file = `${tag}__${name}__${vp}__${theme}.png`
      await page.screenshot({ path: join(SHOTS, file), fullPage: true })
      await page.close()
      console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}${english ? `  EN ${english.join(',')}` : ''}`)
    }
  }
}
await ctx.close()
await browser.close()
