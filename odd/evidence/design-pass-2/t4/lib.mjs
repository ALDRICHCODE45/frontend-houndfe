// Shared API helpers for the T4 scripts. Passwords are read from the backend
// seed at runtime, never printed or written.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
export const SEED = join(HERE, '../../../../../houndfe-backend/prisma/seed.ts')
const TENANT = 'Sucursal Centro'

export function password(key) {
  const text = readFileSync(SEED, 'utf8')
  const found = text.match(new RegExp(`${key}:\\s*\\{[^}]*?password:\\s*'([^']+)'`, 's'))?.[1]
  if (!found) throw new Error(`no password for ${key}`)
  return found
}

export async function call(method, path, token, body, extra = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return data
}

export async function login(email, key) {
  const first = await call('POST', '/auth/login', null, { email, password: password(key) })
  if (!first.requiresTenantSelection) return { token: first.accessToken, user: first.user }
  const tenant = first.tenants.find((t) => t.name.includes(TENANT)) ?? first.tenants[0]
  const sel = await call('POST', '/auth/select-tenant', null, { tempToken: first.tempToken, tenantId: tenant.id })
  return { token: sel.accessToken, user: sel.user }
}

export const idem = () => ({ 'Idempotency-Key': randomUUID() })
