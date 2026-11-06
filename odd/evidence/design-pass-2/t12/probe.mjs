#!/usr/bin/env node
// T12: which real cash rows carry the handoff-09 display fields. Prints names,
// statuses and times only (no ids, no credentials).
// Usage: node probe.mjs [manager|cashier|admin]
import { call, login } from '../t4/lib.mjs'

const user = process.argv[2] ?? 'manager'
const { token } = await login(`${user}@houndfe.com`, user)
const list = await call('GET', '/cash-sessions?page=1&limit=50', token)
console.log(`sessions ${list.total}`)
for (const s of list.items) {
  console.log(`  ${s.status.padEnd(9)} ${s.openingCents} opened=${s.openedAt} closed=${s.closedAt} cashier=${s.cashierDisplayName}`)
}
const custody = await call('GET', '/cash-handovers/custody', token)
for (const key of ['pendingHandovers', 'eligibleFloat']) {
  console.log(`${key} ${custody[key].total}`)
  for (const h of custody[key].items) {
    console.log(`  ${h.kind} ${h.declaredCents} sender=${h.senderDisplayName} register=${h.sourceRegisterName} notes=${h.notes}`)
  }
}
