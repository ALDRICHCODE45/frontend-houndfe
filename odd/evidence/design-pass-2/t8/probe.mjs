#!/usr/bin/env node
// T8 probe: who can read DeliveryRoute, and which routes exist. Passwords come
// from the backend seed at runtime, never printed or written.
import { call, login } from '../t4/lib.mjs'
const out = {}
for (const key of ['manager', 'cashier']) {
  const { token, user } = await login(`${key}@houndfe.com`, key)
  const perms = await call('GET', '/auth/me/permissions', token).catch((e) => String(e.message).slice(0, 120))
  const codes = Array.isArray(perms) ? perms : perms?.permissions ?? perms?.codes ?? perms
  out[key] = { name: user?.name, dr: Array.isArray(codes) ? codes.filter((c) => /deliver/i.test(JSON.stringify(c))) : codes }
  const list = await call('GET', '/delivery-routes?limit=50', token).catch((e) => String(e.message).slice(0, 160))
  out[key].routes = Array.isArray(list?.items) ? list.items.map((r) => ({ name: r.name ?? r.label, status: r.status, driver: r.driver?.name, stops: r.stopsCount ?? r.stops?.length })) : list
}
console.log(JSON.stringify(out, null, 1))
