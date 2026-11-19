import { session } from './api.mjs'
for (const role of ['cashier', 'manager', 'superAdmin']) {
  try {
    const s = await session(role)
    const me = await s.get('/auth/me')
    const p = await s.get('/auth/me/permissions')
    const list = JSON.stringify(p.data)
    const cash = [...new Set((list.match(/"(?:action|subject)":"[^"]+"/g) ?? []))]
    const perms = (p.data?.permissions ?? p.data ?? [])
    const flat = Array.isArray(perms) ? perms.map((x) => typeof x === 'string' ? x : `${x.action}:${x.subject}`).filter((x) => /Cash/.test(x)) : Object.keys(p.data ?? {})
    console.log(role, 'login', s.loginStatus, 'me', me.status, 'userId', me.data?.id ?? me.data?.user?.id, 'name', me.data?.name ?? me.data?.user?.name)
    console.log('  cash perms:', flat.join(' '))
    for (const path of ['/cash-registers?limit=20', '/cash-sessions?limit=5&drawerOpen=true', '/cash-closings?limit=5', '/cash-handovers/recipients?kind=FLOAT']) {
      const r = await s.get(path)
      const d = r.data
      console.log('  ', path, r.status, Array.isArray(d?.items) ? `items=${d.items.length} total=${d.total ?? d.meta?.total ?? '?'}` : Object.keys(d ?? {}).join(','))
    }
  } catch (e) { console.log(role, 'ERR', e.message) }
}
