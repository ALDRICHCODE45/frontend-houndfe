#!/usr/bin/env node
// T9: /select-tenant with several branches, one, none, submitting and a failed
// selection × 1440/390 × light/dark. admin@ is a super admin without a tenant, so
// the guard sends it here with its three branches (switch-tenant flow).
// The dev password is read from the backend seed at runtime, never printed or written.
// Usage: node capture.mjs --scenes a,b [--tag before|after] [--vp 1440,390] [--themes light,dark]
import { chromium } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { password } from '../t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const ORIGIN = BASE.replace(/\/+$/, '')
const PATH = '/select-tenant'
const MEMBERSHIPS = 'hound.auth.memberships'

const argv = process.argv.slice(2)
const opt = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)
const tag = opt('tag') ?? 'shot'
const vps = (opt('vp') ?? '1440,390').split(',')
const themes = (opt('themes') ?? 'light,dark').split(',')
const AUTH = join(HERE, '.auth', 'admin.json')
const sizes = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } }
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
const SWITCH = (u) => u.origin === API && /\/auth\/(switch|select)-tenant$/.test(u.pathname)

const pick = (name) => async (p) => { await p.getByText(name, { exact: true }).first().click(); await p.waitForTimeout(200) }
const cont = async (p) => { await p.getByTestId('tenant-continue').click() }
const scenes = {
  data: {},
  selected: { act: pick('Sucursal Centro') },
  nomatch: { act: async (p) => { await p.getByLabel('Buscar sucursal').fill('zzz'); await p.waitForTimeout(300) } },
  single: { memberships: (list) => list.filter((t) => t.name === 'Sucursal Centro') },
  empty: { memberships: () => [] },
  // Nothing is switched: the exchange hangs, then is aborted after the shot.
  loading: { route: async (r) => { await new Promise((res) => setTimeout(res, 20000)); return r.abort().catch(() => {}) }, act: async (p) => { await pick('Sucursal Centro')(p); await cont(p); await p.waitForTimeout(800) }, noIdle: true },
  error: { route: (r) => r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }) }), act: async (p) => { await pick('Sucursal Centro')(p); await cont(p); await p.waitForTimeout(800) } },
  'error-net': { route: (r) => r.abort('failed'), act: async (p) => { await pick('Sucursal Centro')(p); await cont(p); await p.waitForTimeout(800) } },
}
const wanted = (opt('scenes') ?? 'data').split(',')
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }

mkdirSync(join(HERE, '.auth'), { recursive: true })
mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1', '--js-flags=--max-old-space-size=512'] })

async function session() {
  if (existsSync(AUTH)) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const p = await ctx.newPage()
    await p.goto(`${BASE}${PATH}`)
    await p.waitForLoadState('networkidle').catch(() => {})
    const ok = pathOf(p.url()) === PATH
    await p.close()
    if (ok) return ctx
    await ctx.close()
  }
  const ctx = await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`)
  await p.fill('#email', 'admin@houndfe.com')
  await p.fill('#password', password('superAdmin'))
  await p.click('button[type=submit]')
  await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  await p.goto(`${BASE}${PATH}`)
  await p.waitForLoadState('networkidle').catch(() => {})
  if (pathOf(p.url()) !== PATH) throw new Error(`admin landed on ${p.url()}`)
  await p.close()
  await ctx.storageState({ path: AUTH })
  return ctx
}

// A failed exchange clears the session in its context, so every shot gets a
// fresh context from the saved admin session.
await (await session()).close()
function readStored() {
  try {
    const state = JSON.parse(readFileSync(AUTH, 'utf8'))
    const raw = state.origins.find((o) => o.origin === ORIGIN)?.localStorage.find((e) => e.name === MEMBERSHIPS)?.value
    return JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
}
const stored = readStored()
for (const name of wanted) {
  const scene = scenes[name]
  if (!scene) { console.log(`unknown scene ${name}`); continue }
  for (const theme of themes) for (const vp of vps) {
    const ctx = await browser.newContext({ storageState: AUTH, locale: 'es-MX', reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.setViewportSize(sizes[vp])
    await page.goto(`${BASE}/403`)
    await page.evaluate(([t, key, list]) => { localStorage.setItem('vueuse-color-scheme', t); localStorage.setItem(key, JSON.stringify(list)) }, [theme, MEMBERSHIPS, scene.memberships ? scene.memberships(stored) : stored])
    if (scene.route) await page.route(SWITCH, scene.route)
    await page.goto(`${BASE}${PATH}`)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(400)
    try { if (scene.act) await scene.act(page) } catch (e) { console.log(`${name}: act failed ${String(e.message).slice(0, 160)}`) }
    if (!scene.noIdle) await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
    const file = `${tag}__${name}__${vp}__${theme}.png`
    await page.screenshot({ path: join(SHOTS, file), fullPage: true })
    const ids = await page.evaluate(() => document.body.innerText.match(/[0-9a-f]{8}-[0-9a-f]{4}-|c[a-z0-9]{24}/g))
    console.log(`${file}${overflow ? '  OVERFLOW' : ''}${ids ? `  IDS ${ids.length}` : ''}  url=${pathOf(page.url())}`)
    await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
    await ctx.close()
  }
}
// Leave the saved session as the untouched admin one.
await browser.close()
