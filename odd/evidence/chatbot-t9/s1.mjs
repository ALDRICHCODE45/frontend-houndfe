import { open, shot, BASE } from './lib.mjs'
const { browser, page, log } = await open()
log.requests.length = 0
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log(page.url())
console.log((await page.locator('body').innerText()).slice(0, 5000))
await shot(page, '01-inbox-1440', true)
console.log(log.requests.join('\n')); console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
