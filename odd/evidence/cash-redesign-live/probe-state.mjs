import { session } from './api.mjs'
const c = await session('cashier'); const m = await session('manager')
const regs = await c.get('/cash-registers?limit=50')
console.log('registers:', regs.data.items.map((r) => `${r.id.slice(0,8)} ${r.name} active=${r.isActive ?? r.active} open=${JSON.stringify(r.openSession ?? r.currentSessionId ?? null)?.slice(0,40)}`).join('\n  '))
const s = await m.get('/cash-sessions?limit=50&drawerOpen=true')
console.log('drawerOpen sessions:', s.data.items.map((x) => `${x.id.slice(0,8)} reg=${x.registerId?.slice(0,8)} cashier=${(x.cashierUserId ?? '').slice(0,8)} ${x.status}`).join('\n  '))
const r = await c.get('/cash-handovers/recipients?kind=FLOAT'); console.log('FLOAT recipients', r.data.items.map((x) => `${x.displayName}/${x.roleName}`))
const w = await c.get('/cash-handovers/recipients?kind=WITHDRAWAL'); console.log('WITHDRAWAL recipients', w.data.items.map((x) => `${x.displayName}/${x.roleName}`))
console.log('session keys', Object.keys(s.data.items[0] ?? {}))
