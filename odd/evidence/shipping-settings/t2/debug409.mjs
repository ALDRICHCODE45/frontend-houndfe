#!/usr/bin/env node
// T2 debug: why the 06600 submit sends no PUT.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX', reducedMotion: 'reduce' })
const p = await ctx.newPage()
await p.setViewportSize({ width: 1440, height: 900 })
p.on('request', (r) => { if (!['GET', 'OPTIONS'].includes(r.method())) console.log('REQ', r.method(), r.url().slice(-40)) })
p.on('response', (r) => { if (r.request().method() === 'PUT') console.log('RES', r.status()) })
await p.goto('http://127.0.0.1:5173/sistema/envios?tab=zonas')
await p.waitForLoadState('networkidle')
await p.getByTestId('zone-create').click()
await p.waitForTimeout(500)
await p.locator('#zone-zip').fill('06600')
await p.locator('#zone-eta').fill('1')
const values = await p.evaluate(() => [document.querySelector('#zone-zip')?.value, document.querySelector('#zone-eta')?.value])
console.log('values', values)
const variant = process.argv[2] ?? 'plain'
if (variant === 'radio') { await p.getByRole('radio', { name: 'Con cargo' }).click(); await p.getByRole('radio', { name: 'Envío gratis' }).click() }
if (variant === 'enter') { await p.locator('#zone-eta').press('Enter') } else { await p.getByTestId('zone-submit').click() }
await p.waitForTimeout(2500)
console.log('messages', await p.locator('.hf-form-field__message, [role=alert]').allInnerTexts())
console.log('url', p.url().replace(/[0-9a-f-]{36}/, '<id>'))
await browser.close()
