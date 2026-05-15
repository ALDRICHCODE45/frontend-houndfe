// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CustomerUpsertSlideover from '../CustomerUpsertSlideover.vue'
import type { CustomerDetail, CreateCustomerAddressPayload } from '../../interfaces/customer.types'

// Mock dependencies with more realistic templates that preserve data-testid and event handling
vi.mock('@nuxt/ui', () => ({
  USlideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UTabs: { template: '<div><slot name="content" v-bind="{ item: { value: \'basic\' } }" /></div>' },
  UForm: { template: '<form @submit="$emit(\'submit\', { data: {} })"><slot /></form>' },
  UFormField: { template: '<div><slot /></div>' },
  UInput: { template: '<input />' },
  USelect: { template: '<select />' },
  UTextarea: { template: '<textarea />' },
  UCheckbox: { template: '<input type="checkbox" />' },
  UButton: { 
    template: '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
    emits: ['click']
  },
  UIcon: { template: '<span />' }
}))

vi.mock('../AddressModal.vue', () => ({
  default: {
    template: '<div />',
    emits: ['save'],
    props: ['open', 'address', 'loading']
  }
}))

describe('CustomerUpsertSlideover', () => {
  const mockCustomer: CustomerDetail = {
    id: 'customer-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    phoneCountryCode: null,
    phone: null,
    email: 'juan@test.com',
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
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
    addresses: [
      {
        id: 'addr-1',
        customerId: 'customer-1',
        street: 'Insurgentes Sur',
        exteriorNumber: '123',
        interiorNumber: null,
        zipCode: '03100',
        neighborhood: 'Del Valle',
        municipality: null,
        city: 'CDMX',
        state: 'CDMX',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }

  const mockAddressPayload: CreateCustomerAddressPayload = {
    street: 'Nueva Calle',
    exteriorNumber: '456',
    interiorNumber: undefined,
    zipCode: '12345',
    neighborhood: 'Nueva Colonia',
    municipality: undefined,
    city: 'Nueva Ciudad',
    state: 'Nuevo Estado'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('edit mode address management', () => {
    it('emits create-address when adding new address in edit mode', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'edit',
          customer: mockCustomer,
          open: true
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save']
            }
          }
        }
      })

      // Directly call the handleAddressSave function to test the logic
      // This mimics what happens when the modal emits save after clicking add address
      const vm = wrapper.vm as any
      vm.editingAddress = null // New address (not editing)
      ;(vm.handleAddressSave as Function)(mockAddressPayload)

      // Should emit create-address with customer ID and payload
      expect(wrapper.emitted('create-address')).toBeTruthy()
      expect(wrapper.emitted('create-address')[0]).toEqual([mockCustomer.id, mockAddressPayload])
    })

    it('emits update-address when editing existing address in edit mode', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'edit',
          customer: mockCustomer,
          open: true
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save']
            }
          }
        }
      })

      // Set up editing state to simulate editing an existing address
      const vm = wrapper.vm as any
      vm.editingAddress = mockCustomer.addresses[0] // Editing existing address
      ;(vm.handleAddressSave as Function)(mockAddressPayload)

      // Should emit update-address with customer ID, address ID, and payload
      expect(wrapper.emitted('update-address')).toBeTruthy()
      expect(wrapper.emitted('update-address')[0]).toEqual(['customer-1', 'addr-1', mockAddressPayload])
    })

    it('emits remove-address when removing existing address in edit mode', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'edit',
          customer: mockCustomer,
          open: true
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save']
            }
          }
        }
      })

      // Directly call the removeExistingAddress function
      const vm = wrapper.vm as any
      ;(vm.removeExistingAddress as Function)(mockCustomer.addresses[0])

      // Should emit remove-address with customer ID and address ID
      expect(wrapper.emitted('remove-address')).toBeTruthy()
      expect(wrapper.emitted('remove-address')[0]).toEqual(['customer-1', 'addr-1'])
    })

    it('in create mode, behavior is unchanged: addresses are accumulated in pendingAddresses', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'create',
          open: true
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save']
            }
          }
        }
      })

      // Directly call the handleAddressSave function in create mode
      const vm = wrapper.vm as any
      vm.editingAddress = null // New address
      ;(vm.handleAddressSave as Function)(mockAddressPayload)

      // Should NOT emit create-address in create mode
      expect(wrapper.emitted('create-address')).toBeFalsy()
      expect(wrapper.emitted('update-address')).toBeFalsy()
      expect(wrapper.emitted('remove-address')).toBeFalsy()

      // Should add to pendingAddresses instead
      expect(vm.pendingAddresses).toHaveLength(1)
      expect(vm.pendingAddresses[0]).toEqual(mockAddressPayload)
    })
  })
})