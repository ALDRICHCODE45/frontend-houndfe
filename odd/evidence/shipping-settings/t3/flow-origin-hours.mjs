#!/usr/bin/env node
// T3 real-backend flow: edit one origin field and one Saturday time, save, then
// put the seeded values back. Uses the session saved by capture.mjs.
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX' })
const p = await ctx.newPage()
const seen = []
p.on('response', async (r) => {
  if (/shipping-origin|opening-hours/.test(r.url()) && r.request().method() === 'PUT') seen.push(`PUT ${r.url().split('?')[0].split('/').pop()} ${r.status()}`)
})
const save = async () => { await p.getByRole('button', { name: 'Guardar', exact: true }).click(); await p.waitForTimeout(1200) }
const value = (name) => p.inputValue(`input[name="${name}"]`)

await p.goto(`${BASE}/sistema/envios?tab=origen`)
await p.waitForLoadState('networkidle')
const line2 = await value('addressLine2')
await p.fill('input[name="addressLine2"]', `${line2} (prueba T3)`)
await save()
console.log(`origin saved: ${await value('addressLine2')}`)
await p.fill('input[name="addressLine2"]', line2)
await save()
console.log(`origin restored: ${await value('addressLine2')}`)

await p.goto(`${BASE}/sistema/envios?tab=horario`)
await p.waitForLoadState('networkidle')
await p.fill('input[name="SATURDAY-0-close"]', '14:30')
await save()
console.log(`summary after: ${await p.getByTestId('hours-summary').innerText()}`)
await p.fill('input[name="SATURDAY-0-close"]', '14:00')
await save()
console.log(`summary restored: ${await p.getByTestId('hours-summary').innerText()}`)
console.log(seen.join(' | '))
await browser.close()
