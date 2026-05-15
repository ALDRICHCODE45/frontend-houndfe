import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { reactive } from 'vue'
import AssignCustomerSlideover from '../AssignCustomerSlideover.vue'
import { DraftCustomerAssignmentError } from '../../composables/useDraftCustomerAssignment'
import type { Customer, CustomerAddress, CustomerDetail } from '@/features/POS/customers/interfaces/customer.types'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'

const assignCustomerMock = vi.fn()
const setShippingAddressMock = vi.fn()
const authStoreMock = reactive({
  userCan: vi.fn((_action: string, _subject: string) => true),
})

const customerApiMock = vi.mocked(customerApi)

vi.mock('@/features/POS/customers/api/customer.api', () => ({
  customerApi: {
    getPaginated: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    createAddress: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authStoreMock,
}))

vi.mock('@/features/POS/sales/composables/useDraftCustomerAssignment', () => ({
  DraftCustomerAssignmentError: class DraftCustomerAssignmentError extends Error {
    constructor(public readonly code: string) {
      super(code)
    }
  },
  useDraftCustomerAssignment: () => ({
    assignCustomer: assignCustomerMock,
    setShippingAddress: setShippingAddressMock,
    isPending: { value: false },
    lastError: { value: null },
  }),
}))

const toastAddMock = vi.fn()
vi.stubGlobal('useToast', () => ({
  add: toastAddMock,
}))

function makeAddress(id: string): CustomerAddress {
  return {
    id,
    customerId: 'customer-1',
    street: 'Main St',
    exteriorNumber: '10',
    interiorNumber: null,
    zipCode: '64000',
    neighborhood: 'Centro',
    municipality: 'Monterrey',
    city: 'Monterrey',
    state: 'Nuevo León',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    phoneCountryCode: '+52',
    phone: '5512345678',
    email: 'ada@example.com',
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeCustomerDetail(customer: Customer, addresses: CustomerAddress[]): CustomerDetail {
  return {
    ...customer,
    businessName: null,
    fiscalZipCode: null,
    rfc: null,
    fiscalRegime: null,
    billingStreet: null,
    billingExteriorNumber: null,
    billingInteriorNumber: null,
    billingZipCode: null,
    billingNeighborhood: null,
    billingMunicipality: null,
    billingCity: null,
    billingState: null,
    addresses,
  }
}

function makePaginatedResponse(customers: Customer[]): PaginatedResponse<Customer> {
  return {
    data: customers,
    pagination: {
      pageIndex: 0,
      pageSize: 10,
      totalCount: customers.length,
      pageCount: 1,
    },
  }
}

function mountSlideover() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  return mount(AssignCustomerSlideover, {
    props: {
      open: true,
      saleId: 'sale-1',
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        USlideover: {
          props: ['open'],
          template: '<div v-if="open"><slot name="content" /></div>',
        },
        UButton: {
          props: ['label'],
          emits: ['click'],
          template: '<button @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        UInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        USkeleton: { template: '<div data-testid="skeleton" />' },
        CustomerUpsertSlideover: {
          name: 'CustomerUpsertSlideover',
          emits: ['create', 'update:open'],
          template: `<button data-testid="nested-customer-slideover" @click="$emit('create', { firstName: 'Nuevo' })" />`,
        },
        AddressModal: {
          template: '<div data-testid="address-modal" />',
        },
      },
    },
  })
}

function pageText() {
  return document.body.textContent ?? ''
}

function getByTestId(testId: string): HTMLElement {
  const node = document.body.querySelector(`[data-testid="${testId}"]`)
  if (!(node instanceof HTMLElement)) {
    throw new Error(`Missing data-testid=${testId}`)
  }
  return node
}

describe('AssignCustomerSlideover', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  beforeEach(() => {
    vi.clearAllMocks()
    authStoreMock.userCan.mockReturnValue(true)
    customerApiMock.getPaginated.mockResolvedValue(makePaginatedResponse([]))
    customerApiMock.getById.mockResolvedValue(makeCustomerDetail(makeCustomer(), []))
    customerApiMock.create.mockResolvedValue(makeCustomerDetail(makeCustomer({ id: 'customer-99' }), []))
    customerApiMock.createAddress.mockResolvedValue(makeAddress('address-99'))
  })

  it('loads customer list and renders rows', async () => {
    const ada = makeCustomer()
    const bob = makeCustomer({
      id: 'customer-2',
      firstName: 'Bob',
      lastName: 'Smith',
      fullName: 'Bob Smith',
      email: 'bob@example.com',
      phone: '5588887777',
    })

    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada, bob]))

    const wrapper = mountSlideover()
    await flushPromises()

    expect(customerApiMock.getPaginated).toHaveBeenCalledWith(expect.any(Object) as ServerTableParams)
    expect(pageText()).toContain('Ada Lovelace')
    expect(pageText()).toContain('Bob Smith')
  })

  it('filters list by search across firstName/lastName/email/phone case-insensitive', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(
      makePaginatedResponse([
        makeCustomer(),
        makeCustomer({ id: 'customer-2', firstName: 'Bob', lastName: 'Smith', fullName: 'Bob Smith', email: 'BOB@MAIL.COM', phone: '9911223344' }),
      ]),
    )

    const wrapper = mountSlideover()
    await flushPromises()

    const searchInput = getByTestId('customer-search-input') as HTMLInputElement
    searchInput.value = 'mail.com'
    searchInput.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(pageText()).toContain('Bob Smith')
  })

  it('selecting customer triggers assignCustomer', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))

    const wrapper = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()

    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-1' })
  })

  it('shows address picker only when customer has addresses and always includes Sin dirección option', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, [makeAddress('address-1')]))

    const wrapper = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    expect(document.body.querySelector('[data-testid="shipping-address-picker"]')).not.toBeNull()
    expect(pageText()).toContain('Sin dirección')
  })

  it('hides address picker when selected customer has zero addresses', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, []))

    const wrapper = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    expect(document.body.querySelector('[data-testid="shipping-address-picker"]')).toBeNull()
  })

  it('gates + Nuevo cliente button with authStore.userCan(create, Customer)', async () => {
    authStoreMock.userCan.mockReturnValue(false)
    const wrapper = mountSlideover()
    await flushPromises()

    expect(pageText()).not.toContain('+ Nuevo cliente')
  })

  it('shows empty state when no customers exist', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([]))
    const wrapper = mountSlideover()
    await flushPromises()

    expect(pageText()).toContain('Aún no hay clientes registrados')
  })

  it('surfaces typed backend error code from composable', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([makeCustomer()]))
    assignCustomerMock.mockRejectedValueOnce(new DraftCustomerAssignmentError('CUSTOMER_NOT_FOUND'))

    const wrapper = mountSlideover()
    await flushPromises()
    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-1' })
  })

  it('opens nested customer slideover and auto-selects created customer', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([]))
    const wrapper = mountSlideover()
    await flushPromises()

    getByTestId('open-create-customer').click()
    await wrapper.findComponent({ name: 'CustomerUpsertSlideover' }).vm.$emit('create', { firstName: 'Nuevo' })
    await flushPromises()

    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-99' })
  })
})
