// hold-expire-now L5 / BE handoff 24 §6: «Vencer apartado ahora» (POST /sales/:id/hold/expire).
// One Idempotency-Key per attempt, reused only to retry an uncertain attempt; toasts by outcome;
// a sale that changed under the user (HOLD_VERSION_CONFLICT…) is reloaded.

import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSaleHoldExpire } from '../useSaleHoldExpire'
import type { SaleDetail } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({ saleApi: { expireHold: vi.fn() } }))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => computed(() => 'tenant-1'),
}))

const toastAddMock = vi.fn()
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: toastAddMock }) }))

let keySeq = 0
vi.mock('../../utils/idempotency.utils', () => ({ newIdempotencyKey: () => `key-${++keySeq}` }))

const sale = { id: 'sale-1' } as SaleDetail

function httpError(status: number | null, data?: unknown): AxiosError {
  const error = new AxiosError('fail', status === null ? 'ERR_NETWORK' : 'ERR_BAD_RESPONSE')
  if (status !== null) {
    error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  }
  return error
}

function mountComposable() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useSaleHoldExpire> | undefined
  mount(
    defineComponent({
      setup() {
        result = useSaleHoldExpire(() => 'sale-1')
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { composable: result!, invalidateQueries }
}

function invalidatedKeys(spy: MockInstance): unknown[][] {
  return spy.mock.calls.map((call) => ((call[0] as { queryKey: unknown[] }).queryKey ?? []) as unknown[])
}

function keysSent(): string[] {
  return vi.mocked(saleApi.expireHold).mock.calls.map((call) => call[2])
}

describe('useSaleHoldExpire', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keySeq = 0
  })

  it('sends expectedVersion with one Idempotency-Key and refreshes the detail and lists', async () => {
    vi.mocked(saleApi.expireHold).mockResolvedValue({ sale, outcome: 'CANCELLED' })
    const { composable, invalidateQueries } = mountComposable()

    await expect(composable.expireHold(3)).resolves.toEqual({ ok: true, outcome: 'CANCELLED' })

    expect(saleApi.expireHold).toHaveBeenCalledWith('sale-1', { expectedVersion: 3 }, 'key-1')
    const keys = invalidatedKeys(invalidateQueries).map((key) => key.join('|'))
    expect(keys).toEqual(expect.arrayContaining(['sales|tenant-1|detail|sale-1']))
    expect(keys.some((key) => key.startsWith('sales|tenant-1|confirmed'))).toBe(true)
  })

  it.each([
    ['CANCELLED', 'Apartado vencido: la venta se canceló.'],
    ['REVIEW', 'Apartado vencido: la venta quedó para revisar.'],
    ['SETTLED', 'La venta ya estaba pagada; el apartado se cerró.'],
  ] as const)('toasts the %s outcome', async (outcome, title) => {
    vi.mocked(saleApi.expireHold).mockResolvedValue({ sale, outcome })
    const { composable } = mountComposable()
    await composable.expireHold(1)
    expect(toastAddMock).toHaveBeenCalledWith({ title, color: 'success' })
  })

  it('reuses the key to retry an uncertain attempt and takes a new one after success', async () => {
    vi.mocked(saleApi.expireHold)
      .mockRejectedValueOnce(httpError(null))
      .mockResolvedValueOnce({ sale, outcome: 'CANCELLED' })
      .mockResolvedValueOnce({ sale, outcome: 'CANCELLED' })
    const { composable } = mountComposable()

    await expect(composable.expireHold(1)).resolves.toEqual({ ok: false, code: 'NETWORK' })
    await composable.expireHold(1)
    await composable.expireHold(1)

    expect(keysSent()).toEqual(['key-1', 'key-1', 'key-2'])
    expect(toastAddMock).toHaveBeenNthCalledWith(1, {
      title: 'No pudimos vencer el apartado. Revisa tu conexión e intenta de nuevo.',
      color: 'error',
    })
  })

  it('a new attempt (resetAttempt, e.g. the dialog reopened) takes a new key', async () => {
    vi.mocked(saleApi.expireHold).mockRejectedValue(httpError(503, {}))
    const { composable } = mountComposable()
    await composable.expireHold(1)
    composable.resetAttempt()
    await composable.expireHold(1)
    expect(keysSent()).toEqual(['key-1', 'key-2'])
  })

  it('HOLD_VERSION_CONFLICT reloads the sale, says so and drops the key', async () => {
    vi.mocked(saleApi.expireHold)
      .mockRejectedValueOnce(httpError(409, { error: 'HOLD_VERSION_CONFLICT' }))
      .mockResolvedValueOnce({ sale, outcome: 'CANCELLED' })
    const { composable, invalidateQueries } = mountComposable()

    await expect(composable.expireHold(1)).resolves.toEqual({ ok: false, code: 'HOLD_VERSION_CONFLICT' })

    expect(invalidatedKeys(invalidateQueries).map((key) => key.join('|'))).toContain('sales|tenant-1|detail|sale-1')
    expect(toastAddMock).toHaveBeenCalledWith({
      title: 'Alguien cambió el plazo del apartado. Actualizamos la venta; revisa y vuelve a intentar.',
      color: 'error',
    })
    await composable.expireHold(2)
    expect(keysSent()).toEqual(['key-1', 'key-2'])
  })

  it.each([
    ['HOLD_ALREADY_CLOSED', 409, true],
    ['IDEMPOTENCY_KEY_CONFLICT', 409, false],
  ] as const)('%s shows its message (reload: %s)', async (code, status, reload) => {
    vi.mocked(saleApi.expireHold).mockRejectedValue(httpError(status, { error: code }))
    const { composable, invalidateQueries } = mountComposable()
    await expect(composable.expireHold(1)).resolves.toEqual({ ok: false, code })
    expect(invalidateQueries).toHaveBeenCalledTimes(reload ? 2 : 0)
    expect(toastAddMock.mock.calls[0]![0].color).toBe('error')
  })

  it('ignores a second press while the first is pending', async () => {
    let resolve!: (value: { sale: SaleDetail; outcome: 'CANCELLED' }) => void
    vi.mocked(saleApi.expireHold).mockReturnValue(new Promise((r) => (resolve = r)))
    const { composable } = mountComposable()

    const first = composable.expireHold(1)
    await Promise.resolve()
    expect(composable.isPending.value).toBe(true)
    await expect(composable.expireHold(1)).resolves.toEqual({ ok: false, code: 'PENDING' })
    resolve({ sale, outcome: 'CANCELLED' })
    await first
    expect(saleApi.expireHold).toHaveBeenCalledTimes(1)
  })
})
