// node verify-picker.mjs <width> — measures EligibleSalesPicker option overflow, then injects the suggested CSS fix and re-measures.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fixtures } from './fixtures.mjs'
const HERE = dirname(fileURLToPath(import.meta.url))
const W = Number(process.argv[2] ?? 1440)
const BASE = 'http://127.0.0.1:5197', API = 'http://127.0.0.1:3999'
const USER = { id: 'u-1', email: 'audit@hound.test', name: 'Ana Auditora', isActive: true, createdAt: '2025-01-02T03:04:05.000Z' }
const TENANT = { id: 't-1', name: 'Tienda Centro', slug: 'centro' }
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: W, height: W < 500 ? 844 : 900 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' })
await page.addInitScript(([u, t]) => { const s = localStorage; s.setItem('hound.auth.accessToken', 'a'); s.setItem('hound.auth.refreshToken', 'r'); s.setItem('hound.auth.user', JSON.stringify(u)); s.setItem('hound.auth.permissionCodes', '["manage:all"]'); s.setItem('hound.auth.currentTenant', JSON.stringify(t)); s.setItem('hound.auth.memberships', JSON.stringify([t])); s.setItem('hound.auth.isSuperAdmin', 'false'); s.setItem('vueuse-color-mode', 'light') }, [USER, TENANT])
const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
await page.route(`${API}/**`, (route) => { const r = route.request(); if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors }); if (r.method() !== 'GET') return route.abort(); const u = new URL(r.url()); const hit = fixtures({ USER, PERMS: ['manage:all'] }, {})(u.pathname, u.searchParams); return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(hit ?? []) }) })
await page.goto(BASE + '/pos/rutas-de-entrega'); await page.waitForSelector('h1'); await page.waitForTimeout(1000)
await page.getByRole('button', { name: 'Nueva ruta' }).first().click(); await page.waitForSelector('[data-testid=eligible-sales-picker-list] [role=option]'); await page.waitForTimeout(800)
const measure = () => page.$$eval('[data-testid=eligible-sales-picker-list] [role=option]', (os) => os.map((o) => ({ client: o.clientHeight, content: o.scrollHeight })))
console.log('before', JSON.stringify(await measure()))
await page.addStyleTag({ content: '.eligible-sales-rows .hf-selectable-rows__list { grid-auto-rows: max-content; }' })
await page.waitForTimeout(300)
console.log('after grid-auto-rows:max-content', JSON.stringify(await measure()))
await page.getByTestId('eligible-sales-picker-list').screenshot({ path: join(HERE, 'shots', `routes-${W}-light-picker-FIX-PREVIEW.png`) })
await b.close()
