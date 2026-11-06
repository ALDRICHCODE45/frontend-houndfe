#!/usr/bin/env node
// T3 real-backend flow on dev data: create «Caja prueba T3», hit the duplicate
// name 409, retire, reactivate and delete it. Leaves the seeded boxes untouched.
// Uses the session saved by capture.mjs (run it first).
import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const NAME = 'Caja prueba T3'
const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX' })
const p = await ctx.newPage()
const sent = []
p.on('request', (r) => { if (/shipping-boxes/.test(r.url()) && r.method() !== 'GET') sent.push(`${r.method()} ${r.postData() ?? ''}`) })
const status = []
p.on('response', (r) => { if (/shipping-boxes/.test(r.url()) && r.request().method() !== 'GET') status.push(r.status()) })
const log = (step) => console.log(step)

await p.goto(`${BASE}/sistema/envios?tab=cajas`)
await p.waitForLoadState('networkidle')
async function create(name) {
  await p.getByTestId('create-box').click()
  await p.fill('input[name="name"]', name)
  await p.fill('input[name="length"]', '25,5')
  await p.fill('input[name="width"]', '20')
  await p.fill('input[name="height"]', '10')
  await p.fill('input[name="weightKg"]', '0.15')
  await p.fill('input[name="maxContentKg"]', '3.5')
  await p.locator('[data-testid="box-form"] button[type="submit"]').click()
  await p.waitForTimeout(1200)
}
await create(NAME)
log(`created row visible: ${await p.getByText(NAME).count() > 0}`)
await create('Caja chica')
log(`duplicate message: ${await p.locator('#box-name-message').innerText().catch(() => 'none')}`)
await p.keyboard.press('Escape')
await p.waitForTimeout(400)
// The discard confirmation for the dirty form.
await p.getByRole('button', { name: 'Salir sin guardar' }).click().catch(() => {})
await p.waitForTimeout(600)
const menu = () => p.locator(`button[aria-label="Acciones de ${NAME}"]`).click()
await menu(); await p.getByRole('menuitem', { name: 'Retirar' }).click(); await p.waitForTimeout(1000)
log(`retired badge: ${await p.locator('tr', { hasText: NAME }).getByText('Retirada').count() > 0}`)
await menu(); await p.getByRole('menuitem', { name: 'Reactivar' }).click(); await p.waitForTimeout(1000)
await menu(); await p.getByRole('menuitem', { name: 'Eliminar…' }).click(); await p.waitForTimeout(500)
await p.getByRole('button', { name: 'Eliminar caja' }).click(); await p.waitForTimeout(1200)
log(`deleted: ${await p.getByText(NAME).count() === 0}`)
log(`requests: ${sent.join(' | ')}`)
log(`statuses: ${status.join(',')}`)
await browser.close()
