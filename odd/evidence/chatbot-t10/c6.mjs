// Settings sections' «Aún sin efecto» badges per section, icon-size probe, and design reference renders. GET only.
import { open, shot, BASE, blocked, IDS } from './lib.mjs'
import { chromium } from '@playwright/test'
const { browser, page, log } = await open({ width: 1440, height: 900 })
await page.goto(`${BASE}/sistema/atencion-chatbot`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500)
const secs = await page.locator('section, [id^=section], [data-testid*=section]').evaluateAll((els) => els.map((e) => ({ id: e.id || e.getAttribute('data-testid'), h: (e.querySelector('h2,h3')?.innerText || '').trim(), pending: /Aún sin efecto/.test(e.innerText) })).filter((s) => s.h))
console.log('SECTIONS', JSON.stringify(secs))
// icon probe on S-000022 detail
await page.goto(`${BASE}/chatbot/solicitudes/${IDS.s22}`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500)
console.log('ICONS rd-alert', JSON.stringify(await page.locator('.rd-alert > :first-child, .rd-alert svg, .rd-alert [class*=i-lucide]').evaluateAll((els) => els.map((e) => ({ c: e.className.toString().slice(0, 60), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })))))
console.log('ICONS rc-hint', 'see c2 screens')
await browser.close()
// design reference renders
const b2 = await chromium.launch({ headless: true })
for (const [f, w, h] of [['01-chat-en-la-pagina', 1440, 900], ['04-movil-y-estados', 1440, 900]]) {
  const p = await b2.newPage({ viewport: { width: w, height: h } })
  await p.goto(`file:///home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/design/chatbot-live-chat/${f}.html`)
  await p.waitForTimeout(800)
  await shot(p, `design-${f}`, true)
  console.log('DESIGN', f, 'height', await p.evaluate(() => document.body.scrollHeight))
  await p.close()
}
await b2.close()
console.log('BLOCKED', blocked, 'CONSOLE', log.console)
