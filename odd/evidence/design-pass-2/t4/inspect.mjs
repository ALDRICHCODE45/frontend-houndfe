#!/usr/bin/env node
// Prints the shape of the Caja reads for manager and cashier (keys and readable values only).
import { call, login } from './lib.mjs'
const manager = await login('manager@houndfe.com', 'manager')
const cashier = await login('cashier@houndfe.com', 'cashier')
for (const [who, a] of [['manager', manager], ['cashier', cashier]]) {
  const regs = await call('GET', '/cash-registers', a.token)
  console.log(who, 'registers', (regs.items ?? regs).map((r) => `${r.name}${r.isActive ? '' : ' (inactiva)'}`).join(' | '))
  const s = await call('GET', '/cash-sessions?page=1&limit=25', a.token)
  console.log(who, 'sessions total', s.total, 'keys', Object.keys(s.items[0] ?? {}).join(','))
  console.log(s.items.map((x) => `${x.status}/${x.blind ? 'b' : 'v'}/${x.openingCents}/${x.drawerReleasedAt ? 'rel' : '-'}/${x.cashierUserId === a.user.id ? 'own' : 'other'}`).join(' '))
  const c = await call('GET', '/cash-handovers/custody', a.token).catch((e) => ({ err: e.message.slice(0, 80) }))
  if (c.err) { console.log(who, 'custody', c.err); continue }
  console.log(who, 'custody pending', c.pendingHandovers.total, 'float', c.eligibleFloat.total, 'keys', Object.keys(c.pendingHandovers.items[0] ?? c.eligibleFloat.items[0] ?? {}).join(','))
}
const s = await call('GET', '/cash-sessions?page=1&limit=1', manager.token)
if (s.items[0]) {
  const d = await call('GET', `/cash-sessions/${s.items[0].id}`, manager.token)
  console.log('detail keys', Object.keys(d).join(','), '| session keys', Object.keys(d.session).join(','), '| handover keys', Object.keys(d.handovers?.[0] ?? {}).join(','))
}
