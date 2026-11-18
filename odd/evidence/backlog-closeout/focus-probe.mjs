// node focus-probe.mjs <path> <W> <theme> <css-selector> — focuses the element by keyboard (Tab once for modality, then .focus()), prints its
// computed outline/border/box-shadow focused vs blurred, and saves a close-up shots/probe-<W>-<theme>-focus.png / -blur.png.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const [path, W = '390', theme = 'light', sel] = process.argv.slice(2)
const BASE = `http://127.0.0.1:${process.env.PORT ?? '5194'}`, API = 'http://127.0.0.1:3999'
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }, PERMS = ['manage:all']
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: +W, height: +W < 500 ? 844 : 900 }, reducedMotion: 'reduce', locale: 'es-MX' })
const page = await ctx.newPage()
await page.addInitScript(([u, t, p, th]) => { const s = localStorage; s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r'); s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', JSON.stringify(p)); s.setItem('hound.auth.currentTenant', JSON.stringify(t)); s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false'); s.setItem('vueuse-color-mode', th); s.setItem('vueuse-color-scheme', th) }, [USER, TENANT, PERMS, theme])
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
await page.route((u) => !u.href.startsWith(BASE) && !u.href.startsWith(API), (r) => r.abort())
await page.route(`${API}/**`, (route) => { const r = route.request(), u = new URL(r.url()); if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); if (r.method() !== 'GET') return route.abort()
  const h = fixtures({ USER, PERMS, API }, {})(u.pathname, u.searchParams); if (h?.__svg) return route.fulfill({ status: 200, headers: cors, contentType: 'image/svg+xml', body: h.__svg })
  return route.fulfill({ status: h === undefined ? 404 : 200, headers: cors, contentType: 'application/json', body: JSON.stringify(h ?? {}) }) })
await page.goto(BASE + path); await page.waitForSelector(sel, { timeout: 20000 }); await page.waitForTimeout(1200)
const read = () => page.evaluate((q) => { const e = document.querySelector(q); const s = getComputedStyle(e); return { focused: document.activeElement === e, fv: e.matches(':focus-visible'), outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} off=${s.outlineOffset}`, border: `${s.borderWidth} ${s.borderColor}`, shadow: s.boxShadow, cls: e.className } }, sel)
const box = await page.locator(sel).first().boundingBox(); const clip = { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height: box.height + 24 }
console.log('blur ', JSON.stringify(await read())); await page.screenshot({ path: join(HERE, 'shots', `probe-${W}-${theme}-blur.png`), clip })
await page.keyboard.press('Tab'); await page.locator(sel).first().focus(); await page.waitForTimeout(200)
console.log('focus', JSON.stringify(await read())); await page.screenshot({ path: join(HERE, 'shots', `probe-${W}-${theme}-focus.png`), clip })
await b.close()
