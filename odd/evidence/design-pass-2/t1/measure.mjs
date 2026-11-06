// Column widths of the refunds table at 1440 (diagnosis of the horizontal scroll).
import { BASE, launch } from './lib.mjs'

const { browser, page } = await launch()
await page.setViewportSize({ width: Number(process.argv[2] ?? 1440), height: 900 })
await page.goto(`${BASE}/pos/reembolsos`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const out = await page.evaluate(() => {
  const table = document.querySelector('.hf-data-table table')
  const scroller = table?.parentElement
  const ths = [...(table?.querySelectorAll('thead th') ?? [])].map((th) => ({
    text: th.textContent.trim(),
    w: Math.round(th.getBoundingClientRect().width),
    cls: th.className.slice(0, 120),
  }))
  return { tableW: table?.scrollWidth, scrollerW: scroller?.clientWidth, ths }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
