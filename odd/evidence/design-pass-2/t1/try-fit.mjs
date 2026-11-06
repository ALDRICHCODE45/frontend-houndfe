// Tries candidate CSS for the refunds table and reports whether it fits its card.
import { BASE, launch } from './lib.mjs'

const CSS = process.argv[2] ?? ''
const { browser, page } = await launch()
for (const w of [1440, 1280]) {
  await page.setViewportSize({ width: w, height: 900 })
  await page.goto(`${BASE}/pos/reembolsos`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: CSS })
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => {
    const t = document.querySelector('.hf-data-table table')
    return { need: t.scrollWidth, have: t.parentElement.clientWidth, ths: [...t.querySelectorAll('thead th')].map((th) => Math.round(th.getBoundingClientRect().width)), pad: getComputedStyle(t.querySelector('td')).paddingLeft }
  })
  console.log(w, JSON.stringify(r))
}
await browser.close()
