// Read-only 390 overflow probe: elements inside the quotation detail wider than the viewport.
import { BASE, makeLog, open, settle, shot } from './lib.mjs'

const log = makeLog('overflow-390')
const { browser, page } = await open(log, { width: 390, height: 844 })
for (const [label, id] of process.argv.slice(2).map((a) => a.split('='))) {
  await page.goto(`${BASE}/pos/cotizaciones/${id}`)
  await settle(page, 1500)
  const r = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="quotation-detail-layout"]')
    if (!root) return { missing: true }
    const vw = window.innerWidth
    const wide = []
    for (const el of root.querySelectorAll('*')) {
      const b = el.getBoundingClientRect()
      if (b.right > vw + 1 && b.width > 0) wide.push({ tag: el.tagName.toLowerCase(), tid: el.dataset?.testid ?? null, cls: String(el.className?.baseVal ?? el.className).slice(0, 90), w: Math.round(b.width), right: Math.round(b.right) })
    }
    let scroller = root
    while (scroller && scroller !== document.body) { if (scroller.scrollWidth > scroller.clientWidth + 1 && getComputedStyle(scroller).overflowX !== 'visible') break; scroller = scroller.parentElement }
    const lb = root.getBoundingClientRect()
    return { layoutWidth: Math.round(lb.width), layoutRight: Math.round(lb.right), scroller: scroller ? { tag: scroller.tagName, cls: String(scroller.className).slice(0, 120), sw: scroller.scrollWidth, cw: scroller.clientWidth } : null, firstWide: wide.slice(0, 6) }
  })
  log(`${label} ${id}: ${JSON.stringify(r)}`)
  await shot(page, `25-390-overflow-${label}`, log)
}
await browser.close()
