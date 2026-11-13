import { open, shot, BASE } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
const ID = '44e0e4e1-56fb-419a-96cd-1a48e04db5b5'
const api = []
page.on('response', async (r) => { if (/conversation\?/.test(r.url())) { const j = await r.json().catch(()=>null); api.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), keys: Object.keys(j??{}), n: j?.items?.length, more: j?.hasMoreBefore, first: j?.items?.[0]?.seq, last: j?.items?.at(-1)?.seq }) } })
await page.goto(`${BASE}/chatbot/solicitudes/${ID}`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(2500)
const st = () => page.evaluate(() => { const l = document.querySelector('.rc-log'); const msgs=[...l.querySelectorAll('[data-testid=conversation-message]')]; return { n: msgs.length, firstSeq: msgs[0]?.dataset.seq, top: Math.round(l.scrollTop), sh: l.scrollHeight, ch: l.clientHeight, days: [...l.querySelectorAll('[data-testid=conversation-day]')].map(d=>d.textContent.trim()), kinds: [...l.querySelectorAll('[data-testid^=media-]')].map(m=>m.dataset.testid+':'+(m.querySelector('img')?'img':m.querySelector('audio, [data-testid=voice-player]')?'audio':'other')), older: !!document.querySelector('[data-testid=conversation-older]') } })
const s0 = await st(); console.log('initial', JSON.stringify(s0))
// scroll the log to the top so lazy media near top appear, record anchor
const bottomShot = async (n) => { await shot(page, n) }
await bottomShot(`conv-initial-bottom-${w}`)
// scroll page area so conversation panel is visible
await page.locator('[data-testid=detail-conversation]').scrollIntoViewIfNeeded()
await shot(page, `conv-panel-${w}`)
// anchor: first visible message at the log's top before loading
await page.evaluate(() => { document.querySelector('.rc-log').scrollTop = 0 })
await page.waitForTimeout(800)
const anchorBefore = await page.evaluate(() => { const l = document.querySelector('.rc-log'); const m = l.querySelector('[data-testid=conversation-message]'); return { seq: m.dataset.seq, offset: Math.round(m.getBoundingClientRect().top - l.getBoundingClientRect().top) } })
console.log('anchor before', anchorBefore)
const req0 = log.requests.length
await page.getByTestId('conversation-older').click()
await page.waitForTimeout(2500)
const s1 = await st(); console.log('after older', JSON.stringify(s1))
const anchorAfter = await page.evaluate((seq) => { const l = document.querySelector('.rc-log'); const m = l.querySelector(`[data-seq="${seq}"]`); return { offset: Math.round(m.getBoundingClientRect().top - l.getBoundingClientRect().top), logTop: Math.round(l.scrollTop) } }, anchorBefore.seq)
console.log('anchor after', anchorAfter)
console.log('requests after click:', log.requests.slice(req0).filter(x=>/chatbot/.test(x)).join(' ; '))
console.log('api', JSON.stringify(api))
await shot(page, `conv-after-older-top-${w}`)
// scroll each media into view, wait for load
const seen = await page.evaluate(async () => {
  const out = []
  for (const m of document.querySelectorAll('.rc-log [data-testid^=media-]')) { m.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 1200)); out.push({ t: m.dataset.testid, k: m.dataset.kind, img: !!m.querySelector('img'), imgOk: m.querySelector('img')?.naturalWidth ?? null, imgW: Math.round(m.getBoundingClientRect().width), text: m.textContent.trim().slice(0, 60) }) }
  return out
})
console.log('media', JSON.stringify(seen, null, 0))
console.log('final state', JSON.stringify(await st()))
console.log('media requests', log.requests.filter(x => /media/.test(x)).join(' ; '))
for (const t of ['image','sticker','audio','file']) {}
for (const [i, sel] of [['image','[data-kind=image]'],['sticker','[data-kind=sticker]'],['audio','[data-kind=audio]'],['pdf','[data-kind=document], [data-kind=file], [data-kind=pdf]']].entries()) {
  const el = page.locator('.rc-log ' + sel[1]).first()
  if (await el.count()) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await shot(page, `conv-${sel[0]}-${w}`) } else console.log('no element for', sel[0])
}
console.log('CONSOLE', log.console, 'FAILED', log.failed)
await browser.close()
