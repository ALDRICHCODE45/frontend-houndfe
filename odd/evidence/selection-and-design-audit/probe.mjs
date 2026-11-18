// node probe.mjs <path> — discovery helper: loads one route with an empty-ish API and prints the GETs it makes.
import { chromium } from '@playwright/test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://127.0.0.1:5197', API = 'http://127.0.0.1:3999'
const path = process.argv[2]
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }
const PERMS = ['manage:all']
const log = { console: [], unmocked: [], blocked: [] }
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' })
const page = await ctx.newPage()
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) log.console.push(`${m.type()}: ${m.text().slice(0, 400)}`) })
page.on('pageerror', (e) => log.console.push('pageerror: ' + e.message.slice(0, 400)))
await page.addInitScript(([u, t, p]) => {
  const s = localStorage; s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r')
  s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', JSON.stringify(p)); s.setItem('hound.auth.currentTenant', JSON.stringify(t))
  s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false'); s.setItem('vueuse-color-mode', 'light')
}, [USER, TENANT, PERMS])
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-allow-credentials': 'true' }
await page.route(`${API}/**`, async (route) => {
  const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method()
  if (m === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (m !== 'GET') { log.blocked.push(`${m} ${p}`); return route.abort() }
  const hit = fixtures({ USER, PERMS }, {})(p, u.searchParams)
  if (hit !== undefined) return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(hit) })
  log.unmocked.push(`${p}${u.search}`)
  return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([]) })
})
await page.goto(BASE + path, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)
await page.screenshot({ path: join(HERE, 'shots', '_probe.png'), fullPage: false })
console.log('URL', page.url())
console.log('TEXT', (await page.locator('main, body').first().innerText()).replace(/\n+/g, ' | ').slice(0, 1500))
console.log('unmocked', JSON.stringify([...new Set(log.unmocked)]))
console.log('console', JSON.stringify(log.console, null, 1).slice(0, 4000))
await browser.close()
