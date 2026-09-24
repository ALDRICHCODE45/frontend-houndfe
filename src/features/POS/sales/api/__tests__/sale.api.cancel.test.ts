// PCA-3 (promotion-capacity-alerts): full confirmed-sale cancellation.
//
// Authoritative backend contract:
//   /home/aldrich_coder45/Desktop/workspace/houndfe/houndfe-backend/docs/promotion-capacity-alerts-frontend.md
//   §§2.1, 2.8–2.9.
//
// Pins asserted here:
//   - Exact path: POST /sales/:saleId/cancel
//   - Exact body: { reason: <SaleCancellationReason> } (nothing else leaks).
//   - NO third request-config argument → no `Idempotency-Key` header. The
//     server owns cancellation idempotency (`sale:cancel:<saleId>`).
//   - The full five-reason backend union is typed and forwarded unchanged.
//   - The response shape is returned unwrapped from `.data`.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saleApi } from '../sale.api'
import { http } from '@/core/shared/api/http'
import type { SaleCancellationReason, SaleCancellationResponse } from '../../interfaces/sale.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const cancelledSale: SaleCancellationResponse = {
  saleId: 'sale-1',
  status: 'CANCELED',
  refundedCents: 127000,
  restockedItems: [
    { productId: 'prod-1', variantId: null, quantity: 2 },
    { productId: 'prod-2', variantId: 'var-9', quantity: 1 },
  ],
  canceledAt: '2026-09-21T18:04:11.482Z',
}

const ALL_REASONS: SaleCancellationReason[] = [
  'CUSTOMER_REQUEST',
  'ORDER_ERROR',
  'OUT_OF_STOCK',
  'DUPLICATE_SALE',
  'OTHER',
]

describe('saleApi.cancelSale (PCA-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs /sales/:saleId/cancel with the reason body and nothing else', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: cancelledSale })

    const result = await saleApi.cancelSale('sale-1', { reason: 'CUSTOMER_REQUEST' })

    expect(http.post).toHaveBeenCalledWith('/sales/sale-1/cancel', {
      reason: 'CUSTOMER_REQUEST',
    })
    // Exactly two arguments (url + body). A third argument would be the axios
    // request config that could carry headers.
    expect(vi.mocked(http.post).mock.calls[0]).toHaveLength(2)
    expect(result).toEqual(cancelledSale)
  })

  it('never sends an idempotency-key header (server owns cancellation idempotency)', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: cancelledSale })

    await saleApi.cancelSale('sale-1', { reason: 'CUSTOMER_REQUEST' })

    const call = vi.mocked(http.post).mock.calls[0]
    expect(JSON.stringify(call)).not.toMatch(/idempotency/i)
  })

  it('interpolates the exact saleId into the path', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: cancelledSale })

    await saleApi.cancelSale('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
      reason: 'CUSTOMER_REQUEST',
    })

    expect(http.post).toHaveBeenCalledWith('/sales/a1b2c3d4-e5f6-7890-abcd-ef1234567890/cancel', {
      reason: 'CUSTOMER_REQUEST',
    })
  })

  it('forwards each of the five backend reasons unchanged', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: cancelledSale })

    for (const reason of ALL_REASONS) {
      await saleApi.cancelSale('sale-1', { reason })
    }

    expect(vi.mocked(http.post).mock.calls.map((call) => call[1])).toEqual(
      ALL_REASONS.map((reason) => ({ reason })),
    )
  })

  it('strips any extra caller fields so tenant/actor data never leaks on the wire', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: cancelledSale })

    // Simulates an over-wide caller object (cast to the request type).
    await saleApi.cancelSale('sale-1', {
      reason: 'CUSTOMER_REQUEST',
      tenantId: 'tenant-other',
      actorId: 'user-9',
    } as { reason: SaleCancellationReason })

    expect(vi.mocked(http.post).mock.calls[0]?.[1]).toEqual({ reason: 'CUSTOMER_REQUEST' })
  })

  it('preserves null variantId and per-item quantities from the response', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: cancelledSale })

    const result = await saleApi.cancelSale('sale-1', { reason: 'OUT_OF_STOCK' })

    expect(result.status).toBe('CANCELED')
    expect(result.refundedCents).toBe(127000)
    expect(result.restockedItems).toEqual([
      { productId: 'prod-1', variantId: null, quantity: 2 },
      { productId: 'prod-2', variantId: 'var-9', quantity: 1 },
    ])
    expect(result.canceledAt).toBe('2026-09-21T18:04:11.482Z')
  })

  it('rethrows a SALE_NOT_FOUND error unchanged for the caller to classify', async () => {
    const apiError = {
      response: { status: 404, data: { error: 'SALE_NOT_FOUND' } },
    }
    vi.mocked(http.post).mockRejectedValue(apiError)

    await expect(saleApi.cancelSale('sale-1', { reason: 'CUSTOMER_REQUEST' })).rejects.toBe(
      apiError,
    )
  })
})
