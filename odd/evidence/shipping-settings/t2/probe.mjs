#!/usr/bin/env node
// T2 read-only probe of the zone and validation reads (passwords from the seed, never printed).
import { call, login } from '../../design-pass-2/t4/lib.mjs'
const { token } = await login('manager@houndfe.com', 'manager')
const zones = await call('GET', '/delivery-zones?limit=3', token)
console.log(JSON.stringify({ first: zones.data[0], pagination: zones.pagination }, null, 1))
const vals = await call('GET', '/delivery-zone-validations', token)
console.log(JSON.stringify(vals.data.map((v) => ({ zip: v.zipCode, n: v.requesterCount, u: v.urgency, last: v.lastCustomerMessageAt, ver: v.version })), null, 1), vals.pagination)
