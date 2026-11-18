import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'
import { http } from '@/core/shared/api/http'
import { quotationApi } from '../quotation.api'

// Backend handoff 23 (quotation ↔ sale conversion): two POST routes, both with a
// mandatory `Idempotency-Key` header; 201 bodies decoded before reaching the UI.

vi.mock('@/core/shared/api/http', () => ({
  http: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const quotation = {
  id: 'q-1',
  status: 'DRAFT',
  effectiveStatus: 'DRAFT',
  sellerUserId: 'u-1',
  seller: { id: 'u-1', name: 'Pedro Pérez' },
  customerId: 'c-1',
  customer: { id: 'c-1', firstName: 'María', lastName: 'García', email: null },
  globalPriceListId: 'pl-1',
  priceListExplicitlySet: true,
  customerNotes: 'Entrega en sucursal Norte',
  items: [],
  subtotalCents: 25000,
  discountCents: 500,
  totalCents: 24500,
  ivaBreakdown: [{ classification: 'IVA_16', amountCents: 3379 }],
  saleId: null,
  convertedAt: null,
}

const fromSaleBody = {
  quotation,
  discardedSaleId: 's-9',
  droppedAdjustments: [
    {
      kind: 'ORDER_PROMOTION',
      saleItemId: null,
      productId: null,
      variantId: null,
      promotionId: 'promo-1',
      title: 'Orden -$10',
      discountCents: 1000,
    },
    {
      kind: 'REWARD_PROMOTION',
      saleItemId: 'si-1',
      productId: 'p-1',
      variantId: 'v-1',
      promotionId: 'promo-2',
      title: '2x1 Playeras',
      discountCents: 15000,
    },
  ],
}

const convertBody = {
  quotation: {
    ...quotation,
    status: 'CONVERTED_TO_SALE',
    effectiveStatus: 'CONVERTED_TO_SALE',
    saleId: 's-new',
    convertedAt: '2026-11-18T18:04:05.123Z',
  },
  sale: {
    id: 's-new',
    status: 'DRAFT',
    userId: 'u-cashier',
    customerId: 'c-1',
    sellerUserId: 'u-1',
    globalPriceListId: 'pl-1',
    quotationId: 'q-1',
    subtotalCents: 32345,
    discountCents: 1000,
    totalCents: 31345,
    items: [{ id: 'si-1', productId: 'p-1', unitPriceCents: 9500, quantity: 2 }],
    createdAt: '2026-11-18T18:04:05.123Z',
    updatedAt: '2026-11-18T18:04:05.123Z',
  },
}

describe('quotationApi.createFromSale — POST /quotations/from-sale/:saleId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to the exact URL with the Idempotency-Key header and an empty body by default', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: fromSaleBody })

    await quotationApi.createFromSale('s-9', {}, 'key-1')

    expect(http.post).toHaveBeenCalledWith('/quotations/from-sale/s-9', {}, {
      headers: { 'Idempotency-Key': 'key-1' },
    })
  })

  it('sends customerNotes trimmed', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: fromSaleBody })

    await quotationApi.createFromSale('s-9', { customerNotes: '  Entrega Norte  ' }, 'key-1')

    expect(http.post).toHaveBeenCalledWith(
      '/quotations/from-sale/s-9',
      { customerNotes: 'Entrega Norte' },
      { headers: { 'Idempotency-Key': 'key-1' } },
    )
  })

  it.each([[''], ['   '], [null]])('sends a blank customerNotes (%j) as null', async (notes) => {
    vi.mocked(http.post).mockResolvedValue({ data: fromSaleBody })

    await quotationApi.createFromSale('s-9', { customerNotes: notes }, 'key-1')

    expect(vi.mocked(http.post).mock.calls[0]![1]).toEqual({ customerNotes: null })
  })

  it('decodes quotation, discardedSaleId and droppedAdjustments with cents', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: fromSaleBody })

    const result = await quotationApi.createFromSale('s-9', {}, 'key-1')

    expect(result.discardedSaleId).toBe('s-9')
    expect(result.quotation.id).toBe('q-1')
    expect(result.quotation.saleId).toBeNull()
    expect(result.droppedAdjustments).toEqual(fromSaleBody.droppedAdjustments)
  })

  it('reads a missing droppedAdjustments as [] and an unknown kind as UNKNOWN', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { quotation, discardedSaleId: 's-9' } })
    expect((await quotationApi.createFromSale('s-9', {}, 'k')).droppedAdjustments).toEqual([])

    vi.mocked(http.post).mockResolvedValue({
      data: {
        ...fromSaleBody,
        droppedAdjustments: [{ ...fromSaleBody.droppedAdjustments[0], kind: 'FUTURE_KIND' }],
      },
    })
    const result = await quotationApi.createFromSale('s-9', {}, 'k')
    expect(result.droppedAdjustments[0]!.kind).toBe('UNKNOWN')
    expect(result.droppedAdjustments[0]!.discountCents).toBe(1000)
  })

  it('throws a ZodError when the 201 body breaks the contract', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { discardedSaleId: 's-9' } })

    await expect(quotationApi.createFromSale('s-9', {}, 'k')).rejects.toBeInstanceOf(ZodError)
  })

  it('rethrows the HTTP error unchanged (decode it with decodeQuotationConversionError)', async () => {
    const error = { isAxiosError: true, response: { status: 422, data: { error: 'SALE_HAS_PAYMENTS' } } }
    vi.mocked(http.post).mockRejectedValue(error)

    await expect(quotationApi.createFromSale('s-9', {}, 'k')).rejects.toBe(error)
  })
})

