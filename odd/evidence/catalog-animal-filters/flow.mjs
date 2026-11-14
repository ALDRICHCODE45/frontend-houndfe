import { open, load, shot } from './lib.mjs'
import { installMock, CONTROL } from './mock.mjs'
import { writeFileSync } from 'node:fs'
const out = {}
const note = (k, v) => { out[k] = v; console.log(k, JSON.stringify(v)) }

async function snap(page) {
  return page.evaluate(() => {
    const u = new URL(location.href)
    const box = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) } }
    const chips = [...document.querySelectorAll('.catalog-animal-chip')].map((b) => ({ name: b.querySelector('.catalog-animal-name')?.textContent, p: b.getAttribute('aria-pressed'), ...box(b) }))
    const pills = [...document.querySelectorAll('.catalog-animal-pill')].map((b) => {
      const n = b.querySelector('.catalog-animal-name'), c = b.querySelector('.catalog-animal-count'), k = b.querySelector('.catalog-animal-pill-check')
      const pb = b.getBoundingClientRect()
      const inside = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.left >= pb.left - 0.5 && r.right <= pb.right + 0.5 && r.top >= pb.top - 0.5 && r.bottom <= pb.bottom + 0.5 }
      return { name: n?.textContent, p: b.getAttribute('aria-pressed'), ellipsis: n ? n.scrollWidth > n.clientWidth : false, checkInside: inside(k), countInside: inside(c), nameInside: inside(n), sh: b.scrollHeight > b.clientHeight + 1, ...box(b) }
    })
    const rows = [...document.querySelectorAll('.catalog-animal-scroll')].map((r) => ({ cls: r.className.replace(/catalog-animal-scroll/, '').trim(), sw: r.scrollWidth, cw: r.clientWidth, sl: Math.round(r.scrollLeft), fs: getComputedStyle(r).getPropertyValue('--catalog-fade-start'), fe: getComputedStyle(r).getPropertyValue('--catalog-fade-end') }))
    return {
      facets: u.searchParams.getAll('facet'), cat: u.searchParams.get('categoryId') ?? u.searchParams.get('category'), search: u.search,
      chips, pills, rows, sub: document.querySelector('.catalog-animal-sub')?.innerText.split('\n')[0] ?? null,
      heading: document.body.innerText.match(/(\d+) productos/)?.[0], showing: document.body.innerText.match(/Mostrando [^\n]+/)?.[0],
      docOverflow: document.documentElement.scrollWidth - innerWidth,
    }
  })
}
const chip = (page, name) => page.locator('.catalog-animal-chip', { has: page.locator('.catalog-animal-name', { hasText: new RegExp(`^${name}$`) }) })
const pill = (page, name) => page.locator('.catalog-animal-pill', { has: page.locator('.catalog-animal-name', { hasText: new RegExp(`^${name}$`) }) })
const settle = async (page) => { await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {}); await page.waitForTimeout(500) }

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const T = (k) => `${k}@${w}`
  const { browser, page, errors } = await open(w, h)
  const log = await installMock(page.context())
  await load(page)
  const strip = () => page.locator('.catalog-animal').screenshot({ path: `shots/_tmp.png` })
  // S2: Peces
  await chip(page, 'Peces').click(); await settle(page)
  let s = await snap(page); note(T('2-peces'), { facets: s.facets, sub: s.sub, chips: s.chips.filter((c) => c.p === 'true').map((c) => c.name), pills: s.pills.map((p) => p.name), heading: s.heading, showing: s.showing, rows: s.rows, doc: s.docOverflow })
  await shot(page, `s2-peces-${w}.png`)
  await page.locator('.catalog-animal').screenshot({ path: `shots/s2-peces-strip-${w}.png` })
  // species Guppy
  await pill(page, 'Guppy').click(); await settle(page)
  s = await snap(page); note(T('2-guppy'), { facets: s.facets, pills: s.pills.filter((p) => p.p === 'true'), heading: s.heading, showing: s.showing })
  await page.locator('.catalog-animal').screenshot({ path: `shots/s2-guppy-strip-${w}.png` })
  await shot(page, `s2-guppy-${w}.png`)
  // unselect → back to whole group? 
  await pill(page, 'Guppy').click(); await settle(page)
  s = await snap(page); note(T('2-guppy-toggle-off'), { facets: s.facets.length, pressedPills: s.pills.filter((p) => p.p === 'true').map((p) => p.name), chips: s.chips.filter((c) => c.p === 'true').map((c) => c.name) })
  // Aves long names
  await chip(page, 'Aves').click(); await settle(page)
  for (const sp of ['Canario doméstico', 'Periquito australiano']) {
    await pill(page, sp).click(); await settle(page)
    s = await snap(page); note(T('2-' + sp), { sel: s.pills.filter((p) => p.p === 'true'), facets: s.facets, chipAves: s.chips.find((c) => c.name === 'Aves') })
    await page.locator('.catalog-animal').screenshot({ path: `shots/s2-${sp.replace(/\s/g, '-')}-${w}.png` })
    if (w === 390) await shot(page, `s2-${sp.replace(/\s/g, '-')}-full-${w}.png`)
  }
  // Reptiles: Dragones barbudos
  await chip(page, 'Reptiles').click(); await settle(page)
  await pill(page, 'Dragones barbudos').click(); await settle(page)
  s = await snap(page); note(T('2-dragones'), { sel: s.pills.filter((p) => p.p === 'true'), rows: s.rows, facets: s.facets })
  await page.locator('.catalog-animal').screenshot({ path: `shots/s2-Dragones-barbudos-${w}.png` })
  note(T('errors-s2'), errors.filter((e) => !e.includes('/branch') && !e.includes('404 (Not Found)')))
  await browser.close()
}
writeFileSync('flow-s2.json', JSON.stringify(out, null, 1))
