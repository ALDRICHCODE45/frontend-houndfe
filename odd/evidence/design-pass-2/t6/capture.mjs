#!/usr/bin/env node
// T6: /pos/products/:id/editorial header and shell with data (admin@ in global
// context), plus a missing product, a failed read and loading × 1440/390 × light/dark.
// selection × 1440/390 × light/dark. admin@ is a super admin without a tenant, so
// the guard sends it here with its three branches (switch-tenant flow).
// The dev password is read from the backend seed at runtime, never printed or written.
// Usage: node capture.mjs --scenes a,b [--tag before|after] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from '../t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')
const PRODUCT = readFileSync(join(HERE, '.auth', 'product-id'), 'utf8').trim()
const PATH = `/pos/products/${PRODUCT}/editorial`
const MISSING = '/pos/products/00000000-0000-4000-8000-000000000000/editorial'

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 'shot'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', 'admin.json')
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const EDITORIAL = (u) => u.origin === API && /\/products\/[^/]+\/editorial$/.test(u.pathname)
const PRODUCT_READ = (u) => u.origin === API && /\/products\/[^/]+$/.test(u.pathname)
const fail = (r) => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) }) : r.continue()
const hang = async (r) => { if (r.request().method() !== 'GET') return r.continue(); await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) }
const scenes = {
  data: { path: PATH },
  missing: { path: MISSING },
  error: { path: PATH, routes: [[EDITORIAL, fail]] },
  'name-error': { path: PATH, routes: [[PRODUCT_READ, fail]] },
  loading: { path: PATH, routes: [[EDITORIAL, hang], [PRODUCT_READ, hang]], noIdle: true },
}
const wanted = (opt('scenes') ?? 'data').split(',')
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })

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
  await p.fill('#email', 'admin@houndfe.com')
  await p.fill('#password', password('superAdmin'))
  await p.click('button[type=submit]')
  await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  await p.goto(`${BASE}${PATH}`)
  await p.waitForLoadState('networkidle').catch(() => {})
  if (pathOf(p.url()) !== PATH) throw new Error(`admin landed on ${pathOf(p.url())}`)
  await p.close()
  await ctx.storageState({ path: AUTH })
  return ctx
}

await (await session()).close()
for (const name of wanted) {
  const scene = scenes[name]
  if (!scene) { console.log(`unknown scene ${name}`); continue }
  for (const theme of themes) for (const vp of vps) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.setViewportSize(sizes[vp])
    await page.goto(`${BASE}/403`)
    await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
    for (const [re, fn] of scene.routes ?? []) await page.route(re, fn)
    await page.goto(`${BASE}${scene.path}`)
    if (!scene.noIdle) await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(scene.noIdle ? 1500 : 600)
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
    const file = `${tag}__${name}__${vp}__${theme}.png`
    await page.screenshot({ path: join(SHOTS, file), fullPage: true })
    const ids = await page.evaluate(() => document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-|c[a-z0-9]{24}/g))
    console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}  url=${pathOf(page.url()).replace(PRODUCT, ':id')}`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
    await ctx.close()
  }
}
await browser.close()
