// odd T3b / S4-S5 — «Ver venta» by the linked sale's live status (handoff 23 §3):
//   DRAFT              → the POS draft, only if it is one of the caller's drafts (GET /sales/drafts
//                        lists only the caller's; the draft belongs to whoever converted);
//                        otherwise «La venta está en curso en el punto de venta de quien la convirtió.»
//   CONFIRMED/CANCELED → sale detail;
//   null               → no link.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '@/features/POS/sales/constants/sale.constants'

const fetchQuery = vi.fn()
const routerPush = vi.fn().mockResolvedValue(undefined)
const getById = vi.fn()
const listDrafts = vi.fn()

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQueryClient: () => ({ fetchQuery }) }
})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: routerPush }) }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

vi.mock('../../api/quotation.api', () => ({
  quotationApi: { getById: (...args: unknown[]) => getById(...args) },
}))

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  saleApi: { listDrafts: (...args: unknown[]) => listDrafts(...args) },
}))

import {
  SALE_IN_PROGRESS_ELSEWHERE,
  hasSaleLink,
  useOpenQuotationSale,
} from '../useOpenQuotationSale'

beforeEach(() => {
  fetchQuery.mockReset().mockImplementation((options: { queryFn: () => unknown }) => options.queryFn())
  routerPush.mockReset().mockResolvedValue(undefined)
  getById.mockReset()
  listDrafts.mockReset()
  localStorage.clear()
})

describe('hasSaleLink', () => {
  it('links only when there is a sale id and a live status (null → no link)', () => {
    expect(hasSaleLink({ saleId: 's-1', saleStatus: 'DRAFT' })).toBe(true)
    expect(hasSaleLink({ saleId: 's-1', saleStatus: 'CONFIRMED' })).toBe(true)
    expect(hasSaleLink({ saleId: 's-1', saleStatus: 'CANCELED' })).toBe(true)
    expect(hasSaleLink({ saleId: 's-1', saleStatus: null })).toBe(false)
    expect(hasSaleLink({ saleId: null, saleStatus: null })).toBe(false)
    // Older payload without saleStatus: keep the link, the status is resolved on click.
    expect(hasSaleLink({ saleId: 's-1' })).toBe(true)
  })
})

describe('useOpenQuotationSale', () => {
  it('CONFIRMED → sale detail, without reading the drafts', async () => {
    const { open, notice } = useOpenQuotationSale()

    expect(await open({ saleId: 's-1', saleStatus: 'CONFIRMED' })).toBe(true)

    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/s-1')
    expect(listDrafts).not.toHaveBeenCalled()
    expect(notice.value).toBeNull()
  })

  it('CANCELED → sale detail', async () => {
    const { open } = useOpenQuotationSale()
    await open({ saleId: 's-1', saleStatus: 'CANCELED' })
    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/s-1')
  })

  it('DRAFT among my drafts → selects it as the POS active tab and opens the POS', async () => {
    listDrafts.mockResolvedValue([{ id: 's-other' }, { id: 's-1' }])
    const { open, notice } = useOpenQuotationSale()

    expect(await open({ saleId: 's-1', saleStatus: 'DRAFT' })).toBe(true)

    expect(fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: saleQueryKeys.drafts('tenant-1'), staleTime: 0 }),
    )
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBe('s-1')
    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/nueva')
    expect(notice.value).toBeNull()
  })

  it('DRAFT of another cashier → stays put with the in-progress notice', async () => {
    localStorage.setItem(POS_ACTIVE_TAB_STORAGE_KEY, 's-mine')
    listDrafts.mockResolvedValue([{ id: 's-mine' }])
    const { open, notice } = useOpenQuotationSale()

    expect(await open({ saleId: 's-1', saleStatus: 'DRAFT' })).toBe(false)

    expect(routerPush).not.toHaveBeenCalled()
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBe('s-mine')
    expect(notice.value).toBe('La venta está en curso en el punto de venta de quien la convirtió.')
    expect(SALE_IN_PROGRESS_ELSEWHERE).toBe(notice.value)
  })

  it('DRAFT but the drafts cannot be read → a retry notice, no navigation', async () => {
    listDrafts.mockRejectedValue(new Error('offline'))
    const { open, notice } = useOpenQuotationSale()

    expect(await open({ saleId: 's-1', saleStatus: 'DRAFT' })).toBe(false)

    expect(routerPush).not.toHaveBeenCalled()
    expect(notice.value).toBe('No pudimos abrir la venta. Inténtalo de nuevo.')
  })

  it('null → no navigation at all', async () => {
    const { open } = useOpenQuotationSale()
    expect(await open({ saleId: 's-1', saleStatus: null })).toBe(false)
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('unknown status (QUOTATION_ALREADY_CONVERTED) → reads the quotation for its live saleStatus', async () => {
    getById.mockResolvedValue({ id: 'q-1', saleId: 's-1', saleStatus: 'CONFIRMED' })
    const { open } = useOpenQuotationSale()

    await open({ saleId: 's-1', quotationId: 'q-1' })

    expect(getById).toHaveBeenCalledWith('q-1')
    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/s-1')
  })

  it('unknown status resolving to DRAFT of another cashier → the in-progress notice', async () => {
    getById.mockResolvedValue({ id: 'q-1', saleId: 's-1', saleStatus: 'DRAFT' })
    listDrafts.mockResolvedValue([])
    const { open, notice } = useOpenQuotationSale()

    expect(await open({ saleId: 's-1', quotationId: 'q-1' })).toBe(false)

    expect(notice.value).toBe(SALE_IN_PROGRESS_ELSEWHERE)
  })

  it('unknown status and no readable quotation → my draft opens in the POS, else the sale detail', async () => {
    getById.mockRejectedValue(new Error('500'))
    listDrafts.mockResolvedValue([{ id: 's-1' }])
    const { open } = useOpenQuotationSale()
    await open({ saleId: 's-1', quotationId: 'q-1' })
    expect(routerPush).toHaveBeenLastCalledWith('/pos/ventas/nueva')

    listDrafts.mockResolvedValue([])
    await open({ saleId: 's-2' })
    expect(routerPush).toHaveBeenLastCalledWith('/pos/ventas/s-2')
  })

  it('clears the previous notice on a new attempt', async () => {
    listDrafts.mockResolvedValue([])
    const { open, notice } = useOpenQuotationSale()
    await open({ saleId: 's-1', saleStatus: 'DRAFT' })
    expect(notice.value).not.toBeNull()

    await open({ saleId: 's-1', saleStatus: 'CONFIRMED' })
    expect(notice.value).toBeNull()
  })
})
