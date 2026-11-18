// odd D6 (quotation-sale-conversion L15): after «Convertir en venta» the POS showed the PREVIOUS
// draft. The new draft must already be in the POS drafts cache (`saleQueryKeys.drafts`) when the
// router navigates, so `SalesView` finds the `pos:active-tab` id it is asked to open.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '@/features/POS/sales/constants/sale.constants'
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'

let queryClient: QueryClient
const routerPush = vi.fn()
const convertToSale = vi.fn()

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

vi.mock('../../api/quotation.api', () => ({
  quotationApi: { convertToSale: (...args: unknown[]) => convertToSale(...args) },
}))

import { useConvertQuotationToSale } from '../useConvertQuotationToSale'

const draftsKey = saleQueryKeys.drafts('tenant-1')

function sale(id: string, totalCents = 0): Sale {
  return {
    id,
    userId: 'user-1',
    status: 'DRAFT',
    items: [],
    totalCents,
    createdAt: 'x',
    updatedAt: 'x',
  } as Sale
}

/** What the POS would read from the drafts cache at the moment the router navigates. */
let draftsAtNavigation: Sale[] | undefined

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  routerPush.mockReset().mockImplementation(async () => {
    draftsAtNavigation = queryClient.getQueryData<Sale[]>(draftsKey)
  })
  convertToSale.mockReset()
  localStorage.clear()
  draftsAtNavigation = undefined
})

describe('useConvertQuotationToSale — POS drafts cache before navigating (odd D6)', () => {
  it('appends the new draft to a stale cached list before opening the POS', async () => {
    queryClient.setQueryData(draftsKey, [sale('old-1'), sale('old-2')])
    convertToSale.mockResolvedValue({
      quotation: { id: 'q-1', status: 'CONVERTED_TO_SALE', saleId: 'sale-9' },
      sale: sale('sale-9', 62010),
    })

    await useConvertQuotationToSale().convert('q-1')

    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/nueva')
    expect(draftsAtNavigation?.map((d) => d.id)).toEqual(['old-1', 'old-2', 'sale-9'])
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBe('sale-9')
  })

  it('replaces the draft when the cached list already has it (no duplicate tab)', async () => {
    queryClient.setQueryData(draftsKey, [sale('old-1'), sale('sale-9', 1)])
    convertToSale.mockResolvedValue({
      quotation: { id: 'q-1', status: 'CONVERTED_TO_SALE', saleId: 'sale-9' },
      sale: sale('sale-9', 62010),
    })

    await useConvertQuotationToSale().convert('q-1')

    expect(draftsAtNavigation?.map((d) => d.id)).toEqual(['old-1', 'sale-9'])
    expect(draftsAtNavigation?.[1]?.totalCents).toBe(62010)
  })

  it('seeds the list with the new draft when the POS was never opened', async () => {
    convertToSale.mockResolvedValue({
      quotation: { id: 'q-1', status: 'CONVERTED_TO_SALE', saleId: 'sale-9' },
      sale: sale('sale-9'),
    })

    await useConvertQuotationToSale().convert('q-1')

    expect(draftsAtNavigation?.map((d) => d.id)).toEqual(['sale-9'])
  })

  it('still marks the drafts stale so the POS rereads the full list', async () => {
    queryClient.setQueryData(draftsKey, [sale('old-1')])
    convertToSale.mockResolvedValue({
      quotation: { id: 'q-1', status: 'CONVERTED_TO_SALE', saleId: 'sale-9' },
      sale: sale('sale-9'),
    })

    await useConvertQuotationToSale().convert('q-1')

    expect(queryClient.getQueryState(draftsKey)?.isInvalidated).toBe(true)
  })
})
