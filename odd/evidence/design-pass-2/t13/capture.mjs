#!/usr/bin/env node
// T13: 409 EDITORIAL_STATE_UNREADABLE on /pos/products/:id/editorial (admin@ in global context).
// The seed products are repaired, so every scene produces the 409 with page.route; no write reaches the backend.
// Scenes: read (GET editorial), save (PUT draft), discard (POST draft/discard), initialize (GET rewritten to no draft,
// then POST draft/initialize) × 1440/390 × light/dark.
// The dev password is read from the backend seed at runtime, never printed or written. The product id comes from T6.
// Usage: node capture.mjs --scenes read,save,discard,initialize [--tag after] [--vp 1440,390] [--themes light,dark]
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
const PRODUCT = readFileSync(join(HERE, '../t6/.auth/product-id'), 'utf8').trim()
const PATH = `/pos/products/${PRODUCT}/editorial`

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 'after'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const settle = Number(opt('wait') ?? 1500)
const AUTH = join(HERE, '.auth', 'admin.json')
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }
const headers = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true',
  'cache-control': 'no-store', 'editorial-contract-version': '2' }
const at = (re) => (u) => u.origin === API && re.test(u.pathname)
const STATE = /\/products\/[^/]+\/editorial$/
const unreadable = (method) => (r) => r.request().method() === method
  ? r.fulfill({ status: 409, contentType: 'application/json', headers, body: JSON.stringify({ statusCode: 409, error: 'EDITORIAL_STATE_UNREADABLE' }) })
  : r.continue()
// The real read with its contract headers, the draft dropped: the «Empezar desde lo publicado» state.
const noDraft = async (r) => {
  if (r.request().method() !== 'GET') return r.continue()
  const response = await r.fetch()
  const body = await response.json()
  if (body?.state) body.state = { ...body.state, draft: null }
  return r.fulfill({ response, body: JSON.stringify(body) })
}
const scenes = {
  read: { routes: [[at(STATE), unreadable('GET')]] },
  data: {},
  save: {
    routes: [[at(/\/editorial\/draft$/), unreadable('PUT')]],
    act: async (p) => {
      const title = p.locator('#editorial-title')
      await title.fill(`${await title.inputValue()} `)
      await p.locator('form').first().evaluate((form) => form.requestSubmit())
    },
  },
  discard: {
    routes: [[at(/\/editorial\/draft\/discard$/), unreadable('POST')]],
    act: async (p) => {
      await p.getByTestId('discard-draft').click()
      await p.getByRole('dialog').getByRole('button', { name: 'Descartar borrador' }).click()
    },
  },
  initialize: {
    routes: [[at(STATE), noDraft], [at(/\/editorial\/draft\/initialize$/), unreadable('POST')]],
    act: async (p) => { await p.getByTestId('initialize').click() },
  },
}
const wanted = (opt('scenes') ?? 'read,save,discard,initialize').split(',')
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
    const writes = []
    page.on('request', (req) => { if (req.url().startsWith(API) && req.method() !== 'GET' && req.method() !== 'OPTIONS') writes.push(`${req.method()} ${pathOf(req.url()).replace(PRODUCT, ':id')}`) })
    let stateReads = 0
    page.on('request', (req) => { if (req.method() === 'GET' && STATE.test(pathOf(req.url()))) stateReads++ })
    for (const [re, fn] of scene.routes ?? []) await page.route(re, fn)
    await page.goto(`${BASE}${PATH}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(600)
    if (scene.act) { await scene.act(page); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(800) }
    await page.waitForTimeout(settle)
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
    const file = `${tag}__${name}__${vp}__${theme}.png`
    await page.screenshot({ path: join(SHOTS, file), fullPage: true })
    const ids = await page.evaluate(() => document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-|c[a-z0-9]{24}/g))
    const text = await page.evaluate(() => document.body.innerText)
    const retry = /Reintentar|Cargar la versión más reciente|Conservar mis cambios/.test(text)
    const said = (text.match(/No pudimos leer el contenido guardado de este producto\./g) ?? []).length
    console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}  message×${said}  retry=${retry}  stateReads=${stateReads}  writes=[${writes.join(', ')}]`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
    await ctx.close()
  }
}
await browser.close()
