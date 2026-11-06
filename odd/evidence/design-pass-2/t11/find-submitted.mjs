#!/usr/bin/env node
// T11: lists cash sessions by status (read-only GET) to find a declared one to verify in the browser.
import { call, login } from '../t4/lib.mjs'
const { token } = await login('manager@houndfe.com', 'manager')
const res = await call('GET', '/cash-sessions?page=1&limit=50', token)
const items = Array.isArray(res) ? res : res.items ?? res.data ?? []
const by = {}
for (const s of items) (by[s.status] ??= []).push(s.id.slice(0, 8))
console.log(JSON.stringify(by))
