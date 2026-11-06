#!/usr/bin/env node
// T8 probe 2: assignable drivers and routes as the manager sees them (names only).
import { call, login } from '../t4/lib.mjs'
const { token } = await login('manager@houndfe.com', 'manager')
const drivers = await call('GET', '/users/assignable-drivers', token).catch((e) => String(e.message).slice(0, 160))
console.log('drivers', Array.isArray(drivers) ? drivers.map((d) => d.name ?? d.email) : drivers)
const list = await call('GET', '/delivery-routes', token).catch((e) => String(e.message).slice(0, 160))
const items = Array.isArray(list) ? list : list?.items
console.log('routes', Array.isArray(items) ? items.map((r) => ({ name: r.name ?? r.title, status: r.status, driver: r.driver?.name, stops: r.stops?.length })) : list)
const roles = await call('GET', '/roles', token).catch((e) => String(e.message).slice(0, 160))
const rl = Array.isArray(roles) ? roles : roles?.items
console.log('roles', Array.isArray(rl) ? rl.map((r) => r.name) : roles)
