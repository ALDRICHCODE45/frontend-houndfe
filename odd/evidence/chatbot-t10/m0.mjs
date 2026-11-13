import { open, BASE } from './lib.mjs'
const { browser, page, log } = await open({ width: 1440, height: 900 })
const seen = {}
page.on('response', async (r) => { const u = r.url().replace(/^https?:\/\/[^/]+/, ''); if (r.request().method()==='GET' && /auth|\/me|chatbot-requests\/[0-9a-f-]+$|chatbot-settings/.test(u)) seen[u] = await r.text().catch(() => '') })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500)
const r = await page.evaluate(async () => {
  const keys = Object.keys(localStorage); return keys
})
console.log('LS keys', r)
const groups = await page.evaluate(() => 1)
console.log(Object.keys(seen))
await page.locator('a[href*="/chatbot/solicitudes/"]').first().click(); await page.waitForTimeout(2500)
for (const [u, b] of Object.entries(seen)) console.log(u, b.slice(0, 1200).replace(/"(token|accessToken|refreshToken)":"[^"]+"/g, '"$1":"…"'))
await browser.close()
