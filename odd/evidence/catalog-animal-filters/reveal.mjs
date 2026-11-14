import { open, load, shot } from './lib.mjs'
import { installMock } from './mock.mjs'
const J = (l, v) => console.log(l, JSON.stringify(v))
const chk = (page) => page.evaluate(() => ({
  doc: document.documentElement.scrollWidth - innerWidth,
  sel: [...document.querySelectorAll('.catalog-animal-pill[aria-pressed=true]')].map((b) => { const r = b.getBoundingClientRect(); return [b.querySelector('.catalog-animal-name').textContent, Math.round(r.left), Math.round(r.right), r.left >= 0 && r.right <= innerWidth] }),
  rows: [...document.querySelectorAll('.catalog-animal-scroll')].map((r) => [r.scrollWidth, r.clientWidth, Math.round(r.scrollLeft), r.style.getPropertyValue('--catalog-fade-start'), r.style.getPropertyValue('--catalog-fade-end')]),
}))
for (const patch of [false, true]) for (const w of [390, 768, 900]) {
  const { browser, page, errors } = await open(w, 844)
  await installMock(page.context())
  await load(page)
  if (patch) await page.addStyleTag({ content: `body .catalog-animal{grid-template-columns:minmax(0,1fr)!important}` })
  await page.locator('.catalog-animal-chip', { hasText: 'Aves' }).click(); await page.waitForTimeout(500)
  await page.locator('.catalog-animal-pill', { hasText: 'Periquito australiano' }).click(); await page.waitForTimeout(700)
  J(`${patch ? 'patched' : 'orig'} periquito@${w}`, await chk(page))
  if (w === 390) { await shot(page, `s4-periquito-selected-390${patch ? '-patched' : ''}.png`) }
  // reload with the URL facet (reveal on load)
  await page.reload(); await page.waitForSelector('.catalog-animal-pill'); await page.waitForTimeout(800)
  if (patch) await page.addStyleTag({ content: `body .catalog-animal{grid-template-columns:minmax(0,1fr)!important}` })
  await page.waitForTimeout(300)
  J(`${patch ? 'patched' : 'orig'} reload@${w}`, await chk(page))
  if (w === 390) await shot(page, `s4-reload-selected-390${patch ? '-patched' : ''}.png`)
  await browser.close()
}
