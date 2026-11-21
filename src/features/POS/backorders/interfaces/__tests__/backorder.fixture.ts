import type { BackorderCounts, BackorderStaff } from '../backorder.types'

/** S3's `BackorderBot` example (RESERVED) plus the staff fields. */
export function makeBackorder(overrides: Partial<BackorderStaff> = {}): BackorderStaff {
  return {
    id: '3f6c1c52-5d0e-4b53-9d33-0d3f8c4a9a01',
    folio: 'BO-000012',
    status: 'RESERVED',
    productId: 'a1b2c3d4-0000-4000-8000-000000000001',
    productName: 'Croquetas Adulto Raza Grande 18 kg',
    variantId: null,
    variantName: null,
    quantity: 2,
    referencePriceCents: 114900,
    currentPriceCents: 109900,
    finalPriceCents: 109900,
    scheduledAt: '2026-11-14T10:00:00-06:00',
    estimatedAt: '2026-11-21T12:05:00-06:00',
    estimatedArrivalDays: 7,
    reservedAt: '2026-11-20T09:00:00-06:00',
    reservedUntil: '2026-11-21T09:00:00-06:00',
    reminderAt: '2026-11-20T21:00:00-06:00',
    queuePosition: null,
    saleId: null,
    cancelledByKind: null,
    cancelReason: null,
    branchName: 'Centro',
    customerFirstName: 'Rosa',
    version: 3,
    customer: { id: 'c0ffee00-0000-4000-8000-000000000002', name: 'Rosa Elena Díaz', phone: '+525512345678' },
    origin: 'CHATBOT',
    chatbotRequestId: 'bbbbbbbb-0000-4000-8000-000000000003',
    productImageUrl: null,
    priceListId: null,
    confirmedAt: null,
    cancelledAt: null,
    expiredAt: null,
    cancelledBy: null,
    saleStatus: null,
    etaOverdue: false,
    passedOverCount: 0,
    ...overrides,
  }
}

export const countsFixture: BackorderCounts = { WAITING: 4, RESERVED: 2, CONFIRMED: 7, EXPIRED: 1, CANCELLED: 3 }

/** A WAITING order as the server sends it: nothing reserved yet, so current/final price are null. */
export function makeWaitingBackorder(overrides: Partial<BackorderStaff> = {}): BackorderStaff {
  return makeBackorder({
    status: 'WAITING',
    queuePosition: 2,
    currentPriceCents: null,
    finalPriceCents: null,
    referencePriceCents: 114900,
    reservedAt: null,
    reservedUntil: null,
    reminderAt: null,
    ...overrides,
  })
}
