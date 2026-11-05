#!/usr/bin/env node
// What the driver reads: permissions and the routes the server scopes to them (names only).
import { call } from '../t4/lib.mjs'
import { driverToken } from './lib.mjs'
const token = await driverToken()
const perms = await call('GET', '/auth/me/permissions', token)
console.log('perms', (perms.permissions ?? perms).filter((p) => p.subject === 'DeliveryRoute').map((p) => p.action))
for (const s of ['ACTIVE', '']) {
  const l = await call('GET', `/delivery-routes${s ? `?status=${s}` : ''}`, token)
  console.log(s || 'ALL', l.map((r) => ({ status: r.status, notes: r.notes, stops: r.stops.map((x) => [x.status, x.customer?.name ?? x.sale?.customerName ?? Object.keys(x).join('|')]) })))
}
