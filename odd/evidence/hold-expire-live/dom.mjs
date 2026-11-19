import { makeLog, open, settle, BASE } from './lib.mjs'
const log = makeLog('dom-probe')
const { browser, page } = await open(log)
await page.goto(`${BASE}/pos/ventas`); await settle(page, 1200)
log(JSON.stringify(await page.$$eval('thead th', (ths) => ths.map((t) => t.innerHTML.replace(/<svg.*?<\/svg>/gs, '').replace(/class="[^"]*"/g, '').slice(0, 300)))))
await browser.close()
