// DeliveryRouteUpsertSlideover.spec.ts — STRICT-TDD tests for the manager
// create/edit slideover (sdd delivery-routes S4c, design.md §4.1, §11).
//
// Contract (REQ-DRM-003..007):
//   - mode="create"   : renders EligibleSalesPicker (multi-select) + DriverPicker + notes (≤280).
//                       Emits `create` with `{ saleIds: string[], driverUserId: string, notes?: string }`.
//                       Blocks submission when saleIds is empty or driver is empty
//                       (zod inline errors). notes max 280.
//   - mode="edit"     : renders DriverPicker + notes only. Sales picker is HIDDEN.
//                       Emits `edit` with `{ driverUserId?: string, notes?: string | null }`.
//                       Re-blocks when driver is empty or notes > 280.
//   - never renders the sales picker in edit mode (create-only).
//   - never sends a request itself — emits `create` / `edit` for the parent.
//
// Nuxt UI components are stubbed via `global.stubs`. The pickers are stubbed
// as `defineComponent`s via `global.stubs` so we can drive them through v-model
// without reaching into the Nuxt UI runtime. Each stub exposes the same
// `data-testid` and emit contract the production code consumes.
//
// This spec is intentionally small — it focuses on the slideover's wiring
// (emit shapes, inline error routing, sales-picker visibility per mode). The
// pickers themselves have their own strict-TDD specs.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DeliveryRouteUpsertSlideover from '../DeliveryRouteUpsertSlideover.vue'

// ─── @nuxt/ui stubs ──────────────────────────────────────────────────────────
const slideoverStub = {
  template:
    '<div data-testid="uslideover-stub"><slot /><slot name="body" /><slot name="footer" /></div>',
  props: ['open', 'title', 'description', 'side', 'inset'],
  emits: ['update:open', 'after-leave'],
}

const formStub = {
  template:
    '<form data-testid="uform-stub" :id="id" @submit.prevent="onSubmit"><slot /></form>',
  props: ['schema', 'state', 'id'],
  emits: ['submit'],
  methods: {
    onSubmit(this: { $emit: (event: string, payload: unknown) => void; state: unknown }) {
      this.$emit('submit', { data: this.state })
    },
  },
}

const formFieldStub = {
  props: ['label', 'help', 'error', 'name', 'required'],
  template:
    '<label data-testid="uform-field-stub" :data-field-name="name" :data-field-error="error"><span>{{ label }}</span><slot /><p v-if="help" data-testid="uform-field-help">{{ help }}</p><p v-if="error" data-testid="uform-field-error">{{ error }}</p></label>',
}

const buttonStub = {
  props: ['disabled', 'loading', 'type', 'form', 'color', 'variant', 'label'],
  template:
    '<button v-bind="$attrs" :disabled="disabled" :form="form" :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  emits: ['click'],
}

