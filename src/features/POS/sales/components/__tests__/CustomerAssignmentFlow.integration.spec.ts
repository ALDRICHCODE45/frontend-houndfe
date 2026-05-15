import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { computed, defineComponent, ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ActiveSalePanel from '../ActiveSalePanel.vue'
import AssignCustomerSlideover from '../AssignCustomerSlideover.vue'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import type { Customer, CustomerAddress, CustomerDetail } from '@/features/POS/customers/interfaces/customer.types'
import type { Sale } from '../../interfaces/sale.types'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const saleState = ref<Sale>({
  id: 'sale-1',
  userId: 'user-1',
  status: 'DRAFT',
  items: [],
  customer: null,
  shippingAddress: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const isPendingState = ref(false)

function makeAddress(id: string, customerId: string, street: string): CustomerAddress {
  return {
    id,
    customerId,
    street,
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

const customers: Customer[] = [
  {
    id: 'customer-a',
    firstName: 'Ada',
    lastName: 'Lovelace',
    fullName: 'Ada Lovelace',
    phoneCountryCode: '+52',
    phone: '1111111111',
    email: 'ada@example.com',
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'customer-b',
    firstName: 'Bob',
    lastName: 'Smith',
    fullName: 'Bob Smith',
    phoneCountryCode: '+52',
    phone: '2222222222',
    email: 'bob@example.com',
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

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

const customerDetails: Record<string, CustomerDetail> = {
  'customer-a': makeCustomerDetail(customers[0]!, [makeAddress('address-a', 'customer-a', 'Main St')]),
  'customer-b': makeCustomerDetail(customers[1]!, [makeAddress('address-b', 'customer-b', 'Second St')]),
}

vi.mock('@/features/POS/customers/api/customer.api', () => ({
  customerApi: {
    getPaginated: vi.fn(async () => ({
      data: customers,
      pagination: { pageIndex: 0, pageSize: 100, totalCount: customers.length, pageCount: 1 },
    })),
    getById: vi.fn(async (id: string) => customerDetails[id]),
    create: vi.fn(),
    createAddress: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: () => true }),
}))

vi.mock('../../composables/useDraftCustomerAssignment', () => ({
  DraftCustomerAssignmentError: class DraftCustomerAssignmentError extends Error {},
  useDraftCustomerAssignment: () => ({
    assignCustomer: vi.fn(async ({ customerId }: { customerId: string }) => {
      const detail = customerDetails[customerId]
      if (!detail) {
        throw new Error(`Missing fixture for customer ${customerId}`)
      }
      saleState.value = {
        ...saleState.value,
        customer: { id: detail.id, firstName: detail.firstName, lastName: detail.lastName },
        shippingAddress: null,
      }
    }),
    unassignCustomer: vi.fn(async () => {
      saleState.value = {
        ...saleState.value,
        customer: null,
        shippingAddress: null,
      }
    }),
    setShippingAddress: vi.fn(async ({ shippingAddressId }: { shippingAddressId: string | null }) => {
      const current = saleState.value.customer
      if (!current || !shippingAddressId) {
        saleState.value = { ...saleState.value, shippingAddress: null }
        return
      }
      const detail = customerDetails[current.id]
      if (!detail) {
        throw new Error(`Missing fixture detail for ${current.id}`)
      }
      const selected = detail.addresses.find((address) => address.id === shippingAddressId) ?? null
      saleState.value = { ...saleState.value, shippingAddress: selected }
    }),
    clearShippingAddress: vi.fn(async () => {
      saleState.value = { ...saleState.value, shippingAddress: null }
    }),
    isPending: computed(() => isPendingState.value),
    lastError: { value: null },
  }),
}))

const customerApiMock = vi.mocked(customerApi)

const Harness = defineComponent({
  components: { ActiveSalePanel, AssignCustomerSlideover },
  setup() {
    const open = ref(false)
    return { saleState, open }
  },
  template: `
    <div>
      <ActiveSalePanel
        :drafts="[saleState]"
        :active-draft="saleState"
        :active-tab-id="saleState.id"
        :is-loading-list="false"
        :is-mutating="false"
        :is-customer-mutation-pending="false"
        :on-submit-price-override="async () => undefined"
        :on-apply-discount="async () => undefined"
        :on-remove-discount="async () => undefined"
        :on-remove-item="async () => undefined"
        :on-apply-global-discount="async () => undefined"
        :on-remove-global-discount="async () => undefined"
        @open-customer-assignment="open = true"
        @unassign-customer="saleState.customer = null; saleState.shippingAddress = null"
      />

      <AssignCustomerSlideover
        v-model:open="open"
        :sale-id="saleState.id"
      />
    </div>
  `,
})

function mountFlow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

  return mount(Harness, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        SalesTabsStrip: { template: '<div />' },
        SaleItemRow: { template: '<div />' },
        SaleTotalsFooter: { template: '<div />' },
        GlobalDiscountModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
        UTabs: { template: '<div />' },
        UTooltip: { template: '<div><slot /></div>' },
        UDropdownMenu: { template: '<div><slot /></div>' },
        Tooltip: { template: '<div><slot /></div>' },
        DropdownMenu: { template: '<div><slot /></div>' },
        UCard: { template: '<div><slot /></div>' },
        Card: { template: '<div><slot /></div>' },
        UIcon: { template: '<i />' },
        UButton: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        Button: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        UInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<input data-testid="customer-search-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        USlideover: {
          props: ['open'],
          emits: ['update:open'],
          template: '<div v-if="open"><slot name="content" /></div>',
        },
        USkeleton: { template: '<div />' },
        CustomerUpsertSlideover: { template: '<div />' },
        AddressModal: { template: '<div />' },
      },
    },
  })
}

describe('customer assignment integration flow', () => {
  beforeEach(() => {
    saleState.value = {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
      customer: null,
      shippingAddress: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    vi.clearAllMocks()
  })

  it('assigns A, reassigns to B with shipping wiped, then unassigns to empty state', async () => {
    const wrapper = mountFlow()

    await wrapper.get('[data-testid="assign-customer-trigger"]').trigger('click')
    await flushPromises()

    document.body.querySelector('[data-testid="customer-row-customer-a"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(wrapper.text()).toContain('Ada Lovelace')

    saleState.value = {
      ...saleState.value,
      shippingAddress: customerDetails['customer-a']?.addresses[0] ?? null,
    }
    await flushPromises()
    expect(wrapper.text()).toContain('Main St')

    await wrapper.get('[data-testid="change-customer-trigger"]').trigger('click')
    await flushPromises()

    // After redesign (a9ae66f), slideover is in step 2 showing the selected customer.
    // Click "Cambiar cliente" to return to step 1 (customer list) before picking B.
    document.body.querySelector('[data-testid="change-customer-step"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    document.body.querySelector('[data-testid="customer-row-customer-b"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(wrapper.text()).toContain('Bob Smith')
    expect(wrapper.text()).not.toContain('Main St')

    await wrapper.get('[data-testid="unassign-customer-trigger"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Asignar cliente')
  })
})
