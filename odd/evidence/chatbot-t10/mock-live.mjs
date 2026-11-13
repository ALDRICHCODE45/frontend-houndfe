// MOCK ONLY (browser-side route fulfilment; nothing reaches the API or a customer).
// Turns the real S-000018 detail into «IN_PROGRESS, liveSession <state>, assigned to the logged-in user»
// and serves a synthetic conversation + POST /messages|/template answers.
import { BASE } from './lib.mjs'
const safeJson = (text, fallback = {}) => { try { return JSON.parse(text) } catch { return fallback } }
const safeUrl = (value) => { try { return new URL(value) } catch { return new URL('http://invalid.local/') } }
export const ORIGIN = safeUrl(BASE).origin
const cors = { 'access-control-allow-origin': ORIGIN, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': '*' }
const iso = (ms) => new Date(ms).toISOString()
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export async function currentUser(page) {
  const raw = await page.evaluate(() => localStorage.getItem('hound.auth.user') || '{}')
  const u = safeJson(raw)
  return { id: u.id, displayName: u.name }
}

export async function installLiveMock(page, { requestId, user, sessionState = 'ACTIVE', windowOpen = true, post = 'ok', startingSince = 0, allowed } = {}) {
  const now = Date.now()
  const lastIn = windowOpen ? now - 12 * 60_000 : now - 26 * 3600_000
  const mk = (seq, direction, author, text, at, extra = {}) => ({ id: uuid(seq), seq, direction, author, staff: author === 'STAFF' ? user : null, type: 'TEXT', text, media: null, deliveryStatus: direction === 'OUT' ? 'READ' : null, clientMessageId: null, providerTimestamp: iso(at), createdAt: iso(at), ...extra })
  const state = {
    posts: [], templatePosts: [],
    messages: [
      mk(1, 'IN', 'CUSTOMER', 'Hola, quiero hablar con alguien de la tienda', lastIn - 9 * 60_000),
      mk(2, 'OUT', 'BOT', 'Claro, te paso con una persona del equipo.', lastIn - 8 * 60_000),
      mk(3, 'OUT', 'STAFF', 'Hola, soy Manager Centro. ¿En qué te ayudo?', lastIn - 6 * 60_000),
      mk(4, 'IN', 'CUSTOMER', '¿Tienen croqueta de 15 kg para perro adulto?', lastIn),
    ],
    nextSeq: 5,
  }
  const detailRe = new RegExp(`:3003/chatbot-requests/${requestId}(\\?.*)?$`)
  await page.route(detailRe, async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const res = await route.fetch(); const j = await res.json()
    const actions = allowed ?? ['SEND_MESSAGE', 'SEND_TEMPLATE', 'FINISH', 'RELEASE', 'REASSIGN']
    Object.assign(j, {
      status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', assignee: user, unreadCustomerMessages: 0, version: 7,
      allowedActions: actions, deniedActions: [], whatsappWindowClosesAt: iso(lastIn + 24 * 3600_000),
      liveSession: { state: sessionState, handoffEpoch: 1, lastStaffActivityAt: iso(lastIn - 6 * 60_000), lastCustomerMessageAt: iso(lastIn) },
    })
    if (sessionState === 'STARTING') j.liveSession.lastStaffActivityAt = iso(now - (startingSince || 45_000))
    await route.fulfill({ response: res, json: j })
  })
  await page.route(new RegExp(`:3003/chatbot-requests/${requestId}/conversation`), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const u = safeUrl(route.request().url()); const before = u.searchParams.get('before'); const after = u.searchParams.get('after'); const limit = Number(u.searchParams.get('limit') ?? 50)
    let items = state.messages
    if (after !== null) items = items.filter((m) => m.seq > Number(after))
    else if (before !== null) items = items.filter((m) => m.seq < Number(before))
    items = items.slice(-limit)
    await route.fulfill({ status: 200, headers: cors, json: { items, hasMoreBefore: false } })
  })
  await page.route(new RegExp(`:3003/chatbot-requests/${requestId}/(messages|template)$`), async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (req.method() !== 'POST') return route.fallback()
    const isTemplate = req.url().endsWith('/template')
    const body = safeJson(req.postData() || '{}')
    ;(isTemplate ? state.templatePosts : state.posts).push({ body, key: req.headers()['idempotency-key'] })
    if (post === 'network') return route.abort('failed')
    const seq = state.nextSeq++
    const at = Date.now()
    const msg = mk(seq, 'OUT', 'STAFF', isTemplate ? null : body.text, at, { deliveryStatus: 'QUEUED', clientMessageId: body.clientMessageId ?? null, type: isTemplate ? 'TEMPLATE' : 'TEXT', templateName: isTemplate ? 'hf_reabrir_conversacion' : undefined })
    state.messages.push(msg)
    if (post === 'ok') { setTimeout(() => { msg.deliveryStatus = 'SENT' }, 3500); setTimeout(() => { msg.deliveryStatus = 'READ' }, 8000) }
    if (post === 'failed') setTimeout(() => { msg.deliveryStatus = 'FAILED' }, 3500)
    await route.fulfill({ status: 200, headers: cors, json: { message: msg } })
  })
  return state
}
