// Read-only discovery: active promotions, POS catalog sample, open cash sessions, drafts.
import { session } from './api.mjs'

const { get } = await session()
const promos = await get('/promotions?limit=100')
console.log('promotions', promos.status)
const list = promos.data?.data ?? promos.data?.items ?? promos.data ?? []
for (const p of Array.isArray(list) ? list : []) {
  console.log(' -', p.id, p.status, p.method, p.type, p.title, JSON.stringify({ target: p.targetType ?? p.appliesTo, start: p.startDate, end: p.endDate, val: p.value ?? p.discountValue ?? p.percent }))
}
const cat = await get('/sales/pos-catalog?limit=20')
console.log('pos-catalog', cat.status, Object.keys(cat.data ?? {}))
const items = cat.data?.data ?? cat.data?.items ?? []
for (const it of items.slice(0, 20)) console.log(' -', JSON.stringify(it).slice(0, 300))
const cs = await get('/cash-sessions?status=OPEN')
console.log('cash-sessions', cs.status, JSON.stringify(cs.data).slice(0, 600))
const dr = await get('/sales/drafts')
console.log('drafts', dr.status, Array.isArray(dr.data) ? dr.data.length : JSON.stringify(dr.data).slice(0, 200))
