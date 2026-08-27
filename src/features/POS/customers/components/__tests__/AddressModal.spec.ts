// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import AddressModal from '../AddressModal.vue'
import {
  resetMapProvider,
  setMapProvider,
  type CreateMapOptions,
  type GeoPoint,
  type MapHandle,
  type MapProvider,
} from '@/core/shared/maps/map-provider'
import type { CustomerAddress } from '../../interfaces/customer.types'

// AddressModal consumes UModal/UForm/UInput/USelect/UFormField/UButton through
// Nuxt UI's auto-import resolver (@nuxt/ui/vite), so `vi.mock('@nuxt/ui')` cannot
// intercept them. Stub the resolved components via `global.stubs` instead — the
// same pattern used by QuotationPriceOverrideModal / PaymentMethodUpsertSlideover /
// PaymentDetailUpsertSlideover specs (both U* and unprefixed aliases). The stubs
// render inline so the form is reachable from `wrapper.find()` without crossing
// the teleport boundary that the real UModal creates.
const modalStub = {
  name: 'UModal',
  props: ['open', 'title'],
  emits: ['update:open'],
  template:
    '<div v-if="open" data-testid="u-modal"><h1>{{ title }}</h1><slot name="body" /><slot name="footer" /></div>',
}
const formStub = {
  name: 'UForm',
  props: ['schema', 'state'],
  emits: ['submit'],
  template:
    '<form data-testid="address-form" @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
}
const formFieldStub = { name: 'UFormField', template: '<label><slot /></label>' }
const inputStub = {
  name: 'UInput',
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}
const selectStub = {
  name: 'USelect',
  props: ['modelValue', 'items', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="i in items" :key="i" :value="i">{{ i }}</option></select>',
}
const buttonStub = {
  name: 'UButton',
  props: ['label', 'type', 'loading', 'form', 'disabled'],
  emits: ['click'],
  template:
    '<button :type="type" :form="form" :disabled="disabled || loading" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UForm: formStub,
  Form: formStub,
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UInput: inputStub,
  Input: inputStub,
  USelect: selectStub,
  Select: selectStub,
  UButton: buttonStub,
  Button: buttonStub,
}

// Mock the picker with a controllable v-model so the modal wiring can be
// driven from outside.
vi.mock('@/core/shared/components/AddressMapPicker.vue', () => ({
  default: defineComponent({
    name: 'AddressMapPicker',
    props: ['mode', 'modelValue'],
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      const localModel = computed({
        get: () => props.modelValue,
        set: (value: GeoPoint | null) => emit('update:modelValue', value),
      })
      return { localModel }
    },
    render() {
      // Plain render fn avoids the SFC template-string compile path that's
      // unreliable in vitest when the SFC plugin isn't fully loaded.
      return h('div', { 'data-testid': 'address-map-picker' }, [
        h('button', {
          'data-testid': 'address-map-emit-coords',
          type: 'button',
          onClick: () => {
            this.localModel = { lat: 19.4326, lng: -99.1332 }
          },
        }, 'Emit coords'),
        h('button', {
          'data-testid': 'address-map-clear-pin',
          type: 'button',
          onClick: () => {
            this.localModel = null
          },
        }, 'Clear pin'),
      ])
    },
  }),
  pinToGeoPoint: (source: { latitude?: number | null, longitude?: number | null }) => {
    const lat = source.latitude
    const lng = source.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  },
}))

const MOCK_PROVIDER: MapProvider = {
  kind: 'leaflet',
  createMap(_container: HTMLElement, _opts: CreateMapOptions): MapHandle {
    return {
      setMarker: () => undefined,
      clearMarker: () => undefined,
      getMarker: () => null,
      getPopupText: () => null,
      isMarkerDraggable: () => false,
      simulateMarkerDrag: () => undefined,
      simulateTileError: () => undefined,
      destroy: () => undefined,
    }
  },
  geocode: async () => null,
}

setMapProvider(MOCK_PROVIDER)

interface AddressModalFactoryArgs {
  address?: CustomerAddress | null
  loading?: boolean
}

function mountAddressModal(args: AddressModalFactoryArgs = {}) {
  const Host = defineComponent({
    components: { AddressModal },
    props: {
      address: { type: Object as () => CustomerAddress | null, default: null },
      loading: { type: Boolean, default: false },
    },
    setup(props) {
      const open = ref(true)
      const onSave = vi.fn()
      return { open, onSave, props }
    },
    template: `
      <AddressModal
        :open="open"
        :address="address"
        :loading="loading"
        @save="onSave"
      />
    `,
  })

  const wrapper = mount(Host, {
    props: { address: args.address ?? null, loading: args.loading ?? false },
    global: { stubs },
  })

  const modal = wrapper.findComponent(AddressModal)

  return { wrapper, modal }
}

