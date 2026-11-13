import { describe, expect, it } from 'vitest'
import { makeMessage } from '../conversation-fixture'
import { PENDING_SEND_MS, deliveryView } from '../live-delivery'

const CREATED = '2026-11-13T16:00:00.000Z'
const at = (seconds: number) => new Date(Date.parse(CREATED) + seconds * 1000)
const staff = (overrides: Record<string, unknown> = {}) =>
  makeMessage({
    seq: 20,
    direction: 'OUT',
    author: 'STAFF',
    deliveryStatus: 'QUEUED',
    createdAt: CREATED,
    providerTimestamp: null,
    ...overrides,
  })

describe('deliveryView — the handoff 20 §3 states', () => {
  it.each([
    ['QUEUED', 'En cola'],
    ['SENT', 'Enviado'],
    ['DELIVERED', 'Entregado'],
    ['READ', 'Leído'],
    ['DEFERRED', 'No enviado, ventana cerrada'],
    ['FAILED', 'No enviado'],
    ['UNKNOWN', 'Entrega dudosa'],
  ] as const)('%s reads «%s»', (status, label) => {
    expect(deliveryView(staff({ deliveryStatus: status }), { now: at(5) })?.label).toBe(label)
  })

  it('is null for incoming messages and for timeline marks without a status', () => {
    expect(deliveryView(makeMessage({ direction: 'IN', deliveryStatus: null }), { now: at(5) })).toBeNull()
    expect(deliveryView(staff({ deliveryStatus: null }), { now: at(5) })).toBeNull()
  })
})

describe('deliveryView — «Pendiente de envío» after 30 s without SENT', () => {
  it('stays «En cola» just under 30 s and turns «Pendiente de envío» at 30 s', () => {
    expect(PENDING_SEND_MS).toBe(30_000)
    expect(deliveryView(staff(), { now: at(29) })?.label).toBe('En cola')
    const pending = deliveryView(staff(), { now: at(30) })
    expect(pending?.label).toBe('Pendiente de envío')
    expect(pending?.key).toBe('PENDING')
    expect(pending?.note).toContain('30 s')
    expect(pending?.action).toBeNull()
  })

  it('never turns a SENT (or later) message pending, however old', () => {
    expect(deliveryView(staff({ deliveryStatus: 'SENT' }), { now: at(900) })?.label).toBe('Enviado')
  })

  it('counts from createdAt and tolerates an invalid date as «En cola»', () => {
    expect(deliveryView(staff({ createdAt: 'not-a-date' }), { now: at(900) })?.label).toBe('En cola')
  })
})

describe('deliveryView — actions', () => {
  it('FAILED text can be retried, as a new message', () => {
    const view = deliveryView(staff({ deliveryStatus: 'FAILED' }), { now: at(5) })
    expect(view?.action).toBe('retry')
    expect(view?.note).toContain('No se pudo enviar')
  })

  it('UNKNOWN text offers «Enviar como mensaje nuevo» (a resend is a new message)', () => {
    const view = deliveryView(staff({ deliveryStatus: 'UNKNOWN' }), { now: at(5) })
    expect(view?.action).toBe('resend')
    expect(view?.note).toContain('mensaje nuevo')
  })

  it('a message already resent offers nothing and says so', () => {
    const view = deliveryView(staff({ deliveryStatus: 'FAILED' }), { now: at(5), retried: true })
    expect(view?.action).toBeNull()
    expect(view?.note).toBe('Reenviado como mensaje nuevo.')
  })

  it('DEFERRED explains the window and has no button', () => {
    const view = deliveryView(staff({ deliveryStatus: 'DEFERRED' }), { now: at(5) })
    expect(view?.action).toBeNull()
    expect(view?.note).toContain('ventana')
  })

  it('a FAILED template is retried from the window box, an UNKNOWN one cannot be resent', () => {
    const failed = deliveryView(staff({ type: 'TEMPLATE', deliveryStatus: 'FAILED' }), { now: at(5) })
    expect(failed?.action).toBeNull()
    expect(failed?.note).toContain('recuadro')
    const unknown = deliveryView(staff({ type: 'TEMPLATE', deliveryStatus: 'UNKNOWN' }), { now: at(5) })
    expect(unknown?.action).toBeNull()
    expect(unknown?.note).toContain('No se puede reenviar')
  })

  it('bot messages never get a retry action', () => {
    const view = deliveryView(staff({ author: 'BOT', deliveryStatus: 'FAILED' }), { now: at(5) })
    expect(view?.label).toBe('No enviado')
    expect(view?.action).toBeNull()
  })

  it('retry is offered only when the viewer may send (canAct false hides the buttons)', () => {
    const view = deliveryView(staff({ deliveryStatus: 'FAILED' }), { now: at(5), canAct: false })
    expect(view?.action).toBeNull()
  })
})
