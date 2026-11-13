// T12 harness: reuses T11 → T10 → T9 (login with the password read from the BE seed at runtime; global non-GET abort guard).
import { open as open11, BASE, blocked, IDS, txt, installLiveMock, currentUser, settle, iconSizes } from '../chatbot-t11/lib.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
export { BASE, blocked, IDS, txt, currentUser, settle, iconSizes }
export const open = open11
export const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(SHOTS, { recursive: true })
export const shot = (page, name, full = false) => page.screenshot({ path: join(SHOTS, name + '.png'), fullPage: full })
export const FOLIOS = { s25: '082d696f-2a80-4d56-b9e4-2400f4c91dc5', s26: 'f7716c96-0ad1-48cf-95bd-27c0e804f60b', s22: '1dc4dee8-bf28-4018-8ff3-773f68b0284b' }

// Same MOCK as T10/T11, plus a browser-side override of `templateCostText` in the detail answer.
// installLiveMock fulfils the detail with route.fetch + route.fulfill; the wrapper below adds the field to that body.
// costText: undefined → leave what the backend sent; null / string → force it.
export async function installLiveMockWithCost(page, opts, costText) {
  const orig = page.route.bind(page)
  page.route = (url, handler, o) => {
    const isDetail = url instanceof RegExp && url.source.includes('(\\?.*)?$')
    if (!isDetail || costText === undefined) return orig(url, handler, o)
    return orig(url, (route, req) => handler(new Proxy(route, { get(t, p) { if (p === 'fulfill') return (a) => t.fulfill(a.json ? { ...a, json: { ...a.json, templateCostText: costText } } : a); const v = t[p]; return typeof v === 'function' ? v.bind(t) : v } }), req), o)
  }
  try { return await installLiveMock(page, opts) } finally { page.route = orig }
}
