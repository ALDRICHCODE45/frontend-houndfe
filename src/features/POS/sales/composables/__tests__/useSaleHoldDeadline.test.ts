// BE handoff 24 §2: change the pay-in-store deadline. Success refreshes the sale detail and every
// confirmed-list slot; a conflict (or a hold that ended) refreshes them too, so the user sees the
// current deadline before retrying. The caller gets the decoded code to place the message.

import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { AxiosError, AxiosHeaders } from 'axios'
import { computed, defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { useSaleHoldDeadline } from '../useSaleHoldDeadline'
import type { SaleDetail } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({ saleApi: { updateHold: vi.fn() } }))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => computed(() => 'tenant-1'),
}))

const toastAddMock = vi.fn()
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: toastAddMock }) }))

function axiosError(status: number, error?: string) {
  const headers = new AxiosHeaders()
  return new AxiosError('fail', 'ERR', { headers }, null, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: error ? { statusCode: status, error, message: 'server text' } : {},
  })
}

function mountComposable() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let result: ReturnType<typeof useSaleHoldDeadline> | undefined
  mount(
    defineComponent({
      setup() {
        result = useSaleHoldDeadline(() => 'sale-1')
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { composable: result!, invalidateQueries }
}

const keys = (spy: MockInstance) =>
  spy.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey)

const payload = { expiresAt: '2026-11-20T23:00:00-06:00', expectedVersion: 1 }

describe('useSaleHoldDeadline', () => {
  beforeEach(() => {
    vi.mocked(saleApi.updateHold).mockReset()
    toastAddMock.mockReset()
  })

  it('sends the deadline with the shown version and refreshes the detail and the list', async () => {
    vi.mocked(saleApi.updateHold).mockResolvedValue({ id: 'sale-1' } as SaleDetail)
    const { composable, invalidateQueries } = mountComposable()

    const result = await composable.updateDeadline(payload)

    expect(saleApi.updateHold).toHaveBeenCalledWith('sale-1', payload)
    expect(result).toEqual({ ok: true })
    expect(keys(invalidateQueries)).toEqual(
      expect.arrayContaining([
        ['sales', 'tenant-1', 'detail', 'sale-1'],
        ['sales', 'tenant-1', 'confirmed'],
      ]),
    )
    expect(toastAddMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Fecha límite actualizada', color: 'success' }))
  })

  it('HOLD_VERSION_CONFLICT returns the code and reloads the sale', async () => {
    vi.mocked(saleApi.updateHold).mockRejectedValue(axiosError(409, 'HOLD_VERSION_CONFLICT'))
    const { composable, invalidateQueries } = mountComposable()

    expect(await composable.updateDeadline(payload)).toEqual({ ok: false, code: 'HOLD_VERSION_CONFLICT' })
    expect(keys(invalidateQueries)).toEqual(
      expect.arrayContaining([
        ['sales', 'tenant-1', 'detail', 'sale-1'],
        ['sales', 'tenant-1', 'confirmed'],
      ]),
    )
    expect(toastAddMock).not.toHaveBeenCalled()
  })

  it('HOLD_EXPIRY_NOT_FUTURE returns the code without reloading', async () => {
    vi.mocked(saleApi.updateHold).mockRejectedValue(axiosError(422, 'HOLD_EXPIRY_NOT_FUTURE'))
    const { composable, invalidateQueries } = mountComposable()

    expect(await composable.updateDeadline(payload)).toEqual({ ok: false, code: 'HOLD_EXPIRY_NOT_FUTURE' })
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it('a network failure is NETWORK and reloads nothing', async () => {
    vi.mocked(saleApi.updateHold).mockRejectedValue(axiosError(503))
    const { composable, invalidateQueries } = mountComposable()

    expect(await composable.updateDeadline(payload)).toEqual({ ok: false, code: 'NETWORK' })
    expect(invalidateQueries).not.toHaveBeenCalled()
  })
})
