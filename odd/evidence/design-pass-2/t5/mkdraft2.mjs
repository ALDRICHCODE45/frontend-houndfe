import { join } from 'node:path'
import { BASE, SHOTS, open } from './lib.mjs'
import { productIds } from './ids.mjs'
const name = process.argv[2]
const { [name]: id } = await productIds([name])
const { browser, page } = await open({ width: 1440, height: 900 })
await page.goto(`${BASE}/pos/products/${id}`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.getByRole('button', { name: 'Contenido', exact: true }).first().click()
await page.waitForTimeout(2500)
const title = page.getByLabel('Título comercial', { exact: true }).first()
await title.fill('Alimento para Cachorro Raza Mediana 3 kg, pollo y arroz')
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Guardar', exact: true }).last().click()
await page.waitForTimeout(3000)
await page.screenshot({ path: join(SHOTS, 'mkdraft-3.png') })
await browser.close()
