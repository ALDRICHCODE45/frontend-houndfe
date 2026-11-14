import { open, shot } from './lib.mjs'
import { installMock } from './mock.mjs'
const { browser, page } = await open(390, 844)
await installMock(page.context())
await page.context().addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = 'body .catalog-animal{grid-template-columns:minmax(0,1fr)!important}'; document.head.appendChild(s) }) })
await page.goto('http://127.0.0.1:5199/catalogo/centro?facet=animal.target:ani.bird_pet.budgerigar')
await page.waitForSelector('.catalog-animal-pill'); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(900)
console.log(JSON.stringify(await page.evaluate(() => ({
  doc: document.documentElement.scrollWidth - innerWidth,
  sel: [...document.querySelectorAll('.catalog-animal-pill[aria-pressed=true]')].map((b) => { const r = b.getBoundingClientRect(); return [b.querySelector('.catalog-animal-name').textContent, Math.round(r.left), Math.round(r.right), r.left >= 0 && r.right <= innerWidth] }),
  chip: [...document.querySelectorAll('.catalog-animal-chip[aria-pressed=true]')].map((b) => { const r = b.getBoundingClientRect(); return [b.innerText, Math.round(r.left), Math.round(r.right)] }),
  rows: [...document.querySelectorAll('.catalog-animal-scroll')].map((r) => [r.scrollWidth, r.clientWidth, Math.round(r.scrollLeft)]),
}))))
await shot(page, 's4-reload-selected-390-patched-early.png')
await browser.close()
