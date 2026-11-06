#!/usr/bin/env node
// T3 data: the seeded cashier (Cajero Centro) declares readable custody to the
// manager (Manager Centro) in Sucursal Centro, so /pos/caja/recepciones has rows.
// Passwords are read from the backend seed at runtime, never printed or written.
// Usage: node seed.mjs [inspect]
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const API = process.env.CAPTURE_API ?? 'http://127.0.0.1:3003'
const SEED = join(HERE, '../../../../../houndfe-backend/prisma/seed.ts')
const TENANT = 'Sucursal Centro'

function password(key) {
  const text = readFileSync(SEED, 'utf8')
  const found = text.match(new RegExp(`${key}:\\s*\\{[^}]*?password:\\s*'([^']+)'`, 's'))?.[1]
  if (!found) throw new Error(`no password for ${key}`)
  return found
}

async function call(method, path, token, body, extra = {}) {
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

async function login(email, key) {
  const first = await call('POST', '/auth/login', null, { email, password: password(key) })
  if (!first.requiresTenantSelection) return { token: first.accessToken, user: first.user }
  const tenant = first.tenants.find((t) => t.name.includes(TENANT)) ?? first.tenants[0]
  const sel = await call('POST', '/auth/select-tenant', null, { tempToken: first.tempToken, tenantId: tenant.id })
  return { token: sel.accessToken, user: sel.user }
}

const key = () => ({ 'Idempotency-Key': randomUUID() })

const manager = await login('manager@houndfe.com', 'manager')
const cashier = await login('cashier@houndfe.com', 'cashier')

if (process.argv[2] === 'inspect') {
  const custody = await call('GET', '/cash-handovers/custody', manager.token)
  console.log(JSON.stringify({ pending: custody.pendingHandovers.total, float: custody.eligibleFloat.total }))
  const regs = await call('GET', '/cash-registers', cashier.token)
  console.log(JSON.stringify(regs).slice(0, 600))
  process.exit(0)
}

// A register with an open cashier session (open one if needed).
const regs = await call('GET', '/cash-registers', cashier.token)
const list = regs.items ?? regs.data ?? regs
const sessions = await call('GET', '/cash-sessions?status=OPEN', cashier.token).catch(() => null)
let sessionId = process.env.SESSION ?? (sessions?.items ?? []).find((s) => s.cashierUserId === cashier.user.id)?.id
if (!sessionId) {
  for (const reg of list.filter((r) => r.isActive)) {
    try {
      const opened = await call('POST', `/cash-registers/${reg.id}/sessions`, cashier.token, { openingCents: 150000, openingConfirmed: true }, key())
      sessionId = opened.session?.id ?? opened.id
      console.log(`opened a session on ${reg.name}`)
      break
    } catch (error) {
      console.log(`skip ${reg.name}: ${String(error.message).slice(0, 160)}`)
    }
  }
  if (!sessionId) throw new Error('no register could be opened')
}

// Handovers need a submitted declaration: start the count and declare it.
let detail = await call('GET', `/cash-sessions/${sessionId}`, cashier.token)
const status = detail.session?.status ?? detail.status
if (status === 'OPEN') await call('POST', `/cash-sessions/${sessionId}/start-count`, cashier.token, undefined, key())
if (status === 'OPEN' || status === 'COUNTING') {
  detail = await call('GET', `/cash-sessions/${sessionId}`, cashier.token)
  const channels = detail.requiredChannels ?? (detail.channelSnapshot ?? [])
  console.log(`channels: ${channels.map((c) => c.channelKey).join(',')}`)
  const lines = channels.map((c, i) => ({ channelKey: c.channelKey, amountCents: i === 0 ? 150000 : 0 }))
  await call('POST', `/cash-sessions/${sessionId}/declarations`, cashier.token, { lines }, key())
}

const declare = (handoverKind, declaredCents, notes) =>
  call('POST', `/cash-sessions/${sessionId}/handovers`, cashier.token, { handoverKind, recipientUserId: manager.user.id, declaredCents, ...(notes ? { notes } : {}) }, key())

await declare('WITHDRAWAL', 42550, 'Retiro de media jornada')
await declare('WITHDRAWAL', 68000, 'Corte de la tarde')
await declare('FLOAT', 20000, 'Fondo para la caja 2')
// One FLOAT received by the manager, so "Fondos disponibles" has a row.
const float = await declare('FLOAT', 15000, 'Fondo de apertura')
await call('POST', `/cash-handovers/${float.id}/receive`, manager.token, { receivedCents: 15000 }, key())

const custody = await call('GET', '/cash-handovers/custody', manager.token)
console.log(JSON.stringify({ pending: custody.pendingHandovers.total, float: custody.eligibleFloat.total }))
