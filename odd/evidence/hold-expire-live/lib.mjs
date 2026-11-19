// Live-check harness helpers. Login through the real form with the dev seed
// password (read at runtime, never printed or written). No storage state is
// written to disk. Network log keeps METHOD path -> status only.
import { chromium } from '@playwright/test'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { devPassword, HERE } from './api.mjs'

export { HERE }
export const BASE = 'http://127.0.0.1:5193'
export const API_ORIGIN = 'http://127.0.0.1:3003'
export const SHOTS = join(HERE, 'shots')
// The FE dev env points at localhost:3003 (observed); both spellings are the local DEV backend.
const API_ORIGINS = new Set(['http://127.0.0.1:3003', 'http://localhost:3003'])
const LOCAL = new Set(['http://127.0.0.1:5193', ...API_ORIGINS])

export function makeLog(name) {
  mkdirSync(SHOTS, { recursive: true })
  const file = join(HERE, `${name}.log`)
  writeFileSync(file, '')
  const line = (s) => {
    const clean = String(s).replace(/eyJ[\w.-]+/g, '<redacted>').replace(/bearer\s+\S+/gi, 'Bearer <redacted>')
    appendFileSync(file, clean + '\n')
    console.log(clean)
  }
  return line
}

export function instrument(page, log) {
  const foreign = new Set()
  page.on('response', (res) => {
    const req = res.request()
    let u
    try { u = new URL(req.url()) } catch { return }
    if (API_ORIGINS.has(u.origin)) log(`API ${req.method()} ${u.pathname}${u.search ? ' ?' + [...u.searchParams.keys()].join('&') : ''} -> ${res.status()}`)
    else if (!LOCAL.has(u.origin) && !u.protocol.startsWith('data') && !u.protocol.startsWith('blob')) foreign.add(u.origin)
  })
  page.on('requestfailed', (req) => {
    let u
    try { u = new URL(req.url()) } catch { return }
    if (!LOCAL.has(u.origin)) foreign.add(u.origin + ' (failed)')
    else if (API_ORIGINS.has(u.origin)) log(`API ${req.method()} ${u.pathname} -> FAILED ${req.failure()?.errorText}`)
  })
  page.on('console', (m) => { if (m.type() === 'error') log(`CONSOLE.error ${m.text().slice(0, 300)}`) })
  page.on('pageerror', (e) => log(`PAGEERROR ${String(e).slice(0, 300)}`))
  return foreign
}

export async function open(log, { width = 1440, height = 900, role = 'manager' } = {}) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City' })
  await ctx.addInitScript(() => localStorage.setItem('vueuse-color-scheme', 'light'))
  const page = await ctx.newPage()
  const foreign = instrument(page, log)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', `${role}@houndfe.com`)
  await page.fill('#password', devPassword(role))
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (new URL(page.url()).pathname === '/select-tenant') {
    await page.getByText('Sucursal Centro', { exact: false }).first().click()
    await page.getByRole('button', { name: /continuar/i }).click()
    await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  log(`logged in as ${role}, landed ${new URL(page.url()).pathname}`)
  return { browser, ctx, page, foreign }
}

export async function settle(page, ms = 600) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

export async function shot(page, name, log) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: false })
  log?.(`SHOT ${name}.png`)
}

// Mutation bodies: keys only, plus the values the check needs (never tokens).
export function logBodies(page, log, keep = ['expiresAt', 'expectedVersion', 'cashSessionId', 'method', 'amountCents']) {
  page.on('request', (req) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method())) return
    let u; try { u = new URL(req.url()) } catch { return }
    if (!u.port || u.port !== '3003' || u.pathname.startsWith('/auth')) return
    let body = null; try { body = req.postDataJSON() } catch {}
    const show = (o) => o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Array.isArray(v) ? v.map(show) : keep.includes(k) ? v : typeof v])) : o
    log(`BODY ${req.method()} ${u.pathname} ${JSON.stringify(show(body))} idem=${Boolean(req.headers()['idempotency-key'])}`)
  })
}
