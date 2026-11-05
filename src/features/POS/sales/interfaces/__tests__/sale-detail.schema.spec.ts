import { describe, expect, it } from 'vitest'
import { parseSaleDetail } from '../sale-detail.schema'

// odd/handoff/06-refund-settlements.md §3, «Cancelled sale detail»: four additive fields on
// `GET /sales/:id`. The decoder stays non-strict: it checks the new fields and keeps the rest.

const base = {
  id: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46',
  folio: 'A-202611-000022',
  status: 'CONFIRMED',
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-10-21T18:00:00.000Z',
  dueDate: null,
  subtotalCents: 6555,
  discountCents: 0,
  totalCents: 6555,
  paidCents: 6555,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  customer: null,
  cashier: { id: 'u-1', name: 'Cajero' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
}

const canceled = {
  ...base,
  status: 'CANCELED',
  canceledAt: '2026-10-21T20:42:00.000Z',
  cancelReason: 'CUSTOMER_REQUEST',
  canceledBy: { id: 'u-9', name: 'Ana Ruiz' },
  refunds: [
    {
      id: 'cmw2iwsa00000r965efhf292s',
      method: 'cash',
      amountCents: 6555,
      settledCents: 6555,
      outstandingCents: 0,
      reason: 'CUSTOMER_REQUEST',
      status: 'PENDING',
      createdAt: '2026-10-21T20:42:00.000Z',
    },
    {
      id: 'cmw2iwsdh0001r965z1rmw0n0',
      method: 'transfer',
      amountCents: 92910,
      settledCents: 46500,
      outstandingCents: 46410,
      reason: 'CUSTOMER_REQUEST',
      status: 'PENDING',
      createdAt: '2026-10-21T20:42:00.000Z',
    },
  ],
}

describe('parseSaleDetail', () => {
  it('reads the cancellation and its refunds, oldest first, fully returned ones included', () => {
    const sale = parseSaleDetail(canceled)
    expect(sale.status).toBe('CANCELED')
    expect(sale.canceledAt).toBe('2026-10-21T20:42:00.000Z')
    expect(sale.cancelReason).toBe('CUSTOMER_REQUEST')
    expect(sale.canceledBy).toEqual({ id: 'u-9', name: 'Ana Ruiz' })
    expect(sale.refunds?.map((refund) => refund.id)).toEqual([
      'cmw2iwsa00000r965efhf292s',
      'cmw2iwsdh0001r965z1rmw0n0',
    ])
    expect(sale.refunds?.[0]?.outstandingCents).toBe(0)
  })

  it('reads a confirmed sale with null fields and no refunds', () => {
    const sale = parseSaleDetail({
      ...base,
      canceledAt: null,
      cancelReason: null,
      canceledBy: null,
      refunds: [],
    })
    expect(sale.canceledAt).toBeNull()
    expect(sale.cancelReason).toBeNull()
    expect(sale.canceledBy).toBeNull()
    expect(sale.refunds).toEqual([])
  })

  it('accepts a cancelled sale whose canceller no longer exists', () => {
    expect(parseSaleDetail({ ...canceled, canceledBy: null }).canceledBy).toBeNull()
  })

  it('stays non-strict: a payload without the new fields and with unknown keys still parses', () => {
    const sale = parseSaleDetail({ ...base, somethingNew: 1 })
    expect(sale.folio).toBe('A-202611-000022')
    expect(sale.canceledAt).toBeNull()
    expect(sale.cancelReason).toBeNull()
    expect(sale.canceledBy).toBeNull()
    expect(sale.refunds).toEqual([])
    expect((sale as unknown as Record<string, unknown>).somethingNew).toBe(1)
  })

  it.each([
    ['an unknown refund method', { method: 'check' }],
    ['an unknown refund reason', { reason: 'WHATEVER' }],
    ['negative cents', { settledCents: -1 }],
    ['fractional cents', { amountCents: 10.5 }],
  ])('rejects %s', (_, patch) => {
    const refund = { ...canceled.refunds[1], ...patch }
    expect(() => parseSaleDetail({ ...canceled, refunds: [refund] })).toThrow()
  })

  it('rejects an unknown cancel reason', () => {
    expect(() => parseSaleDetail({ ...canceled, cancelReason: 'BECAUSE' })).toThrow()
  })
})
