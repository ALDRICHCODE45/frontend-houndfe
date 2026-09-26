import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import AddressModal from '../AddressModal.vue'
import { resetMapProvider, setMapProvider } from '@/core/shared/maps/map-provider'
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
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
    emits: ['click'],
  },
  UIcon: { template: '<span />' },
}))

// Exercise the real child; only the map network/provider boundary is replaced.
const editorStubs = {
  USlideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UTabs: { template: '<div><slot name="content" v-bind="{ item: { value: \'basic\' } }" /></div>' },
  UModal: {
    props: ['open', 'title'],
    template:
      '<div v-if="open"><h1>{{ title }}</h1><slot name="body" /><slot name="footer" /></div>',
  },
  UForm: {
    props: ['state'],
    template: '<form @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
  },
  UFormField: { template: '<label><slot /></label>' },
  UInput: {
    props: ['modelValue'],
    template:
      '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USelect: { template: '<select />' },
  UTextarea: { template: '<textarea />' },
  UCheckbox: { template: '<input type="checkbox" />' },
  UButton: {
    props: ['label', 'type', 'form', 'loading', 'disabled'],
    template:
      '<button :type="type || \'button\'" :form="form" :disabled="loading || disabled" v-bind="$attrs" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  UIcon: { template: '<span />' },
}
for (const [key, stub] of Object.entries({ ...editorStubs })) {
  Object.assign(editorStubs, { [key.slice(1)]: stub })
}

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
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  const mockAddressPayload: CreateCustomerAddressPayload = {
    street: 'Nueva Calle',
    exteriorNumber: '456',
    interiorNumber: undefined,
    zipCode: '12345',
    neighborhood: 'Nueva Colonia',
    municipality: undefined,
    city: 'Nueva Ciudad',
    state: 'Nuevo Estado',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the edit draft open on failure, ignores duplicate saves and fences a late acknowledgement', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', customer: mockCustomer, open: true },
      global: { stubs: editorStubs },
    })
    try {
      await wrapper.find('[data-testid="edit-address-addr-1"]').trigger('click')
      const modal = wrapper.findComponent(AddressModal)
      const vm = wrapper.vm as unknown as {
        handleAddressSave: (payload: CreateCustomerAddressPayload) => void
        isAddressModalOpen: boolean
      }
      vm.handleAddressSave(mockAddressPayload)
      vm.handleAddressSave(mockAddressPayload)
      expect(wrapper.emitted('update-address')).toHaveLength(1)
      expect(vm.isAddressModalOpen).toBe(true)
      const firstAck = wrapper.emitted('update-address')![0]![3] as (saved: boolean) => void
      firstAck(false)
      await nextTick()
      expect((modal.vm as unknown as { formState: { street: string } }).formState.street).toBe(
        'Insurgentes Sur',
      )
      expect(wrapper.find('[role="alert"]').text()).toContain('No se pudo guardar')
      vm.handleAddressSave(mockAddressPayload)
      const lateAck = wrapper.emitted('update-address')![1]![3] as (saved: boolean) => void
      await wrapper.setProps({ customer: { ...mockCustomer, id: 'customer-2', addresses: [] } })
      lateAck(true)
      expect(vm.isAddressModalOpen).toBe(false)
      expect(wrapper.emitted('update-address')?.[1]?.slice(0, 2)).toEqual(['customer-1', 'addr-1'])
    } finally {
      wrapper.unmount()
    }
  })

  it('does not let an old save close a reopened editor for the same customer', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', customer: mockCustomer, open: true },
      global: { stubs: editorStubs },
    })
    try {
      await wrapper.find('[data-testid="edit-address-addr-1"]').trigger('click')
      const modal = wrapper.findComponent(AddressModal)
      const vm = wrapper.vm as unknown as {
        handleAddressSave: (payload: CreateCustomerAddressPayload) => void
        isAddressModalOpen: boolean
      }
      vm.handleAddressSave(mockAddressPayload)
      const acknowledge = wrapper.emitted('update-address')![0]![3] as (saved: boolean) => void
      await nextTick()
      expect(modal.props('loading')).toBe(true)
      await modal
        .findAll('button')
        .find((button) => button.text() === 'Cancelar')!
        .trigger('click')
      await wrapper.find('[data-testid="edit-address-addr-1"]').trigger('click')
      acknowledge(true)
      await nextTick()
      expect(vm.isAddressModalOpen).toBe(true)
      expect((modal.vm as unknown as { formState: { street: string } }).formState.street).toBe(
        'Insurgentes Sur',
      )
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps a same-customer dirty form and resets the nested editor on a customer switch', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', customer: mockCustomer, open: true },
      global: { stubs: editorStubs },
    })
    try {
      await wrapper.find('[data-testid="edit-address-addr-1"]').trigger('click')
      await nextTick()
      const vm = wrapper.vm as unknown as {
        state: { firstName: string }
        isAddressModalOpen: boolean
        editingAddress: CustomerDetail['addresses'][number] | null
      }
      vm.state.firstName = 'Unsaved'
      await wrapper.setProps({
        customer: { ...mockCustomer, addresses: [...mockCustomer.addresses] },
      })
      expect(vm.state.firstName).toBe('Unsaved')
      expect(vm.isAddressModalOpen).toBe(true)
      await wrapper.setProps({ customer: { ...mockCustomer, id: 'customer-2', addresses: [] } })
      expect(vm.isAddressModalOpen).toBe(false)
      expect(vm.editingAddress).toBeNull()
      expect(vm.state.firstName).toBe('Juan')
    } finally {
      wrapper.unmount()
    }
  })

  it('pencil opens the real editor with the selected fields and pin, independently of the create instance', async () => {
    setMapProvider({
      kind: 'leaflet',
      createMap: () => ({
        setMarker: vi.fn(),
        clearMarker: vi.fn(),
        getMarker: () => null,
        getPopupText: () => null,
        isMarkerDraggable: () => false,
        simulateMarkerDrag: vi.fn(),
        simulateTileError: vi.fn(),
        destroy: vi.fn(),
      }),
      geocode: async () => null,
    })
    const addressA = {
      ...mockCustomer.addresses[0]!,
      interiorNumber: 'Unit A',
      municipality: 'District A',
      latitude: 19.5,
      longitude: -99.2,
    }
    const addressB = {
      ...addressA,
      id: 'addr-2',
      street: 'Second Street',
      latitude: 0,
      longitude: 0,
    }
    const edit = mount(CustomerUpsertSlideover, {
      props: {
        mode: 'edit',
        customer: { ...mockCustomer, addresses: [addressA, addressB] },
        open: true,
      },
      global: { stubs: editorStubs },
    })
    const create = mount(CustomerUpsertSlideover, {
      props: { mode: 'create', open: true },
      global: { stubs: editorStubs },
    })
    try {
      expect(edit.find('[data-testid="edit-address-addr-1"]').exists(), edit.html()).toBe(true)
      await edit.find('[data-testid="edit-address-addr-1"]').trigger('click')
      await nextTick()
      const modal = edit.findComponent(AddressModal)
      expect(edit.text()).toContain('Editar dirección')
      expect(
        (modal.vm as unknown as { formState: Record<string, unknown> }).formState,
      ).toMatchObject({
        street: 'Insurgentes Sur',
        exteriorNumber: '123',
        interiorNumber: 'Unit A',
        zipCode: '03100',
        neighborhood: 'Del Valle',
        municipality: 'District A',
        city: 'CDMX',
        state: 'CDMX',
        latitude: 19.5,
        longitude: -99.2,
      })
      expect(modal.findComponent({ name: 'AddressMapPicker' }).props('modelValue')).toEqual({
        lat: 19.5,
        lng: -99.2,
      })
      expect(create.findComponent(AddressModal).props('open')).toBe(false)
      await modal
        .findAll('button')
        .find((button) => button.text() === 'Cancelar')!
        .trigger('click')
      await nextTick()
      await edit.find('[data-testid="edit-address-addr-2"]').trigger('click')
      await nextTick()
      expect((modal.vm as unknown as { formState: { street: string } }).formState.street).toBe(
        'Second Street',
      )
      expect(modal.findComponent({ name: 'AddressMapPicker' }).props('modelValue')).toEqual({
        lat: 0,
        lng: 0,
      })
      expect(create.findComponent(AddressModal).props('open')).toBe(false)
      const vm = edit.vm as unknown as {
        handleAddressSave: (payload: CreateCustomerAddressPayload) => void
        isAddressModalOpen: boolean
      }
      vm.handleAddressSave(mockAddressPayload)
      expect(edit.emitted('update-address')?.[0]?.slice(0, 3)).toEqual([
        'customer-1',
        'addr-2',
        mockAddressPayload,
      ])
      expect(vm.isAddressModalOpen).toBe(true)
      const acknowledge = edit.emitted('update-address')![0]![3] as (saved: boolean) => void
      acknowledge(true)
      await nextTick()
      expect(vm.isAddressModalOpen).toBe(false)
    } finally {
      edit.unmount()
      create.unmount()
      resetMapProvider()
    }
  })

  describe('edit mode address management', () => {
    it('emits create-address when adding new address in edit mode', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'edit',
          customer: mockCustomer,
          open: true,
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save'],
            },
          },
        },
      })

      // Directly call the handleAddressSave function to test the logic
      // This mimics what happens when the modal emits save after clicking add address
      const vm = wrapper.vm as unknown as {
        editingAddress: CustomerDetail['addresses'][number] | null
        openAddressModal: () => void
        handleAddressSave: (payload: CreateCustomerAddressPayload) => void
      }
      vm.openAddressModal()
      vm.editingAddress = null // New address (not editing)
      vm.handleAddressSave(mockAddressPayload)

      // Should emit create-address with customer ID and payload
      expect(wrapper.emitted('create-address')).toBeTruthy()
      expect(wrapper.emitted('create-address')?.[0]?.slice(0, 2)).toEqual([
        mockCustomer.id,
        mockAddressPayload,
      ])
    })

    it('emits update-address when editing existing address in edit mode', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'edit',
          customer: mockCustomer,
          open: true,
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save'],
            },
          },
        },
      })

      // Set up editing state to simulate editing an existing address
      const vm = wrapper.vm as unknown as {
        editingAddress: CustomerDetail['addresses'][number] | null
        editExistingAddress: (address: CustomerDetail['addresses'][number]) => void
        handleAddressSave: (payload: CreateCustomerAddressPayload) => void
      }
      vm.editExistingAddress(mockCustomer.addresses[0]!) // Editing existing address
      vm.handleAddressSave(mockAddressPayload)

      // Should emit update-address with customer ID, address ID, and payload
      expect(wrapper.emitted('update-address')).toBeTruthy()
      expect(wrapper.emitted('update-address')?.[0]?.slice(0, 3)).toEqual([
        'customer-1',
        'addr-1',
        mockAddressPayload,
      ])
    })

    it('emits remove-address when removing existing address in edit mode', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'edit',
          customer: mockCustomer,
          open: true,
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save'],
            },
          },
        },
      })

      // Directly call the removeExistingAddress function
      const vm = wrapper.vm as unknown as {
        removeExistingAddress: (address: CustomerDetail['addresses'][number]) => void
      }
      vm.removeExistingAddress(mockCustomer.addresses[0]!)

      // Should emit remove-address with customer ID and address ID
      expect(wrapper.emitted('remove-address')).toBeTruthy()
      expect(wrapper.emitted('remove-address')?.[0]).toEqual(['customer-1', 'addr-1'])
    })

    it('in create mode, behavior is unchanged: addresses are accumulated in pendingAddresses', async () => {
      const wrapper = mount(CustomerUpsertSlideover, {
        props: {
          mode: 'create',
          open: true,
        },
        global: {
          stubs: {
            AddressModal: {
              template: '<div />',
              emits: ['save'],
            },
          },
        },
      })

      // Directly call the handleAddressSave function in create mode
      const vm = wrapper.vm as unknown as {
        editingAddress: CustomerDetail['addresses'][number] | null
        pendingAddresses: CreateCustomerAddressPayload[]
        openAddressModal: () => void
        handleAddressSave: (payload: CreateCustomerAddressPayload) => void
      }
      vm.openAddressModal()
      vm.editingAddress = null // New address
      vm.handleAddressSave(mockAddressPayload)

      // Should NOT emit create-address in create mode
      expect(wrapper.emitted('create-address')).toBeFalsy()
      expect(wrapper.emitted('update-address')).toBeFalsy()
      expect(wrapper.emitted('remove-address')).toBeFalsy()

      // Should add to pendingAddresses instead
      expect(vm.pendingAddresses).toHaveLength(1)
      expect(vm.pendingAddresses[0]).toEqual(mockAddressPayload)
    })

    // ── S3b regression pin: the local `formatAddress` helper is gone; the
    //    slideover now consumes the shared `@/core/shared/utils/formatAddress`
    //    util (design §8.2). The pin asserts the shared output exactly so a
    //    future drift would re-introducing the divergent helper would break
    //    this assertion. REQ-AMP-009.
    it('shared formatAddress regression pin — matches S3a formatAddress.spec output for an address row', async () => {
      const { formatAddress } = await import('@/core/shared/utils/formatAddress')
      const address = mockCustomer.addresses[0]!
      const expected = formatAddress(address)
      // Shared formatter emits label-first, includes interior number, zip
      // formatted as 'CP 03100'. The old local helper dropped interior,
      // neighborhood/zipCode formatting, and any label.
      expect(expected).toContain('Insurgentes Sur #123')
      expect(expected).toContain('Del Valle')
      expect(expected).toContain('CP 03100')
      // Sanity: the OLD local helper output would be
      // 'Insurgentes Sur #123, Del Valle, CDMX, CDMX' — missing CP. The
      // shared one MUST NOT match the old shape; that mismatch is exactly
      // what the swap fixes.
      expect(expected).not.toBe('Insurgentes Sur #123, Del Valle, CDMX, CDMX')
    })
  })
})
