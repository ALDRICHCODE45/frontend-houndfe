/**
 * owner-ideas-batch T4 (S2, L2): «Nueva venta» from the customer page. `POST /sales/drafts` →
 * `PUT /sales/drafts/:id/customer` → the assigned draft becomes the POS active tab (same handoff as
 * «Convertir en venta»). A failed assignment deletes the empty draft with delete:Sale, otherwise
 * leaves it and says so; nothing navigates on a failure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '../../constants/sale.constants'
import type { Sale } from '../../interfaces/sale.types'

const calls: string[] = []
const queryClientMock = {
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}
const routerPush = vi.fn()
const createDraft = vi.fn()
const assignCustomer = vi.fn()
const closeDraft = vi.fn()
const toastAdd = vi.fn()
const grants = { set: new Set<string>() }

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQueryClient: () => queryClientMock }
})
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: routerPush }) }
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => grants.set.has(`${action}:${subject}`),
  }),
}))
vi.mock('../../api/sale.api', () => ({
  saleApi: {
    createDraft: (...args: unknown[]) => createDraft(...args),
    assignCustomer: (...args: unknown[]) => assignCustomer(...args),
    closeDraft: (...args: unknown[]) => closeDraft(...args),
  },
}))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

import {
  EMPTY_DRAFT_LEFT_MESSAGE,
  useStartSaleForCustomer,
} from '../useStartSaleForCustomer'

const draftsKey = saleQueryKeys.drafts('tenant-1')

function draft(overrides: Partial<Sale> = {}): Sale {
  return { id: 'sale-new', customer: null, items: [] , ...overrides } as unknown as Sale
}

function axiosRejection(status: number, error: string) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    code: 'ERR_BAD_REQUEST',
    response: { status, data: { statusCode: status, error } },
  })
}

beforeEach(() => {
  calls.length = 0
  grants.set = new Set(['read:Sale', 'create:Sale', 'update:Sale'])
  queryClientMock.getQueryData.mockReset()
  queryClientMock.setQueryData.mockReset()
  queryClientMock.invalidateQueries.mockReset().mockResolvedValue(undefined)
  routerPush.mockReset().mockImplementation(async () => {
    calls.push('push')
  })
  createDraft.mockReset().mockImplementation(async () => {
    calls.push('create')
    return draft()
  })
  assignCustomer.mockReset().mockImplementation(async (saleId: string, payload: { customerId: string }) => {
    calls.push(`assign:${saleId}:${payload.customerId}`)
    return { ...draft({ id: saleId, customer: { id: payload.customerId } as Sale['customer'] }), petsCleared: false }
  })
  closeDraft.mockReset().mockImplementation(async (saleId: string) => {
    calls.push(`delete:${saleId}`)
  })
  toastAdd.mockReset()
  localStorage.clear()
})

describe('useStartSaleForCustomer — happy path', () => {
  it('creates a draft, assigns the customer, seeds the POS drafts, writes the active tab and opens the POS', async () => {
    queryClientMock.getQueryData.mockReturnValue([draft({ id: 'sale-old' })])
    const { start } = useStartSaleForCustomer()

    await expect(start('c-1')).resolves.toBe(true)

    expect(calls).toEqual(['create', 'assign:sale-new:c-1', 'push'])
    expect(assignCustomer).toHaveBeenCalledWith('sale-new', { customerId: 'c-1' })
    const [key, seeded] = queryClientMock.setQueryData.mock.calls[0]!
    expect(key).toEqual(draftsKey)
    expect((seeded as Sale[]).map((sale) => sale.id)).toEqual(['sale-old', 'sale-new'])
    expect((seeded as Sale[])[1]!.customer?.id).toBe('c-1')
    expect((seeded as Array<Record<string, unknown>>)[1]).not.toHaveProperty('petsCleared')
    const invalidated = queryClientMock.invalidateQueries.mock.calls.map(([arg]) => arg.queryKey)
    expect(invalidated).toContainEqual(draftsKey)
    expect(invalidated).toContainEqual(saleQueryKeys.applicablePromotions('tenant-1', 'sale-new'))
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBe('sale-new')
    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/nueva')
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('replaces the draft when the cache already has it', async () => {
    queryClientMock.getQueryData.mockReturnValue([draft({ id: 'sale-new' })])
    const { start } = useStartSaleForCustomer()
    await start('c-1')
    const [, seeded] = queryClientMock.setQueryData.mock.calls[0]!
    expect((seeded as Sale[]).map((sale) => sale.customer?.id)).toEqual(['c-1'])
  })

  it('a second press while pending is ignored: one draft', async () => {
    let release!: () => void
    createDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(draft())
        }),
    )
    const { start, isPending } = useStartSaleForCustomer()

    const first = start('c-1')
    expect(isPending.value).toBe(true)
    await expect(start('c-1')).resolves.toBe(false)
    release()
    await first

    expect(createDraft).toHaveBeenCalledTimes(1)
    expect(assignCustomer).toHaveBeenCalledTimes(1)
    expect(routerPush).toHaveBeenCalledTimes(1)
    expect(isPending.value).toBe(false)
  })
})

describe('useStartSaleForCustomer — failures', () => {
  it('assignment fails with delete:Sale → the empty draft is deleted, a toast says why, no navigation', async () => {
    grants.set.add('delete:Sale')
    assignCustomer.mockRejectedValue(axiosRejection(404, 'CUSTOMER_NOT_FOUND'))
    const { start, isPending } = useStartSaleForCustomer()

    await expect(start('c-1')).resolves.toBe(false)

    expect(closeDraft).toHaveBeenCalledWith('sale-new')
    expect(routerPush).not.toHaveBeenCalled()
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBeNull()
    expect(queryClientMock.setQueryData).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    const toast = toastAdd.mock.calls[0]![0]
    expect(toast.color).toBe('error')
    expect(toast.description).toBe('No se encontró el cliente. Recarga la lista.')
    expect(toast.description).not.toContain(EMPTY_DRAFT_LEFT_MESSAGE)
    expect(isPending.value).toBe(false)
  })

  it('assignment fails without delete:Sale → the draft is kept and the toast says it was left in the POS', async () => {
    assignCustomer.mockRejectedValue(axiosRejection(403, 'SALE_UPDATE_FORBIDDEN'))
    const { start } = useStartSaleForCustomer()

    await expect(start('c-1')).resolves.toBe(false)

    expect(closeDraft).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
    const toast = toastAdd.mock.calls[0]![0]
    expect(toast.description).toContain('No tienes permisos para modificar esta venta.')
    expect(toast.description).toContain(
      'Se creó una venta vacía en el punto de venta; puedes cerrarla.',
    )
    // The POS tabs must show the empty draft.
    expect(queryClientMock.invalidateQueries.mock.calls.map(([arg]) => arg.queryKey)).toContainEqual(
      draftsKey,
    )
  })

  it('a failed delete of the empty draft also says it was left in the POS', async () => {
    grants.set.add('delete:Sale')
    assignCustomer.mockRejectedValue(axiosRejection(409, 'SALE_NOT_DRAFT'))
    closeDraft.mockRejectedValue(new Error('offline'))
    const { start } = useStartSaleForCustomer()

    await start('c-1')

    const toast = toastAdd.mock.calls[0]![0]
    expect(toast.description).toContain('Esta venta ya no es un borrador. Recarga la página.')
    expect(toast.description).toContain(EMPTY_DRAFT_LEFT_MESSAGE)
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('create fails → a toast, no assignment, no navigation, and a new press works', async () => {
    createDraft.mockRejectedValueOnce(axiosRejection(403, 'FORBIDDEN'))
    const { start, isPending } = useStartSaleForCustomer()

    await expect(start('c-1')).resolves.toBe(false)

    expect(assignCustomer).not.toHaveBeenCalled()
    expect(closeDraft).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
    expect(toastAdd).toHaveBeenCalledTimes(1)
    expect(toastAdd.mock.calls[0]![0].color).toBe('error')
    expect(isPending.value).toBe(false)

    await expect(start('c-1')).resolves.toBe(true)
    expect(createDraft).toHaveBeenCalledTimes(2)
  })
})
