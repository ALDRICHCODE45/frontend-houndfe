import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { withQuery } from './withQuery'

vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { listPendingRefunds: vi.fn() } }))

const auth = vi.hoisted(() => ({ canRead: true, tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.canRead && action === 'read' && subject === 'SaleRefund',
  }),
}))

import { saleApi } from '@/features/POS/sales/api/sale.api'
import { usePendingRefundsCount } from '../usePendingRefundsCount'

const listPending = vi.mocked(saleApi.listPendingRefunds)

describe('usePendingRefundsCount (nav badge)', () => {
  beforeEach(() => {
    listPending.mockReset()
    auth.canRead = true
    listPending.mockResolvedValue({ data: [], pagination: { page: 1, limit: 1, total: 4, totalPages: 4 } })
  })

  it('reads pagination.total from the lightest page under the shared pending-refunds key', async () => {
    const { result, client } = withQuery(() => usePendingRefundsCount())
    await flushPromises()

    expect(listPending).toHaveBeenCalledWith({ page: 1, limit: 1 }, expect.anything())
    expect(result.count.value).toBe(4)
    // Under the prefix a settlement invalidates, so the badge refetches with the list.
    expect(client.getQueryData(saleQueryKeys.pendingRefunds('tenant-1', { page: 1, limit: 1 }))).toBeDefined()
  })

  it('does not fire without SaleRefund read and reads 0', async () => {
    auth.canRead = false
    const { result } = withQuery(() => usePendingRefundsCount())
    await flushPromises()

    expect(listPending).not.toHaveBeenCalled()
    expect(result.count.value).toBe(0)
  })
})
