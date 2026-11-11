// SPA transitions: does body ever lose data-catalog-theme while catalog UI is painted?
import { chromium, firefox } from '@playwright/test'
for (const [n, e] of [['firefox', firefox], ['chromium', chromium]]) {
  const b = await e.launch(); const c = await b.newContext({ viewport: { width: 1848, height: 950 }, colorScheme: 'dark' })
  await c.addInitScript(() => {
    window.__t = []
    const rec = (why) => { const bd = document.body; if (!bd) return; const sk = document.querySelector('.catalog-pdp-skeleton-main,.catalog-product-card,.catalog-skeleton-card')
      const row = `${why}|attr=${bd.getAttribute('data-catalog-theme')}|skel=${sk ? getComputedStyle(sk).backgroundColor : '-'}|${location.pathname.slice(0, 30)}`
      if (window.__t.at(-1) !== row) window.__t.push(row) }
    const tick = () => { rec('f'); requestAnimationFrame(tick) }; requestAnimationFrame(tick)
  })
  const p = await c.newPage()
  await p.route('**/public/catalog/centro/products/0b2f*', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.continue() })
  await p.goto('http://localhost:5199/catalogo/centro'); await p.waitForSelector('.catalog-product-card')
  await p.screenshot({ path: `shots/${n}-spa-list.png` })
  await p.click('.catalog-product-card a, .catalog-product-card'); await p.waitForSelector('.catalog-pdp-skeleton-main'); await p.waitForTimeout(400)
  await p.screenshot({ path: `shots/${n}-spa-detail-loading.png` })
  await p.waitForTimeout(3000); await p.goBack(); await p.waitForTimeout(800); await p.goForward(); await p.waitForTimeout(800)
  console.log(n, JSON.stringify(await p.evaluate(() => window.__t), null, 1)); await b.close()
}
