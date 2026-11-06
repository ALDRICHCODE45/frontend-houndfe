// T1 Reembolsos: list in data/empty/loading/error, plus the settle slideover (data),
// at 1440 and 390, light and dark. Shots go to shots/ (uncommitted).
// Usage: node shoot.mjs [suffix]
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { API, BASE, HERE, launch, pathOf } from './lib.mjs'

const SUFFIX = process.argv[2] ?? 'before'
const SHOTS = join(HERE, 'shots')
mkdirSync(SHOTS, { recursive: true })
const ORIGIN = BASE.replace(/\/+$/, '')
const PENDING = /^\/sales\/refunds\/pending$/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const { browser, page } = await launch()
const report = []

async function overflow() {
  return page.evaluate(() => {
    const out = []
    for (const el of document.querySelectorAll('body *')) {
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0) {
        if (['svg', 'path'].includes(el.tagName.toLowerCase())) continue
      }
    }
    // Clipped text: ellipsis or hidden overflow on text nodes.
    for (const el of document.querySelectorAll('td span, td button, .refund-card *, .refund-settle *')) {
      const cs = getComputedStyle(el)
      if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1 && (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis' || cs.overflowX === 'hidden')) {
        out.push({ text: el.textContent.trim().slice(0, 60), sw: el.scrollWidth, cw: el.clientWidth, cls: el.className.toString().slice(0, 60) })
      }
    }
    return { pageOverflow: document.scrollingElement.scrollWidth > innerWidth, clipped: out }
  })
}

for (const theme of ['light', 'dark']) {
  for (const vp of [{ n: '1440', w: 1440, h: 900 }, { n: '390', w: 390, h: 844 }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h })
    await page.evaluate((t) => localStorage.setItem('vueuse-color-scheme', t), theme)
    for (const state of ['data', 'empty', 'loading', 'error']) {
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      if (state !== 'data') {
        await page.route((u) => u.origin === API && PENDING.test(pathOf(u.href)), async (r) => {
          const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-credentials': 'true' }
          if (state === 'loading') { await sleep(20000); return r.abort().catch(() => {}) }
          if (state === 'error') return r.fulfill({ status: 500, contentType: 'application/json', headers: cors, body: JSON.stringify({ statusCode: 500, message: 'Error interno del servidor' }) }).catch(() => {})
          return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }) }).catch(() => {})
        })
      }
      await page.goto(`${BASE}/pos/reembolsos`, { waitUntil: 'domcontentloaded' })
      if (state === 'loading') await sleep(1500)
      else await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await sleep(400)
      const file = `list__${state}__${vp.n}__${theme}__${SUFFIX}.png`
      await page.screenshot({ path: join(SHOTS, file), fullPage: true })
      report.push({ file, ...(await overflow()) })

      if (state === 'data') {
        // Open the biggest refund's slideover.
        const target = vp.n === '1440'
          ? page.locator('td button.hf-row-primary').last()
          : page.locator('.refund-card__link').last()
        await target.click()
        await page.locator('.refund-settle').waitFor({ timeout: 10000 })
        await sleep(500)
        const sf = `settle__data__${vp.n}__${theme}__${SUFFIX}.png`
        await page.screenshot({ path: join(SHOTS, sf) })
        report.push({ file: sf, ...(await overflow()) })
        // Error case: an amount over the pending balance.
        await page.fill('#settle-amount', '9999999.99')
        await sleep(300)
        const ef = `settle__toomuch__${vp.n}__${theme}__${SUFFIX}.png`
        await page.screenshot({ path: join(SHOTS, ef) })
        report.push({ file: ef, ...(await overflow()) })
        await page.keyboard.press('Escape')
        await page.goto(`${BASE}/403`, { waitUntil: 'domcontentloaded' })
      }
    }
  }
}
console.log(JSON.stringify(report, null, 1))
await browser.close()
