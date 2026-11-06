#!/usr/bin/env node
// T5 read-only browser check: resolved 06600 drawer, pending 03900 drawer, closed Sistema group count.
// Nothing is resolved or saved. The password is read from the backend seed at runtime and never printed;
// /auth/* bodies are redacted; ids are never printed. No session is written to disk.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, login, password } from '../../design-pass-2/t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = 'http://127.0.0.1:5173'
const API = 'http://127.0.0.1:3003'
const VALS = '/sistema/envios/validaciones'
const pathOf = (url) => { try { return new URL(url).pathname } catch { return '' } }
mkdirSync(SHOTS, { recursive: true })

const { token } = await login('manager@houndfe.com', 'manager')
const zone = await call('GET', '/delivery-zones/06600', token)
const resolvedId = zone.sourceValidationId
console.log('06600 zone has sourceValidationId:', Boolean(resolvedId))

const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1'] })

async function run(width, height, scheme) {
  const ctx = await browser.newContext({ locale: 'es-MX', reducedMotion: 'reduce', viewport: { width, height } })
  const p = await ctx.newPage()
  const writes = []
  p.on('request', (req) => {
    if (!req.url().startsWith(API) || ['GET', 'OPTIONS'].includes(req.method())) return
    writes.push(`${req.method()} ${pathOf(req.url()).startsWith('/auth/') ? pathOf(req.url()) + ' body=<redacted>' : pathOf(req.url()).replace(/[0-9a-f-]{36}/g, '<id>')}`)
  })
  await p.goto(`${BASE}/login`)
  await p.evaluate((v) => localStorage.setItem('vueuse-color-scheme', v), scheme)
  await p.fill('#email', 'manager@houndfe.com')
  await p.fill('#password', password('manager'))
  await p.click('button[type=submit]')
  await p.waitForURL((u) => u.pathname !== '/login', { timeout: 30000 })
  if (pathOf(p.url()) === '/select-tenant') {
    await p.getByText('Sucursal Centro').first().click()
    await p.getByRole('button', { name: /continuar/i }).click()
    await p.waitForURL((u) => u.pathname !== '/select-tenant', { timeout: 30000 })
  }
  const tag = `${width}__${scheme}`
  const shot = async (name) => {
    await p.waitForTimeout(600)
    await p.screenshot({ path: join(SHOTS, `t5__${name}__${tag}.png`) })
    const text = await p.evaluate(() => document.body.innerText)
    const ids = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-/g)
    const overflow = await p.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
    console.log(`  shot ${name}${overflow ? ' OVERFLOW' : ''}${ids ? ` IDS ${ids.length}` : ''}`)
  }
  const drawerText = async () => (await p.locator('.zone-validations-portal').first().innerText()).replace(/\s+/g, ' ').trim()
  console.log(`== ${width} ${scheme}`)

  // 1) Closed Sistema group (fresh shell: every group starts closed)
  await p.goto(`${BASE}/`)
  await p.waitForLoadState('networkidle').catch(() => {})
  if (width < 768) {
    await p.getByRole('button', { name: /abrir|menú|menu/i }).first().click().catch(() => {})
    await p.waitForTimeout(600)
  }
  const group = p.locator('[data-slot="link"]').filter({ hasText: /^\s*Sistema/ }).filter({ visible: true }).first()
  console.log('  Sistema group (closed):', JSON.stringify((await group.innerText().catch(() => '(none)')).replace(/\s+/g, ' ').trim()),
    'expanded=', await group.getAttribute('aria-expanded').catch(() => null) ?? await group.getAttribute('data-state').catch(() => null),
    'child visible=', await p.locator(`a[href="${VALS}"]`).filter({ visible: true }).count())
  await shot('1-sistema-closed')

  // 2) Resolved 06600 drawer opened by link
  await p.goto(`${BASE}${VALS}?validation=${resolvedId}`)
  await p.waitForLoadState('networkidle').catch(() => {})
  await p.locator('.zone-validations-portal .validation-facts').first().waitFor({ timeout: 15000 })
  console.log('  resolved 06600 drawer:', JSON.stringify(await drawerText()))
  // Live paint check of the success banner: a DOM-only copy carrying the drawer's scoped attribute.
  const paint = await p.evaluate(() => {
    const facts = document.querySelector('.zone-validations-portal .validation-facts')
    const scope = [...facts.attributes].find((a) => a.name.startsWith('data-v-'))?.name
    const banner = document.createElement('p')
    banner.className = 'validation-banner'
    banner.dataset.tone = 'success'
    if (scope) banner.setAttribute(scope, '')
    banner.textContent = 'Decisión guardada.'
    facts.parentElement.insertBefore(banner, facts)
    const s = getComputedStyle(banner)
    const probe = document.createElement('span')
    probe.style.color = 'var(--hf-success)'
    banner.appendChild(probe)
    const success = getComputedStyle(probe).color
    probe.remove()
    return { color: s.color, background: s.backgroundColor, successToken: success }
  })
  console.log('  banner paint (DOM copy, nothing saved):', JSON.stringify(paint))
  await shot('2-resolved-06600')

  // 3) Pending 03900 drawer
  await p.goto(`${BASE}${VALS}?zipCode=03900`)
  await p.waitForLoadState('networkidle').catch(() => {})
  await p.locator('.zone-validations-portal .validation-facts').first().waitFor({ timeout: 15000 })
  console.log('  pending 03900 drawer:', JSON.stringify(await drawerText()))
  await shot('3-pending-03900')

  console.log('  non-GET API calls:', writes.join(' | ') || '(none)')
  await ctx.close()
}

try {
  await run(1440, 900, 'light')
  await run(390, 844, 'dark')
} finally {
  await browser.close()
}
