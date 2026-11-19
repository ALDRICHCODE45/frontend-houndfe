import { session } from './api.mjs'
const s = await session('manager')
const d = await s.get('/sales/6e64f7bc-f7a8-48cb-8c5f-8902ef000233')
const x = d.data; console.log(JSON.stringify({ total: x.totalCents ?? x.total, paid: x.paidCents ?? x.amountPaidCents, due: x.balanceDueCents ?? x.amountDueCents, payments: (x.payments ?? []).map((p) => ({ m: p.method, a: p.amountCents, at: p.createdAt })), keys: Object.keys(x) }))
const l = await s.get('/sales?page=1&limit=50'); console.log('list', l.status)
const items = l.data?.items ?? l.data?.data ?? []
for (const r of items) if (r.hold && r.status === 'CONFIRMED') console.log(r.folio, r.id, r.paymentStatus, JSON.stringify(r.hold))
