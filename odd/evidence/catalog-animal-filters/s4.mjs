import { open, load, shot } from './lib.mjs'
import { installMock } from './mock.mjs'
const patch = process.env.PATCH === '1'
const sfx = patch ? '-patched' : ''
const J = (l, v) => console.log(l, JSON.stringify(v))
const chip = (page, n) => page.locator('.catalog-animal-chip', { has: page.locator('.catalog-animal-name', { hasText: new RegExp(`^${n}$`) }) })
const pillsInfo = (page) => page.evaluate(() => [...document.querySelectorAll('.catalog-animal-pill')].map((b) => { const r = b.getBoundingClientRect(); const after = getComputedStyle(b, '::after'); return { t: b.innerText.replace(/\s+/g, ' ').trim(), p: b.getAttribute('aria-pressed'), l: Math.round(r.left), r: Math.round(r.right), h: Math.round(r.height), hit: after.content !== 'none' ? { top: after.top, bottom: after.bottom } : null } }))
const rowsInfo = (page) => page.evaluate(() => [...document.querySelectorAll('.catalog-animal-scroll')].map((r) => ({ sw: r.scrollWidth, cw: r.clientWidth, sl: Math.round(r.scrollLeft), fs: r.style.getPropertyValue('--catalog-fade-start'), fe: r.style.getPropertyValue('--catalog-fade-end') })))
for (const [w, h] of (process.env.ONLY ? [[Number(process.env.ONLY), process.env.ONLY === '390' ? 844 : 900]] : [[1440, 900], [390, 844]])) {
  const { browser, page, errors } = await open(w, h)
  await installMock(page.context(), { many: true })
  await load(page)
  if (patch) await page.addStyleTag({ content: `body .catalog-animal{grid-template-columns:minmax(0,1fr)!important}` })
  // chip target sizes
  J(`chips@${w}`, await page.evaluate(() => [...document.querySelectorAll('.catalog-animal-chip')].map((b) => [b.querySelector('.catalog-animal-name').textContent, Math.round(b.getBoundingClientRect().height)])))
  await chip(page, 'Peces').click(); await page.waitForTimeout(800)
  J(`peces-pills@${w}`, (await pillsInfo(page)).map((p) => [p.t, p.h, p.hit]))
  J(`peces-rows@${w}`, await rowsInfo(page))
  await shot(page, `s4-peces-collapsed-${w}${sfx}.png`)
  await page.locator('.catalog-animal').screenshot({ path: `shots/s4-peces-collapsed-strip-${w}${sfx}.png` })
  const more = page.locator('.catalog-animal-more')
  J(`more@${w}`, { n: await more.count(), text: await more.allInnerTexts(), box: await more.first().boundingBox() })
  if (w >= 1000) {
    await more.click(); await page.waitForTimeout(500)
    J(`expanded-pills@${w}`, (await pillsInfo(page)).map((p) => p.t))
    J(`search@${w}`, await page.locator('.catalog-animal-search input').count())
    await shot(page, `s4-peces-expanded-${w}.png`)
    await page.locator('.catalog-animal').screenshot({ path: `shots/s4-peces-expanded-strip-${w}.png` })
    await page.locator('.catalog-animal-search input').fill('neon'); await page.waitForTimeout(300)
    J(`search-neon@${w}`, (await pillsInfo(page)).map((p) => p.t))
    await page.locator('.catalog-animal-search input').fill('zzz'); await page.waitForTimeout(300)
    J(`search-zzz@${w}`, await page.locator('.catalog-animal-empty').innerText())
    await page.locator('.catalog-animal').screenshot({ path: `shots/s4-search-empty-strip-${w}.png` })
  } else {
    await more.click(); await page.waitForTimeout(700)
    await shot(page, `s4-sheet-${w}${sfx}.png`)
    const dlg = page.getByRole('dialog')
    J(`sheet@${w}`, { n: await dlg.count(), text: (await dlg.first().innerText()).slice(0, 400) })
    J(`sheet-rows@${w}`, await dlg.first().evaluate((d) => [...d.querySelectorAll('button, [role=checkbox], label, [role=option]')].slice(0, 30).map((b) => [b.innerText.replace(/\s+/g, ' ').trim().slice(0, 40), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width)])))
    // choose a species in the sheet
    const item = dlg.first().getByText('Koi', { exact: false }).first()
    if (await item.count()) { await item.click(); await page.waitForTimeout(700); await shot(page, `s4-sheet-selected-${w}${sfx}.png`); J(`sheet-url@${w}`, decodeURIComponent(new URL(page.url()).search)) }
    await page.keyboard.press('Escape'); await page.waitForTimeout(500)
    await shot(page, `s4-sheet-closed-${w}${sfx}.png`)
    J(`closed-pills@${w}`, (await pillsInfo(page)).filter((p) => p.p === 'true').map((p) => [p.t, p.l, p.r]))
    J(`closed-rows@${w}`, await rowsInfo(page))
  }
  // scroll behaviour: scroll the strip row sideways, read fades
  const row = page.locator('.catalog-animal-strip')
  await row.evaluate((e) => { e.scrollLeft = 120 }); await page.waitForTimeout(300)
  J(`strip-scrolled@${w}`, await rowsInfo(page))
  await shot(page, `s4-strip-scrolled-${w}${sfx}.png`)
  J('errors', errors.filter((e) => !e.includes('/branch') && !e.includes('404 (Not Found)')))
  await browser.close()
}
