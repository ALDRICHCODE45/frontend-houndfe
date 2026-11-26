/**
 * «Cobrar todo» T1 (S2, S5; handoff 30 §5, §9): the live preview, the confirm gate, one
 * idempotency key per submission, the 409 / IN_FLIGHT / 422 recoveries and the refresh after a
 * successful collection.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { CollectionPreview, CollectionResult, CollectionTender } from '../collection.types'

const preview = vi.fn()
const apply = vi.fn()
vi.mock('../collection.api', () => ({
  customerCollectionApi: {
    preview: (...args: unknown[]) => preview(...args),
    apply: (...args: unknown[]) => apply(...args),
    read: vi.fn(),
    getReceiptPdf: vi.fn(),
  },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))
let keyCounter = 0
vi.mock('@/features/POS/sales/utils/idempotency.utils', () => ({
  newIdempotencyKey: () => `key-${++keyCounter}`,
}))

const { useCustomerCollection } = await import('../useCustomerCollection')

function makePreview(overrides: Partial<CollectionPreview> = {}): CollectionPreview {
  return {
    customer: { id: 'c-1', name: 'Ana López' },
    debtCents: 140000,
    tenderedCents: 0,
    appliedCents: 0,
    changeDueCents: 0,
    payments: [],
    sales: [
      {
        saleId: 's-a',
        folio: 'V-000120',
        confirmedAt: '2026-10-02T17:04:11.000Z',
        dueDate: '2026-11-01T00:00:00.000Z',
        overdue: true,
        appliedCents: 0,
        paidCents: 0,
        debtCents: 30000,
        paymentStatus: 'CREDIT',
      },
    ],
    remainingCustomerDebtCents: 140000,
    ...overrides,
  }
}

function makeResult(): CollectionResult {
  return {
    collectionId: 'col-1',
    customer: { id: 'c-1', name: 'Ana López' },
    createdAt: '2026-11-25T18:02:33.120Z',
    tenderedCents: 30000,
    appliedCents: 30000,
    changeDueCents: 0,
    payments: [{ method: 'cash', amountCents: 30000, catalog: null }],
    sales: [
      {
        saleId: 's-a',
        folio: 'V-000120',
        confirmedAt: '2026-10-02T17:04:11.000Z',
        dueDate: '2026-11-01T00:00:00.000Z',
        overdue: true,
        appliedCents: 30000,
        paidCents: 30000,
        debtCents: 0,
        paymentStatus: 'PAID',
        paymentIds: ['p1'],
      },
      {
        saleId: 's-b',
        folio: 'V-000123',
        confirmedAt: '2026-10-11T18:30:00.000Z',
        dueDate: null,
        overdue: false,
        appliedCents: 0,
        paidCents: 0,
        debtCents: 0,
        paymentStatus: 'PAID',
        paymentIds: ['p2'],
      },
    ],
    remainingCustomerDebtCents: 110000,
  }
}

const httpError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: { status, data },
})
const networkError = () => ({ isAxiosError: true, message: 'Network Error' })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const CASH: CollectionTender[] = [{ method: 'cash', amountCents: 30000 }]

type Api = ReturnType<typeof useCustomerCollection>
let wrapper: VueWrapper | undefined
let queryClient: QueryClient
const open = shallowRef(true)
const cashSessionId = shallowRef<string | null>('sess-1')

function setup(): Api {
  let api!: Api
  queryClient = new QueryClient()
  vi.spyOn(queryClient, 'invalidateQueries')
  wrapper = mount(
    defineComponent({
      setup() {
        api = useCustomerCollection({
          customerId: () => 'c-1',
          open: () => open.value,
          cashSessionId: () => cashSessionId.value,
        })
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return api
}

/** Open, type CASH and let the debounced preview settle. */
async function ready(): Promise<Api> {
  preview.mockResolvedValueOnce(makePreview())
  const api = setup()
  await flushPromises()
  preview.mockResolvedValueOnce(makePreview({ tenderedCents: 30000, appliedCents: 30000 }))
  api.setPayments(CASH)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  return api
}

