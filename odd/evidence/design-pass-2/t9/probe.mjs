// T9: which dev accounts land on /select-tenant, and with how many branches.
// Passwords come from the backend seed at runtime, never printed.
import { call, password } from '../t4/lib.mjs'
for (const key of ['superAdmin', 'manager', 'cashier']) {
  const email = { superAdmin: 'admin@houndfe.com', manager: 'manager@houndfe.com', cashier: 'cashier@houndfe.com' }[key]
  const r = await call('POST', '/auth/login', null, { email, password: password(key) })
  console.log(key, 'select?', !!r.requiresTenantSelection, 'tenants:', (r.tenants ?? []).map((t) => `${t.name} [${t.status ?? '-'}] addr=${!!t.address} shift=${t.onShiftCount ?? '-'}`).join(' | '), 'user keys', Object.keys(r.user ?? {}).join(','))
}
