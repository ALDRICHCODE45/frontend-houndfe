// Live-check harness (adapted from hold-expire-live). Login through the real form with
// the dev seed password (read at runtime, never printed or written). No storage state on disk.
import { chromium } from '@playwright/test'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { devPassword, EMAIL, HERE } from './api.mjs'

export { HERE }
export const BASE = 'http://127.0.0.1:5195'
export const SHOTS = join(HERE, 'shots')
const API_ORIGINS = new Set(['http://127.0.0.1:3003', 'http://localhost:3003'])
const LOCAL = new Set([BASE, ...API_ORIGINS])

export function makeLog(name) {
  mkdirSync(SHOTS, { recursive: true })
  const file = join(HERE, `${name}.log`)
  writeFileSync(file, '')
  return (s) => {
    const clean = String(s).replace(/eyJ[\w.-]+/g, '<redacted>').replace(/bearer\s+\S+/gi, 'Bearer <redacted>')
    appendFileSync(file, clean + '\n'); console.log(clean)
  }
}

export function instrument(page, log, tag) {
  const issues = []
  page.on('response', (res) => {
    const req = res.request(); let u
    try { u = new URL(req.url()) } catch { return }
    if (API_ORIGINS.has(u.origin)) {
      const line = `API[${tag}] ${req.method()} ${u.pathname}${u.search ? ' ?' + [...new Set(u.searchParams.keys())].join('&') : ''} -> ${res.status()}`
      log(line); if (res.status() >= 400) issues.push(line)
    } else if (LOCAL.has(u.origin) && res.status() >= 400) { const l = `HTTP[${tag}] ${u.pathname} -> ${res.status()}`; log(l); issues.push(l) }
  })
  page.on('requestfailed', (req) => {
    let u; try { u = new URL(req.url()) } catch { return }
    if (u.protocol === 'blob:' || u.protocol === 'data:') return
    const l = `FAILED[${tag}] ${req.method()} ${u.origin}${u.pathname} ${req.failure()?.errorText}`; log(l); issues.push(l)
  })
  page.on('console', (m) => { if (m.type() === 'error') { const l = `CONSOLE.error[${tag}] ${m.text().slice(0, 300)}`; log(l); issues.push(l) } })
  page.on('pageerror', (e) => { const l = `PAGEERROR[${tag}] ${String(e).slice(0, 300)}`; log(l); issues.push(l) })
  return issues
}

export async function open(log, { width = 1440, height = 900, role = 'cashier', theme = 'light', browser } = {}) {
  const b = browser ?? await chromium.launch({ headless: true })
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City', acceptDownloads: true })
  await ctx.addInitScript((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
  const page = await ctx.newPage()
  const issues = instrument(page, log, `${role}-${width}-${theme}`)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', EMAIL[role])
  await page.fill('#password', devPassword(role))
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (new URL(page.url()).pathname === '/select-tenant') {
    await page.getByText('Sucursal Centro', { exact: false }).first().click()
    await page.getByRole('button', { name: /continuar/i }).click()
    await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  log(`logged in as ${role} (${width} ${theme}), landed ${new URL(page.url()).pathname}`)
  return { browser: b, ctx, page, issues }
}

export async function settle(page, ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(ms)
}

export async function shot(page, name, log, fullPage = false) {
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage })
  log?.(`SHOT shots/${name}.png`)
}

export async function overflow(page) {
  return page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
}

export function logBodies(page, log, keep = ['amountCents', 'openingCents', 'kind', 'declaredCents', 'method', 'countedCents', 'status']) {
  page.on('request', (req) => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method())) return
    let u; try { u = new URL(req.url()) } catch { return }
    if (u.port !== '3003' || u.pathname.startsWith('/auth')) return
    let body = null; try { body = req.postDataJSON() } catch {}
    const show = (o) => o && typeof o === 'object' ? (Array.isArray(o) ? o.map(show) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' ? show(v) : keep.includes(k) ? v : typeof v]))) : o
    log(`BODY ${req.method()} ${u.pathname} ${JSON.stringify(show(body))}`)
  })
}
