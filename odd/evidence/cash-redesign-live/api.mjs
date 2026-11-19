// API helper: dev seed password read at runtime (never printed/written); token in memory only.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const HERE = dirname(fileURLToPath(import.meta.url))
export const API = 'http://127.0.0.1:3003'
const SEED = join(HERE, '../../../../houndfe-backend/prisma/seed.ts')
export const EMAIL = { manager: 'manager@houndfe.com', cashier: 'cashier@houndfe.com', superAdmin: 'admin@houndfe.com' }

export function devPassword(role = 'manager') {
  const text = readFileSync(SEED, 'utf8')
  const found = text.match(new RegExp(role + ':\\s*\\{[^}]*?password:\\s*\'([^\']+)\'', 's'))?.[1]
  if (!found) throw new Error(`${role} dev password not found in seed`)
  return found
}

export async function session(role = 'manager') {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL[role], password: devPassword(role) }),
  })
  const body = await r.json()
  let token = body.accessToken
  if (body.requiresTenantSelection) {
    const tenants = body.tenants ?? []
    const t = tenants.find((x) => /centro/i.test(x.name)) ?? tenants[0]
    const s = await fetch(`${API}/auth/select-tenant`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: t.id, tempToken: body.tempToken }),
    })
    const sb = await s.json()
    token = sb.accessToken ?? sb.access_token ?? token
  }
  const req = async (method, path, data) => {
    const res = await fetch(`${API}${path}`, {
      method, headers: { authorization: `Bearer ${token}`, ...(method !== 'GET' ? { 'idempotency-key': crypto.randomUUID() } : {}), ...(data ? { 'content-type': 'application/json' } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    })
    let out = null; try { out = await res.json() } catch {}
    return { status: res.status, data: out }
  }
  return { get: (p) => req('GET', p), post: (p, d) => req('POST', p, d), loginStatus: r.status }
}
