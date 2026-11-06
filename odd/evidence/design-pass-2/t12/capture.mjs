#!/usr/bin/env node
// T12: cash display fields (handoff 09) on /pos/caja (Sesiones, the selected
// turn card) and the shared custody cards (/pos/caja/recepciones), with real
// data plus a null-fields mock, × 1440/390 × light/dark.
// The dev password is read from the backend seed at runtime, never printed or written.
// Usage: node capture.mjs --scenes a,b [--tag t12] [--user manager|cashier] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from '../t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 't12'
const user = opt('user') ?? 'manager'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', `${user}.json`)
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

const isApi = (re) => (u) => u.origin === API && re.test(u.pathname)
const SESSIONS = /\/cash-sessions$/
const CUSTODY = /\/cash-handovers\/custody$/

// Real responses with every display field blanked: the screen must show nothing.
const NULL_KEYS = ['openedAt', 'closedAt', 'cashierDisplayName', 'senderDisplayName', 'sourceRegisterName', 'notes']
const blank = (item) => Object.fromEntries(Object.entries(item).map(([k, v]) => [k, NULL_KEYS.includes(k) ? null : v]))
const nullify = (re, shape) => ({
  re,
  fn: async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const res = await route.fetch()
    const body = shape(await res.json())
    return route.fulfill({ response: res, body: JSON.stringify(body) })
  },
})
const nullSessions = nullify(SESSIONS, (b) => ({ ...b, items: b.items.map(blank) }))
const nullCustody = nullify(CUSTODY, (b) => ({
  pendingHandovers: { ...b.pendingHandovers, items: b.pendingHandovers.items.map(blank) },
  eligibleFloat: { ...b.eligibleFloat, items: b.eligibleFloat.items.map(blank) },
}))

const task = (id) => async (p) => {
  await p.getByTestId(`cash-workspace-task-${id}`).click()
  await p.waitForTimeout(500)
}
const pick = (status, nth = 0) => async (p) => {
  await task('historial')(p)
  await p.locator('[data-testid^="cash-session-status-"]', { hasText: status }).nth(nth).click()
  await p.waitForLoadState('networkidle').catch(() => {})
  await p.waitForTimeout(500)
}

const scenes = {
  sesiones: { path: '/pos/caja', act: task('historial') },
  'sesiones-null': { path: '/pos/caja', act: task('historial'), routes: [nullSessions] },
  'closed-turn': { path: '/pos/caja', act: pick('Cerrada') },
  'open-turn': { path: '/pos/caja', act: pick('Abierta') },
  recepciones: { path: '/pos/caja/recepciones' },
  'recepciones-null': { path: '/pos/caja/recepciones', routes: [nullCustody] },
  recepcion: { path: '/pos/caja', act: task('recepcion') },
}
const wanted = (opt('scenes') ?? 'sesiones').split(',')

const pathOf = (url) => {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1'] })

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/pos/caja`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = pathOf(p.url()) === '/pos/caja'
    await p.close()
    if (ok) return ctx
    await ctx.close()
  }
  const ctx = await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`)
  await p.fill('#email', `${user}@houndfe.com`)
  await p.fill('#password', password(user))
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
  if (!scene) {
    console.log(`unknown scene ${name}`)
    continue
  }
  for (const theme of themes) {
    for (const vp of vps) {
      const page = await ctx.newPage()
      await page.setViewportSize(sizes[vp])
      await page.goto(`${BASE}/403`)
      await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
      for (const r of scene.routes ?? []) await page.route(isApi(r.re), r.fn)
      await page.goto(`${BASE}${scene.path}`)
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(500)
      try {
        if (scene.act) await scene.act(page)
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(500)
      } catch (error) {
        console.log(`${name}: act failed ${String(error.message).slice(0, 160)}`)
      }
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      const text = await page.evaluate(() => document.querySelector('main')?.innerText ?? '')
      const ids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-|c[a-z0-9]{24}/g)
      const file = `${tag}__${name}__${vp}__${theme}.png`
      await page.setViewportSize({ width: sizes[vp].width, height: Number(opt('h') ?? 1800) })
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(SHOTS, file) })
      await page.close()
      console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}`)
    }
  }
}
await browser.close()