describe('quotationApi.convertToSale — POST /quotations/:id/convert-to-sale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to the exact URL with no body and the Idempotency-Key header', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: convertBody })

    await quotationApi.convertToSale('q-1', 'key-2')

    expect(http.post).toHaveBeenCalledWith('/quotations/q-1/convert-to-sale', null, {
      headers: { 'Idempotency-Key': 'key-2' },
    })
  })

  it('decodes the converted quotation and the new sale draft', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: convertBody })

    const result = await quotationApi.convertToSale('q-1', 'key-2')

    expect(result.quotation.status).toBe('CONVERTED_TO_SALE')
    expect(result.quotation.effectiveStatus).toBe('CONVERTED_TO_SALE')
    expect(result.quotation.saleId).toBe('s-new')
    expect(result.quotation.convertedAt).toBe('2026-11-18T18:04:05.123Z')
    expect(result.sale.id).toBe('s-new')
    expect(result.sale.quotationId).toBe('q-1')
    expect(result.sale.items).toHaveLength(1)
  })

  it('throws a ZodError when the sale is missing from the 201 body', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { quotation: convertBody.quotation } })

    await expect(quotationApi.convertToSale('q-1', 'k')).rejects.toBeInstanceOf(ZodError)
  })
})

describe('quotation reads — saleId / convertedAt', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes the new fields through getById and keeps older payloads without them', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: convertBody.quotation })
    const converted = await quotationApi.getById('q-1')
    expect(converted.saleId).toBe('s-new')
    expect(converted.convertedAt).toBe('2026-11-18T18:04:05.123Z')

    const { saleId: _s, convertedAt: _c, ...older } = quotation
    vi.mocked(http.get).mockResolvedValue({ data: older })
    const legacy = await quotationApi.getById('q-1')
    expect(legacy.saleId).toBeUndefined()
    expect(legacy.convertedAt).toBeUndefined()
  })

  it('filters the list by CONVERTED_TO_SALE', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { data: [], pagination: {} } })

    await quotationApi.list({ status: 'CONVERTED_TO_SALE' })

    expect(http.get).toHaveBeenCalledWith('/quotations', { params: { status: 'CONVERTED_TO_SALE' } })
  })
})

// odd T3b / S5 — automatic promotions vetoed on the new sale (handoff 23 §2, `suppressedPromotions`).
describe('convertToSale — suppressedPromotions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('decodes the list, with a null title kept as null', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: {
        ...convertBody,
        suppressedPromotions: [
          { promotionId: 'promo-auto', title: 'Orden auto' },
          { promotionId: 'promo-gone', title: null },
        ],
      },
    })

    const result = await quotationApi.convertToSale('q-1', 'k')

    expect(result.suppressedPromotions).toEqual([
      { promotionId: 'promo-auto', title: 'Orden auto' },
      { promotionId: 'promo-gone', title: null },
    ])
  })

  it('reads a missing list as [] and skips malformed entries', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: convertBody })
    expect((await quotationApi.convertToSale('q-1', 'k')).suppressedPromotions).toEqual([])

    vi.mocked(http.post).mockResolvedValue({
      data: { ...convertBody, suppressedPromotions: [{ title: 'sin id' }, { promotionId: 'ok' }] },
    })
    expect((await quotationApi.convertToSale('q-1', 'k')).suppressedPromotions).toEqual([
      { promotionId: 'ok', title: null },
    ])
  })
})

describe('createFromSale — the discarded draft forgets its suppressed promotions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('clears the stored list of discardedSaleId', async () => {
    const { rememberSuppressedPromotions, readSuppressedPromotions } = await import(
      '@/features/POS/sales/composables/useSuppressedPromotions'
    )
    rememberSuppressedPromotions('s-9', [{ promotionId: 'promo-auto', title: 'Orden auto' }])
    vi.mocked(http.post).mockResolvedValue({ data: fromSaleBody })

    await quotationApi.createFromSale('s-9', {}, 'k')

    expect(readSuppressedPromotions('s-9')).toEqual([])
  })
})

describe('quotation reads — saleStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('passes saleStatus through getById', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { ...convertBody.quotation, saleStatus: 'CONFIRMED' },
    })
    const read = await quotationApi.getById('q-1')
    expect(read.saleStatus).toBe('CONFIRMED')
  })
})
