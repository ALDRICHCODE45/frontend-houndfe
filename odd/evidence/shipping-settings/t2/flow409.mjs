#!/usr/bin/env node
// T2: saving a zone whose postal code has a pending validation (06600) must open that validation (L7).
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://127.0.0.1:5173'
const safeUrl = (raw) => { try { return new URL(raw) } catch { return null } }
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX', reducedMotion: 'reduce' })
const p = await ctx.newPage()
await p.setViewportSize({ width: 1440, height: 900 })
p.on('response', (r) => { if (r.request().method() === 'PUT') console.log('PUT', safeUrl(r.url())?.pathname, r.status()) })
p.on('console', (m) => { if (m.type() === 'error') console.log('console error:', m.text().slice(0, 200)) })
await p.goto(`${BASE}/sistema/envios?tab=zonas`)
await p.waitForLoadState('networkidle')
await p.getByTestId('zone-create').click()
await p.waitForTimeout(500)
await p.locator('#zone-zip').fill('06600')
await p.locator('#zone-eta').fill('1')
await p.getByTestId('zone-submit').click()
await p.waitForTimeout(3000)
const url = safeUrl(p.url())
console.log('now at', url?.pathname, 'validation param present:', Boolean(url?.searchParams.get('validation')))
console.log('dialog:', (await p.locator('[role=dialog]').innerText().catch(() => '(none)')).split('\n').slice(0, 4).join(' | '))
await p.screenshot({ path: join(HERE, 'shots', 't2__flow-409__1440__light.png') })
await browser.close()
