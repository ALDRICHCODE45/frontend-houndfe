import { makeLog, open, settle, BASE } from './lib.mjs'
const log = makeLog('probe-cell')
const { browser, page } = await open(log)
await page.goto(`${BASE}/pos/ventas?status=CANCELED`); await settle(page, 1500)
const r = await page.evaluate(() => {
  const n = document.querySelector('tbody tr .sale-cancel-note'); const td = n.closest('td'); const s = getComputedStyle(td)
  const b = (e) => { const x = e.getBoundingClientRect(); return [Math.round(x.left), Math.round(x.right), Math.round(x.width)] }
  return { td: b(td), tdOverflow: s.overflow, tdWhiteSpace: s.whiteSpace, tdDisplay: s.display, note: b(n), noteScroll: n.scrollWidth, noteClient: n.clientWidth, nextTd: b(td.nextElementSibling), thW: td.closest('table').querySelector('th:nth-child(3)').getBoundingClientRect().width, tdInnerFirstChild: td.firstElementChild?.className?.slice(0, 120) }
})
log(JSON.stringify(r))
await browser.close()
