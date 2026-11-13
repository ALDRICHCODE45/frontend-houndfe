import { open, shot, BASE } from './lib.mjs'
const { browser, page, log } = await open({ width: 390, height: 844 })
await page.route(/:3003\/chatbot-/, (route) => route.request().method() !== 'GET' ? route.abort() : route.continue())
for (const [id, n] of [['5f35aff8-4047-42c8-9609-808dc67a9220','clarif'],['3bfe8ff1-7209-4bcb-a022-69ded3e9424e','decision']]) {
await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(3000)
await page.getByRole('button', { name: /más acciones|acciones|^…$|\.\.\./i }).first().click().catch(async () => { await page.locator('button:has(svg)').last().click() })
await page.waitForTimeout(800)
await shot(page, `mobile-more-actions-${n}-390`)
console.log(n, (await page.locator('[role=menu], [role=dialog]').last().innerText().catch(()=>'?')).replace(/\n+/g,' | '))
console.log(n, 'all visible buttons:', (await page.locator('button:visible').evaluateAll(b=>b.map(x=>(x.innerText||x.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ')))).join(' | '))
await page.keyboard.press('Escape')
}
console.log('CONSOLE', log.console, log.failed)
await browser.close()
