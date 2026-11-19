// Static matrix: /pos/caja per role at 1440/390 x light/dark; overflow + sticky bar + focus.
import { chromium } from '@playwright/test'
import { open, settle, shot, makeLog, BASE, overflow } from './lib.mjs'
const log = makeLog('matrix')
const browser = await chromium.launch({ headless: true })
for (const role of ['cashier', 'manager']) for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
  const height = width === 390 ? 844 : 900
  const { ctx, page, issues } = await open(log, { role, width, height, theme, browser })
  page.setDefaultTimeout(8000)
  await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
  const tag = `${role}-${width}-${theme}`
  const o = await overflow(page)
  const bar = page.getByTestId('cash-workspace-bar')
  const barInfo = await bar.isVisible().catch(() => false) ? await bar.evaluate((e) => { const r = e.getBoundingClientRect(); return { pos: getComputedStyle(e).position, bottom: Math.round(r.bottom), h: Math.round(r.height), text: e.innerText.replace(/\s+/g, ' ') } }) : null
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  log(`${tag}: dark=${isDark} scrollW=${o.sw} clientW=${o.cw} overflowX=${o.sw > o.cw} bar=${JSON.stringify(barInfo)}`)
  await shot(page, `M-${tag}-caja`, log)
  if (width === 390) {
    // scroll down: bar must stay pinned
    await page.mouse.wheel(0, 1500); await page.waitForTimeout(500)
    const b2 = await bar.isVisible().catch(() => false) ? await bar.evaluate((e) => Math.round(e.getBoundingClientRect().bottom)) : null
    log(`${tag}: after scroll bar bottom=${b2} viewportH=${height}`)
    await shot(page, `M-${tag}-caja-scrolled`, log)
  }
  if (role === 'manager') {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.getByRole('button', { name: /Cortes/ }).first().click().catch((e) => log('cortes btn ' + e.message.slice(0, 60))); await settle(page, 1200)
    const o2 = await overflow(page)
    log(`${tag}: cortes overflowX=${o2.sw > o2.cw} (${o2.sw}/${o2.cw}) rows=${await page.getByTestId('cash-closing-row').count()}`)
    await page.getByTestId('cash-closings-list').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `M-${tag}-cortes`, log)
    await page.getByTestId('cash-closing-row-open').first().click().catch(() => {}); await settle(page, 1200)
    const o3 = await overflow(page)
    log(`${tag}: corte detail overflowX=${o3.sw > o3.cw} (${o3.sw}/${o3.cw})`)
    await page.getByTestId('cash-closing-detail').scrollIntoViewIfNeeded().catch(() => {})
    await shot(page, `M-${tag}-corte`, log)
  }
  log(`${tag}: ISSUES ${JSON.stringify(issues)}`)
  await ctx.close()
}
await browser.close()
