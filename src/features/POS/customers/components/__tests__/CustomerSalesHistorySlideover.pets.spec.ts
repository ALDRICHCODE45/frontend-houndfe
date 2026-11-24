/// <reference types="vite/client" />
/**
 * Customer pets T4 (handoff 27 §7): the customer history filtered by pet. The KPI cards stay
 * customer-wide, `404 PET_NOT_FOUND` resets the filter to «Todas» and reloads the pets.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { Customer } from '../../interfaces/customer.types'
import type { Pet } from '../../pets/pet.types'
import { makePet } from '../../pets/__tests__/pet.fixture'
import type {
  ConfirmedSaleRow,
  ConfirmedSalesListResponse,
} from '@/features/POS/sales/interfaces/sale.types'
import CustomerSalesHistorySlideover from '../CustomerSalesHistorySlideover.vue'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}))

const history = {
  response: shallowRef<ConfirmedSalesListResponse>(),
  isLoading: shallowRef(false),
  isFetching: shallowRef(false),
  isPageTransition: shallowRef(false),
  isError: shallowRef(false),
  error: shallowRef<unknown>(null),
  refetch: vi.fn(),
}
let options: { page: { value: number }; petId?: unknown } | undefined

vi.mock('@/features/POS/sales/composables/useCustomerSalesHistory', () => ({
  useCustomerSalesHistory: (opts: typeof options) => {
    options = opts
    return history
  },
}))

const pets = shallowRef<Pet[] | undefined>([])
const petsRefetch = vi.fn()
const petsArgs: unknown[][] = []
vi.mock('../../pets/usePets', () => ({
  usePetsList: (...args: unknown[]) => {
    petsArgs.push(args)
    return { data: pets, refetch: petsRefetch, isLoading: shallowRef(false) }
  },
}))

function selectedPetId(): string | null | undefined {
  const value = options?.petId
  if (typeof value === 'function') return (value as () => string | null | undefined)()
  return (value as { value: string | null | undefined } | undefined)?.value
}

function customer(id = 'customer-1'): Customer {
  return {
    id,
    firstName: 'Ana',
    lastName: 'Pérez',
    fullName: 'Ana Pérez',
    phoneCountryCode: null,
    phone: null,
    email: null,
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function sale(id: string): ConfirmedSaleRow {
  return {
    id,
    folio: `A-${id}`,
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    deliveryStatus: 'DELIVERED',
    totalCents: 15_000,
    debtCents: 0,
    confirmedAt: '2026-08-30T14:00:00.000Z',
    dueDate: null,
    customer: null,
    cashier: { id: 'c', name: 'Caja' },
    seller: null,
    paymentMethods: [],
  }
}

/** Customer-wide KPIs (23 sales) — a pet only narrows data, pagination and filterSummary. */
function response(overrides: Partial<ConfirmedSalesListResponse> = {}): ConfirmedSalesListResponse {
  return {
    data: [sale('1'), sale('2')],
    pagination: { page: 1, limit: 10, total: 23, totalPages: 3 },
    counts: { all: 23, pendingPayments: 0, notDelivered: 0 },
    summary: { salesCount: 23, totalSoldCents: 999_000, outstandingDebtCents: 0 },
    ...overrides,
  }
}

const stubs = {
  EntityAvatar: { template: '<span />' },
  AppResponsiveDrawer: {
    props: ['open'],
    template:
      '<section v-if="open" role="dialog"><slot name="body" /><slot name="footer" /></section>',
  },
}

let wrapper: VueWrapper | undefined
function mountSlideover() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerSalesHistorySlideover, {
    props: { open: true, customer: customer() },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }]], components: stubs },
  })
  return wrapper
}

const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const chips = () => [
  ...document.body.querySelectorAll<HTMLButtonElement>('[data-testid="history-pet-chip"]'),
]
const chip = (label: string) => {
  const found = chips().find((button) => button.textContent?.includes(label))
  if (!found) throw new Error(`chip ${label} not found`)
  return found
}

