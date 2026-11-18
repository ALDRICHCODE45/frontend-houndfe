// odd D6 (quotation-sale-conversion L15): «Ver venta» for a DRAFT must leave the POS drafts cache
// holding the fresh list (the one that confirmed the draft is mine) when it navigates, even if the
// cache held an older list (staleTime Infinity in `useSalesDrafts`).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '@/features/POS/sales/constants/sale.constants'
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'

let queryClient: QueryClient
const routerPush = vi.fn()
const listDrafts = vi.fn()

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQueryClient: () => queryClient }
})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: routerPush }) }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

vi.mock('../../api/quotation.api', () => ({ quotationApi: { getById: vi.fn() } }))

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  saleApi: { listDrafts: (...args: unknown[]) => listDrafts(...args) },
}))

import { useOpenQuotationSale } from '../useOpenQuotationSale'

const draftsKey = saleQueryKeys.drafts('tenant-1')
const sale = (id: string) => ({ id, userId: 'u', status: 'DRAFT', items: [] }) as unknown as Sale
let draftsAtNavigation: Sale[] | undefined

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  routerPush.mockReset().mockImplementation(async () => {
    draftsAtNavigation = queryClient.getQueryData<Sale[]>(draftsKey)
  })
  listDrafts.mockReset()
  localStorage.clear()
  draftsAtNavigation = undefined
})

describe('useOpenQuotationSale — POS drafts cache before navigating (odd D6)', () => {
  it('a stale cached list is replaced by the fresh one that holds the draft', async () => {
    queryClient.setQueryData(draftsKey, [sale('old-1')])
    listDrafts.mockResolvedValue([sale('old-1'), sale('s-1')])

    expect(await useOpenQuotationSale().open({ saleId: 's-1', saleStatus: 'DRAFT' })).toBe(true)

    expect(listDrafts).toHaveBeenCalledTimes(1)
    expect(draftsAtNavigation?.map((d) => d.id)).toEqual(['old-1', 's-1'])
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBe('s-1')
  })
})
