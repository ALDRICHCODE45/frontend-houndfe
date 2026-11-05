import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { SettlementFormValues } from '../../utils/settlementForm'
import { withQuery } from './withQuery'

vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { settleRefund: vi.fn() } }))
vi.mock('@/features/auth/composables/useSafeTenantId', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return { useSafeTenantId: () => computed(() => 'tenant-1') }
})

let keyCounter = 0
vi.mock('@/features/POS/sales/utils/idempotency.utils', () => ({
  newIdempotencyKey: () => `key-${++keyCounter}`,
}))

import { saleApi } from '@/features/POS/sales/api/sale.api'
import { useSettleRefund } from '../useSettleRefund'

const REFUND_ID = 'cmw2iwsa00000r965efhf292s'
const NOW = new Date('2026-11-05T17:05:00.000Z')

function values(patch: Partial<SettlementFormValues> = {}): SettlementFormValues {
  return { amount: '20.00', method: 'cash', reference: '', settledAt: null, useCashSession: false, ...patch }
}

function response(outstandingCents: number, amountCents = 2000) {
  return {
    settlementId: '1cd165f0-6aa9-4001-8441-b8648ca54b07',
    refundId: REFUND_ID,
    saleId: '291e8f35-0c17-46df-8c87-6ad6cbfdcd46',
    amountCents,
    method: 'cash' as const,
    reference: null,
    settledAt: '2026-11-05T17:05:00.000Z',
    settledCents: 6555 - outstandingCents,
    outstandingCents,
  }
}

function domainError(status: number, error: string) {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('fail', 'ERR_BAD_REQUEST', config, {}, {
    status,
    statusText: '',
    data: { statusCode: status, error, message: error, timestamp: 'x' },
    headers: {},
    config,
  })
}

function setup() {
  const harness = withQuery(() => useSettleRefund({ retryDelayMs: 0, now: () => NOW }))
  const invalidate = vi.spyOn(harness.client, 'invalidateQueries')
  return { ...harness, invalidate }
}

const settle = vi.mocked(saleApi.settleRefund)
const keyOf = (call: number) => settle.mock.calls[call]![2]

