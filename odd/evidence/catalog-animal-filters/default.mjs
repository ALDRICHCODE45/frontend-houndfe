import { open, load, shot } from './lib.mjs'
import { installMock } from './mock.mjs'
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const { browser, page, errors } = await open(w, h)
  await installMock(page.context())
  await load(page)
  const info = await page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } }
    const strip = document.querySelector('.catalog-animal-strip'), sec = document.querySelector('.catalog-animal')
    return {
      chips: [...document.querySelectorAll('.catalog-animal-chip')].map((b) => ({ text: b.innerText.replace(/\s+/g, ' '), p: b.getAttribute('aria-pressed'), icon: b.querySelector('.catalog-animal-icon')?.dataset.icon, ...r(b) })),
      strip: { sw: strip.scrollWidth, cw: strip.clientWidth, flexWrap: getComputedStyle(strip).flexWrap, ...r(strip) }, sec: r(sec),
      docOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
  console.log(w, JSON.stringify(info))
  await shot(page, `s1-default-${w}.png`)
  console.log(errors)
  await browser.close()
}
