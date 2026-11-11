// Which CSS rules paint the detail skeleton and the card, per engine.
import { chromium, firefox } from '@playwright/test'
for (const [n, e] of [['firefox', firefox], ['chromium', chromium]]) {
  const b = await e.launch(); const c = await b.newContext({ viewport: { width: 1848, height: 950 }, colorScheme: 'dark' })
  await c.addInitScript(() => localStorage.setItem('vueuse-color-scheme', 'dark'))
  const p = await c.newPage()
  await p.route('**/public/catalog/centro/products/0b2f*', async (r) => { await new Promise((x) => setTimeout(x, 3000)); r.continue() })
  await p.goto('http://localhost:5199/catalogo/centro/p/0b2f0000-0000-4000-8000-000000000001', { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.catalog-pdp-skeleton-main')
  const out = await p.evaluate(() => {
    const el = document.querySelector('.catalog-pdp-skeleton-main'); const res = []
    const walk = (rules, ctx = '') => { for (const r of rules) {
      if (r.cssRules && !r.selectorText) walk(r.cssRules, ctx + ' ' + (r.conditionText || r.name || r.cssText.slice(0, 40)))
      else if (r.selectorText) { try { if (el.matches(r.selectorText) && /background/.test(r.style.cssText)) res.push(`${ctx} ${r.selectorText} { ${r.style.cssText.slice(0, 160)} }`) } catch {} } } }
    for (const s of document.styleSheets) { try { walk(s.cssRules) } catch {} }
    const html = getComputedStyle(document.documentElement)
    return { res, htmlElev: html.getPropertyValue('--ui-bg-elevated'), bodyAttr: document.body.dataset.catalogTheme }
  })
  console.log('==', n, JSON.stringify(out, null, 1)); await b.close()
}
