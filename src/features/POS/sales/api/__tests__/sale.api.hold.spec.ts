import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { saleApi } from '../sale.api'

vi.mock('@/core/shared/api/http', () => ({
  http: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

// BE handoff 24 §2: PATCH /sales/:id/hold answers the full sale detail with the new hold.
const detail = {
  id: 'sale-1',
  folio: 'W-1',
  status: 'CONFIRMED',
  channel: 'ONLINE',
  paymentStatus: 'CREDIT',
  hold: {
    paymentIntent: 'IN_STORE',
    expiresAt: '2026-11-21T05:00:00.000Z',
    reminderAt: '2026-11-21T02:00:00.000Z',
    stage: 0,
    version: 2,
  },
}

describe('saleApi.updateHold', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes /sales/:id/hold with only expiresAt and expectedVersion, no Idempotency-Key', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: detail })
    const over = { expiresAt: '2026-11-20T23:00:00-06:00', expectedVersion: 1, tenantId: 'x' }

    const sale = await saleApi.updateHold('sale-1', over)

    expect(http.patch).toHaveBeenCalledTimes(1)
    expect(http.patch).toHaveBeenCalledWith('/sales/sale-1/hold', {
      expiresAt: '2026-11-20T23:00:00-06:00',
      expectedVersion: 1,
    })
    expect(sale.hold).toEqual(detail.hold)
    expect(sale.cancelReason).toBeNull()
  })

  it('encodes the sale id in the path', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: detail })
    await saleApi.updateHold('a/b', { expiresAt: '2026-11-20T23:00:00-06:00', expectedVersion: 0 })
    expect(vi.mocked(http.patch).mock.calls[0]![0]).toBe('/sales/a%2Fb/hold')
  })

  it('rethrows the transport error unchanged for the decoder', async () => {
    const error = Object.assign(new Error('409'), { response: { status: 409, data: { error: 'HOLD_VERSION_CONFLICT' } } })
    vi.mocked(http.patch).mockRejectedValue(error)
    await expect(
      saleApi.updateHold('sale-1', { expiresAt: '2026-11-20T23:00:00-06:00', expectedVersion: 1 }),
    ).rejects.toBe(error)
  })
})
