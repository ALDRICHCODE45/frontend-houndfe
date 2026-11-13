// T11 harness: reuses the T10 harness (T9 login with the password read from the BE seed at runtime + global non-GET abort guard).
import { open as open10, BASE, blocked, IDS, txt } from '../chatbot-t10/lib.mjs'
import { installLiveMock, currentUser } from '../chatbot-t10/mock-live.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
export { BASE, blocked, IDS, txt, installLiveMock, currentUser }
export const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(SHOTS, { recursive: true })
export const shot = (page, name, full = false) => page.screenshot({ path: join(SHOTS, name + '.png'), fullPage: full })
export const settle = async (page, ms = 2200) => { await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(ms) }
// real rendered size of the icons inside a scope (alerts, notes, hints, sheets)
export const iconSizes = (page, scope) => page.locator(scope).evaluateAll((roots) => roots.flatMap((r) => [...r.querySelectorAll('svg, [class*="i-"], .iconify, span[class*="icon"]')].map((e) => { const b = e.getBoundingClientRect(); return { cls: String(e.getAttribute('class') || e.tagName).slice(0, 60), w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 } })))
// hides the Vite Vue-DevTools floating button (dev-only overlay) so it does not cover the UI in screenshots
export async function open(opts) {
  const r = await open10(opts)
  await r.ctx.addInitScript(() => { const add = () => { const s = document.createElement('style'); s.textContent = '#__vue-devtools-container__{display:none!important}'; document.head.appendChild(s) }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add) })
  await r.page.reload({ waitUntil: 'domcontentloaded' })
  return r
}