const inputStub = {
  props: ['modelValue', 'disabled', 'type', 'placeholder', 'size'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :type="type" :placeholder="placeholder" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const textareaStub = {
  props: ['modelValue', 'rows', 'placeholder', 'size'],
  emits: ['update:modelValue'],
  template:
    '<textarea :value="modelValue" :placeholder="placeholder" :rows="rows" data-testid="notes-textarea" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

// ─── Eligible-sales picker stub ──────────────────────────────────────────────
// The stub is rendered through the parent v-model; the parent receives
// update:selected events but the spec drives the model directly on the
// stub instance (via setProps on the wrapper). Exposes a `data-testid` root
// AND a unique marker data attribute so `findComponent` callers can locate it.
const eligibleSalesStub = defineComponent({
  name: 'EligibleSalesPicker',
  props: { modelValue: { type: Array, default: () => [] }, error: { type: String, default: '' } },
  emits: ['update:selected'],
  template:
    '<div data-testid="eligible-sales-picker" data-stub="eligible-sales-picker" :data-count="modelValue.length" :data-error="error"><span>{{ error }}</span></div>',
})

// ─── Driver picker stub ──────────────────────────────────────────────────────
const driverStub = defineComponent({
  name: 'DriverPicker',
  props: { modelValue: { type: [String, null], default: null }, error: { type: String, default: '' } },
  emits: ['update:driverUserId'],
  template:
    '<div data-testid="driver-picker" data-stub="driver-picker" :data-value="modelValue" :data-error="error"><span>{{ error }}</span></div>',
})

const stubs = {
  USlideover: slideoverStub,
  Slideover: slideoverStub,
  UForm: formStub,
  Form: formStub,
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UButton: buttonStub,
  Button: buttonStub,
  UInput: inputStub,
  Input: inputStub,
  UTextarea: textareaStub,
  Textarea: textareaStub,
  USelectMenu: { template: '<div data-testid="uselectmenu-stub"><slot /></div>', props: ['modelValue'], emits: ['update:modelValue'] },
  SelectMenu: { template: '<div data-testid="uselectmenu-stub"><slot /></div>', props: ['modelValue'], emits: ['update:modelValue'] },
  USelect: { template: '<select><option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option></select>', props: ['items'], emits: ['update:modelValue'] },
  Select: { template: '<select><option v-for="i in items" :key="i.value" :value="i.value">{{ i.label }}</option></select>', props: ['items'], emits: ['update:modelValue'] },
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
  // The real pickers are STUBBED so the spec owns the v-model surface.
  EligibleSalesPicker: eligibleSalesStub,
  DriverPicker: driverStub,
}

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

function mountSlideover(props: Record<string, unknown> = {}) {
  setActivePinia(createPinia())
  return mount(DeliveryRouteUpsertSlideover, {
    props: { open: true, mode: 'create', ...props },
    global: { stubs },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})

describe('DeliveryRouteUpsertSlideover — create mode (REQ-DRM-003..006)', () => {
  it('renders the sales picker, driver picker, and notes when mode="create"', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    await flushPromises()
    expect(wrapper.find('[data-testid="eligible-sales-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="driver-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notes-textarea"]').exists()).toBe(true)
  })

  it('hides the sales picker in edit mode (REQ-DRM-007)', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: 'b1111111-1111-4111-8111-111111111111',
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="eligible-sales-picker"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="driver-picker"]').exists()).toBe(true)
  })

  it('emits create with { saleIds, driverUserId } (no notes) after a valid create submission', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    await flushPromises()
    // Drive the v-models directly via the slideover's exposed test handles.
    // The slideover exposes `__testSelectedSaleIds` / `__testSelectedDriverUserId`
    // for the spec to set the local form state without reaching into the picker DOM.
    const vm = wrapper.vm as unknown as {
      __testSelectedSaleIds: { value: string[] }
      __testSelectedDriverUserId: { value: string | null }
    }
    vm.__testSelectedSaleIds.value = ['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222']
    vm.__testSelectedDriverUserId.value = 'b1111111-1111-4111-8111-111111111111'
    await nextTick()
    await wrapper.find('form#create-delivery-route-form').trigger('submit')
    await flushPromises()

    const events = wrapper.emitted('create')
    expect(events).toBeTruthy()
    expect(events!.length).toBeGreaterThanOrEqual(1)
    const lastPayload = events![events!.length - 1]![0] as {
      saleIds: string[]
      driverUserId: string
      notes?: string
    }
    expect(lastPayload.saleIds).toEqual(['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222'])
    expect(lastPayload.driverUserId).toBe('b1111111-1111-4111-8111-111111111111')
    expect(lastPayload.notes).toBeUndefined()
  })

  it('blocks submission when saleIds is empty — inline "Selecciona al menos una venta"', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      __testSelectedDriverUserId: { value: string | null }
    }
    vm.__testSelectedDriverUserId.value = 'b1111111-1111-4111-8111-111111111111'
    await nextTick()
    await wrapper.find('form#create-delivery-route-form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('create')).toBeFalsy()
    expect(wrapper.text()).toMatch(/al menos una venta/i)
  })

  it('blocks submission when driverUserId is empty — inline driver picker error', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      __testSelectedSaleIds: { value: string[] }
    }
    vm.__testSelectedSaleIds.value = ['a1111111-1111-4111-8111-111111111111']
    await nextTick()
    await wrapper.find('form#create-delivery-route-form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('create')).toBeFalsy()
    // The driver picker renders an inline error propagated through the `error` prop.
    const driverPicker = wrapper.find('[data-testid="driver-picker"]')
    expect(driverPicker.attributes('data-error')).toBeTruthy()
  })

  it('blocks submission when notes exceed 280 chars — inline "Máximo 280 caracteres"', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      __testSelectedSaleIds: { value: string[] }
      __testSelectedDriverUserId: { value: string | null }
      __testNotes: { value: string }
    }
    vm.__testSelectedSaleIds.value = ['a1111111-1111-4111-8111-111111111111']
    vm.__testSelectedDriverUserId.value = 'b1111111-1111-4111-8111-111111111111'
    await nextTick()
    const textarea = wrapper.find('[data-testid="notes-textarea"]')
    expect(textarea.exists()).toBe(true)
    const tooLong = 'x'.repeat(281)
    await textarea.setValue(tooLong)
    await nextTick()
    await wrapper.find('form#create-delivery-route-form').trigger('submit')
    await flushPromises()

    expect(wrapper.emitted('create')).toBeFalsy()
    expect(wrapper.text()).toMatch(/280/)
  })
})

