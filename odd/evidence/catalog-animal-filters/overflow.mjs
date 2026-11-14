import { open, load, shot } from './lib.mjs'
import { installMock } from './mock.mjs'
const { browser, page } = await open(390, 844)
await installMock(page.context())
await load(page)
const q = () => page.evaluate(() => {
  window.scrollTo(400, 0)
  const wide = []
  for (const e of document.querySelectorAll('body *')) { const r = e.getBoundingClientRect(); if (r.right > innerWidth + 2 && !e.closest('.catalog-animal-scroll')) wide.push(`${e.tagName}.${(e.className?.baseVal ?? e.className).toString().slice(0, 50)} r=${Math.round(r.right)} w=${Math.round(r.width)}`) }
  return { sx: scrollX, sw: document.documentElement.scrollWidth, bodySw: document.body.scrollWidth, wide: wide.slice(0, 8) }
})
console.log('default', JSON.stringify(await q()))
await page.evaluate(() => scrollTo(0, 0))
await page.locator('.catalog-animal-chip', { hasText: 'Peces' }).click(); await page.waitForTimeout(800)
console.log('peces', JSON.stringify(await q()))
await page.screenshot({ path: 'shots/s4-peces-scrolledX-390.png' })
await browser.close()
