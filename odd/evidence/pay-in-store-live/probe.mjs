import { session } from './api.mjs'
const s = await session()
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o?.[k]]))
for (const id of ['6e64f7bc-f7a8-48cb-8c5f-8902ef000233', 'c146d74e-06bc-486d-8fbf-8f3a06a0e6ae']) {
  const r = await s.get(`/sales/${id}`)
  console.log(r.status, JSON.stringify(pick(r.data, ['folio', 'status', 'paymentStatus', 'channel', 'totalCents', 'paidCents', 'debtCents', 'hold', 'cancelReason'])))
}
const n = await s.get('/notifications?limit=10')
const items = n.data?.data ?? n.data?.items ?? n.data
console.log('notif', n.status, JSON.stringify((Array.isArray(items) ? items : []).filter(x=>x.type==='SALE_HOLD_REVIEW').map((x) => pick(x, ['type', 'title', 'body', 'saleId', 'readAt']))))
for (const p of ['/cash-sessions/current', '/cash-sessions?status=OPEN', '/cash-registers']) {
  const r = await s.get(p); console.log(p, r.status, JSON.stringify(r.data).slice(0, 600))
}
