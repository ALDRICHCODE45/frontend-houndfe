#!/usr/bin/env node
// T10: one screen at a time for the shared requests and the round-2 low re-check.
// The dev password is read from the backend seed at runtime, never printed or written.
// Usage: node shot.mjs --path /pos/caja --name caja [--user manager] [--vp 1440,390]
//   [--themes light,dark] [--act "<async (p) => {...}>"] [--probe "<() => value>"] [--h 1800]
//   [--route "<regex>:<error|empty|loading>"] [--nofull]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from '../t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const user = opt('user') ?? 'manager'
const key = opt('key') ?? (user === 'admin' ? 'superAdmin' : user)
const path = opt('path') ?? '/'
const name = opt('name') ?? 'shot'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const act = opt('act') ? eval(opt('act')) : null
const probe = opt('probe')
const AUTH = join(HERE, '.auth', `${user}.json`)
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const routes = (opt('route') ?? '').split(',').filter(Boolean).map((r) => {
  const i = r.lastIndexOf(':')
  return { re: new RegExp(r.slice(0, i)), kind: r.slice(i + 1) }
})

const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }
mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}/pos/products`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = !['/login', '/select-tenant'].includes(pathOf(p.url()))
    await p.close()
    if (ok) return ctx
    await ctx.close()
  }
  const ctx = await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`)
  await p.fill('#email', `${user}@houndfe.com`)
  await p.fill('#password', password(key))
  await p.click('button[type=submit]')
  await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(p.url()) === '/select-tenant') {
    await p.getByText('Sucursal Centro').first().click()
    await p.getByRole('button', { name: /continuar/i }).click()
    await p.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  await p.close()
  await ctx.storageState({ path: AUTH })
  return ctx
}

const ctx = opt('anon') ? await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce' }) : await session()
for (const theme of themes) {
  for (const vp of vps) {
    const page = await ctx.newPage()
    await page.setViewportSize(sizes[vp])
    await page.goto(`${BASE}/403`)
    await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
    for (const { re, kind } of routes) {
      await page.route((u) => u.origin === API && re.test(u.pathname + u.search), async (r) => {
        if (r.request().method() !== 'GET') return r.continue()
        if (kind === 'error') return r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Error interno del servidor' }) })
        if (kind === 'empty') return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ page: 1, limit: 25, total: 0, items: [] }) })
        await new Promise((res) => setTimeout(res, 20000))
        return r.abort().catch(() => {})
      })
    }
    await page.goto(`${BASE}${path}`)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    await page.waitForTimeout(700)
    try { if (act) { await act(page); await page.waitForTimeout(500) } } catch (e) { console.log(`act failed ${String(e.message).slice(0, 200)}`) }
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
    if (probe) console.log(`${vp} ${theme} probe:`, JSON.stringify(await page.evaluate(eval(probe))))
    const file = `${name}__${vp}__${theme}.png`
    if (!opt('nofull')) await page.setViewportSize({ width: sizes[vp].width, height: Number(opt('h') ?? 1600) })
    await page.waitForTimeout(300)
    await page.screenshot({ path: join(SHOTS, file) })
    console.log(`${file} url=${pathOf(page.url())}${overflow ? '  OVERFLOW' : ''}`)
    await page.close()
  }
}
await browser.close()
