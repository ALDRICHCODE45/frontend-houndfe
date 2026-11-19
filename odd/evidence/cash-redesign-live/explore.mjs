import { open, settle, shot, makeLog, BASE } from './lib.mjs'
const [role = 'cashier', width = '1440', name = 'explore'] = process.argv.slice(2)
const log = makeLog(name)
const { browser, page } = await open(log, { role, width: +width })
await page.goto(`${BASE}/pos/caja`); await settle(page, 1500)
await shot(page, name, log, true)
const main = await page.locator('main').innerText().catch(() => page.locator('body').innerText())
log('TEXT\n' + main.slice(0, 4000))
await browser.close()
