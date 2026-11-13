// T11 items 3, 5, 6, 7 (MOCK live: S-000018 detail patched in the browser to IN_PROGRESS + liveSession). Nothing is sent: POSTs are fulfilled by the mock or aborted by the guard.
import { open, shot, BASE, blocked, settle, iconSizes, installLiveMock, currentUser } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const scenario = process.argv[3] ?? 'ok'
const h = Number(process.argv[4] ?? (w < 500 ? 844 : 900))
const mobile = w < 500
const { browser, page, log } = await open({ width: w, height: h })
let groups
page.on('response', async (r) => { if (/chatbot-requests\/groups\?/.test(r.url())) groups = await r.json().catch(() => null) })
await page.goto(`${BASE}/chatbot/solicitudes`, { waitUntil: 'domcontentloaded' }); await settle(page, 500)
const id = groups.items.flatMap((g) => g.requests ?? g.items ?? []).find((r) => r.folio === 'S-000018').id
const user = await currentUser(page)
const sessionState = { ok: 'ACTIVE', closed: 'ACTIVE', waiting: 'WAITING', starting: 'STARTING' }[scenario]
const st = await installLiveMock(page, { requestId: id, user, sessionState, windowOpen: scenario !== 'closed' })
if (process.argv[5] === 'many') {
  const base = Date.now() - 11 * 60_000
  for (let i = 0; i < 40; i++) { const seq = 5 + i; const out = i % 2; st.messages.push({ id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, seq, direction: out ? 'OUT' : 'IN', author: out ? 'STAFF' : 'CUSTOMER', staff: out ? user : null, type: 'TEXT', text: out ? `Respuesta de relleno número ${i}: con gusto te ayudo con eso.` : `Mensaje de relleno del cliente número ${i}: ¿me puedes confirmar el precio y la disponibilidad de ese producto?`, media: null, deliveryStatus: out ? 'READ' : null, clientMessageId: null, providerTimestamp: new Date(base + i * 10_000).toISOString(), createdAt: new Date(base + i * 10_000).toISOString() }) }
  st.nextSeq = 45
}
await page.goto(`${BASE}/chatbot/solicitudes/${id}`, { waitUntil: 'domcontentloaded' }); await settle(page, 2500)
const tag = `l1-${scenario}${process.argv[5] === 'many' ? '-many' : ''}-${w}x${h}`
await shot(page, `${tag}-load`)
console.log('scrollY after load', await page.evaluate(() => [scrollY, document.documentElement.scrollHeight, innerHeight]))
if (mobile) { const o = page.getByTestId('live-card-open'); console.log('live-card-open', await o.count()); await shot(page, `${tag}-detail`); if (await o.count()) { await o.click(); await page.waitForTimeout(1200) } }
await shot(page, `${tag}-live`)
const conv = page.getByTestId('detail-conversation')
console.log('MODE', (await conv.innerText()).replace(/\n+/g, ' | ').slice(0, 700))
// item 6: geometry
const ta = page.locator('textarea').first()
if (await ta.count()) {
  const g = await page.evaluate(() => {
    const t = document.querySelector('textarea'); const log = document.querySelector('[role=log]')
    const box = (e) => e && (({ top, bottom, height }) => ({ top: Math.round(top), bottom: Math.round(bottom), height: Math.round(height) }))(e.getBoundingClientRect())
    let sc = log; const chain = []
    while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY)) chain.push({ el: sc.tagName + '.' + String(sc.className).slice(0, 50), sh: sc.scrollHeight, ch: sc.clientHeight, oy: cs.overflowY }); sc = sc.parentElement }
    return { vh: innerHeight, scrollY, docH: document.documentElement.scrollHeight, textarea: box(t), log: box(log), scrollers: chain, logMaxH: log && getComputedStyle(log).maxHeight }
  })
  console.log('GEOM', JSON.stringify(g))
  console.log('composer in view without scroll:', g.textarea.bottom <= g.vh && g.textarea.top >= 0, '| page scrolled:', g.scrollY)
}
// item 6/7: «Qué hacer» panel + rail card
const acts = await page.locator('[data-testid=action-panel] button, [data-testid=mobile-action-bar] button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const cs = getComputedStyle(e); return { t: e.innerText.trim().replace(/\s+/g, ' '), id: e.dataset.testid, bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, fw: cs.fontWeight, dis: e.disabled } }))
console.log('ACTIONS', JSON.stringify(acts))
const sp = page.getByTestId('session-panel')
console.log('session-panel count', await sp.count(), 'visible', await sp.first().isVisible().catch(() => false))
if (await sp.count() && await sp.first().isVisible()) { console.log('SESSION', (await sp.first().innerText()).replace(/\n+/g, ' | ')); const par = sp.first().locator('xpath=ancestor::*[contains(@class,"rd-card") or self::section or self::aside][1]'); await (await par.count() ? par : sp.first()).screenshot({ path: `${process.cwd()}/shots/${tag}-session-card.png` }) }
if (scenario === 'closed') {
  console.log('BLOCKED BOX icons', JSON.stringify(await iconSizes(page, '[data-testid=live-blocked], .rd-alert, .lc-note')))
  console.log('rd-alert/lc-note', JSON.stringify(await page.locator('.rd-alert, .lc-note').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ cls: String(e.className).slice(0, 40), t: e.innerText.trim().replace(/\s+/g, ' ').slice(0, 90), h: Math.round(e.getBoundingClientRect().height) })))))
  const tb = page.getByRole('button', { name: /Enviar plantilla/ }).first()
  await tb.click(); await page.waitForTimeout(1000)
  await shot(page, `${tag}-template-sheet`)
  const dlg = page.locator('[role=dialog]').last()
  console.log('TEMPLATE SHEET', (await dlg.innerText()).replace(/\n+/g, ' | '))
  console.log('template sheet icons', JSON.stringify(await iconSizes(page, '[role=dialog]')))
  const r = await dlg.evaluate((e) => { const b = e.getBoundingClientRect(); return { h: Math.round(b.height), vh: innerHeight } }); console.log('sheet box', JSON.stringify(r))
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  console.log('template POSTs (mock)', st.templatePosts.length, 'dialogs left', await page.locator('[role=dialog]').count())
}
if (mobile && scenario === 'ok') {
  const attach = page.getByRole('button', { name: /Adjuntar/ }).first()
  console.log('attach btn', await attach.count())
  if (await attach.count()) {
    await attach.click(); await page.waitForTimeout(900); await shot(page, `${tag}-attach-sheet`)
    const dlg = page.locator('[role=dialog]').last()
    console.log('ATTACH', (await dlg.innerText().catch(() => 'no dialog')).replace(/\n+/g, ' | '))
    console.log('attach sheet box', JSON.stringify(await page.evaluate(() => { const d = [...document.querySelectorAll('[role=dialog]')].pop(); const c = d.closest('[class*=rc-portal], [class*=portal]') ?? d; const b = d.getBoundingClientRect(); return { dialogH: Math.round(b.height), dialogTop: Math.round(b.top), vh: innerHeight, cls: String(c.className).slice(0, 120) } })))
    await page.keyboard.press('Escape'); await page.waitForTimeout(600); console.log('dialogs left', await page.locator('[role=dialog]').count())
  }
}
await shot(page, `${tag}-final`, true)
console.log('REAL non-GET attempted (must be empty):', blocked, '| mocked posts', st.posts.length, st.templatePosts.length)
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
