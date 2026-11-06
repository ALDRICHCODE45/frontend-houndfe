#!/usr/bin/env node
// Read-only: expand the Sistema nav group and read the «Validaciones de zona» entry (pending count).
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX', reducedMotion: 'reduce' })
const p = await ctx.newPage()
await p.setViewportSize({ width: 1440, height: 900 })
await p.goto('http://127.0.0.1:5173/sistema/envios/validaciones')
await p.waitForLoadState('networkidle').catch(() => {})
await p.getByText('Sistema', { exact: true }).first().click()
await p.waitForTimeout(800)
const link = p.locator('a[href="/sistema/envios/validaciones"]').first()
console.log('nav entry:', (await link.innerText().catch(() => '(none)')).replace(/\s+/g, ' ').trim())
console.log('reembolsos-like badges:', (await p.locator('a').filter({ hasText: /Reembolsos|Validaciones de zona/ }).allInnerTexts()).map((s) => s.replace(/\s+/g, ' ')).join(' || '))
await p.screenshot({ path: join(HERE, 'shots', 't2r__4-nav-after__1440__light.png') })
await browser.close()
