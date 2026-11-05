#!/usr/bin/env node
// T8: delivery routes as a pure driver (list and detail cockpit) in real data,
// empty, loading and error × 1440/390 × light/dark.
// The driver password lives only in the git-ignored .auth/, never printed.
// Usage: node capture.mjs --scenes a,b [--tag before|after] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call } from '../t4/lib.mjs'
import { DRIVER, driverPassword, driverToken } from './lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 'shot'
const user = 'driver'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', `${user}.json`)
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const isApi = (re) => (u) => u.origin === API && re.test(u.pathname)
// Route mocks per state; `re` picks the read that is replaced.
const mock = {
  empty: (re, body) => ({ re, fn: (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) }) }),
  error: (re) => ({ re, fn: (r) => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Error interno del servidor' }) }) : r.continue() }),
  loading: (re) => ({ re, fn: async (r) => { if (r.request().method() !== 'GET') return r.continue(); await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) } }),
}
const LIST = /^\/delivery-routes$/
const DETAIL = /^\/delivery-routes\/[^/]+$/
const PATH = '/pos/rutas-de-entrega'
// The driver's active route, read once (its id stays in the URL only).
const routes = await call('GET', '/delivery-routes?status=ACTIVE', await driverToken())
const DPATH = `${PATH}/${routes[0]?.id}`
const firstCard = async (p) => { await p.locator('[data-testid^="driver-stop-card-details"]').first().click(); await p.waitForTimeout(700) }

const scenes = {
  list: { path: PATH },
  'list-empty': { path: PATH, routes: [mock.empty(LIST, [])] },
  'list-loading': { path: PATH, routes: [mock.loading(LIST)], wait: 1200 },
  'list-error': { path: PATH, routes: [mock.error(LIST)] },
  detail: { path: DPATH },
  'detail-stop': { path: DPATH, act: firstCard },
  'detail-history': { path: DPATH, act: async (p) => { await p.getByTestId('cockpit-recent-history').click(); await p.waitForTimeout(700) } },
  'detail-loading': { path: DPATH, routes: [mock.loading(DETAIL)], wait: 1200 },
  'detail-error': { path: DPATH, routes: [mock.error(DETAIL)] },
  'detail-notfound': { path: `${PATH}/00000000-0000-4000-8000-000000000000` },
}
const wanted = (opt('scenes') ?? 'data').split(',')

function pathOf(url) {
  try { return new URL(url).pathname } catch { return '' }
}

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const launch = () => chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })
let browser = await launch()

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}${PATH}`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = pathOf(p.url()) === PATH
    await p.close()
    if (ok) return ctx
    await ctx.close()
  }
  const ctx = await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`)
  await p.fill('#email', DRIVER.email)
  await p.fill('#password', driverPassword())
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
      // List reads start with the page; the detail read starts on selection, so
      // its mock goes in after the first load (`late`).
      if (!scene.late) for (const r of scene.routes ?? []) await page.route(isApi(r.re), r.fn)
      await page.goto(`${BASE}${scene.path}`)
      if (!scene.wait) await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(500)
      if (scene.late) for (const r of scene.routes ?? []) await page.route(isApi(r.re), r.fn)
      try {
        if (scene.act) await scene.act(page)
        if (scene.wait) await page.waitForTimeout(scene.wait)
        else await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(500)
      } catch (error) {
        console.log(`${name}: act failed ${String(error.message).slice(0, 160)}`)
      }
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      const file = `${tag}__${name}__${vp}__${theme}.png`
      await page.setViewportSize({ width: sizes[vp].width, height: Number(opt('h') ?? 1800) })
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(SHOTS, file) })
      const ids = await page.evaluate(() => (document.querySelector('main')?.innerText ?? '').match(/[0-9a-f]{8}-[0-9a-f]{4}-|c[a-z0-9]{24}/g))
      await page.close()
      console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}`)
}
for (const name of wanted) {
  const scene = scenes[name]
  if (!scene) { console.log(`unknown scene ${name}`); continue }
  for (const theme of themes) {
    for (const vp of vps) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await shoot(name, scene, theme, vp)
          break
        } catch (error) {
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
