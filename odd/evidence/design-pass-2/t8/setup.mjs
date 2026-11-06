#!/usr/bin/env node
// T8 data: a pure driver «Marta Ruiz» in Sucursal Centro (role repartidor) with
// one started route built from eligible sales. Idempotent; prints names only.
import { call, login, idem } from '../t4/lib.mjs'
import { DRIVER, driverPassword } from './lib.mjs'

const reg = await call('POST', '/auth/register', null, { email: DRIVER.email, password: driverPassword(), name: DRIVER.name })
  .then(() => 'created').catch((e) => (/409|exist/i.test(e.message) ? 'exists' : Promise.reject(e)))
console.log('user', DRIVER.name, reg)

const admin = await login('admin@houndfe.com', 'superAdmin')
const tenants = await call('GET', '/admin/tenants', admin.token)
const centro = (tenants.data ?? tenants.items ?? tenants).find((t) => t.name === 'Sucursal Centro')
const roles = await call('GET', `/admin/tenants/${centro.id}/roles`, admin.token)
const role = (roles.data ?? roles).find((r) => r.name === 'repartidor')
const members = (await call('GET', `/admin/tenants/${centro.id}/members`, admin.token)).data
const already = members.find((m) => (m.user?.email ?? m.email) === DRIVER.email)
if (already) console.log('membership exists')
else {
  const elig = await call('GET', `/admin/tenants/${centro.id}/eligible-users?search=${encodeURIComponent(DRIVER.email)}`, admin.token)
  const u = (elig.data ?? elig.items ?? elig).find((x) => x.email === DRIVER.email)
  await call('POST', `/admin/tenants/${centro.id}/members`, admin.token, { userId: u.id, roleId: role.id })
  console.log('membership created: repartidor @ Sucursal Centro')
}

const mgr = await login('manager@houndfe.com', 'manager')
const drivers = await call('GET', '/users/assignable-drivers', mgr.token)
const me = drivers.find((d) => d.email === DRIVER.email || d.name === DRIVER.name)
if (!me) throw new Error('driver not assignable')
const routes = await call('GET', '/delivery-routes', mgr.token)
const mine = routes.filter((r) => r.driver?.name === DRIVER.name)
console.log('routes for driver', mine.map((r) => r.status))
if (!mine.some((r) => r.status === 'ACTIVE')) {
  const el = await call('GET', '/delivery-routes/eligible-sales', mgr.token)
  const sales = (el.items ?? el.data ?? el)
  console.log('eligible sales', sales.length)
  const pick = sales.slice(0, 3).map((s) => s.id ?? s.saleId)
  if (!pick.length) throw new Error('no eligible sales')
  const route = await call('POST', '/delivery-routes', mgr.token, { saleIds: pick, driverUserId: me.id, notes: 'Entregar por la mañana; llamar al cliente al llegar.' }, idem())
  await call('POST', `/delivery-routes/${route.id}/start`, mgr.token, undefined, idem())
  console.log('route created and started with', pick.length, 'stops')
}
