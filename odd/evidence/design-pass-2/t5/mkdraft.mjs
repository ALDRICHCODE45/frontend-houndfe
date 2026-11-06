// Data for Historial: start a draft from the published version of a product and change its commercial title.
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
await page.screenshot({ path: join(SHOTS, 'mkdraft-1.png') })
const start = page.getByRole('button', { name: /Empezar desde lo publicado/ })
console.log('start buttons', await start.count())
if (process.argv[3] === 'go' && await start.count()) {
  await start.first().click(); await page.waitForTimeout(3000)
  await page.screenshot({ path: join(SHOTS, 'mkdraft-2.png') })
}
await browser.close()
