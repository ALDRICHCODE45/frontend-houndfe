// Read-only API probe helper: logs in with the dev seed password (read at runtime,
// never printed), keeps the token in memory only.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const API = 'http://127.0.0.1:3003'
const SEED = join(HERE, '../../../../houndfe-backend/prisma/seed.ts')

export function devPassword(role = 'manager') {
  const text = readFileSync(SEED, 'utf8')
  const found = text.match(new RegExp(role + ':\\s*\\{[^}]*?password:\\s*\'([^\']+)\'', 's'))?.[1]
  if (!found) throw new Error('manager dev password not found in seed')
  return found
}

export async function session(role = 'manager') {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${role}@houndfe.com`, password: devPassword(role) }),
  })
  const body = await r.json()
  let token = body.accessToken
  const tenants = body.tenants ?? []
  if (body.requiresTenantSelection) {
    const t = tenants.find((x) => /centro/i.test(x.name)) ?? tenants[0]
    const s = await fetch(`${API}/auth/select-tenant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: t.id, tempToken: body.tempToken }),
    })
    const sb = await s.json()
    token = sb.accessToken ?? sb.access_token ?? token
    if (!s.ok) console.log('select-tenant', s.status, Object.keys(sb))
  }
  const get = async (path) => {
    const res = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })
    let data = null
    try { data = await res.json() } catch {}
    return { status: res.status, data }
  }
  return { get, keys: Object.keys(body) }
}
