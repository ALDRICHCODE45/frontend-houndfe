#!/usr/bin/env node
// T3: /pos/caja/recepciones in data/empty/loading/error × 1440/390 × light/dark.
// Same approach as odd/evidence/system-redesign/capture.mjs; the dev password is
// read from the backend seed at runtime and never printed or written.
// Usage: node capture.mjs [--states data,empty] [--tag before|after]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth-state.json')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const SEED = join(HERE, '../../../../../houndfe-backend/prisma/seed.ts')
const PATH = '/pos/caja/recepciones'
const CUSTODY = /\/cash-handovers\/custody$/

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const states = (opt('states') ?? 'data,empty,loading,error').split(',')
const tag = opt('tag') ?? 'shot'
const viewports = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

function password() {
  const text = readFileSync(SEED, 'utf8')
  const found = text.match(/manager:\s*\{[^}]*?password:\s*'([^']+)'/s)?.[1]
  if (!found) throw new Error('manager password not found')
  return found
}

/** Path of a URL, '' when it does not parse. */
function pathOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}
const ORIGIN = BASE.replace(/\/+$/, '')

mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true })

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
  await p.fill('#email', 'manager@houndfe.com')
  await p.fill('#password', password())
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
const page = await ctx.newPage()
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const emptyBody = { pendingHandovers: { items: [], page: 1, limit: 25, total: 0 }, eligibleFloat: { items: [], page: 1, limit: 25, total: 0 } }

for (const state of states) {
  for (const theme of ['light', 'dark']) {
    for (const [vp, size] of Object.entries(viewports)) {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      if (state !== 'data') {
        await page.route((u) => u.origin === API && CUSTODY.test(u.pathname), async (r) => {
          if (state === 'empty') return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(emptyBody) })
          if (state === 'error') return r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Error interno del servidor' }) })
          await new Promise((res) => setTimeout(res, 20000))
          return r.abort().catch(() => {})
        })
      }
      await page.setViewportSize(size)
      await page.goto(`${BASE}/403`)
      await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
      await page.goto(`${BASE}${PATH}`)
      if (state === 'loading') await page.waitForTimeout(1500)
      else {
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(600)
      }
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      const file = `${tag}__${state}__${vp}__${theme}.png`
      await page.screenshot({ path: join(SHOTS, file), fullPage: true })
      if (state === 'data') {
        // The shell scrolls inside its own container: a tall viewport shows the whole page.
        await page.setViewportSize({ width: size.width, height: 2200 })
        await page.waitForTimeout(400)
        await page.screenshot({ path: join(SHOTS, file.replace('.png', '__full.png')) })
      }
      console.log(`${file}${overflow ? '  OVERFLOW' : ''}`)
    }
  }
}
await browser.close()
