// node verify-date-placeholder.mjs [light|dark] — measures the «dd/mm/aaaa» placeholder segments of the closed-date UInputDate on
// /sistema/atencion-chatbot, then injects the suggested CSS and re-measures. Writes shots/defect-chatbotcfg-date-placeholder-{before,after}-<theme>.png.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
const HERE = dirname(fileURLToPath(import.meta.url)); const theme = process.argv[2] ?? 'light'
const BASE = `http://127.0.0.1:${process.env.PORT ?? '5194'}`, API = 'http://127.0.0.1:3999'
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }, PERMS = ['manage:all']
const FIX = '.chatbot-settings .cbs-date-input [data-placeholder] { color: var(--hf-muted); }'
const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'es-MX' })).newPage()
await page.addInitScript(([u, t, p, th]) => { const s = localStorage; s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r'); s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', JSON.stringify(p)); s.setItem('hound.auth.currentTenant', JSON.stringify(t)); s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false'); s.setItem('vueuse-color-mode', th); s.setItem('vueuse-color-scheme', th) }, [USER, TENANT, PERMS, theme])
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
await page.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith(API), (r) => r.abort())
await page.route(`${API}/**`, (route) => { const r = route.request(), u = new URL(r.url()); if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); if (r.method() !== 'GET') return route.abort()
  const h = fixtures({ USER, PERMS, API }, {})(u.pathname, u.searchParams); return route.fulfill({ status: h === undefined ? 404 : 200, headers: cors, contentType: 'application/json', body: JSON.stringify(h ?? {}) }) })
await page.goto(BASE + '/sistema/atencion-chatbot'); await page.waitForSelector('[data-testid=date-input]', { timeout: 20000 }); await page.waitForTimeout(1000)
const measure = () => page.evaluate(() => {
  const cv = document.createElement('canvas').getContext('2d'); const rgb = (c) => { cv.fillStyle = '#000'; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); return [...cv.getImageData(0, 0, 1, 1).data].slice(0, 3) }
  const L = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const bg = (e) => { for (let n = e; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (!/rgba\(.*, 0\)|transparent/.test(c)) return rgb(c) } return [255, 255, 255] }
  return [...document.querySelectorAll('[data-testid=date-input] [data-placeholder]')].map((e) => { const a = L(rgb(getComputedStyle(e).color)), z = L(bg(e)); return `${e.textContent}:${getComputedStyle(e).color}:${((Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05)).toFixed(2)}` })
})
const shot = (n) => page.locator('[data-testid=date-input]').screenshot({ path: join(HERE, 'shots', `defect-chatbotcfg-date-placeholder-${n}-${theme}.png`) })
console.log('before', JSON.stringify(await measure())); await shot('before')
await page.addStyleTag({ content: FIX }); await page.waitForTimeout(200)
console.log('after ', JSON.stringify(await measure())); await shot('after')
await b.close()
