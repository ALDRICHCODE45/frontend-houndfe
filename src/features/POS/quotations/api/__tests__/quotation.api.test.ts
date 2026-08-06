import { describe, it, expect, vi, beforeEach } from 'vitest'
import { quotationApi, QuotationPdfError } from '../quotation.api'
import { http } from '@/core/shared/api/http'
import type {
  CancelReason,
  PaginatedQuotations,
  QuotationListParams,
  QuotationResponseDto,
} from '../../interfaces/quotation.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockQuotation = (overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto => ({
  id: 'q-1',
  customerId: null,
  customer: null,
  globalPriceListId: null,
  priceListExplicitlySet: false,
  status: 'DRAFT',
  expiresAt: null,
  cancelReason: null,
  canceledAt: null,
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
  taxRate: null,
  taxCents: null,
  customerNotes: null,
  manuallyEnded: false,
  items: [],
  appliedPromotions: [],
  vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    effectiveStatus: 'DRAFT',
    createdAt: '2026-08-01T20:00:00.000Z',
  updatedAt: '2026-08-01T20:00:00.000Z',
  ...overrides,
})

describe('quotationApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── 3.1 createDraft ────────────────────────────────────────────────────────

  describe('createDraft', () => {
    it('POSTs to /quotations/drafts with no body when no customerId is provided', async () => {
      const response = mockQuotation({ id: 'q-new' })
      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await quotationApi.createDraft()

      expect(http.post).toHaveBeenCalledWith('/quotations/drafts', { customerId: undefined })
      expect(result.id).toBe('q-new')
    })

    it('POSTs to /quotations/drafts with customerId when provided', async () => {
      const response = mockQuotation({ id: 'q-cust', customerId: 'cust-1' })
      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await quotationApi.createDraft('cust-1')

      expect(http.post).toHaveBeenCalledWith('/quotations/drafts', { customerId: 'cust-1' })
      expect(result.customerId).toBe('cust-1')
    })
  })

  // ─── 3.2 list ───────────────────────────────────────────────────────────────

  describe('list', () => {
    it('GETs /quotations with query params and returns paginated response', async () => {
      const params: QuotationListParams = {
        page: 1,
        limit: 20,
        status: 'DRAFT',
        customerId: 'cust-1',
        search: 'maría',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }
      const response: PaginatedQuotations = {
        data: [mockQuotation({ id: 'q-1' })],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const result = await quotationApi.list(params)

      expect(http.get).toHaveBeenCalledWith('/quotations', { params })
      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })

    it('passes an empty params object when no filters are provided', async () => {
      const response: PaginatedQuotations = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      await quotationApi.list({})

      expect(http.get).toHaveBeenCalledWith('/quotations', { params: {} })
    })
  })

  // ─── 3.3 getById ────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('GETs /quotations/:id and returns the full quotation', async () => {
      const response = mockQuotation({ id: 'q-42', status: 'SENT' })
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const result = await quotationApi.getById('q-42')

      expect(http.get).toHaveBeenCalledWith('/quotations/q-42')
      expect(result.id).toBe('q-42')
      expect(result.status).toBe('SENT')
    })
  })

  // ─── 3.4 getPdfBlob ─────────────────────────────────────────────────────────

  describe('getPdfBlob', () => {
    const makeBlob = (text: string) => new Blob([text], { type: 'application/json' })

    it('GETs /quotations/:id/pdf with format=quotation-a4, responseType blob, and returns the Blob', async () => {
      const pdfBytes = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })
      vi.mocked(http.get).mockResolvedValue({ data: pdfBytes })

      const result = await quotationApi.getPdfBlob('q-1')

      expect(http.get).toHaveBeenCalledWith(
        '/quotations/q-1/pdf',
        expect.objectContaining({
          params: { format: 'quotation-a4' },
          responseType: 'blob',
          timeout: 15_000,
        }),
      )
      expect(result).toBe(pdfBytes)
    })

    it('forwards an AbortSignal when one is provided', async () => {
      const pdfBytes = new Blob(['%PDF'], { type: 'application/pdf' })
      const controller = new AbortController()
      vi.mocked(http.get).mockResolvedValue({ data: pdfBytes })

      await quotationApi.getPdfBlob('q-1', { signal: controller.signal })

      expect(http.get).toHaveBeenCalledWith(
        '/quotations/q-1/pdf',
        expect.objectContaining({ signal: controller.signal }),
      )
    })

    it('parses known backend PDF error codes and throws QuotationPdfError', async () => {
      vi.mocked(http.get)
        .mockRejectedValueOnce({
          response: { status: 400, data: makeBlob(JSON.stringify({ error: 'INVALID_FORMAT' })) },
        })
        .mockRejectedValueOnce({
          response: { status: 404, data: makeBlob(JSON.stringify({ error: 'QUOTATION_NOT_FOUND' })) },
        })
        .mockRejectedValueOnce({
          response: { status: 500, data: makeBlob(JSON.stringify({ error: 'PDF_GENERATION_FAILED' })) },
        })

      await expect(quotationApi.getPdfBlob('q-1')).rejects.toMatchObject({ code: 'INVALID_FORMAT' })
      await expect(quotationApi.getPdfBlob('q-1')).rejects.toMatchObject({ code: 'QUOTATION_NOT_FOUND' })
      await expect(quotationApi.getPdfBlob('q-1')).rejects.toBeInstanceOf(QuotationPdfError)
    })

    it('rethrows the original axios error when the Blob body has no known code', async () => {
      const apiError = {
        response: { status: 503, data: makeBlob(JSON.stringify({ error: 'SOMETHING_ELSE' })) },
      }
      vi.mocked(http.get).mockRejectedValue(apiError)

      await expect(quotationApi.getPdfBlob('q-1')).rejects.toBe(apiError)
    })

    it('rethrows the original error on network failures (no Blob body)', async () => {
      const networkError = new Error('Network Error')
      vi.mocked(http.get).mockRejectedValue(networkError)

      await expect(quotationApi.getPdfBlob('q-1')).rejects.toBe(networkError)
    })
  })

  // ─── 3.5 assignCustomer ─────────────────────────────────────────────────────

  describe('assignCustomer', () => {
    it('PUTs to /quotations/drafts/:id/customer with { customerId }', async () => {
      const response = mockQuotation({
        id: 'q-1',
        customerId: 'cust-1',
        globalPriceListId: 'pl-1',
        priceListExplicitlySet: false,
      })
      vi.mocked(http.put).mockResolvedValue({ data: response })

      const result = await quotationApi.assignCustomer('q-1', 'cust-1')

      expect(http.put).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/customer',
        { customerId: 'cust-1' },
      )
      expect(result.customerId).toBe('cust-1')
    })
  })

  // ─── 3.6 setPriceList ───────────────────────────────────────────────────────

  describe('setPriceList', () => {
    it('PUTs to /quotations/drafts/:id/price-list with a price list id', async () => {
      const response = mockQuotation({ id: 'q-1', globalPriceListId: 'pl-mayoreo' })
      vi.mocked(http.put).mockResolvedValue({ data: response })

      const result = await quotationApi.setPriceList('q-1', 'pl-mayoreo')

      expect(http.put).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/price-list',
        { globalPriceListId: 'pl-mayoreo' },
      )
      expect(result.globalPriceListId).toBe('pl-mayoreo')
    })

    it('accepts null to clear the active price list', async () => {
      const response = mockQuotation({ id: 'q-1', globalPriceListId: null })
      vi.mocked(http.put).mockResolvedValue({ data: response })

      const result = await quotationApi.setPriceList('q-1', null)

      expect(http.put).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/price-list',
        { globalPriceListId: null },
      )
      expect(result.globalPriceListId).toBeNull()
    })
  })

  // ─── 3.7 addItem ────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('POSTs to /quotations/drafts/:id/items with the full payload', async () => {
      const response = mockQuotation({ id: 'q-1' })
      vi.mocked(http.post).mockResolvedValue({ data: response })

      await quotationApi.addItem('q-1', { productId: 'prod-1', quantity: 3 })

      expect(http.post).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/items',
        { productId: 'prod-1', quantity: 3 },
      )
    })

    it('forwards variantId when provided', async () => {
      vi.mocked(http.post).mockResolvedValue({ data: mockQuotation() })

      await quotationApi.addItem('q-1', { productId: 'prod-2', variantId: 'var-1', quantity: 2 })

      expect(http.post).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/items',
        { productId: 'prod-2', variantId: 'var-1', quantity: 2 },
      )
    })
  })

  // ─── 3.8 updateQuantity ─────────────────────────────────────────────────────

  describe('updateQuantity', () => {
    it('PATCHes /quotations/drafts/:id/items/:itemId/quantity with the new quantity', async () => {
      const response = mockQuotation({ id: 'q-1' })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      await quotationApi.updateQuantity('q-1', 'item-1', 5)

      expect(http.patch).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/items/item-1/quantity',
        { quantity: 5 },
      )
    })
  })

  // ─── 3.9 removeItem ─────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('DELETEs /quotations/drafts/:id/items/:itemId and returns the updated quotation', async () => {
      const response = mockQuotation({ id: 'q-1' })
      vi.mocked(http.delete).mockResolvedValue({ data: response })

      const result = await quotationApi.removeItem('q-1', 'item-1')

      expect(http.delete).toHaveBeenCalledWith('/quotations/drafts/q-1/items/item-1')
      expect(result.id).toBe('q-1')
    })
  })

  // ─── 3.10 overridePrice ─────────────────────────────────────────────────────

  describe('overridePrice', () => {
    it('PATCHes /quotations/drafts/:id/items/:itemId/price with unitPriceCents', async () => {
      const response = mockQuotation({ id: 'q-1' })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      await quotationApi.overridePrice('q-1', 'item-1', 19900)

      expect(http.patch).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/items/item-1/price',
        { unitPriceCents: 19900 },
      )
    })
  })

  // ─── 3.11 manual promotions ─────────────────────────────────────────────────

  describe('applyManualPromotion', () => {
    it('PUTs to /quotations/drafts/:id/manual-promotions/:promoId with empty body', async () => {
      const response = mockQuotation({ id: 'q-1' })
      vi.mocked(http.put).mockResolvedValue({ data: response })

      await quotationApi.applyManualPromotion('q-1', 'promo-1')

      expect(http.put).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/manual-promotions/promo-1',
        {},
      )
    })
  })

  describe('removeManualPromotion', () => {
    it('DELETEs /quotations/drafts/:id/manual-promotions/:promoId and returns the updated quotation', async () => {
      const response = mockQuotation({ id: 'q-1' })
      vi.mocked(http.delete).mockResolvedValue({ data: response })

      const result = await quotationApi.removeManualPromotion('q-1', 'promo-1')

      expect(http.delete).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/manual-promotions/promo-1',
      )
      expect(result.id).toBe('q-1')
    })
  })

  // ─── 3.12 automatic promotion veto / opt-in ─────────────────────────────────

  describe('vetoPromotion', () => {
    it('POSTs to /quotations/drafts/:id/promotions/:promoId/veto with empty body', async () => {
      const response = mockQuotation({ id: 'q-1', vetoedPromotionIds: ['promo-1'] })
      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await quotationApi.vetoPromotion('q-1', 'promo-1')

      expect(http.post).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/promotions/promo-1/veto',
        {},
      )
      expect(result.vetoedPromotionIds).toContain('promo-1')
    })
  })

  describe('unvetoPromotion', () => {
    it('DELETEs /quotations/drafts/:id/promotions/:promoId/veto and returns the updated quotation', async () => {
      const response = mockQuotation({ id: 'q-1', vetoedPromotionIds: [] })
      vi.mocked(http.delete).mockResolvedValue({ data: response })

      const result = await quotationApi.unvetoPromotion('q-1', 'promo-1')

      expect(http.delete).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/promotions/promo-1/veto',
      )
      expect(result.vetoedPromotionIds).not.toContain('promo-1')
    })
  })

  // ─── 3.13 setExpiry ─────────────────────────────────────────────────────────

  describe('setExpiry', () => {
    it('PATCHes /quotations/drafts/:id/expiry with an ISO date', async () => {
      const response = mockQuotation({ id: 'q-1', expiresAt: '2026-08-15T00:00:00.000Z' })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      await quotationApi.setExpiry('q-1', '2026-08-15T00:00:00.000Z')

      expect(http.patch).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/expiry',
        { expiresAt: '2026-08-15T00:00:00.000Z' },
      )
    })

    it('accepts null to clear the expiry (never expires)', async () => {
      const response = mockQuotation({ id: 'q-1', expiresAt: null })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      await quotationApi.setExpiry('q-1', null)

      expect(http.patch).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/expiry',
        { expiresAt: null },
      )
    })
  })

  // ─── 3.13b updateNotes ──────────────────────────────────────────────────────

  describe('updateNotes', () => {
    it('PATCHes /quotations/drafts/:id/notes with a non-null customerNotes string', async () => {
      const response = mockQuotation({
        id: 'q-1',
        customerNotes: 'Entrega en domicilio, pago en efectivo',
      })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      const result = await quotationApi.updateNotes('q-1', 'Entrega en domicilio, pago en efectivo')

      expect(http.patch).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/notes',
        { customerNotes: 'Entrega en domicilio, pago en efectivo' },
      )
      expect(result.customerNotes).toBe('Entrega en domicilio, pago en efectivo')
    })

    it('accepts null to clear the notes', async () => {
      const response = mockQuotation({ id: 'q-1', customerNotes: null })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      const result = await quotationApi.updateNotes('q-1', null)

      expect(http.patch).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/notes',
        { customerNotes: null },
      )
      expect(result.customerNotes).toBeNull()
    })

    it('returns the full updated quotation (replace-cache-head pattern)', async () => {
      const response = mockQuotation({
        id: 'q-1',
        customerNotes: 'X',
        taxRate: 0.16,
        taxCents: 1600,
        totalCents: 10000,
      })
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      const result = await quotationApi.updateNotes('q-1', 'X')

      expect(result.id).toBe('q-1')
      expect(result.taxRate).toBe(0.16)
      expect(result.taxCents).toBe(1600)
    })

    it('rejects with the original axios error on HTTP 409 (non-DRAFT)', async () => {
      const apiError = { response: { status: 409, data: { message: 'QUOTATION_NOT_DRAFT' } } }
      vi.mocked(http.patch).mockRejectedValue(apiError)

      await expect(quotationApi.updateNotes('q-1', 'X')).rejects.toEqual(apiError)
    })
  })

  // ─── 3.14 send ──────────────────────────────────────────────────────────────

  describe('send', () => {
    it('POSTs to /quotations/drafts/:id/send with ?email=true by default', async () => {
      const response = mockQuotation({ id: 'q-1', status: 'SENT' })
      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await quotationApi.send('q-1')

      expect(http.post).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/send',
        null,
        { params: { email: true } },
      )
      expect(result.status).toBe('SENT')
    })

    it('passes email=false when the caller opts out of sending the email', async () => {
      const response = mockQuotation({ id: 'q-1', status: 'SENT' })
      vi.mocked(http.post).mockResolvedValue({ data: response })

      await quotationApi.send('q-1', false)

      expect(http.post).toHaveBeenCalledWith(
        '/quotations/drafts/q-1/send',
        null,
        { params: { email: false } },
      )
    })
  })

  // ─── 3.15 cancel ────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it.each<CancelReason>(['CUSTOMER_REQUEST', 'PRICE_OBJECTION', 'EXPIRED', 'OTHER'])(
      'POSTs to /quotations/drafts/:id/cancel with %s reason',
      async (reason) => {
        const response = mockQuotation({ id: 'q-1', status: 'CANCELLED', cancelReason: reason })
        vi.mocked(http.post).mockResolvedValue({ data: response })

        const result = await quotationApi.cancel('q-1', reason)

        expect(http.post).toHaveBeenCalledWith(
          '/quotations/drafts/q-1/cancel',
          { cancelReason: reason },
        )
        expect(result.status).toBe('CANCELLED')
        expect(result.cancelReason).toBe(reason)
      },
    )
  })

  // ─── 3.16 delete ────────────────────────────────────────────────────────────

  describe('deleteQuotation', () => {
    it('DELETEs /quotations/:id and resolves with void (204 No Content)', async () => {
      vi.mocked(http.delete).mockResolvedValueOnce({ data: undefined })

      await expect(quotationApi.deleteQuotation('q-1')).resolves.toBeUndefined()
      expect(http.delete).toHaveBeenCalledWith('/quotations/q-1')
    })

    it.each([400, 404, 409, 422, 500])(
      'rejects with the original axios error on HTTP %s',
      async (status) => {
        const apiError = { response: { status } }
        vi.mocked(http.delete).mockRejectedValue(apiError)

        await expect(quotationApi.deleteQuotation('q-1')).rejects.toEqual(apiError)
      },
    )
  })

  // ─── error handling — all mutations bubble up axios errors ──────────────────

  describe('error handling', () => {
    it.each([400, 404, 409, 422, 500])(
      'rejects with the original axios error on HTTP %s for assignCustomer',
      async (status) => {
        const apiError = { response: { status } }
        vi.mocked(http.put).mockRejectedValue(apiError)

        await expect(quotationApi.assignCustomer('q-1', 'cust-1')).rejects.toEqual(apiError)
      },
    )

    it.each([400, 404, 409, 422, 500])(
      'rejects with the original axios error on HTTP %s for updateQuantity',
      async (status) => {
        const apiError = { response: { status } }
        vi.mocked(http.patch).mockRejectedValue(apiError)

        await expect(quotationApi.updateQuantity('q-1', 'item-1', 1)).rejects.toEqual(apiError)
      },
    )

    it.each([400, 404, 409, 422, 500])(
      'rejects with the original axios error on HTTP %s for cancel',
      async (status) => {
        const apiError = { response: { status } }
        vi.mocked(http.post).mockRejectedValue(apiError)

        await expect(quotationApi.cancel('q-1', 'OTHER')).rejects.toEqual(apiError)
      },
    )

    it.each([400, 404, 409, 422, 500])(
      'rejects with the original axios error on HTTP %s for getById',
      async (status) => {
        const apiError = { response: { status } }
        vi.mocked(http.get).mockRejectedValue(apiError)

        await expect(quotationApi.getById('q-1')).rejects.toEqual(apiError)
      },
    )
  })

  // ─── QuotationPdfError class ───────────────────────────────────────────────

  describe('QuotationPdfError', () => {
    it('exposes a code and name as expected', () => {
      const err = new QuotationPdfError('INVALID_FORMAT')
      expect(err).toBeInstanceOf(Error)
      expect(err.code).toBe('INVALID_FORMAT')
      expect(err.name).toBe('QuotationPdfError')
      expect(err.message).toBe('INVALID_FORMAT')
    })
  })
})
