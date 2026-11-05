// T5 harness helpers: login once through the real form (password read from the
// backend seed at runtime, never printed or written), reuse the session.
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
export const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const SEED = join(HERE, '../../../../../houndfe-backend/prisma/seed.ts')
const AUTH = join(HERE, '.auth')
const WHO = process.env.T5_USER ?? 'manager'
const STATE = join(AUTH, `state-${WHO}.json`)
export const SHOTS = join(HERE, 'shots')

export function pathOf(url) {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function devPassword() {
  const text = readFileSync(SEED, 'utf8')
  const found = text.match(new RegExp(`${WHO}:\\s*\\{[^}]*?password:\\s*'([^']+)'`, 's'))?.[1]
  if (!found) throw new Error('dev password not found in seed')
  return found
}

export async function open({ width = 1440, height = 900, theme = 'light' } = {}) {
  mkdirSync(AUTH, { recursive: true })
  mkdirSync(SHOTS, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const mk = (storageState) =>
    browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'es-MX', storageState })
  let ctx = await mk(existsSync(STATE) ? STATE : undefined)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/pos/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  if (pathOf(page.url()) !== '/pos/products') {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', WHO === 'superAdmin' ? 'admin@houndfe.com' : `${WHO}@houndfe.com`)
    await page.fill('#password', devPassword())
    await page.click('button[type=submit]')
    await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
    if (pathOf(page.url()) === '/select-tenant') {
      await page.getByText('Sucursal Centro', { exact: false }).first().click()
      await page.getByRole('button', { name: /continuar/i }).click()
      await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
    }
    await ctx.storageState({ path: STATE })
  }
  await ctx.addInitScript((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
  return { browser, ctx, page }
}
