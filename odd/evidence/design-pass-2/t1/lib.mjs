// Shared helpers for the T1 (Reembolsos) evidence scripts. The dev password is read from
// the backend seed at runtime and never printed or written; the session lives in .auth/.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
export const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const SEED = join(HERE, '../../../../../houndfe-backend/prisma/seed.ts')
const AUTH = join(HERE, '.auth')
const STATE_FILE = join(AUTH, 'state-manager.json')
mkdirSync(AUTH, { recursive: true })

function devPassword() {
  const text = readFileSync(SEED, 'utf8')
  const pw = text.match(/manager:\s*\{[^}]*?password:\s*'([^']+)'/s)?.[1]
  if (!pw) throw new Error('manager dev password not found in seed')
  return pw
}

/** Path of a URL, '' when it does not parse. */
export function pathOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

export async function launch() {
  const browser = await chromium.launch({ headless: true })
  const newCtx = (storageState) =>
    browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'es-MX', storageState })
  let ctx = await newCtx(existsSync(STATE_FILE) ? STATE_FILE : undefined)
  const page = await ctx.newPage()
  // Learn the bearer token from the app's own requests.
  let token = null
  page.on('request', (req) => {
    const h = req.headers().authorization
    if (req.url().startsWith(API) && h?.startsWith('Bearer ')) token = h
  })
  await page.goto(`${BASE}/pos/reembolsos`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  if (pathOf(page.url()) !== '/pos/reembolsos') {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', 'manager@houndfe.com')
    await page.fill('#password', devPassword())
    await page.click('button[type=submit]')
    await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
    if (pathOf(page.url()) === '/select-tenant') {
      await page.getByText('Sucursal Centro', { exact: false }).first().click()
      await page.getByRole('button', { name: /continuar/i }).click()
      await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await ctx.storageState({ path: STATE_FILE })
    await page.goto(`${BASE}/pos/reembolsos`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  }
  const api = async (method, path, body) => {
    const res = await page.request.fetch(`${API}${path}`, {
      method,
      headers: { authorization: token, 'content-type': 'application/json' },
      data: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = text }
    return { status: res.status(), json }
  }
  return { browser, ctx, page, api, token: () => token }
}
