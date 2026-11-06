#!/usr/bin/env node
// T2 resolve on dev data (L16): resolve the seeded 06600 validation from the UI as
// «Con cargo» $45.00, 3 días. One Chromium, one page. The dev password is read from
// the backend seed at runtime, never printed or written; ids never printed.
// The resolve click runs once; a failure stops the script (no retry).
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, login, password } from '../../design-pass-2/t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const AUTH = join(HERE, '.auth', 'manager.json')
const BASE = 'http://127.0.0.1:5173'
const API = 'http://127.0.0.1:3003'
const VALS = '/sistema/envios/validaciones'
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }
mkdirSync(SHOTS, { recursive: true })
mkdirSync(join(HERE, '.auth'), { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1'] })
let ctx = await browser.newContext({ ...(existsSync(AUTH) ? { storageState: AUTH } : {}), locale: 'es-MX', reducedMotion: 'reduce' })
const p = await ctx.newPage()
await p.setViewportSize({ width: 1440, height: 900 })

const net = []
p.on('response', async (r) => {
  const req = r.request()
  if (!r.url().startsWith(API) || req.method() === 'GET' || req.method() === 'OPTIONS') return
  if (pathOf(r.url()).startsWith('/auth/')) return net.push(`${req.method()} ${pathOf(r.url())} → ${r.status()} body=<redacted>`)
  const body = (req.postData() ?? '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<uuid>')
  net.push(`${req.method()} ${pathOf(r.url()).replace(/[0-9a-f-]{36}/g, '<id>')} → ${r.status()} body=${body}`)
})

async function theme(t) {
  await p.evaluate((v) => localStorage.setItem('vueuse-color-scheme', v), t)
}
async function shot(name, w = 1440, t = 'light') {
  await p.waitForTimeout(500)
  await p.screenshot({ path: join(SHOTS, `t2r__${name}__${w}__${t}.png`) })
  const text = await p.evaluate(() => document.body.innerText)
  const ids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-/g)
  const english = text.match(/\b(must|should|not found|Internal server|Unauthorized|Bad Request|resolved|pending)\b/gi)
  const overflow = await p.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
  console.log(`shot ${name} ${w} ${t}${overflow ? ' OVERFLOW' : ''}${ids ? ` IDS ${ids.length}` : ''}${english ? ` EN ${english.join(',')}` : ''}`)
}
const navText = async () => (await p.locator(`nav a[href="${VALS}"], aside a[href="${VALS}"]`).first().innerText().catch(() => '(no nav link)')).replace(/\s+/g, ' ').trim()
const rowZips = async () => (await p.locator('button.validation-zip').filter({ visible: true }).allInnerTexts()).map((s) => s.trim())

// Session
await p.goto(`${BASE}/403`)
await theme('light')
await p.goto(`${BASE}${VALS}`)
await p.waitForLoadState('networkidle').catch(() => {})
if (pathOf(p.url()) !== VALS) {
  await p.goto(`${BASE}/login`)
  await p.fill('#email', 'manager@houndfe.com')
  await p.fill('#password', password('manager'))
  await p.click('button[type=submit]')
  await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(p.url()) === '/select-tenant') {
    await p.getByText('Sucursal Centro').first().click()
    await p.getByRole('button', { name: /continuar/i }).click()
    await p.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  await ctx.storageState({ path: AUTH })
  await p.goto(`${BASE}${VALS}`)
  await p.waitForLoadState('networkidle').catch(() => {})
}

// 1) queue + nav count
console.log('1 path:', pathOf(p.url()), '| nav:', await navText(), '| rows:', (await rowZips()).join(','))
await shot('1-queue')

// 2) open 06600
await p.locator('button.validation-zip').filter({ visible: true, hasText: '06600' }).first().click()
const dialog = p.locator('[role=dialog]')
await dialog.waitFor({ timeout: 10000 })
await p.waitForLoadState('networkidle').catch(() => {})
console.log('2 drawer:', (await dialog.innerText()).replace(/\n+/g, ' | ').slice(0, 400))
await shot('2-drawer-pending')

// 3) fill and resolve once
await dialog.getByRole('radio', { name: 'Con cargo' }).click()
await p.locator('#resolve-surcharge').fill('45.00')
await p.locator('#resolve-surcharge').blur()
await p.locator('#resolve-eta').fill('3')
await p.locator('#resolve-eta').blur()
console.log('3 inputs:', await p.locator('#resolve-surcharge').inputValue(), '/', await p.locator('#resolve-eta').inputValue(), '| button:', (await p.getByTestId('resolve-submit').innerText()).trim())
await shot('3-drawer-filled')
const resp = p.waitForResponse((r) => r.url().startsWith(API) && /resolve|delivery-zone-validations/.test(r.url()) && r.request().method() !== 'GET' && r.request().method() !== 'OPTIONS', { timeout: 20000 }).catch(() => null)
await p.getByTestId('resolve-submit').click()
const r = await resp
console.log('3 response:', r ? r.status() : '(none)')
await p.waitForLoadState('networkidle').catch(() => {})
await p.waitForTimeout(800)
if (!r || r.status() >= 300) {
  console.log('STOP drawer:', (await dialog.innerText().catch(() => '')).replace(/\n+/g, ' | ').slice(0, 500))
  await shot('3-failed')
  console.log(net.join('\n'))
  await browser.close()
  process.exit(1)
}

// 4) resolved drawer + queue + nav
console.log('4 drawer:', (await dialog.innerText()).replace(/\n+/g, ' | ').slice(0, 500))
await shot('4-drawer-resolved')
const drawerUrl = p.url()
await p.setViewportSize({ width: 390, height: 844 })
await theme('dark')
await p.reload()
await p.waitForLoadState('networkidle').catch(() => {})
await p.waitForTimeout(800)
console.log('4 drawer 390 dark:', (await dialog.innerText().catch(() => '(no dialog)')).replace(/\n+/g, ' | ').slice(0, 300))
await shot('4-drawer-resolved', 390, 'dark')
await theme('light')
await p.setViewportSize({ width: 1440, height: 900 })
await p.goto(drawerUrl)
await p.waitForLoadState('networkidle').catch(() => {})
await p.keyboard.press('Escape')
await p.waitForTimeout(600)
await p.goto(`${BASE}${VALS}`)
await p.waitForLoadState('networkidle').catch(() => {})
console.log('4 queue rows:', (await rowZips()).join(',') || '(none)', '| nav:', await navText())
await shot('4-queue-after')

// 5) zones tab
await p.goto(`${BASE}/sistema/envios?tab=zonas`)
await p.waitForLoadState('networkidle').catch(() => {})
await p.getByPlaceholder('Buscar por código postal o colonia...').fill('06600')
await p.waitForTimeout(1200)
console.log('5 zone rows:', (await p.locator('tbody tr').filter({ visible: true }).allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim()).join(' || '))
await shot('5-zonas-06600')

// 6) read-only API check
const { token } = await login('manager@houndfe.com', 'manager')
const z = await call('GET', '/delivery-zones/06600', token)
console.log('6 zone:', JSON.stringify({ type: z.type, surchargeCents: z.surchargeCents, etaDays: z.etaDays, isActive: z.isActive, sourceValidation: Boolean(z.sourceValidationId) }))
const v = await call('GET', '/delivery-zone-validations?zipCode=06600', token)
console.log('6 ?zipCode=06600:', v.data.length, 'total', v.pagination?.totalCount)
console.log('network writes:\n' + net.join('\n'))
await browser.close()
