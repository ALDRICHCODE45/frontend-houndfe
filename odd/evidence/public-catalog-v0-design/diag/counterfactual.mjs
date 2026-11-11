// Counterfactual: strip body[data-catalog-theme] and read what the skeleton/card paint (what the owner sees).
import { firefox } from '@playwright/test'
const b = await firefox.launch(); const c = await b.newContext({ viewport: { width: 1848, height: 950 }, colorScheme: 'dark' })
const p = await c.newPage()
await p.route('**/public/catalog/centro/products/0b2f*', async (r) => { await new Promise((x) => setTimeout(x, 6000)); r.continue() })
await p.goto('http://localhost:5199/catalogo/centro'); await p.waitForSelector('.catalog-product-card')
const read = () => p.evaluate(() => { const g = (s, k) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[k] : '-' }
  return { card: g('.catalog-product-card', 'backgroundColor'), title: g('.catalog-product-name', 'color'), skeleton: g('.catalog-pdp-skeleton-main', 'backgroundColor'), page: g('.catalog-layout', 'backgroundColor') } })
await p.evaluate(() => document.body.removeAttribute('data-catalog-theme'))
console.log('listing, attr removed:', JSON.stringify(await read()))
await p.screenshot({ path: 'shots/firefox-counterfactual-list-no-attr.png' })
await p.evaluate(() => document.body.setAttribute('data-catalog-theme', 'light'))
await p.evaluate(() => history.pushState({}, '', '/catalogo/centro/p/0b2f0000-0000-4000-8000-000000000001'))
await p.goto('http://localhost:5199/catalogo/centro/p/0b2f0000-0000-4000-8000-000000000001'); await p.waitForSelector('.catalog-pdp-skeleton-main')
await p.evaluate(() => document.body.removeAttribute('data-catalog-theme'))
console.log('detail loading, attr removed:', JSON.stringify(await read()))
await p.screenshot({ path: 'shots/firefox-counterfactual-detail-no-attr.png' })
await b.close()
