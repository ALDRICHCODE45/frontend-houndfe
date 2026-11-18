import { session } from './api.mjs'
const s = await session()
const r = await s.get('/cash-sessions?page=1&limit=50')
const items = r.data?.items ?? r.data?.data ?? []
console.log('status', r.status, 'total', r.data?.total ?? items.length, 'keys', Object.keys(items[0] ?? {}).join(','))
for (const x of items.filter((x) => x.status !== 'CLOSED')) console.log(JSON.stringify({ id: x.id, status: x.status, registerId: x.registerId, cashier: x.cashierDisplayName }))
