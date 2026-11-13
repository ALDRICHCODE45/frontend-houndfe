import { open, shot, BASE, blocked } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
let counts
page.on('response', async (r) => { if (/chatbot-requests\/counts/.test(r.url())) counts = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1500)
console.log('COUNTS', JSON.stringify(counts))
await shot(page, `c1-inbox-${w}`)
const body = await page.locator('body').innerText()
console.log('BODY', body.replace(/\n+/g, ' | ').slice(0, 1800))
console.log('FILTERS', await page.getByText(/Agendadas/).evaluateAll((e) => e.map((x) => x.tagName + ':' + x.innerText.replace(/\s+/g, ' '))))
for (const f of ['S-000020', 'S-000021', 'S-000022']) {
  const row = page.locator('[class*=chatbot-row]', { hasText: f }).first()
  console.log(f, (await row.count()) ? (await row.innerText()).replace(/\n+/g, ' | ') : 'ROW NOT FOUND')
}
// Agendadas filter
const tab = page.getByRole('tab', { name: /Agendadas/ }).or(page.getByRole('button', { name: /Agendadas/ })).first()
console.log('agendadas control count', await tab.count())
if (await tab.count()) { await tab.click(); await page.waitForTimeout(2000); await shot(page, `c1-agendadas-${w}`); console.log('AGENDADAS VIEW', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 1800)); await shot(page, `c1-agendadas-${w}-full`, true) }
console.log('REQ', log.requests.filter((x) => /chatbot-requests/.test(x)).slice(-6))
console.log('CONSOLE', log.console, 'FAILED', log.failed, 'BLOCKED', blocked)
await browser.close()
