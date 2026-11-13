import { open, BASE } from './lib.mjs'
const { browser, page } = await open({ width: 390, height: 844 })
for (const id of ['5f35aff8-4047-42c8-9609-808dc67a9220','3bfe8ff1-7209-4bcb-a022-69ded3e9424e','44e0e4e1-56fb-419a-96cd-1a48e04db5b5']) {
  await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000)
  console.log(id.slice(0,8), await page.evaluate(() => { const o=[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && e.getBoundingClientRect().width>0 && !e.closest('[class*=devtools]')); return { docW: document.documentElement.scrollWidth, vw: innerWidth, over: o.slice(0,4).map(e=>e.className.toString().slice(0,50)) } }))
}
await browser.close()
