// T5 · Product detail: Presentaciones, Inventario, Historial (Contenido) at 1440/390, light/dark.
// node shoot.mjs --product "Name" --task presentations|inventory|history [--state data|loading|error|empty]
//   [--vp 1440|390] [--theme light|dark|both] [--tag x] [--full] [--scroll N]
import { join } from 'node:path'
import { BASE, SHOTS, open } from './lib.mjs'
import { productIds } from './ids.mjs'

const args = process.argv.slice(2)
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const name = flag('--product')
const task = flag('--task', 'presentations')
const state = flag('--state', 'data')
const vps = flag('--vp', '1440,390').split(',').map(Number)
const themes = flag('--theme', 'light,dark').split(',')
const tag = flag('--tag', '')
const full = args.includes('--full')
const scrollTo = flag('--scroll')
const { [name]: id } = await productIds([name])
if (!id) throw new Error('product not found')
const slug = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 24)
const LABEL = { presentations: 'Presentaciones', inventory: 'Inventario', history: 'Contenido', identity: 'Identidad' }
const ROUTES = {
  inventory: /\/inventory\/(products\/[^/]+\/stock|movements)/,
  presentations: /\/products\/[^/]+\/(variants|price-lists|images|lots)/,
  history: /\/products\/[^/]+\/editorial/,
}

for (const width of vps) {
  for (const theme of themes) {
    const { browser, page } = await open({ width, height: width < 768 ? 844 : 900, theme })
    if (state !== 'data') {
      await page.route((u) => u.port === '3003' && ROUTES[task].test(u.pathname) && !(state === 'kardex-error' && /stock$/.test(u.pathname)), async (route) => {
        if (route.request().method() !== 'GET') return route.continue()
        if (state === 'loading') { await new Promise((r) => setTimeout(r, 30000)); return route.abort().catch(() => {}) }
        if (state === 'error' || state === 'kardex-error') return route.fulfill({ status: 500, contentType: 'application/json', body: '{"statusCode":500,"message":"Internal server error"}' })
        return route.continue()
      })
    }
    await page.goto(`${BASE}/pos/products/${id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.getByRole('button', { name: LABEL[task], exact: true }).first().click()
    await page.waitForTimeout(state === 'loading' ? 1500 : 800)
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    if (task === 'history') {
      await page.getByTestId('open-history').first().click()
      await page.waitForTimeout(state === 'loading' ? 1500 : 900)
    }
    if (scrollTo) await page.evaluate((y) => { const s = [...document.querySelectorAll('.overflow-y-auto')].find((e) => e.scrollHeight > e.clientHeight); s?.scrollTo(0, Number(y)) }, scrollTo)
    if (full && task !== 'history') {
      const h = await page.evaluate(() => { const s = [...document.querySelectorAll('.overflow-y-auto')].find((e) => e.scrollHeight > e.clientHeight); return s ? s.scrollHeight - s.clientHeight : 0 })
      if (h > 0) { await page.setViewportSize({ width, height: (width < 768 ? 844 : 900) + h }); await page.waitForTimeout(500) }
    }
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
    const file = `${slug}__${task}__${state}__${width}__${theme}${tag ? '__' + tag : ''}.png`
    await page.screenshot({ path: join(SHOTS, file) })
    console.log(file, overflow ? 'OVERFLOW' : '')
    await browser.close()
  }
}