describe('DeliveryRouteUpsertSlideover — edit mode (REQ-DRM-007)', () => {
  it('renders the driver picker and notes when mode="edit"', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: 'b1111111-1111-4111-8111-111111111111',
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="driver-picker"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="eligible-sales-picker"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notes-textarea"]').exists()).toBe(true)
  })

  it('prefills notes from initialNotes when provided', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: 'b1111111-1111-4111-8111-111111111111',
    })
    await flushPromises()
    const textarea = wrapper.find('[data-testid="notes-textarea"]')
    expect(textarea.exists()).toBe(true)
    expect((textarea.element as HTMLTextAreaElement).value).toBe('Llevar cambio')
  })

  it('emits edit with { driverUserId, notes } after a valid edit submission', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: 'b1111111-1111-4111-8111-111111111111',
    })
    await flushPromises()
    await wrapper.find('form#edit-delivery-route-form').trigger('submit')
    await flushPromises()

    const events = wrapper.emitted('edit')
    expect(events).toBeTruthy()
    const lastPayload = events![events!.length - 1]![0] as {
      driverUserId?: string
      notes?: string | null
    }
    expect(lastPayload.driverUserId).toBe('b1111111-1111-4111-8111-111111111111')
    expect(lastPayload.notes).toBe('Llevar cambio')
  })

  it('emits edit with notes=null when the user clears the notes field (REQ-DRM-005)', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: 'b1111111-1111-4111-8111-111111111111',
    })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      __testNotes: { value: string }
    }
    vm.__testNotes.value = ''
    await nextTick()
    await wrapper.find('form#edit-delivery-route-form').trigger('submit')
    await flushPromises()

    const events = wrapper.emitted('edit')
    expect(events).toBeTruthy()
    const lastPayload = events![events!.length - 1]![0] as {
      driverUserId?: string
      notes?: string | null
    }
    expect(lastPayload.notes).toBeNull()
  })

  it('blocks submission when driverUserId is empty in edit mode', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: null,
    })
    await flushPromises()
    await wrapper.find('form#edit-delivery-route-form').trigger('submit')
    await flushPromises()
    expect(wrapper.emitted('edit')).toBeFalsy()
    // The driver picker renders an inline error propagated through the `error` prop.
    const driverPicker = wrapper.find('[data-testid="driver-picker"]')
    expect(driverPicker.attributes('data-error')).toBeTruthy()
  })
})

describe('DeliveryRouteUpsertSlideover — payload shape (TRIANGULATE)', () => {
  it('create payload contains ONLY saleIds, driverUserId, notes (whitelist)', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      __testSelectedSaleIds: { value: string[] }
      __testSelectedDriverUserId: { value: string | null }
    }
    vm.__testSelectedSaleIds.value = ['a1111111-1111-4111-8111-111111111111', 'a2222222-2222-4222-8222-222222222222']
    vm.__testSelectedDriverUserId.value = 'b1111111-1111-4111-8111-111111111111'
    await nextTick()
    await wrapper.find('form#create-delivery-route-form').trigger('submit')
    await flushPromises()
    const events = wrapper.emitted('create')
    expect(events).toBeTruthy()
    const lastPayload = events![events!.length - 1]![0] as Record<string, unknown>
    const keys = Object.keys(lastPayload).sort()
    expect(keys.every((k) => ['saleIds', 'driverUserId', 'notes'].includes(k))).toBe(true)
  })

  it('edit payload contains ONLY driverUserId, notes (saleIds MUST NOT appear)', async () => {
    const wrapper = mountSlideover({
      mode: 'edit',
      routeId: 'route-1',
      initialNotes: 'Llevar cambio',
      initialDriverUserId: 'b1111111-1111-4111-8111-111111111111',
    })
    await flushPromises()
    await wrapper.find('form#edit-delivery-route-form').trigger('submit')
    await flushPromises()
    const events = wrapper.emitted('edit')
    expect(events).toBeTruthy()
    const lastPayload = events![events!.length - 1]![0] as Record<string, unknown>
    const keys = Object.keys(lastPayload).sort()
    expect(keys.every((k) => ['driverUserId', 'notes'].includes(k))).toBe(true)
    expect(keys).not.toContain('saleIds')
  })
})
