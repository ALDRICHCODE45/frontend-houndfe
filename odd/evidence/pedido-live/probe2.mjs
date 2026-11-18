// Read-only: promotion targets, open cash sessions, draft summaries.
import { session } from './api.mjs'

const { get } = await session()
for (const id of process.argv.slice(2)) {
  const p = await get(`/promotions/${id}`)
  const d = p.data ?? {}
  console.log('promo', id, p.status, d.title, JSON.stringify({ customerScope: d.customerScope, targetItems: d.targetItems ?? d.targets ?? d.products, minPurchase: d.minPurchaseAmountCents, priceLists: d.priceListIds, days: d.daysOfWeek }).slice(0, 900))
}
const cs = await get('/cash-sessions')
const sessions = cs.data?.items ?? cs.data?.data ?? cs.data ?? []
console.log('cash-sessions', cs.status, Array.isArray(sessions) ? sessions.filter((s) => s.status === 'OPEN').map((s) => JSON.stringify({ id: s.id, status: s.status, register: s.cashRegister?.name ?? s.registerId, user: s.openedBy?.email ?? s.openedByUserId ?? s.cashier })).join('\n ') : JSON.stringify(cs.data).slice(0, 300))
const dr = await get('/sales/drafts')
for (const s of dr.data ?? []) console.log('draft', s.id, s.status, s.items?.length, s.totalCents ?? s.total, s.quotationId ?? '')
