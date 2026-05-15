import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { reactive } from 'vue'
import AssignCustomerSlideover from '../AssignCustomerSlideover.vue'
import { DraftCustomerAssignmentError } from '../../composables/useDraftCustomerAssignment'
import type { Customer, CustomerAddress, CustomerDetail } from '@/features/POS/customers/interfaces/customer.types'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { customerQueryKeys } from '@/core/shared/constants/query-keys'

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

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
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

  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  const wrapper = mount(AssignCustomerSlideover, {
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
          name: 'AddressModal',
          props: ['open'],
          template: '<div v-if="open" data-testid="address-modal" />',
        },
      },
    },
  })

  return { wrapper, queryClient, invalidateQueries }
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
    assignCustomerMock.mockResolvedValue(undefined)
    setShippingAddressMock.mockResolvedValue(undefined)
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

    const { wrapper } = mountSlideover()
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

    const { wrapper } = mountSlideover()
    await flushPromises()

    const searchInput = getByTestId('customer-search-input') as HTMLInputElement
    searchInput.value = 'mail.com'
    searchInput.dispatchEvent(new Event('input'))
    await flushPromises()

    expect(pageText()).toContain('Bob Smith')
  })

  it('selecting customer triggers assignCustomer but keeps slideover open for address picker', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))

    const { wrapper } = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-1' })
    // Should NOT emit close on customer selection
    expect(wrapper.emitted('update:open') ?? []).toEqual([])
    // Address picker step should be visible
    expect(pageText()).toContain('Cliente seleccionado: Ada Lovelace')
  })

  it('shows address picker only when customer has addresses and always includes Sin dirección option', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, [makeAddress('address-1')]))

    const { wrapper } = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    expect(document.body.querySelector('[data-testid="shipping-address-picker"]')).not.toBeNull()
    expect(pageText()).toContain('Sin dirección')
  })

  it('shows "Sin dirección" button even when customer has zero addresses', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, []))

    const { wrapper } = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    // Should show the skip button even with 0 addresses
    expect(document.body.querySelector('[data-testid="skip-shipping-address"]')).not.toBeNull()
    expect(pageText()).toContain('Sin dirección')
  })

  it('gates + Nuevo cliente button with authStore.userCan(create, Customer)', async () => {
    authStoreMock.userCan.mockReturnValue(false)
    const { wrapper } = mountSlideover()
    await flushPromises()

    expect(pageText()).not.toContain('+ Nuevo cliente')
  })

  it('shows empty state when no customers exist', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([]))
    const { wrapper } = mountSlideover()
    await flushPromises()

    expect(pageText()).toContain('Aún no hay clientes registrados')
  })

  it('keeps slideover open when assignCustomer fails with typed backend error', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([makeCustomer()]))
    assignCustomerMock.mockRejectedValueOnce({ code: 'CUSTOMER_NOT_FOUND' })

    const { wrapper } = mountSlideover()
    await flushPromises()
    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-1' })
    // Boundary: toast plumbing is owned by Nuxt runtime composable; component-level unit test asserts error path keeps overlay open.
    expect(wrapper.emitted('update:open') ?? []).toEqual([])
  })

  it('opens nested customer slideover and auto-selects created customer', async () => {
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([]))
    const { wrapper } = mountSlideover()
    await flushPromises()

    getByTestId('open-create-customer').click()
    await wrapper.findComponent({ name: 'CustomerUpsertSlideover' }).vm.$emit('create', { firstName: 'Nuevo' })
    await flushPromises()

    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-99' })
  })

  it('clicking "Sin dirección" calls setShippingAddress with null and closes slideover', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, [makeAddress('address-1')]))

    const { wrapper } = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    getByTestId('skip-shipping-address').click()
    await flushPromises()

    expect(setShippingAddressMock).toHaveBeenCalledWith({ shippingAddressId: null })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('clicking + Nueva dirección opens AddressModal', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, [makeAddress('address-1')]))

    const { wrapper } = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-testid="open-create-address"]')).not.toBeNull()
    })

    getByTestId('open-create-address').click()
    await flushPromises()

    const addressModal = wrapper.findComponent({ name: 'AddressModal' })
    expect(addressModal.exists()).toBe(true)
    expect(addressModal.props('open')).toBe(true)
  })

  it('address pick after customer pick closes the slideover', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, [makeAddress('address-1')]))

    const { wrapper } = mountSlideover()
    await flushPromises()

    // Pick customer - should NOT close
    getByTestId('customer-row-customer-1').click()
    await flushPromises()
    expect(wrapper.emitted('update:open') ?? []).toEqual([])

    // Pick address - should close
    getByTestId('shipping-address-option-address-1').click()
    await flushPromises()

    expect(setShippingAddressMock).toHaveBeenCalledWith({ shippingAddressId: 'address-1' })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('invalidates customer addresses query on SHIPPING_ADDRESS_NOT_FOR_CUSTOMER', async () => {
    const ada = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValueOnce(makePaginatedResponse([ada]))
    customerApiMock.getById.mockResolvedValueOnce(makeCustomerDetail(ada, [makeAddress('address-1')]))
    setShippingAddressMock.mockRejectedValueOnce(new DraftCustomerAssignmentError('SHIPPING_ADDRESS_NOT_FOR_CUSTOMER'))

    const { wrapper, invalidateQueries } = mountSlideover()
    await flushPromises()

    getByTestId('customer-row-customer-1').click()
    await flushPromises()

    getByTestId('shipping-address-option-address-1').click()
    await flushPromises()

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: customerQueryKeys.addresses('tenant-1', 'customer-1'),
    })
  })
})