describe('CustomerSalesHistorySlideover — pet filter', () => {
  beforeEach(() => {
    history.response.value = response()
    history.isError.value = false
    history.error.value = null
    history.refetch.mockClear()
    petsRefetch.mockClear()
    petsArgs.length = 0
    pets.value = [
      makePet({ id: 'p1', name: 'Bruno' }),
      makePet({
        id: 'p2',
        name: 'Luna',
        status: 'ARCHIVED',
        archivedAt: '2026-10-01T00:00:00.000Z',
      }),
    ]
    options = undefined
    document.body.innerHTML = ''
  })
  afterEach(() => {
    wrapper?.vm.$root?.$?.appContext.app.unmount()
    wrapper = undefined
    document.body.innerHTML = ''
  })

  it('loads ACTIVE and ARCHIVED pets of the customer', async () => {
    mountSlideover()
    await flushPromises()
    const [customerId, status] = petsArgs[0] as [() => string, unknown]
    expect(
      typeof customerId === 'function' ? customerId() : (customerId as { value: string }).value,
    ).toBe('customer-1')
    expect(status).toBe('ALL')
  })

  it('hides the filter when the customer has no pets', async () => {
    pets.value = []
    mountSlideover()
    await flushPromises()
    expect(q('[data-testid="history-pet-filter"]')).toBeNull()
  })

  it('offers «Todas» plus every pet, archived ones labeled, «Todas» selected by default', async () => {
    mountSlideover()
    await flushPromises()
    expect(chips().map((button) => button.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Todas',
      'Bruno',
      'Luna (archivada)',
    ])
    expect(chip('Todas').getAttribute('aria-pressed')).toBe('true')
    expect(selectedPetId() ?? null).toBeNull()
  })

  it('selecting a pet (archived too) sends its id and goes back to page 1', async () => {
    mountSlideover()
    await flushPromises()
    options!.page.value = 3

    chip('Luna').click()
    await nextTick()
    expect(selectedPetId()).toBe('p2')
    expect(options!.page.value).toBe(1)
    expect(chip('Luna').getAttribute('aria-pressed')).toBe('true')

    chip('Todas').click()
    await nextTick()
    expect(selectedPetId() ?? null).toBeNull()
  })

  it('keeps the KPI cards customer-wide when a pet is selected', async () => {
    mountSlideover()
    await flushPromises()
    chip('Bruno').click()
    await nextTick()
    history.response.value = response({
      data: [sale('1')],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      filterSummary: { count: 1, totalCents: 15_000, debtCents: 0 },
    })
    await flushPromises()

    const metrics = q('dl')!.textContent!
    expect(metrics).toContain('23')
    expect(metrics).toContain('9,990.00')
    expect(metrics).not.toContain('150.00')
    expect(q('[data-testid="history-pagination"]')!.textContent).toContain('1 venta')
  })

  it('shows the empty state for a pet with no sales', async () => {
    mountSlideover()
    await flushPromises()
    chip('Bruno').click()
    await nextTick()
    history.response.value = response({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })
    await flushPromises()

    const empty = q('.hf-empty-state[data-kind="empty"]')!
    expect(empty.textContent).toContain('Bruno aún no tiene ventas')
    expect(q('dl')!.textContent).toContain('23')
  })

  it('on 404 PET_NOT_FOUND shows a message, resets to «Todas» and reloads the pets', async () => {
    mountSlideover()
    await flushPromises()
    chip('Bruno').click()
    await nextTick()

    history.isError.value = true
    history.error.value = {
      response: {
        status: 404,
        data: { statusCode: 404, error: 'PET_NOT_FOUND', message: 'PET_NOT_FOUND' },
      },
    }
    await flushPromises()

    expect(selectedPetId() ?? null).toBeNull()
    expect(petsRefetch).toHaveBeenCalledOnce()
    expect(q('[data-testid="history-pet-notice"]')!.textContent).toContain(
      'Esa mascota ya no existe',
    )
    expect(q('.hf-empty-state[data-kind="error"]')).toBeNull()
  })

  it('resets the pet filter when the customer changes', async () => {
    const mounted = mountSlideover()
    await flushPromises()
    chip('Bruno').click()
    await nextTick()
    expect(selectedPetId()).toBe('p1')

    mounted.vm.$.props.customer = customer('customer-2')
    await nextTick()
    expect(selectedPetId() ?? null).toBeNull()
  })
})
