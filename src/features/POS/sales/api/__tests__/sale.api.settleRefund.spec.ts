import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import { http } from '@/core/shared/api/http'
import { saleApi } from '../sale.api'

const REFUND_ID = 'cmw2iwsa00000r965efhf292s'
const PARTIAL = {
  settlementId: '1cd165f0-6aa9-4001-8441-b8648ca54b07',
  refundId: REFUND_ID,
  saleId: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46',
  amountCents: 2000,
  method: 'cash',
  reference: 'DOC-EXAMPLE',
  settledAt: '2026-11-05T16:30:00.000Z',
  settledCents: 4000,
  outstandingCents: 2555,
}

describe('saleApi.settleRefund', () => {
  beforeEach(() => vi.mocked(http.post).mockReset())

  it('posts the closed body with the Idempotency-Key header and decodes the response', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: PARTIAL })

    const result = await saleApi.settleRefund(
      REFUND_ID,
      { amountCents: 2000, method: 'cash', reference: 'DOC-EXAMPLE', settledAt: '2026-11-05T10:30:00-06:00' },
      'doc-example-partial-1',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/sales/refunds/${REFUND_ID}/settlements`,
      { amountCents: 2000, method: 'cash', reference: 'DOC-EXAMPLE', settledAt: '2026-11-05T10:30:00-06:00' },
      { headers: { 'Idempotency-Key': 'doc-example-partial-1' } },
    )
    expect(result).toEqual(PARTIAL)
  })

  it('omits an empty reference and an absent cash session, and drops foreign keys', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { ...PARTIAL, reference: null } })

    await saleApi.settleRefund(
      REFUND_ID,
      {
        amountCents: 2000,
        method: 'cash',
        reference: '   ',
        settledAt: '2026-11-05T10:30:00-06:00',
        cashSessionId: undefined,
        note: 'never sent',
      } as never,
      'key-1',
    )

    expect(vi.mocked(http.post).mock.calls[0]![1]).toEqual({
      amountCents: 2000,
      method: 'cash',
      settledAt: '2026-11-05T10:30:00-06:00',
    })
  })

  it('sends the trimmed reference and the cash session when present', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: PARTIAL })

    await saleApi.settleRefund(
      REFUND_ID,
      {
        amountCents: 2000,
        method: 'cash',
        reference: '  SPEI 123 ',
        settledAt: '2026-11-05T10:30:00-06:00',
        cashSessionId: '7f1c2a90-3b4d-4e5f-8a6b-1c2d3e4f5a6b',
      },
      'key-1',
    )

    expect(vi.mocked(http.post).mock.calls[0]![1]).toEqual({
      amountCents: 2000,
      method: 'cash',
      reference: 'SPEI 123',
      settledAt: '2026-11-05T10:30:00-06:00',
      cashSessionId: '7f1c2a90-3b4d-4e5f-8a6b-1c2d3e4f5a6b',
    })
  })

  it('rejects a response that does not match the contract', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { ...PARTIAL, extra: true } })

    await expect(
      saleApi.settleRefund(
        REFUND_ID,
        { amountCents: 2000, method: 'cash', settledAt: '2026-11-05T10:30:00-06:00' },
        'key-1',
      ),
    ).rejects.toBeInstanceOf(ZodError)
  })
})
