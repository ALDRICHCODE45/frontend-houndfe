import { chromium } from '@playwright/test'
import { join } from 'node:path'
import { SHOTS } from './lib.mjs'
const D = '/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/design/catalog-animal-filters/'
const b = await chromium.launch()
for (const [f, w] of [['01-direccion-a-grupos-y-especies', 1500], ['04-movil-direccion-a', 1500], ['05-estados-direccion-a', 1500]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } })
  await p.goto('file://' + D + f + '.html'); await p.waitForTimeout(800)
  await p.screenshot({ path: join(SHOTS, `design-${f.slice(0, 2)}.png`), fullPage: true })
  console.log(f, await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]))
}
await b.close()
