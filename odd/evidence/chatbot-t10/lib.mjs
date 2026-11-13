// T10 harness: reuses the T9 login (password read from the BE seed at runtime) and adds a global write guard.
import { open as open9, BASE } from '../chatbot-t9/lib.mjs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
export { BASE }
export const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'shots')
mkdirSync(SHOTS, { recursive: true })
export const blocked = []
export async function open(opts) {
  const r = await open9(opts)
  // abort every non-GET to the API (nothing can reach customers or change data); mocks registered later take precedence.
  await r.page.route(/:3003\//, (route) => {
    const m = route.request().method()
    if (m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') { blocked.push(`${m} ${route.request().url().replace(/^https?:\/\/[^/]+/, '')}`); return route.abort() }
    return route.fallback()
  })
  return r
}
export const shot = (page, name, full = false) => page.screenshot({ path: join(SHOTS, name + '.png'), fullPage: full })
export const IDS = { s18: null, s20: '1e84827c-3ce4-4201-aab7-40a07153e140', s21: 'c302527c-bed5-4245-abec-a315484294ba', s22: '1dc4dee8-bf28-4018-8ff3-773f68b0284b' }
export const txt = async (loc) => (await loc.innerText()).replace(/\n+/g, ' | ')
