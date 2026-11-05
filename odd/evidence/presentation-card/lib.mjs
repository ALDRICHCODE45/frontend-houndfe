// Shared harness for the presentation card check (T10, S13). Login as admin through the real form; the
// dev password is read from the backend seed at runtime and is never printed or written.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth')
export const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
export const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3000'
const SEED = process.env.CAPTURE_SEED ?? join(HERE, '../../../../houndfe-backend/prisma/seed.ts')
const EMAIL = 'admin@houndfe.com'
const TENANT = 'Sucursal Centro'
const STATE_FILE = join(AUTH, 'state-admin.json')
mkdirSync(SHOTS, { recursive: true })
mkdirSync(AUTH, { recursive: true })

function devPassword() {
  const re = /superAdmin:\s*\{[^}]*?password:\s*'([^']+)'/s
  const pw = existsSync(SEED) ? readFileSync(SEED, 'utf8').match(re)?.[1] : undefined
  if (!pw) throw new Error('admin dev password not found in the backend seed')
  return pw
}
export const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }

export async function open(report) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'es-MX', storageState: existsSync(STATE_FILE) ? STATE_FILE : undefined })
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300)) })
  page.on('pageerror', (e) => report.consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`))
  // Any native dialog is a defect for this screen (S13: no native alerts); it is recorded and dismissed.
  page.on('dialog', async (d) => { report.nativeDialogs.push(`${d.type()}: ${d.message()}`); await d.dismiss() })
  let token = ''
  // The app may call the API as localhost or 127.0.0.1: match it by port.
  const portOf = (url) => { try { return new URL(url).port } catch { return null } }
  const apiPort = portOf(API)
  page.on('request', (r) => { const a = r.headers()['authorization']; if (a && portOf(r.url()) === apiPort) token = a })
  async function login() {
    // A stale stored session redirects /login away before the form shows: start from a clean session.
    await ctx.clearCookies()
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', EMAIL)
    await page.fill('#password', devPassword())
    await page.click('button[type=submit]')
    await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
    if (pathOf(page.url()) === '/select-tenant') {
      await page.getByText(TENANT, { exact: false }).first().click()
      await page.getByRole('button', { name: /continuar/i }).click()
      await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await ctx.storageState({ path: STATE_FILE })
  }
  async function productId(name) {
    const find = async () => {
      await page.goto(`${BASE}/pos/products`, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
      if (pathOf(page.url()) === '/login') throw new Error('logged out')
      const res = await fetch(`${API}/products?search=${encodeURIComponent(name.split(' ').slice(0, 2).join(' '))}&limit=50`, { headers: { authorization: token } })
      const body = await res.json()
      const list = Array.isArray(body) ? body : (body.data ?? body.items ?? [])
      const hit = list.find((p) => p.name === name)
      if (!hit) throw new Error(`product not found: ${name} (${res.status}, ${list.map((p) => p.name).join(' | ')})`)
      return hit
    }
    try { return await find() } catch (e) { if (!/logged out|401/.test(String(e)) && token) throw e; await login(); return find() }
  }
  async function api(path) {
    const res = await fetch(`${API}${path}`, { headers: { authorization: token } })
    return { status: res.status, body: await res.json().catch(() => null) }
  }
  return { browser, ctx, page, productId, api }
}

/** Opens the Contenido task of a product and waits for the editor. */
export async function openContent(page, id) {
  await page.goto(`${BASE}/pos/products/${id}`, { waitUntil: 'domcontentloaded' })
  await page.locator('.product-task-button[data-task="content"]').waitFor({ timeout: 20000 })
  await page.locator('.product-task-button[data-task="content"]').click()
  await page.locator('.editorial-workspace').waitFor({ timeout: 20000 })
  await page.waitForFunction(() => !document.querySelector('[data-testid="editorial-skeleton"]'), null, { timeout: 20000 }).catch(() => {})
  await page.addStyleTag({ content: '#vue-devtools-anchor, .vue-devtools__anchor { display: none !important }' })
  await page.waitForTimeout(500)
}

/** The product page scrolls inside its own container; scrollIntoView would also move the app shell. */
export const scrollInPage = (page, selector, offset = 8) => page.evaluate(([sel, off]) => {
  const target = document.querySelector(sel)
  const box = document.querySelector('.product-workspace > .overflow-y-auto')
  if (target && box) box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top - off
}, [selector, offset])

export const setTheme = (page, theme) => page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
