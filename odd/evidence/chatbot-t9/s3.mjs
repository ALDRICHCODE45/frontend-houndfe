import { open, shot, BASE } from './lib.mjs'
const w = Number(process.argv[2] ?? 1440)
const { browser, page, log } = await open({ width: w, height: w < 500 ? 844 : 900 })
const ID = '44e0e4e1-56fb-419a-96cd-1a48e04db5b5'
const api = []
page.on('response', async (r) => { if (/conversation\?/.test(r.url())) { const j = await r.json().catch(()=>null); api.push({ url: r.url().replace(/^https?:\/\/[^/]+/, ''), n: j?.items?.length, more: j?.hasMoreBefore, first: j?.items?.[0]?.seq, last: j?.items?.at(-1)?.seq, kinds: [...new Set((j?.items??[]).map(m=>m.kind ?? m.type))] }) } })
await page.goto(`${BASE}/chatbot/solicitudes/${ID}`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
await page.waitForTimeout(3000)
console.log('cancel btn state (S-18):', await page.getByRole('button', { name: /Cancelar solicitud/ }).evaluate(e => ({dis: e.disabled, aria: e.getAttribute('aria-disabled')})))
const probe = async (tag) => page.evaluate(() => {
  const bubbles = [...document.querySelectorAll('[class*="conv"] [class*="bubble"], [data-testid*="message"], [class*="message"]')]
  const sc = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 5 && ['auto','scroll'].includes(getComputedStyle(e).overflowY))
  return { scrollers: sc.map(e => ({ c: e.className.toString().slice(0,60), top: Math.round(e.scrollTop), sh: e.scrollHeight, ch: e.clientHeight })), winY: Math.round(scrollY), winH: document.documentElement.scrollHeight }
})
console.log('before older', JSON.stringify(await probe()))
const count = () => page.evaluate(() => document.querySelectorAll('[class*="rd-conv"][class*="msg"], .rd-msg, [data-seq], [data-message-id]').length)
console.log('msg-like nodes', await count())
const html = await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => /^Conversación$/.test(e.textContent.trim()) && e.children.length===0); const sec = el?.closest('section') ?? el?.parentElement?.parentElement; return sec ? sec.outerHTML.slice(0, 2500) : 'none' })
console.log(html)
await browser.close()