describe('useSettleRefund', () => {
  beforeEach(() => {
    settle.mockReset()
    keyCounter = 0
  })

  it('sends one key per attempt and reuses it, with the frozen body, to retry the same answers', async () => {
    const { result } = setup()
    settle.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
    settle.mockResolvedValueOnce(response(2555))

    const first = await result.submit(REFUND_ID, values(), { cashSessionId: null })
    expect(first).toMatchObject({ status: 'failed', error: { code: 'NETWORK' } })
    await result.submit(REFUND_ID, values(), { cashSessionId: null })

    expect(keyOf(0)).toBe('key-1')
    expect(keyOf(1)).toBe('key-1')
    expect(settle.mock.calls[1]![1]).toEqual(settle.mock.calls[0]![1])
  })

  it('opens a new key when an answer changes or after a success', async () => {
    const { result } = setup()
    settle.mockRejectedValueOnce(domainError(422, 'SETTLEMENT_EXCEEDS_REFUND'))
    settle.mockResolvedValue(response(2555))

    await result.submit(REFUND_ID, values({ amount: '99.99' }), { cashSessionId: null })
    await result.submit(REFUND_ID, values({ amount: '20.00' }), { cashSessionId: null })
    await result.submit(REFUND_ID, values({ amount: '20.00' }), { cashSessionId: null })

    expect([keyOf(0), keyOf(1), keyOf(2)]).toEqual(['key-1', 'key-2', 'key-3'])
  })

  it('ignores a second submit while the first is in flight', async () => {
    const { result } = setup()
    let resolve!: (value: unknown) => void
    settle.mockReturnValueOnce(new Promise((r) => (resolve = r)) as never)

    const first = result.submit(REFUND_ID, values(), { cashSessionId: null })
    const second = await result.submit(REFUND_ID, values(), { cashSessionId: null })
    expect(second).toEqual({ status: 'ignored' })
    expect(result.isSubmitting.value).toBe(true)

    resolve(response(2555))
    await first
    expect(settle).toHaveBeenCalledTimes(1)
    expect(result.isSubmitting.value).toBe(false)
  })

  it('waits and retries with the same key and body on IDEMPOTENCY_KEY_IN_FLIGHT', async () => {
    const { result } = setup()
    settle.mockRejectedValueOnce(domainError(409, 'IDEMPOTENCY_KEY_IN_FLIGHT'))
    settle.mockResolvedValueOnce(response(0, 4555))

    const outcome = await result.submit(REFUND_ID, values(), { cashSessionId: null })

    expect(outcome).toMatchObject({ status: 'settled', response: { outstandingCents: 0 } })
    expect(settle).toHaveBeenCalledTimes(2)
    expect(keyOf(1)).toBe(keyOf(0))
    expect(settle.mock.calls[1]![1]).toEqual(settle.mock.calls[0]![1])
  })

  it('drops the key after IDEMPOTENCY_KEY_CONFLICT so the next confirm is a new attempt', async () => {
    const { result } = setup()
    settle.mockRejectedValueOnce(domainError(409, 'IDEMPOTENCY_KEY_CONFLICT'))
    settle.mockResolvedValueOnce(response(2555))

    await result.submit(REFUND_ID, values(), { cashSessionId: null })
    await result.submit(REFUND_ID, values(), { cashSessionId: null })

    expect(keyOf(0)).toBe('key-1')
    expect(keyOf(1)).toBe('key-2')
  })

  it('refreshes every pending-refund slot (page, dashboard, nav badge) after a settlement', async () => {
    const { result, invalidate } = setup()
    settle.mockResolvedValueOnce(response(2555))

    const outcome = await result.submit(REFUND_ID, values(), { cashSessionId: null })

    expect(outcome).toMatchObject({ status: 'settled', response: { outstandingCents: 2555 } })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: saleQueryKeys.pendingRefundsPrefix('tenant-1') })
  })

  it('refreshes the detail of the refund\'s sale after a settlement', async () => {
    const { result, invalidate } = setup()
    settle.mockResolvedValueOnce(response(2555))

    await result.submit(REFUND_ID, values(), { cashSessionId: null })

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: saleQueryKeys.detail('tenant-1', '291e8f35-0c17-46df-8c87-6ad6cbfdcd46'),
    })
  })

  it('refreshes the sale detail after a balance error when the caller names the sale', async () => {
    const { result, invalidate } = setup()
    settle.mockRejectedValueOnce(domainError(422, 'SETTLEMENT_EXCEEDS_REFUND'))

    await result.submit(REFUND_ID, values(), { cashSessionId: null, saleId: 'sale-9' })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: saleQueryKeys.detail('tenant-1', 'sale-9') })
  })

  it.each(['SETTLEMENT_EXCEEDS_REFUND', 'REFUND_ALREADY_SETTLED', 'REFUND_NOT_FOUND'])(
    'refreshes the balance after %s',
    async (code) => {
      const { result, invalidate } = setup()
      settle.mockRejectedValueOnce(domainError(code === 'REFUND_NOT_FOUND' ? 404 : code === 'REFUND_ALREADY_SETTLED' ? 409 : 422, code))

      const outcome = await result.submit(REFUND_ID, values(), { cashSessionId: null })

      expect(outcome).toMatchObject({ status: 'failed', error: { code } })
      expect(invalidate).toHaveBeenCalledWith({ queryKey: saleQueryKeys.pendingRefundsPrefix('tenant-1') })
    },
  )

  it('sends the open cash session only when the user asks for it', async () => {
    const { result } = setup()
    settle.mockResolvedValue(response(2555))
    const session = '7f1c2a90-3b4d-4e5f-8a6b-1c2d3e4f5a6b'

    await result.submit(REFUND_ID, values({ useCashSession: true }), { cashSessionId: session })

    expect(settle.mock.calls[0]![1]).toMatchObject({ cashSessionId: session, settledAt: expect.stringMatching(/[+-]\d{2}:\d{2}$|Z$/) })
  })
})
