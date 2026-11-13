// T9 harness: logs in through the real form (password read from the BE seed at runtime, never printed or stored).
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
export const HERE = dirname(fileURLToPath(import.meta.url))
export const BASE = 'http://127.0.0.1:5199'
export const SHOTS = join(HERE, 'shots')
mkdirSync(SHOTS, { recursive: true })
const SEED = join(HERE, '../../../../houndfe-backend/prisma/seed.ts')
const pw = () => readFileSync(SEED, 'utf8').match(/manager:\s*\{[^}]*?password:\s*'([^']+)'/s)?.[1]
export async function open({ width = 1440, height = 900 } = {}) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce', locale: 'es-MX' })
  const page = await ctx.newPage()
  const log = { console: [], requests: [], failed: [] }
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 300)}`) })
  page.on('pageerror', (e) => log.console.push('pageerror: ' + e.message.slice(0, 300)))
  page.on('request', (r) => { if (r.url().includes(':3003')) log.requests.push(`${r.method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`) })
  page.on('response', (r) => { if (r.url().includes(':3003') && r.status() >= 400) log.failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`) })
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('#email', 'manager@houndfe.com')
  await page.fill('#password', pw())
  await page.click('button[type=submit]')
  await page.waitForURL((u) => u.pathname !== '/login', { timeout: 30000, waitUntil: 'commit' })
  if (new URL(page.url()).pathname === '/select-tenant') {
    await page.getByText('Sucursal Centro', { exact: false }).first().click()
    await page.getByRole('button', { name: /continuar/i }).click()
    await page.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000, waitUntil: 'commit' })
  }
  return { browser, ctx, page, log }
}
export const shot = (page, name, full = false) => page.screenshot({ path: join(SHOTS, name + '.png'), fullPage: full })
