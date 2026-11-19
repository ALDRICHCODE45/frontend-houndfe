// Creates one dev register for the check (manager, create:CashRegister). Prints id/name only.
import { session } from './api.mjs'
const m = await session('manager')
const r = await m.post('/cash-registers', { name: 'Caja QA rediseño T6' })
console.log('POST /cash-registers', r.status, r.data?.id, r.data?.name, r.status >= 400 ? JSON.stringify(r.data) : '')
