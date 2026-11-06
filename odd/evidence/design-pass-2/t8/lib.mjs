// T8 helpers. The T8 driver is a user this folder creates (setup.mjs); its
// generated password lives only in the git-ignored .auth/, never printed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { call } from '../t4/lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CRED = join(HERE, '.auth', 'driver-cred.json')
export const DRIVER = { email: 'marta.ruiz@houndfe.com', name: 'Marta Ruiz' }

export function driverPassword() {
  if (!existsSync(CRED)) {
    mkdirSync(dirname(CRED), { recursive: true })
    writeFileSync(CRED, JSON.stringify({ password: `Rt8-${randomBytes(9).toString('base64url')}` }))
  }
  try {
    return JSON.parse(readFileSync(CRED, 'utf8')).password
  } catch {
    throw new Error('unreadable .auth/driver-cred.json; the T8 driver password cannot be recovered')
  }
}

export async function driverToken() {
  const first = await call('POST', '/auth/login', null, { email: DRIVER.email, password: driverPassword() })
  if (!first.requiresTenantSelection) return first.accessToken
  const tenant = first.tenants.find((t) => t.name.includes('Sucursal Centro')) ?? first.tenants[0]
  return (await call('POST', '/auth/select-tenant', null, { tempToken: first.tempToken, tenantId: tenant.id })).accessToken
}
