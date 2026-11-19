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

  const shippingAddress = {
    id: null,
    street: 'Calle Prueba 1',
    exteriorNumber: '1',
    interiorNumber: null,
    zipCode: '06000',
    neighborhood: 'Centro',
    municipality: null,
    city: 'CDMX',
    state: null,
    visualReferences: null,
    carrierPhone: null,
    label: 'Casa',
    latitude: 19.4,
    longitude: -99.1,
    sourceStatus: 'DELETED',
    changedFields: [],
  }

  it('reads the sale shipping snapshot with its source status (odd sale-address-change-notice S4)', () => {
    const sale = parseSaleDetail({ ...base, shippingAddress })
    expect(sale.shippingAddress).toEqual(shippingAddress)
  })

  it('reads a missing or null shipping address as null (older payload, sale without address)', () => {
    expect(parseSaleDetail(base).shippingAddress).toBeNull()
    expect(parseSaleDetail({ ...base, shippingAddress: null }).shippingAddress).toBeNull()
  })

  it('rejects an unknown shipping address status', () => {
    expect(() =>
      parseSaleDetail({ ...base, shippingAddress: { ...shippingAddress, sourceStatus: 'MOVED' } }),
    ).toThrow()
  })

  it('rejects an unknown cancel reason', () => {
    expect(() => parseSaleDetail({ ...canceled, cancelReason: 'BECAUSE' })).toThrow()
  })

  // Handoff 23 §3: `quotationId` only when the sale came from a quotation; the key is absent otherwise.
  it('reads quotationId when the sale came from a quotation', () => {
    expect(parseSaleDetail({ ...base, quotationId: 'q-1' }).quotationId).toBe('q-1')
  })

  it('keeps quotationId absent on a sale that did not come from a quotation', () => {
    const sale = parseSaleDetail(base)
    expect(sale.quotationId).toBeUndefined()
    expect('quotationId' in sale).toBe(false)
  })

  it('rejects a non-string quotationId', () => {
    expect(() => parseSaleDetail({ ...base, quotationId: 42 })).toThrow()
  })

  // BE handoff 24 §4: the sweep cancels an unpaid hold with HOLD_EXPIRED and no person.
  it('reads a HOLD_EXPIRED cancellation with canceledBy null', () => {
    const sale = parseSaleDetail({ ...canceled, cancelReason: 'HOLD_EXPIRED', canceledBy: null, refunds: [] })
    expect(sale.cancelReason).toBe('HOLD_EXPIRED')
    expect(sale.canceledBy).toBeNull()
  })

  // BE handoff 24 §1: additive `hold` on GET /sales/:id; null for sales without an intent.
  const hold = {
    paymentIntent: 'IN_STORE',
    expiresAt: '2026-11-19T18:30:00.000Z',
    reminderAt: '2026-11-19T15:30:00.000Z',
    stage: 0,
    version: 1,
  }

  it('reads the pay-in-store hold', () => {
    expect(parseSaleDetail({ ...base, hold }).hold).toEqual(hold)
  })

  it('reads a hold without reminder (3 h or shorter)', () => {
    expect(parseSaleDetail({ ...base, hold: { ...hold, reminderAt: null, stage: 2 } }).hold).toEqual({
      ...hold,
      reminderAt: null,
      stage: 2,
    })
  })

  // hold-expire-now L5: hold.expiredAt (= canceledAt) only when the expiry cancelled the sale.
  it('keeps hold.expiredAt when the expiry cancelled the sale', () => {
    const expired = { ...hold, stage: 2, expiredAt: '2026-11-19T18:30:00.000Z' }
    expect(parseSaleDetail({ ...base, hold: expired }).hold).toEqual(expired)
    expect(parseSaleDetail({ ...base, hold: { ...hold, expiredAt: null } }).hold?.expiredAt).toBeNull()
  })

  it('reads a missing or null hold as null (older payload, POS sale)', () => {
    expect(parseSaleDetail(base).hold).toBeNull()
    expect(parseSaleDetail({ ...base, hold: null }).hold).toBeNull()
  })

  it.each([
    ['an unknown intent', { paymentIntent: 'ONLINE' }],
    ['a fractional version', { version: 1.5 }],
    ['a missing expiry', { expiresAt: undefined }],
    ['an unknown stage', { stage: 7 }],
  ])('reads a malformed hold (%s) as null instead of breaking the detail', (_, patch) => {
    const sale = parseSaleDetail({ ...base, hold: { ...hold, ...patch } })
    expect(sale.hold).toBeNull()
    expect(sale.folio).toBe('A-202611-000022')
  })
})
