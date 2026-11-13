import { open, shot, BASE, blocked, IDS } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const key = process.argv[3] ?? 's20'
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
const slots = []
page.on('response', async (r) => { if (/scheduling\/slots/.test(r.url())) slots.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), status: r.status(), body: await r.json().catch(() => null) }) })
await page.goto(`${BASE}/chatbot/solicitudes/${IDS[key]}`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2000)
console.log('DETAIL', (await page.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 2500))
const btns = await page.locator('button:visible, a[role=button]:visible').evaluateAll((els) => els.map((e) => ({ t: (e.innerText || '').trim().replace(/\s+/g, ' '), a: e.getAttribute('aria-label'), dis: e.disabled || e.getAttribute('aria-disabled') })))
console.log('BUTTONS', JSON.stringify(btns.filter((b) => b.t || b.a)))
await shot(page, `c2-${key}-detail-${w}`); await shot(page, `c2-${key}-detail-${w}-full`, true)
const rs = page.getByRole('button', { name: /Reagendar/ }).first()
console.log('reagendar btn', await rs.count())
if (await rs.count()) {
  await rs.click(); await page.waitForTimeout(2500)
  await shot(page, `c2-${key}-resched-open-${w}`)
  const dlg = page.locator('[role=dialog]').last()
  console.log('SHEET', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 2500))
  console.log('radios', await page.getByRole('radio').count())
  console.log('SLOTS GET', JSON.stringify(slots.map((s) => ({ url: s.url, status: s.status, n: s.body && (s.body.items ?? s.body.slots ?? []).length, sample: JSON.stringify(s.body).slice(0, 700) }))))
  // pick the first radio, then one outside the window (last)
  const radios = page.getByRole('radio')
  const n = await radios.count()
  if (n) {
    await radios.first().click({ force: true }); await page.waitForTimeout(600)
    console.log('PICK FIRST', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 2000))
    await shot(page, `c2-${key}-resched-pick1-${w}`)
    await radios.nth(n - 1).click({ force: true }); await page.waitForTimeout(600)
    console.log('PICK LAST', (await dlg.innerText()).replace(/\n+/g, ' | ').slice(0, 2000))
    await shot(page, `c2-${key}-resched-pickN-${w}`)
    await dlg.evaluate((d) => d.querySelectorAll('*').forEach(() => {}))
    // scroll the sheet bottom
    await shot(page, `c2-${key}-resched-pickN-${w}-full`, true)
  }
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  console.log('closed, dialogs left:', await page.locator('[role=dialog]').count())
  await shot(page, `c2-${key}-resched-closed-${w}`)
}
console.log('REQ', log.requests.filter((x) => /chatbot-requests/.test(x)))
console.log('CONSOLE', log.console, 'FAILED', log.failed, 'BLOCKED', blocked)
await browser.close()
