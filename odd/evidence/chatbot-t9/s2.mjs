import { open, shot, BASE } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(1000)
const rows = (groups.items).flatMap((g) => g.requests ?? g.items ?? [])
const id = (f) => rows.find((r) => r.folio === f).id
for (const [folio, label] of [['S-000004', 'clarif'], ['S-000008', 'decision'], ['S-000018', 'conv']]) {
  console.log('=====', folio, id(folio))
  // open via the SPA: click the row link
  log.requests.length = 0
  await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  log.requests.length = 0
  await page.locator(`a[href$="/${id(folio)}"]`).first().click()
  await page.waitForURL(/solicitudes\/[0-9a-f-]+/, { waitUntil: 'commit' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2500)
  console.log('requests on open (SPA click):\n ' + log.requests.filter((x) => /chatbot|media/.test(x)).join('\n '))
  const btns = await page.locator('button:visible, a[role=button]:visible').evaluateAll((els) => els.map((e) => ({ t: (e.innerText || '').trim().replace(/\s+/g, ' '), a: e.getAttribute('aria-label'), dis: e.disabled, c: e.className.toString().slice(0,0), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })))
  console.log('buttons:', JSON.stringify(btns.filter((b) => b.t === '' ).map(b=>b)), '\n named:', btns.filter(b=>b.t).map(b=>b.t).join(' | '))
  await shot(page, `${label}-detail-${w}`)
  await shot(page, `${label}-detail-${w}-full`, true)
  console.log((await page.locator('body').innerText()).slice(0, 2500))
  // direct deep link
  log.requests.length = 0
  await page.goto(`${BASE}/chatbot/solicitudes/${id(folio)}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(2500)
  console.log('requests on open (deep link):\n ' + log.requests.filter((x) => /chatbot|media/.test(x)).join('\n '))
}
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
