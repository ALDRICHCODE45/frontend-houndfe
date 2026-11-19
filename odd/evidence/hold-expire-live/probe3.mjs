import { session } from './api.mjs'
const s = await session('manager')
const l = await s.get('/sales?page=1&limit=10')
console.log('list', l.status, JSON.stringify((l.data?.items ?? l.data?.data ?? []).map((r) => [r.folio, r.status, r.paymentStatus, r.cancelReason ?? null, r.confirmedAt])))
for (const st of ['CANCELED', 'CANCELLED']) { const c = await s.get('/sales?page=1&limit=5&status=' + st); console.log(st, c.status, JSON.stringify((c.data?.items ?? c.data?.data ?? []).map((r) => [r.folio, r.status, r.cancelReason ?? null]))) }
