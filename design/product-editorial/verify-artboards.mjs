import { chromium } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const base = 'design/product-editorial/'
await mkdir(base + '.screenshots', { recursive: true })
const report = { checks: [], screenshots: [], pageErrors: [], network: [], cleanup: false }
const check = (name, actual, expected = true) => report.checks.push({ name, pass: actual === expected, actual, expected })
const browser = await chromium.launch({ headless: true })
try {
  for (const [index, file] of ['01-task-workspace.html', '02-document-inspector.html', '03-guided-workspace.html'].entries()) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      page.setDefaultTimeout(5000)
      page.on('pageerror', error => report.pageErrors.push({ file, message: error.message }))
      await page.route(/^https?:/, route => { report.network.push(route.request().url()); return route.abort() })
      await page.goto(pathToFileURL(resolve(base + file)).href, { timeout: 15000 })
      // The browser parses the actual inline scripts; pageerror captures syntax failures.
      for (const width of [1440, 390]) {
        for (const theme of ['light', 'dark']) {
          await page.setViewportSize({ width, height: 1000 })
          await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
          await page.locator('#theme').focus()
          const metrics = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth,
            focus: getComputedStyle(document.activeElement).outlineWidth,
            small: [...document.querySelectorAll('button,input,select,textarea,a[href]')].filter(e => e.getClientRects().length && !e.disabled).map(e => ({ e, r: (e.type === 'checkbox' ? e.closest('label') : e).getBoundingClientRect() })).filter(({ r }) => r.width < 43.5 || r.height < 43.5).map(({ e, r }) => ({ id: e.id, text: e.textContent.trim().slice(0,60), width: r.width, height: r.height }))
          }))
          check(`${file} ${width} ${theme}: no horizontal overflow`, !metrics.overflow)
          check(`${file} ${width} ${theme}: focus 2px`, metrics.focus, '2px')
          check(`${file} ${width} ${theme}: touch targets`, metrics.small.length, 0)
          if (metrics.small.length) report.checks.at(-1).details = metrics.small
          const shot = base + `.screenshots/${index + 1}-${width}-${theme}.png`
          await page.screenshot({ path: shot, fullPage: false })
          report.screenshots.push(shot)
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 })
      if (index === 0) {
        await page.locator('#title').fill('Título local de prueba')
        check(file + ': dirty cannot publish', await page.locator('#publish').isDisabled())
        await page.locator('#save-editorial').click()
        await page.getByRole('button', { name: 'Revisión y publicación', exact: true }).click()
        check(file + ': saved can review publication', await page.locator('#publish').isEnabled())
        await page.locator('#publish').click()
        check(file + ': explicit consent', await page.locator('#confirm').isDisabled())
        await page.keyboard.press('Escape')
        check(file + ': escape closes dialog', !(await page.locator('#confirm-dialog').isVisible()))
        for (const value of ['readonly', 'conflict', 'ambiguous']) {
          await page.locator('#scenario').selectOption(value)
          check(file + ': scenario ' + value, await page.locator('#publish').isDisabled())
        }
      } else if (index === 1) {
        await page.locator('#title').fill('Título local de prueba')
        await page.locator('.tabs [data-view="review"]').click()
        check(file + ': dirty cannot publish', await page.locator('#openPublish').isDisabled())
        await page.locator('.tabs [data-view="editorial"]').click()
        await page.locator('#title').fill('')
        await page.locator('#saveDraft').click()
        check(file + ': incomplete draft can be saved', await page.locator('#savedTitle').textContent(), '')
        await page.locator('.tabs [data-view="review"]').click()
        for (const value of ['readonly', 'conflict', 'uncertain']) {
          await page.locator('#scenario').selectOption(value)
          check(file + ': scenario ' + value, await page.locator('#openPublish').isDisabled())
        }
      } else {
        await page.locator('#edit-mode').click()
        await page.locator('[data-page="content"]').click()
        await page.locator('#editorial-title').fill('')
        await page.locator('#description').fill('')
        await page.locator('#editorial-save').click()
        check(file + ': incomplete draft can be saved', await page.locator('#saved-title').textContent(), '')
      }
      const ids = index === 0 ? { publish: '#publish', confirm: '#confirm', dialog: '#confirm-dialog', published: '#published-title' } : index === 1 ? { publish: '#openPublish', confirm: '#confirmPublish', dialog: '#publishDialog', published: '#publishedTitle' } : { publish: '#publish', confirm: '#confirm-publish', dialog: '#confirm-dialog', published: '#published-title' }
      if (index === 2) await page.locator('[data-page="review"]').click()
      await page.locator('#scenario').selectOption('normal')
      const before = await page.locator(ids.published).textContent()
      await page.locator(ids.publish).click()
      check(file + ': consent required before confirmation', await page.locator(ids.confirm).isDisabled())
      await page.keyboard.press('Escape')
      check(file + ': cancelling preserves published copy', await page.locator(ids.published).textContent(), before)
      await page.locator('#scenario').selectOption('care')
      await page.locator(ids.publish).click()
      await page.locator('#consent').check()
      if (index === 1) {
        check(file + ': care requires additional acknowledgement', await page.locator(ids.confirm).isDisabled())
        await page.locator('#careConsent').check()
      }
      await page.locator(ids.confirm).click()
      check(file + ': confirmation closes dialog', !(await page.locator(ids.dialog).isVisible()))
      const savedSelector = index === 1 ? '#savedTitle' : '#saved-title'
      check(file + ': confirmation copies only saved content', await page.locator(ids.published).textContent(), await page.locator(savedSelector).textContent())
      for (const scenario of ['readonly','conflict', index === 0 ? 'ambiguous' : 'uncertain']) {
        await page.locator('#scenario').selectOption(scenario)
        check(file + ': publication blocked in ' + scenario, await page.locator(ids.publish).isDisabled())
      }
      await page.locator('#scenario').selectOption('normal')
      await page.setViewportSize({ width: 390, height: 1000 })
      const routes = index === 0 ? ['editorial','review','concepts'] : index === 1 ? ['editorial','operations','new','review'] : ['identity','variants','content','review']
      for (const route of routes) {
        if (index === 0) await page.locator('#mobile-task').selectOption(route)
        else if (index === 1) await page.locator(route === 'new' ? '.heading [data-view="new"]' : `.tabs [data-view="${route}"]`).click()
        else await page.locator(`[data-page="${route}"]`).click()
        check(`${file}: mobile ${route} no overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      }
      const reviewShot = base + `.screenshots/${index + 1}-390-review.png`
      await page.screenshot({ path: reviewShot, fullPage: true })
      report.screenshots.push(reviewShot)
    } finally { await context.close() }
  }
} catch (error) { report.error = { message: error.message, stack: error.stack } }
finally {
  await browser.close()
  report.cleanup = true
  check('No JavaScript page errors', report.pageErrors.length, 0)
  check('No external network requests', report.network.length, 0)
  report.status = !report.error && report.checks.every(c => c.pass) ? 'passed' : 'failed'
  await writeFile(base + 'verification.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failures: report.checks.filter(c => !c.pass), error: report.error, screenshots: report.screenshots.length, cleanup: report.cleanup }, null, 2))
  if (report.status !== 'passed') process.exitCode = 1
}
