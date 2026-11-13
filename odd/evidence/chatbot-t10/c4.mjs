import { open, shot, BASE, blocked } from './lib.mjs'
import { installLiveMock, currentUser } from './mock-live.mjs'
const w = Number(process.argv[2] ?? 1440)
const scenario = process.argv[3] ?? 'ok'
const mobile = w < 500
const { browser, page, log } = await open({ width: w, height: mobile ? 844 : 900 })
// find S-000018's id
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
const id = groups.items.flatMap((g) => g.requests ?? g.items ?? []).find((r) => r.folio === 'S-000018').id
const user = await currentUser(page)
const sessionState = { ok: 'ACTIVE', failed: 'ACTIVE', network: 'ACTIVE', closed: 'ACTIVE', starting: 'STARTING', waiting: 'WAITING', ended: 'ENDED', ending: 'ENDING' }[scenario]
const post = ['failed', 'network'].includes(scenario) ? scenario : 'ok'
const st = await installLiveMock(page, { requestId: id, user, sessionState, windowOpen: scenario !== 'closed', post })
await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2500)
const tag = `c4-${scenario}-${w}`
if (mobile) { await shot(page, `${tag}-detail`); const open = page.getByTestId('live-card-open'); console.log('card-open', await open.count()); if (await open.count()) { await open.click(); await page.waitForTimeout(1200) } }
await shot(page, `${tag}-a`)
const conv = page.getByTestId('detail-conversation')
console.log('MODE TEXT', (await conv.innerText()).replace(/\n+/g, ' | ').slice(0, 900))
const composer = page.locator('textarea')
console.log('textarea', await composer.count(), 'visible', await composer.first().isVisible().catch(() => false), 'disabled', await composer.first().isDisabled().catch(() => 'n/a'), 'placeholder', await composer.first().getAttribute('placeholder').catch(() => null))
if (['ok', 'failed', 'network'].includes(scenario)) {
  await composer.first().click(); await composer.first().fill('Sí, tenemos de 15 kg. ¿Te la apartamos?')
  await shot(page, `${tag}-typed`)
  await page.keyboard.press('Shift+Enter'); await page.keyboard.type('Segunda línea'); await page.waitForTimeout(200)
  console.log('after shift+enter, posts:', st.posts.length)
  await composer.first().fill('Sí, tenemos de 15 kg. ¿Te la apartamos?')
  await page.keyboard.press('Enter'); await page.waitForTimeout(700)
  console.log('POSTS after Enter:', st.posts.length, JSON.stringify(st.posts.map((p) => ({ keys: Object.keys(p.body), key: p.key === p.body.clientMessageId }))))
  await shot(page, `${tag}-queued`)
  console.log('LAST BUBBLE (queued)', (await page.locator('[role=log]').innerText()).split('\n').filter(Boolean).slice(-4).join(' | '))
  for (const [ms, name] of [[4500, 'sent'], [5500, 'read']]) { await page.waitForTimeout(ms); await shot(page, `${tag}-${name}`); console.log(`LAST BUBBLE (${name})`, (await page.locator('[role=log]').innerText()).split('\n').filter(Boolean).slice(-4).join(' | ')) }
  console.log('retry buttons', await page.getByRole('button', { name: /Reintentar/ }).count())
  console.log('composer after send value=', JSON.stringify(await composer.first().inputValue()))
}
if (scenario === 'closed') {
  const tb = page.getByRole('button', { name: /Enviar plantilla/ }).first()
  console.log('template btn', await tb.count()); await tb.click(); await page.waitForTimeout(1000)
  await shot(page, `${tag}-template-sheet`)
  console.log('SHEET', (await page.locator('[role=dialog]').last().innerText()).replace(/\n+/g, ' | '))
  await page.keyboard.press('Escape'); await page.waitForTimeout(500)
  console.log('template POSTs', st.templatePosts.length)
}
if (mobile && ['ok', 'closed'].includes(scenario)) {
  const attach = page.getByRole('button', { name: /Adjuntar/ }).first()
  console.log('attach btn', await attach.count())
  if (await attach.count()) { await attach.click(); await page.waitForTimeout(800); await shot(page, `${tag}-attach-sheet`); console.log('ATTACH', (await page.locator('[role=dialog]').last().innerText().catch(() => 'no dialog')).replace(/\n+/g, ' | ')) }
}
await shot(page, `${tag}-final`, true)
console.log('REAL non-GET attempted (must be empty):', blocked, '| mocked posts', st.posts.length, st.templatePosts.length)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
