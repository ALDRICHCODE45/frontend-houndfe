import { open, BASE } from './lib.mjs'
const { browser, page } = await open()
const out = {}
page.on('response', async (r) => { const m = r.url().match(/chatbot-requests\/([0-9a-f-]{36})$/); if (m && r.request().method()==='GET') out[m[1]] = await r.json().catch(() => null) })
for (const id of ['5f35aff8-4047-42c8-9609-808dc67a9220','3bfe8ff1-7209-4bcb-a022-69ded3e9424e','44e0e4e1-56fb-419a-96cd-1a48e04db5b5']) {
  await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3500)
}
for (const [id, d] of Object.entries(out)) { const r = d.request ?? d; console.log(r.folio, r.subtype, 'allowed', JSON.stringify(r.allowedActions), 'denied', JSON.stringify(r.deniedActions), 'wcs', r.windowClosingSoon, 'liveSession', JSON.stringify(r.liveSession)) }
await browser.close()
