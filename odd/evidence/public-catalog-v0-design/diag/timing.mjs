// Frame-by-frame trace from navigation start: when does body get data-catalog-theme vs when do
// skeleton/card first paint, and with which background? Also SPA navigation list -> detail.
import { chromium, firefox } from '@playwright/test'
const URLS = { detail: '/catalogo/centro/p/0b2f0000-0000-4000-8000-000000000001', list: '/catalogo/centro' }
for (const [n, e] of [['firefox', firefox], ['chromium', chromium]]) {
  for (const [label, url] of Object.entries(URLS)) {
    const b = await e.launch(); const c = await b.newContext({ viewport: { width: 1848, height: 950 }, colorScheme: 'dark' })
    await c.addInitScript(() => {
      window.__trace = []
      const sel = '.catalog-pdp-skeleton-main, .catalog-product-card, .catalog-skeleton-card, .catalog-skeleton'
      const tick = () => {
        const el = document.querySelector(sel); const b = document.body
        if (el) { const cs = getComputedStyle(el); const last = window.__trace.at(-1); const row = `${b?.getAttribute('data-catalog-theme')}|${cs.backgroundColor}|${el.className.slice(0, 40)}`
          if (!last || last.row !== row) window.__trace.push({ t: Math.round(performance.now()), row }) }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    const p = await c.newPage()
    await p.route('**/public/catalog/centro/products/0b2f*', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.continue() })
    await p.goto('http://localhost:5199' + url); await p.waitForTimeout(4500)
    console.log(n, label, JSON.stringify(await p.evaluate(() => window.__trace)))
    await b.close()
  }
}
