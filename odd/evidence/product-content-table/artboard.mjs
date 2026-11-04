// Screenshots of the approved artboard (design/product-content-editor/03-attribute-table.html) for the comparison.
import { chromium } from '@playwright/test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const HERE = dirname(fileURLToPath(import.meta.url))
const file = 'file://' + resolve(HERE, '../../../design/product-content-editor/03-attribute-table.html')
const browser = await chromium.launch()
const page = await browser.newPage({ reducedMotion: 'reduce' })
for (const [vp, size] of [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]) {
  await page.setViewportSize(size)
  await page.goto(file)
  for (const state of ['edit', 'saved', 'error', 'empty']) {
    await page.locator(`[data-set-state="${state}"]`).click().catch(() => {})
    await page.waitForTimeout(200)
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
      await page.screenshot({ path: join(HERE, 'shots', `artboard__${state}__${vp}__${theme}.png`) })
    }
  }
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.locator('[data-set-state="edit"]').click()
  await page.locator('[data-open-history]').click().catch(() => {})
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(HERE, 'shots', `artboard__history__${vp}__light.png`) })
}
await browser.close()