beforeEach(() => {
  vi.useFakeTimers()
  preview.mockReset()
  apply.mockReset()
  keyCounter = 0
  open.value = true
  cashSessionId.value = 'sess-1'
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('useCustomerCollection — preview', () => {
  it('previews without tenders when it opens', async () => {
    preview.mockResolvedValue(makePreview())
    const api = setup()
    await flushPromises()
    expect(preview).toHaveBeenCalledTimes(1)
    expect(preview).toHaveBeenCalledWith('c-1', {})
    expect(api.preview.value?.debtCents).toBe(140000)
  })

  it('debounces the preview with tenders by ~300 ms after the last change', async () => {
    preview.mockResolvedValue(makePreview())
    const api = setup()
    await flushPromises()
    api.setPayments([{ method: 'cash', amountCents: 100 }])
    await vi.advanceTimersByTimeAsync(200)
    api.setPayments(CASH)
    await vi.advanceTimersByTimeAsync(299)
    expect(preview).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(preview).toHaveBeenCalledTimes(2)
    expect(preview).toHaveBeenLastCalledWith('c-1', { payments: CASH })
  })

  it('ignores a stale preview response that arrives after a newer one', async () => {
    preview.mockResolvedValueOnce(makePreview())
    const api = setup()
    await flushPromises()
    const slow = deferred<CollectionPreview>()
    preview.mockReturnValueOnce(slow.promise)
    api.setPayments([{ method: 'cash', amountCents: 100 }])
    await vi.advanceTimersByTimeAsync(300)
    preview.mockResolvedValueOnce(makePreview({ appliedCents: 30000 }))
    api.setPayments(CASH)
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(api.preview.value?.appliedCents).toBe(30000)
    slow.resolve(makePreview({ appliedCents: 100 }))
    await flushPromises()
    expect(api.preview.value?.appliedCents).toBe(30000)
    expect(api.previewLoading.value).toBe(false)
  })

  it('shows a preview 422 inline and keeps confirm off', async () => {
    preview.mockResolvedValueOnce(makePreview())
    const api = setup()
    await flushPromises()
    preview.mockRejectedValueOnce(httpError(422, { error: 'COLLECTION_EXCEEDS_DEBT' }))
    api.setPayments([{ method: 'card_debit', amountCents: 999999 }])
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(api.previewError.value?.code).toBe('COLLECTION_EXCEEDS_DEBT')
    expect(api.canConfirm.value).toBe(false)
  })
})

describe('useCustomerCollection — confirm gate', () => {
  it('is on with a settled preview, tenders and a cash session', async () => {
    const api = await ready()
    expect(api.canConfirm.value).toBe(true)
  })

  it('is off without an open cash session', async () => {
    const api = await ready()
    cashSessionId.value = null
    expect(api.canConfirm.value).toBe(false)
  })

  it('is off while the preview is loading (from the first keystroke)', async () => {
    const api = await ready()
    preview.mockReturnValueOnce(new Promise(() => {}))
    api.setPayments([{ method: 'cash', amountCents: 20000 }])
    expect(api.previewLoading.value).toBe(true)
    expect(api.canConfirm.value).toBe(false)
  })

  it('is off without tenders', async () => {
    preview.mockResolvedValue(makePreview())
    const api = setup()
    await flushPromises()
    expect(api.canConfirm.value).toBe(false)
  })

  it('confirm() does nothing while the gate is off', async () => {
    const api = await ready()
    cashSessionId.value = null
    expect(await api.confirm()).toBeNull()
    expect(apply).not.toHaveBeenCalled()
  })
})

describe('useCustomerCollection — apply', () => {
  it('sends payments, cashSessionId and expectedDebtCents from the last preview (no saleIds)', async () => {
    const api = await ready()
    apply.mockResolvedValue(makeResult())
    await api.confirm()
    expect(apply).toHaveBeenCalledWith(
      'c-1',
      { payments: CASH, cashSessionId: 'sess-1', expectedDebtCents: 140000 },
      'key-1',
    )
    expect(apply.mock.calls[0]![1]).not.toHaveProperty('saleIds')
  })

  it('reuses the key only for a network retry of the same body', async () => {
    const api = await ready()
    apply.mockRejectedValueOnce(networkError())
    await api.confirm()
    expect(api.applyError.value?.network).toBe(true)
    apply.mockResolvedValueOnce(makeResult())
    await api.confirm()
    expect(apply.mock.calls[0]![2]).toBe('key-1')
    expect(apply.mock.calls[1]![2]).toBe('key-1')
    expect(apply.mock.calls[1]![1]).toEqual(apply.mock.calls[0]![1])
  })

  it('regenerates the key when the tenders change after a network failure', async () => {
    const api = await ready()
    apply.mockRejectedValueOnce(networkError())
    await api.confirm()
    preview.mockResolvedValueOnce(makePreview({ appliedCents: 20000 }))
    api.setPayments([{ method: 'cash', amountCents: 20000 }])
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    apply.mockResolvedValueOnce(makeResult())
    await api.confirm()
    expect(apply.mock.calls[1]![2]).not.toBe(apply.mock.calls[0]![2])
  })

  it('regenerates the key when the cash session changes (another body)', async () => {
    const api = await ready()
    apply.mockRejectedValueOnce(networkError())
    await api.confirm()
    cashSessionId.value = 'sess-2'
    apply.mockResolvedValueOnce(makeResult())
    await api.confirm()
    expect(apply.mock.calls[1]![2]).not.toBe(apply.mock.calls[0]![2])
  })

  it('409 COLLECTION_DEBT_CHANGED: says so, shows body.preview and needs a new confirm with a new key', async () => {
    const api = await ready()
    const fresh = makePreview({ debtCents: 110000, appliedCents: 30000 })
    apply.mockRejectedValueOnce(
      httpError(409, { error: 'COLLECTION_DEBT_CHANGED', preview: fresh }),
    )
    const result = await api.confirm()
    expect(result).toBeNull()
    expect(apply).toHaveBeenCalledTimes(1)
    expect(api.notice.value).toBe(
      'La deuda del cliente cambió. Revisa los montos y confirma de nuevo.',
    )
    expect(api.preview.value?.debtCents).toBe(110000)
    expect(api.canConfirm.value).toBe(true)

    apply.mockResolvedValueOnce(makeResult())
    await api.confirm()
    expect(apply.mock.calls[1]![1]).toMatchObject({ expectedDebtCents: 110000 })
    expect(apply.mock.calls[1]![2]).not.toBe(apply.mock.calls[0]![2])
  })

  it('IN_FLIGHT: waits briefly and retries once with the same key and body', async () => {
    const api = await ready()
    apply.mockRejectedValueOnce(httpError(409, { error: 'IDEMPOTENCY_KEY_IN_FLIGHT' }))
    apply.mockResolvedValueOnce(makeResult())
    const pending = api.confirm()
    await flushPromises()
    expect(apply).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1500)
    const result = await pending
    expect(apply).toHaveBeenCalledTimes(2)
    expect(apply.mock.calls[1]).toEqual(apply.mock.calls[0])
    expect(result?.collectionId).toBe('col-1')
  })

  it('IN_FLIGHT twice: stops, shows the message and keeps the key for a later retry', async () => {
    const api = await ready()
    apply.mockRejectedValue(httpError(409, { error: 'IDEMPOTENCY_KEY_IN_FLIGHT' }))
    const pending = api.confirm()
    await vi.advanceTimersByTimeAsync(1500)
    expect(await pending).toBeNull()
    expect(apply).toHaveBeenCalledTimes(2)
    expect(api.applyError.value?.code).toBe('IDEMPOTENCY_KEY_IN_FLIGHT')
    apply.mockReset()
    apply.mockResolvedValueOnce(makeResult())
    await api.confirm()
    expect(apply.mock.calls[0]![2]).toBe('key-1')
  })

  it('another 422 on apply shows its message and refreshes the preview', async () => {
    const api = await ready()
    preview.mockResolvedValueOnce(makePreview({ debtCents: 90000 }))
    apply.mockRejectedValueOnce(httpError(422, { error: 'COLLECTION_EXCEEDS_DEBT' }))
    await api.confirm()
    await flushPromises()
    expect(api.applyError.value?.message).toContain('El pago supera la deuda')
    expect(preview).toHaveBeenLastCalledWith('c-1', { payments: CASH })
    expect(api.preview.value?.debtCents).toBe(90000)
  })

  it('a 4xx frees the key: the next confirm uses a new one', async () => {
    const api = await ready()
    preview.mockResolvedValue(makePreview({ tenderedCents: 30000, appliedCents: 30000 }))
    apply.mockRejectedValueOnce(
      httpError(422, { error: 'CASH_SESSION_NOT_OWNED', message: 'English' }),
    )
    await api.confirm()
    await flushPromises()
    expect(api.applyError.value?.message).not.toContain('English')
    apply.mockResolvedValueOnce(makeResult())
    await api.confirm()
    expect(apply.mock.calls[1]![2]).not.toBe(apply.mock.calls[0]![2])
  })

  it('success keeps the result and refreshes the customer history, monthly, sales lists and each sale', async () => {
    const api = await ready()
    apply.mockResolvedValue(makeResult())
    const result = await api.confirm()
    expect(result?.collectionId).toBe('col-1')
    expect(api.result.value?.collectionId).toBe('col-1')
    const keys = vi
      .mocked(queryClient.invalidateQueries)
      .mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toEqual(
      expect.arrayContaining([
        ['sales', 'tenant-1', 'customer-history', 'c-1'],
        ['sales', 'tenant-1', 'customer-monthly', 'c-1'],
        ['sales', 'tenant-1', 'confirmed'],
        ['sales', 'tenant-1', 'detail', 's-a'],
        ['sales', 'tenant-1', 'detail', 's-b'],
      ]),
    )
  })

  it('a double confirm sends one request', async () => {
    const api = await ready()
    const slow = deferred<CollectionResult>()
    apply.mockReturnValueOnce(slow.promise)
    void api.confirm()
    void api.confirm()
    slow.resolve(makeResult())
    await flushPromises()
    expect(apply).toHaveBeenCalledTimes(1)
  })
})
