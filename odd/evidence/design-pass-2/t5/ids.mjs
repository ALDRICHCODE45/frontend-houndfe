// Resolve product ids by name at runtime (ids stay in URLs only, never on screen or in files).
import { call, login } from './api.mjs'
export async function productIds(names) {
  const { token } = await login(process.env.T5_USER === 'superAdmin' ? 'admin@houndfe.com' : 'manager@houndfe.com', process.env.T5_USER ?? 'manager')
  const out = {}
  for (const name of names) {
    const res = await call('GET', `/products?limit=20&search=${encodeURIComponent(name)}`, token)
    const items = res.data ?? res.items ?? res
    out[name] = items.find((p) => p.name === name)?.id
  }
  return out
}
