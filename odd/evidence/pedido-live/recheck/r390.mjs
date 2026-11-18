// 390 read-only check of the quotation detail: horizontal overflow of the scroller.
import { BASE, makeLog, open, settle, shot } from './lib.mjs'

const log = makeLog('r390')
const { browser, page } = await open(log, { width: 390, height: 844 })
for (const [label, id] of process.argv.slice(2).map((a) => a.split('='))) {
  await page.goto(`${BASE}/pos/cotizaciones/${id}`)
  await settle(page, 1500)
  const r = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="quotation-detail-layout"]')
    let s = root
    while (s && s !== document.body && !/overflow-y-auto/.test(String(s.className))) s = s.parentElement
    const vw = window.innerWidth
    const wide = [...root.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > vw + 1).length
    return { docOverflow: document.documentElement.scrollWidth > vw, scrollerSW: s?.scrollWidth, scrollerCW: s?.clientWidth, elementsPastViewport: wide }
  })
  log(`${label} ${id}: ${JSON.stringify(r)}`)
  await shot(page, `r09-390-${label}-top`, log)
  const banner = page.getByTestId('converted-banner')
  if (await banner.count()) {
    await banner.scrollIntoViewIfNeeded()
    await shot(page, `r10-390-${label}-banner`, log)
  }
}
await browser.close()