function makeAddress(overrides: Partial<CustomerAddress> = {}): CustomerAddress {
  return {
    id: 'addr-1',
    customerId: 'customer-1',
    street: 'Av. Reforma',
    exteriorNumber: '123',
    interiorNumber: null,
    zipCode: '06000',
    neighborhood: 'Centro',
    municipality: 'Cuauhtémoc',
    city: 'CDMX',
    state: 'CDMX',
    latitude: null,
    longitude: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('AddressModal — AddressMapPicker integration', () => {
  beforeEach(() => {
    setMapProvider(MOCK_PROVIDER)
  })

  it('mounts <AddressMapPicker mode="write" v-model="pin" /> when the modal opens', async () => {
    const { modal } = mountAddressModal()
    await nextTick()

    const picker = modal.findComponent({ name: 'AddressMapPicker' })
    expect(picker.exists()).toBe(true)
    expect(picker.props('mode')).toBe('write')
  })

  it('hydrates the picker pin from the address.latitude/longitude when editing an existing address with coords', async () => {
    const { modal } = mountAddressModal({
      address: makeAddress({ latitude: 19.4326, longitude: -99.1332 }),
    })
    await nextTick()

    const picker = modal.findComponent({ name: 'AddressMapPicker' })
    expect(picker.props('modelValue')).toEqual({ lat: 19.4326, lng: -99.1332 })
  })

  it('hydrates the picker pin as null when the address has no coords', async () => {
    const { modal } = mountAddressModal({ address: makeAddress() })
    await nextTick()

    const picker = modal.findComponent({ name: 'AddressMapPicker' })
    expect(picker.props('modelValue')).toBeNull()
  })

  it('writes the picker pin back into formState.latitude/longitude on update:modelValue', async () => {
    const { modal } = mountAddressModal()
    await nextTick()

    const picker = modal.findComponent({ name: 'AddressMapPicker' })
    picker.vm.$emit('update:modelValue', { lat: 19.5, lng: -99.2 })
    await nextTick()

    const vm = modal.vm as unknown as {
      formState: { latitude: number | null, longitude: number | null }
    }
    expect(vm.formState.latitude).toBe(19.5)
    expect(vm.formState.longitude).toBe(-99.2)
  })

  it('clears the pin and zeroes the form coords when the picker emits null (clear-pin)', async () => {
    const { modal } = mountAddressModal({
      address: makeAddress({ latitude: 19.4326, longitude: -99.1332 }),
    })
    await nextTick()

    const picker = modal.findComponent({ name: 'AddressMapPicker' })
    picker.vm.$emit('update:modelValue', null)
    await nextTick()

    const vm = modal.vm as unknown as {
      formState: { latitude: number | null, longitude: number | null }
    }
    expect(vm.formState.latitude).toBeNull()
    expect(vm.formState.longitude).toBeNull()
  })

  it('emits latitude/longitude on save ONLY when both coordinates are present', async () => {
    const { wrapper } = mountAddressModal()
    await nextTick()

    const form = wrapper.find('[data-testid="address-form"]')
    expect(form.exists()).toBe(true)
    await form.trigger('submit')
    await flushPromises()

    const onSave = wrapper.vm.onSave as unknown as ReturnType<typeof vi.fn>
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]?.[0]).toEqual({
      street: '',
    })
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('latitude')
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('longitude')
  })

  it('emits latitude/longitude on save when the picker placed a pin', async () => {
    const { modal, wrapper } = mountAddressModal()
    await nextTick()

    const picker = modal.findComponent({ name: 'AddressMapPicker' })
    picker.vm.$emit('update:modelValue', { lat: 19.4326, lng: -99.1332 })
    await nextTick()

    // Fill required field, then submit
    const vm = modal.vm as unknown as { formState: { street: string } }
    vm.formState.street = 'Av. Reforma'
    await nextTick()

    const form = wrapper.find('[data-testid="address-form"]')
    expect(form.exists()).toBe(true)
    await form.trigger('submit')
    await flushPromises()

    const onSave = wrapper.vm.onSave as unknown as ReturnType<typeof vi.fn>
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      street: 'Av. Reforma',
      latitude: 19.4326,
      longitude: -99.1332,
    })
  })

  it('never gates address eligibility on the pin — submit succeeds with no pin', async () => {
    const { modal, wrapper } = mountAddressModal()
    await nextTick()

    // Set only the required field; leave the pin untouched.
    const vm = modal.vm as unknown as { formState: { street: string } }
    vm.formState.street = 'Av. Reforma'
    await nextTick()

    const form = wrapper.find('[data-testid="address-form"]')
    expect(form.exists()).toBe(true)
    await form.trigger('submit')
    await flushPromises()

    const onSave = wrapper.vm.onSave as unknown as ReturnType<typeof vi.fn>
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('latitude')
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('longitude')
  })

  it('omits latitude/longitude when only one coordinate is set (no half-pins)', async () => {
    const { modal, wrapper } = mountAddressModal()
    await nextTick()

    // Simulate a half-pin by writing only latitude through the form path.
    const vm = modal.vm as unknown as {
      formState: { street: string, latitude: number | null, longitude: number | null }
    }
    vm.formState.street = 'Av. Reforma'
    vm.formState.latitude = 19.4326
    vm.formState.longitude = null
    await nextTick()

    const form = wrapper.find('[data-testid="address-form"]')
    expect(form.exists()).toBe(true)
    await form.trigger('submit')
    await flushPromises()

    const onSave = wrapper.vm.onSave as unknown as ReturnType<typeof vi.fn>
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('latitude')
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('longitude')

    // Silence unused-var warning by referencing the picker.
    expect(modal.findComponent({ name: 'AddressMapPicker' }).exists()).toBe(true)
  })

  it('does not add a `label` field on save — label stays delivery-routes-only', async () => {
    const { modal, wrapper } = mountAddressModal()
    await nextTick()

    const vm = modal.vm as unknown as { formState: { street: string } }
    vm.formState.street = 'Av. Reforma'
    await nextTick()

    const form = wrapper.find('[data-testid="address-form"]')
    expect(form.exists()).toBe(true)
    await form.trigger('submit')
    await flushPromises()

    const onSave = wrapper.vm.onSave as unknown as ReturnType<typeof vi.fn>
    expect(onSave.mock.calls[0]?.[0]).not.toHaveProperty('label')
  })
})

afterEach(() => {
  resetMapProvider()
})
