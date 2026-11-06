#!/usr/bin/env node
// T4: /pos/caja (and the shared custody cards on /pos/caja/recepciones) in
// real data, empty, loading and error × 1440/390 × light/dark.
// The dev password is read from the backend seed at runtime, never printed or written.
// Usage: node capture.mjs --scenes a,b [--tag before|after] [--user manager|cashier] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from './lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 'shot'
const user = opt('user') ?? 'manager'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', `${user}.json`)
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }

const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const page0 = { page: 1, limit: 25, total: 0, items: [] }
const isApi = (re) => (u) => u.origin === API && re.test(u.pathname)
const SESSIONS = /\/cash-sessions$/
const DETAIL = /\/cash-sessions\/[^/]+$/
const CUSTODY = /\/cash-handovers\/custody$/
const REGISTERS = /\/cash-registers$/

// Route mocks per state; `kind` picks the read that is replaced.
const mock = {
  empty: (re, body) => ({ re, fn: (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(body) }) }),
  error: (re) => ({ re, fn: (r) => r.request().method() === 'GET' ? r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Error interno del servidor' }) }) : r.continue() }),
  loading: (re) => ({ re, fn: async (r) => { if (r.request().method() !== 'GET') return r.continue(); await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) } }),
}

const task = (id) => async (p) => {
  await p.getByTestId(`cash-workspace-task-${id}`).click()
  await p.waitForTimeout(500)
}
// Select a session by its row in Sesiones (nth row with the given status label), then a task.
const pick = (status, taskId, nth = 0) => async (p) => {
  await task('historial')(p)
  const rows = p.locator('[data-testid^="cash-session-status-"]', { hasText: status })
  await rows.nth(nth).click()
  await p.waitForLoadState('networkidle').catch(() => {})
  await p.waitForTimeout(500)
  if (taskId) await task(taskId)(p)
}

const scenes = {
  apertura: { path: '/pos/caja' },
  'apertura-register': { path: '/pos/caja', act: async (p) => { await p.locator('[data-testid^="cash-register-select-"]').first().click().catch(() => {}); await p.waitForTimeout(400) } },
  sesiones: { path: '/pos/caja', act: task('historial') },
  'open-mov': { path: '/pos/caja', act: pick('Abierta', 'movimientos') },
  'open-conteo': { path: '/pos/caja', act: pick('Abierta', 'conteo') },
  'open-custodia': { path: '/pos/caja', act: pick('Abierta', 'custodia') },
  'submitted-verif': { path: '/pos/caja', act: pick('Declarada', 'verificacion') },
  'submitted-custodia': { path: '/pos/caja', act: pick('Declarada', 'custodia') },
  'submitted-notas': { path: '/pos/caja', act: pick('Declarada', 'notas') },
  'closed-mov': { path: '/pos/caja', act: pick('Cerrada', 'movimientos') },
  recepcion: { path: '/pos/caja', act: task('recepcion') },
  recepciones: { path: '/pos/caja/recepciones' },
  // A different amount without a note: the card's own validation stops it, nothing is sent.
  'recepciones-mismatch': { path: '/pos/caja/recepciones', act: async (p) => {
    await p.locator('[data-testid^="cash-custody-received-input-"]').first().fill('290')
    await p.locator('[data-testid^="cash-custody-receive-"]').first().click()
    await p.waitForTimeout(300)
  } },
  'recepciones-differs': { path: '/pos/caja/recepciones', act: async (p) => {
    await p.locator('[data-testid^="cash-custody-received-input-"]').first().fill('290')
    await p.waitForTimeout(300)
  } },
  'sesiones-empty': { path: '/pos/caja', act: task('historial'), routes: [mock.empty(SESSIONS, page0)] },
  'sesiones-loading': { path: '/pos/caja', act: task('historial'), routes: [mock.loading(SESSIONS)], wait: 1200 },
  'sesiones-error': { path: '/pos/caja', act: task('historial'), routes: [mock.error(SESSIONS)] },
  'apertura-empty': { path: '/pos/caja', routes: [mock.empty(REGISTERS, { items: [] })] },
  'apertura-loading': { path: '/pos/caja', routes: [mock.loading(REGISTERS)], wait: 1200 },
  'apertura-error': { path: '/pos/caja', routes: [mock.error(REGISTERS)] },
  'detail-loading': { path: '/pos/caja', act: pick('Abierta', 'movimientos'), routes: [mock.loading(DETAIL)], wait: 1200, late: true },
  'detail-error': { path: '/pos/caja', act: pick('Abierta', 'movimientos'), routes: [mock.error(DETAIL)], late: true },
  'recepcion-empty': { path: '/pos/caja', act: task('recepcion'), routes: [mock.empty(CUSTODY, { pendingHandovers: page0, eligibleFloat: page0 })] },
  'recepcion-loading': { path: '/pos/caja', act: task('recepcion'), routes: [mock.loading(CUSTODY)], wait: 1200 },
  'recepcion-error': { path: '/pos/caja', act: task('recepcion'), routes: [mock.error(CUSTODY)] },
  'recepciones-empty': { path: '/pos/caja/recepciones', routes: [mock.empty(CUSTODY, { pendingHandovers: page0, eligibleFloat: page0 })] },
  'recepciones-loading': { path: '/pos/caja/recepciones', routes: [mock.loading(CUSTODY)], wait: 1200 },
  'recepciones-error': { path: '/pos/caja/recepciones', routes: [mock.error(CUSTODY)] },
}
const wanted = (opt('scenes') ?? 'apertura,sesiones').split(',')

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
