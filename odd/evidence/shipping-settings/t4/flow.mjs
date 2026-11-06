#!/usr/bin/env node
// T4 write flow on the dev record «Prueba empaque T4» (created for this check,
// never a seeded record): add the product packaging, give «Grande» its own,
// then send it back to inheriting, and remove the product packaging. Each step
// is checked against the API. 1440 light, one page.
import { chromium } from '@playwright/test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call, login } from '../../design-pass-2/t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = join(HERE, 'shots')
const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5173'
const { token } = await login('manager@houndfe.com', 'manager')
const [product] = await call('GET', `/products?search=${encodeURIComponent('Prueba empaque T4')}&limit=1`, token)
const variants = await call('GET', `/products/${product.id}/variants`, token)
const grande = variants.find((v) => v.name === 'Grande')
const api = {
  product: () => call('GET', `/products/${product.id}/packaging`, token),
  grande: () => call('GET', `/products/${product.id}/variants/${grande.id}/packaging`, token),
}
const check = (label, ok, detail) => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)

const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--disable-dev-shm-usage', '--renderer-process-limit=1'] })
const ctx = await browser.newContext({ storageState: join(HERE, '.auth', 'manager.json'), locale: 'es-MX', reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
await page.goto(`${BASE}/pos/products/${product.id}`)
await page.waitForLoadState('networkidle').catch(() => {})
await page.locator('[data-task="presentations"]:visible').first().click()
const section = page.getByTestId('product-packaging-section')
await section.waitFor({ state: 'visible', timeout: 15000 })

// 1. Product packaging from empty.
await page.getByTestId('packaging-add').click()
await page.locator('#product-packaging-weight').fill('1,25')
await page.locator('#product-packaging-length').fill('30')
await page.locator('#product-packaging-width').fill('20.5')
await page.locator('#product-packaging-height').fill('8')
await page.getByTestId('packaging-save').click()
await page.getByTestId('packaging-summary').waitFor({ timeout: 10000 })
let p = await api.product()
check('product PUT kg→g, cm', p.packaging?.weightG === 1250 && p.packaging?.widthCm === 20.5, JSON.stringify(p.packaging))
check('summary shows kg/cm', /1\.25 kg/.test(await section.innerText()) && /30 × 20\.5 × 8 cm/.test(await section.innerText()))
await section.screenshot({ path: join(SHOTS, 't4__flow-saved__1440__light.png') })

// 2. «Grande» gets its own record.
const openGrande = async () => {
  await page.getByRole('button', { name: 'Acciones de la variante Grande' }).click()
  await page.getByRole('menuitem', { name: 'Empaque' }).click()
  await page.getByText('Empaque que usa hoy').waitFor({ timeout: 10000 })
}
await openGrande()
check('Grande inherits first', /Heredado del producto/.test(await page.getByTestId('variant-packaging-effective').innerText()))
await page.getByRole('radio', { name: /Empaque propio/ }).click()
await page.locator('#variant-packaging-weight').fill('1.5')
await page.locator('#variant-packaging-length').fill('35')
await page.getByTestId('variant-packaging-save').click()
await page.getByText('Empaque que usa hoy').waitFor({ state: 'hidden', timeout: 10000 })
let v = await api.grande()
check('variant PUT own record', v.source === 'VARIANT' && v.override?.weightG === 1500 && v.override?.lengthCm === 35, JSON.stringify(v.override))

// 3. Back to inheriting (DELETE).
await openGrande()
check('Grande shows own, no badge', !/Heredado del producto/.test(await page.getByTestId('variant-packaging-effective').innerText()))
await page.getByRole('radio', { name: /Usar el empaque del producto/ }).click()
await page.getByTestId('variant-packaging-save').click()
await page.getByText('Empaque que usa hoy').waitFor({ state: 'hidden', timeout: 10000 })
v = await api.grande()
check('variant DELETE → inherits', v.source === 'PRODUCT' && v.override === null)

// 4. Remove the product packaging (confirmed).
await page.getByTestId('packaging-remove').click()
await page.getByRole('button', { name: 'Quitar empaque' }).click()
await page.getByText('Sin empaque registrado').waitFor({ timeout: 10000 })
p = await api.product()
check('product DELETE → null', p.packaging === null)
v = await api.grande()
check('Grande now has nothing', v.source === null && v.effective === null)

await browser.close()
