#!/usr/bin/env node
// T10: round-2 low re-check, many screens with one browser and one page at a time.
// The dev password is read from the backend seed at runtime, never printed or written.
// Usage: node batch.mjs [--user admin] [--only name1,name2]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from '../t4/lib.mjs'
import { scenes } from './scenes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')
const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const user = opt('user') ?? 'admin'
const key = user === 'admin' ? 'superAdmin' : user
const only = opt('only')?.split(',')
const AUTH = join(HERE, '.auth', `${user}.json`)
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
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

const route = (kind) => async (r) => {
  if (r.request().method() !== 'GET') return r.continue()
  if (kind === 'error') return r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Error interno del servidor' }) })
  if (kind === 'empty') return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ page: 1, limit: 25, total: 0, items: [] }) })
  if (kind === '404') return r.fulfill({ status: 404, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 404, message: 'Not found' }) })
  await new Promise((res) => setTimeout(res, 20000))
  return r.abort().catch(() => {})
}

const ctx = await session()
for (const s of scenes) {
  if (only && !only.includes(s.name)) continue
  for (const vp of s.vp ?? [1440]) {
    for (const theme of s.themes ?? ['light']) {
      const page = await ctx.newPage()
      try {
        await page.setViewportSize(sizes[vp])
        await page.goto(`${BASE}/403`)
        await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
        if (s.pre) await s.pre(page)
        for (const [re, kind] of s.routes ?? []) await page.route((u) => u.origin === API && re.test(u.pathname + u.search), route(kind))
        if (s.path) await page.goto(`${BASE}${s.path}`)
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
        await page.waitForTimeout(s.wait ?? 800)
        if (s.act) { await s.act(page); await page.waitForTimeout(600) }
        for (const [re, kind] of s.late ?? []) { await page.route((u) => u.origin === API && re.test(u.pathname + u.search), route(kind)) }
        if (s.after) { await s.after(page); await page.waitForTimeout(800) }
        const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
        const probe = s.probe ? await page.evaluate(s.probe) : null
        if (s.full) await page.setViewportSize({ width: sizes[vp].width, height: s.full })
        await page.waitForTimeout(200)
        const file = `r2-${s.name}__${vp}__${theme}.png`
        await page.screenshot({ path: join(SHOTS, file) })
        console.log(`${file} url=${pathOf(page.url())}${overflow ? ' OVERFLOW' : ''}${probe !== null ? ` probe=${JSON.stringify(probe)}` : ''}`)
      } catch (e) {
        console.log(`${s.name} ${vp} ${theme}: FAILED ${String(e.message).slice(0, 160)}`)
      }
      await page.close()
    }
  }
}
await browser.close()
