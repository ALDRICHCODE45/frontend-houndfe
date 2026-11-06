#!/usr/bin/env node
// T4: product and variant packaging in Presentaciones — data, empty, loading,
// error, validation and the variant modal × 1440/390 × light/dark. One
// Chromium, one page at a time. The dev password is read from the backend seed
// at runtime (shared lib), never printed or written.
// Usage: node capture.mjs [--scenes a,b] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, login, password } from '../../design-pass-2/t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth', 'manager.json')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')
const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }

// Seeded records, found by name (handoff §8).
const { token } = await login('manager@houndfe.com', 'manager')
async function productId(name) {
  const list = await call('GET', `/products?search=${encodeURIComponent(name)}&limit=5`, token)
  const found = list.find((p) => p.name === name)
  if (!found) throw new Error(`no product ${name}`)
  return found.id
}
const ids = {
  arnes: await productId('Arnés Acolchado para Paseo'),
  collar: await productId('Collar Ajustable de Nailon'),
  service: await productId('Baño y Corte Higiénico (Perro Mediano)'),
}

const PACKAGING = /\/products\/[^/]+\/packaging$/
const VARIANT_PACKAGING = /\/products\/[^/]+\/variants\/[^/]+\/packaging$/
const isApi = (re) => (u) => u.origin === API && re.test(u.pathname)
const mock = {
  error: (re) => ({ re, fn: (r) => (r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) }) : r.continue()) }),
  loading: (re) => ({ re, fn: async (r) => { if (r.request().method() !== 'GET') return r.continue(); await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) } }),
}

const presentations = async (p) => {
  await p.locator('[data-task="presentations"]:visible').first().click()
  await p.waitForTimeout(500)
  await p.getByTestId('product-variants-table').or(p.getByTestId('product-packaging-section')).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
}
const section = (p) => p.getByTestId('product-packaging-section')
const variantMenu = (label) => async (p) => {
  await presentations(p)
  await p.getByRole('button', { name: `Acciones de la variante ${label}` }).click()
  await p.waitForTimeout(300)
  await p.getByRole('menuitem', { name: 'Empaque' }).click()
  await p.waitForTimeout(800)
}

const scenes = {
  data: { id: 'arnes', act: presentations, target: section },
  empty: { id: 'collar', act: presentations, target: section },
  loading: { id: 'arnes', act: presentations, target: section, routes: [mock.loading(PACKAGING)], wait: 1200 },
  error: { id: 'arnes', act: presentations, target: section, routes: [mock.error(PACKAGING)] },
  // Out-of-range typed values: the form stops them, nothing is sent.
  invalid: {
    id: 'arnes',
    target: section,
    act: async (p) => {
      await presentations(p)
      await p.getByTestId('packaging-edit').click()
      await p.locator('#product-packaging-weight').fill('80')
      await p.locator('#product-packaging-length').fill('10.25')
      await p.locator('#product-packaging-height').fill('')
      await p.getByTestId('packaging-save').click()
      await p.waitForTimeout(300)
    },
  },
  service: { id: 'service', act: presentations },
  'variant-inherit': { id: 'arnes', act: variantMenu('Chico') },
  'variant-own': { id: 'arnes', act: variantMenu('Grande') },
  // Choosing «Empaque propio» shows the prefilled fields (not saved).
  'variant-choose-own': {
    id: 'arnes',
    act: async (p) => {
      await variantMenu('Chico')(p)
      await p.getByRole('radio', { name: /Empaque propio/ }).click()
      await p.waitForTimeout(300)
    },
  },
  'variant-none': { id: 'collar', act: async (p) => { await presentations(p); const b = p.getByRole('button', { name: /^Acciones de la variante/ }).first(); await b.click(); await p.waitForTimeout(300); await p.getByRole('menuitem', { name: 'Empaque' }).click(); await p.waitForTimeout(800) } },
  'variant-error': { id: 'arnes', act: variantMenu('Chico'), routes: [mock.error(VARIANT_PACKAGING)] },
}
const wanted = (opt('scenes') ?? Object.keys(scenes).join(',')).split(',')

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/pos/products`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = !['/login', '/select-tenant'].includes(pathOf(p.url()))
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
const productsPath = process.env.CAPTURE_PRODUCTS_PATH ?? '/pos/products'
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
      await page.goto(`${BASE}${productsPath}/${ids[scene.id]}`)
      // A hanging mock never lets the network go idle: wait for the page instead.
      if (scene.wait) await page.locator('input[name="name"]').waitFor({ timeout: 15000 }).catch(() => {})
      else await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(600)
      let note = ''
      try {
        if (scene.act) await scene.act(page)
        if (scene.wait) await page.waitForTimeout(scene.wait)
        else await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(400)
      } catch (error) {
        note = `  ACT FAILED ${String(error.message).split('\n')[0].slice(0, 140)}`
      }
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      const text = await page.evaluate(() => document.body.innerText)
      const uuids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/g)
      const english = text.match(/must |not found|Internal server|greater than/gi)
      const file = `t4__${name}__${vp}__${theme}.png`
      const target = scene.target?.(page)
      let shot = false
      if (target) {
        for (let attempt = 0; attempt < 3 && !shot; attempt++) {
          try {
            await target.waitFor({ state: 'visible', timeout: 10000 })
            await target.scrollIntoViewIfNeeded()
            await target.screenshot({ path: join(SHOTS, file) })
            shot = true
          } catch {
            await page.waitForTimeout(800)
          }
        }
        if (!shot) note += '  TARGET MISSING'
      }
      if (!shot) {
        await page.screenshot({ path: join(SHOTS, file) })
      }
      const hasSection = (await section(page).count()) > 0
      await page.close()
      console.log(`${file}${overflow ? '  OVERFLOW' : ''}${uuids ? `  IDS ${uuids.length}` : ''}${english ? `  EN ${english.join('|')}` : ''}  section=${hasSection}${note}`)
    }
  }
}
await browser.close()
