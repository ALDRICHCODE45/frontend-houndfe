import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
export const HERE = dirname(fileURLToPath(import.meta.url))
export const BASE = 'http://127.0.0.1:5199'
export const URL0 = `${BASE}/catalogo/centro`
export const SHOTS = join(HERE, 'shots')
mkdirSync(SHOTS, { recursive: true })
export async function open(width, height) {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width, height }, locale: 'es-MX', reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text().slice(0, 300)}`) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`))
  page.on('requestfailed', (r) => errors.push(`reqfailed: ${r.url()} ${r.failure()?.errorText}`))
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`) })
  return { browser, page, errors }
}
export async function load(page, url = URL0) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.catalog-animal', { timeout: 20000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(400)
}
export const shot = (page, name, opts = {}) => page.screenshot({ path: join(SHOTS, name), ...opts })
