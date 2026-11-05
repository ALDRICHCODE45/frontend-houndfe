// T2 · Decisiones pendientes: list + drawer in data/empty/loading/error,
// 1440 and 390, light and dark. Shots go to ./shots (uncommitted).
// node shoot.mjs [--only list,drawer-restock,...] [--tag suffix]
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BASE, SHOTS, open } from './lib.mjs'

const args = process.argv.slice(2)
const flag = (name) => args[args.indexOf(name) + 1]
const only = args.includes('--only') ? flag('--only').split(',') : null
const tag = args.includes('--tag') ? `__${flag('--tag')}` : ''
const VIEWPORTS = [
  [1440, 900],
  [390, 844],
]
const THEMES = ['light', 'dark']
const LIST = /\/human-decisions$/
const DETAIL = /\/human-decisions\/[^/]+$/
const pathOf = (u) => {
  try {
    return new URL(u).pathname
  } catch {
    return ''
  }
}

const SCENES = [
  { slug: 'list', state: 'data' },
  { slug: 'list', state: 'empty' },
  { slug: 'list', state: 'loading' },
  { slug: 'list', state: 'error' },
  { slug: 'list-pending', state: 'data', filter: 'Pendientes' },
  { slug: 'list-nomatch', state: 'data', search: 'zzz collar' },
  { slug: 'drawer-restock', state: 'data', row: /Tetra|Ever Clean/ },
  { slug: 'drawer-expiration', state: 'data', row: /Catit/ },
  { slug: 'drawer-resolved', state: 'data', row: /Cama ortopédica/ },
  { slug: 'drawer-resolved-exp', state: 'data', row: /Collar GPS/ },
  { slug: 'drawer', state: 'loading', row: /Tetra|Ever Clean/ },
  { slug: 'drawer', state: 'error', row: /Tetra|Ever Clean/ },
  { slug: 'drawer-invalid', state: 'data', row: /Tetra|Ever Clean/, act: 'invalid' },
  { slug: 'drawer-confirm', state: 'data', row: /Tetra|Ever Clean/, act: 'confirm' },
]

async function wire(page, scene) {
  const target = scene.slug.startsWith('drawer') && scene.slug !== 'drawer-restock' ? DETAIL : LIST
  if (scene.state === 'data') return
  const re = scene.slug === 'list' ? LIST : DETAIL
  await page.route(
    (u) => re.test(u.pathname) && u.port === '3003',
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue()
      if (scene.state === 'loading') {
        await new Promise((r) => setTimeout(r, 30000))
        return route.abort().catch(() => {})
      }
      if (scene.state === 'error')
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{"statusCode":500,"message":"Internal server error"}' })
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: { nextCursor: null, totalCount: 0 } }),
      })
    },
  )
  void target
}

for (const [width, height] of VIEWPORTS) {
  for (const theme of THEMES) {
    const { browser, page } = await open({ width, height, theme })
    for (const scene of SCENES) {
      const name = `${scene.slug}${scene.slug === 'drawer' ? '' : ''}__${scene.state}__${width}__${theme}${tag}.png`
      if (only && !only.includes(scene.slug) && !only.includes(`${scene.slug}:${scene.state}`)) continue
      if (existsSync(join(SHOTS, name))) continue // resumable
      await page.unrouteAll({ behavior: 'ignoreErrors' })
      const listPhase = scene.slug === 'list'
      if (listPhase) await wire(page, scene)
      await page.goto(`${BASE}/pos/decisiones-pendientes`, { waitUntil: 'domcontentloaded' })
      if (scene.state === 'loading' && listPhase) await page.waitForTimeout(1500)
      else await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      if (scene.filter) {
        const trigger = page.getByTestId('human-decisions-status').first()
        if (width < 768) await page.getByRole('button', { name: /Filtros/ }).click()
        await trigger.click()
        await page.getByRole('option', { name: scene.filter }).click()
        if (width < 768) await page.keyboard.press('Escape')
        await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(400)
      }
      if (scene.search) {
        await page.getByPlaceholder(/Buscar/).first().fill(scene.search)
        await page.waitForTimeout(900)
        await page.waitForLoadState('networkidle').catch(() => {})
      }
      if (scene.row) {
        if (!listPhase) await wire(page, scene)
        const cell = page.getByText(scene.row).first()
        await cell.click()
        if (scene.state === 'loading') await page.waitForTimeout(1500)
        else await page.waitForLoadState('networkidle').catch(() => {})
        await page.waitForTimeout(600)
        if (scene.act === 'invalid') {
          await page.getByTestId('provide-restock-estimate').click()
          await page.waitForTimeout(300)
        }
        if (scene.act === 'confirm') {
          await page.locator('input#restock-days, [data-testid="restock-days-input"] input').first().fill('7')
          await page.getByTestId('provide-restock-estimate').click()
          await page.waitForTimeout(500)
        }
      }
      const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth)
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
      await page.screenshot({ path: join(SHOTS, name), fullPage: !scene.row })
      console.log(name, overflow ? 'OVERFLOW' : '', dark ? 'dark' : 'light', pathOf(page.url()))
    }
    await browser.close()
  }
}
