import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import DataTableFilters from '../DataTableFilters.vue'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'

const desktopRef = ref(true)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return {
    ...actual,
    useBreakpoints: () => ({ greaterOrEqual: () => desktopRef }),
  }
})

const schema = defineFiltersSchema([
  filter.multiText({ id: 'folio', label: 'Folio', param: 'folio' }),
  filter.multiEnum({
    id: 'paymentMethod',
    label: 'Método',
    section: 'Cobro',
    param: 'paymentMethod',
    options: [{ label: 'Tarjeta débito', value: 'CARD_DEBIT' }],
    includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' },
  }),
  filter.multiAsync({ id: 'sellerIds', label: 'Vendedor', section: 'Cobro', param: 'sellerIds', options: [{ label: 'Ana', value: 'seller-1' }] }),
  filter.numericRange({ id: 'total', label: 'Total', section: 'Montos', minParam: 'totalMin', maxParam: 'totalMax', formatAs: 'currency' }),
  filter.dateRange({ id: 'confirmedAt', label: 'Fecha', section: 'Fecha', fromParam: 'from', toParam: 'to' }),
])

const baseStubs = {
  UIcon: true,
  UBadge: { template: '<span :data-testid="$attrs[\'data-testid\']">{{ label }}<slot /></span>', props: ['label'] },
  UButton: { template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>' },
  USlideover: { props: ['open', 'side', 'ui'], template: '<div data-testid="slideover" :data-open="String(open)" :data-side="side" :data-ui="ui ? JSON.stringify(ui) : \'\'"><slot name="content" /></div>' },
  Icon: true,
  Badge: { template: '<span :data-testid="$attrs[\'data-testid\']">{{ label }}<slot /></span>', props: ['label'] },
  Button: { template: '<button :data-testid="$attrs[\'data-testid\']" @click="$emit(\'click\')"><slot /></button>' },
  Slideover: { props: ['open', 'side', 'ui'], template: '<div data-testid="slideover" :data-open="String(open)" :data-side="side" :data-ui="ui ? JSON.stringify(ui) : \'\'"><slot name="content" /></div>' },
  MultiSelectEnumFilter: {
    name: 'MultiSelectEnumFilter',
    template:
      '<div data-testid="primitive-enum" :data-is-active="String(!!isActive)" :data-portal-class="portalClass ?? \'\'" />',
    props: ['error', 'displayDivisor', 'isActive', 'portalClass'],
  },
  MultiSelectAsyncFilter: {
    name: 'MultiSelectAsyncFilter',
    template: '<div data-testid="primitive-async" :data-portal-class="portalClass ?? \'\'" />',
    props: ['portalClass'],
  },
  MultiTextInputFilter: {
    name: 'MultiTextInputFilter',
    template: '<div data-testid="primitive-text" :data-portal-class="portalClass ?? \'\'" />',
    props: ['portalClass'],
  },
  NumericRangeFilter: {
    name: 'NumericRangeFilter',
    template: '<div data-testid="primitive-numeric" :data-portal-class="portalClass ?? \'\'" />',
    props: ['displayDivisor', 'error', 'portalClass'],
  },
  DateRangeFilter: {
    name: 'DateRangeFilter',
    template: '<div data-testid="primitive-date" :data-portal-class="portalClass ?? \'\'" />',
    props: ['portalClass'],
  },
  DataTableFiltersChips: { template: '<div data-testid="chips-stub" />' },
}

describe('DataTableFilters (v2)', () => {
  it('renders trigger, count badge, header actions and responsive side', async () => {
    desktopRef.value = true
    const state = { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] }
    const wrapper = mount(DataTableFilters, { props: { schema, state }, global: { stubs: baseStubs } })

    expect(wrapper.find('[data-testid="filters-trigger"]').text()).toContain('Filtros')
    expect(wrapper.find('[data-testid="filters-trigger-count"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-side')).toBe('right')

    await wrapper.find('[data-testid="filters-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')
    expect(wrapper.find('[data-testid="filters-header"]').text()).toContain('Filtros')
    expect(wrapper.find('[data-testid="clear-all-button"]').exists()).toBe(true)

    desktopRef.value = false
    const mobile = mount(DataTableFilters, { props: { schema, state: schema.defaults() }, global: { stubs: baseStubs } })
    expect(mobile.find('[data-testid="slideover"]').attributes('data-side')).toBe('bottom')
  })

  it('applies bottom-sheet ui overrides only on mobile', () => {
    desktopRef.value = true
    const desktop = mount(DataTableFilters, { props: { schema, state: schema.defaults() }, global: { stubs: baseStubs } })
    expect(desktop.find('[data-testid="slideover"]').attributes('data-ui')).toBe('{}')

    desktopRef.value = false
    const mobile = mount(DataTableFilters, { props: { schema, state: schema.defaults() }, global: { stubs: baseStubs } })
    const mobileUi = mobile.find('[data-testid="slideover"]').attributes('data-ui') ?? ''
    expect(mobileUi).toContain('h-[85vh]')
    expect(mobileUi).toContain('max-h-[85vh]')
    expect(mobileUi).toContain('rounded-t-2xl')
  })

  it('groups fields by section, no-section first, marks active filters on the primitive', () => {
    // The section dot was removed when the chips row left the header — active
    // filters are now marked by `is-active=true` on the primitive itself, so
    // it can render a primary ring around the input/select.
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] } },
      global: { stubs: baseStubs },
    })

    const groups = wrapper.findAll('[data-testid^="section-group-"]')
    expect(groups[0]?.attributes('data-testid')).toBe('section-group-__no_section__')
    expect(wrapper.find('[data-testid="section-dot-Cobro"]').exists()).toBe(false)
    // The "Cobro" group holds the paymentMethod enum filter; its primitive
    // must receive isActive=true so the visual ring lands on it.
    const cobroEnum = wrapper.find('[data-testid="primitive-enum"]')
    expect(cobroEnum.attributes('data-is-active')).toBe('true')
  })

  it('renders correct primitive per kind, passes errors, clear all resets defaults', async () => {
    const wrapper = mount(DataTableFilters, {
      props: {
        schema,
        state: { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'], total: { min: 100 } },
        errors: { paymentMethod: 'Error método' },
      },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="primitive-enum"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-async"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-text"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-numeric"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="primitive-date"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'MultiSelectEnumFilter' }).props('error')).toBe('Error método')
    expect(wrapper.findComponent({ name: 'NumericRangeFilter' }).props('displayDivisor')).toBe(100)

    await wrapper.find('[data-testid="clear-all-button"]').trigger('click')
    const updates = wrapper.emitted('update:state') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual(schema.defaults())
  })

  it('close button closes slideover without mutating state', async () => {
    const state = { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] }
    const wrapper = mount(DataTableFilters, { props: { schema, state }, global: { stubs: baseStubs } })

    await wrapper.find('[data-testid="filters-trigger"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('true')
    await wrapper.find('[data-testid="close-filters"]').trigger('click')
    expect(wrapper.find('[data-testid="slideover"]').attributes('data-open')).toBe('false')
    expect(wrapper.emitted('update:state')).toBeUndefined()
  })

  // ── embedded mode (REQ-5 / WU-1) ──────────────────────────────────────────
  // When embedded, the wrapper DataTableToolbar owns the slideover; this
  // component renders only its filter sections + chips inside that sheet.
  // The trigger button and the own slideover MUST NOT render, and the
  // exposed open()/close() controls MUST be no-ops so a stale caller cannot
  // accidentally toggle a hidden sheet.

  it('embedded=true renders only the embedded filter surface (no trigger, no slideover)', () => {
    const state = { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] }
    const wrapper = mount(DataTableFilters, {
      props: { schema, state, embedded: true },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="data-table-filters-embedded"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="filters-trigger"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)
  })

  it('embedded=true: exposed open()/close() are no-ops (slideover state stays closed)', async () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), embedded: true },
      global: { stubs: baseStubs },
    })

    // Pre-condition: in embedded mode there is no slideover at all, so calling
    // open()/close() must not throw or attempt to mount one.
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)

    const vm = wrapper.vm as unknown as { open: () => void, close: () => void }
    vm.open()
    vm.close()
    await wrapper.vm.$nextTick()

    // Still no slideover — embedded mode owns nothing that should be toggled.
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)
  })

  it('embedded unset preserves current standalone trigger + slideover behaviour', () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults() },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="filters-trigger"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(true)
    // The embedded marker MUST NOT render when the prop is omitted/false.
    expect(wrapper.find('[data-testid="data-table-filters-embedded"]').exists()).toBe(false)
  })
})

// ── T5: bounded optional portal opt-in ──────────────────────────────────────
// `portalClass` is additive: absent keeps the exact prior slideover ui and the
// exact prior primitive props. Present forwards the marker to the slideover
// content and to the three popup primitives in BOTH render paths.

describe('DataTableFilters — optional portal opt-in (T5/S3/S4)', () => {
  const MARKER = 'hf-theme hf-ui quotations-list-portal'

  function slideoverUi(wrapper: ReturnType<typeof mount>): Record<string, unknown> {
    const raw = wrapper.find('[data-testid="slideover"]').attributes('data-ui') ?? '{}'
    return JSON.parse(raw) as Record<string, unknown>
  }

  it('keeps the exact prior slideover ui when portalClass is absent', () => {
    desktopRef.value = true
    const desktop = mount(DataTableFilters, {
      props: { schema, state: schema.defaults() },
      global: { stubs: baseStubs },
    })
    expect(slideoverUi(desktop)).toEqual({})

    desktopRef.value = false
    const mobile = mount(DataTableFilters, {
      props: { schema, state: schema.defaults() },
      global: { stubs: baseStubs },
    })
    expect(slideoverUi(mobile)).toEqual({ content: 'h-[85vh] max-h-[85vh] rounded-t-2xl' })
  })

  it('opts the standalone slideover in and keeps the mobile sheet classes', () => {
    desktopRef.value = true
    const desktop = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), portalClass: MARKER },
      global: { stubs: baseStubs },
    })
    expect(slideoverUi(desktop)).toEqual({ content: MARKER })

    desktopRef.value = false
    const mobile = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), portalClass: MARKER },
      global: { stubs: baseStubs },
    })
    const content = String(slideoverUi(mobile).content ?? '')
    expect(content).toContain('h-[85vh]')
    expect(content).toContain('max-h-[85vh]')
    expect(content).toContain('rounded-t-2xl')
    expect(content).toContain(MARKER)
  })

  it('forwards portalClass to exactly the enum/async/date popup primitives in the standalone path', () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), portalClass: MARKER },
      global: { stubs: baseStubs },
    })

    const popupPrimitives = ['primitive-enum', 'primitive-async', 'primitive-date']
    for (const testid of popupPrimitives) {
      expect(wrapper.get(`[data-testid="${testid}"]`).attributes('data-portal-class')).toBe(MARKER)
    }
    // Non-popup primitives are deliberately untouched.
    for (const testid of ['primitive-text', 'primitive-numeric']) {
      expect(wrapper.get(`[data-testid="${testid}"]`).attributes('data-portal-class')).toBe('')
    }
  })

  it('forwards portalClass in the embedded path without creating a second slideover', async () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), embedded: true, portalClass: MARKER },
      global: { stubs: baseStubs },
    })

    expect(wrapper.find('[data-testid="data-table-filters-embedded"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)

    const popupPrimitives = ['primitive-enum', 'primitive-async', 'primitive-date']
    for (const testid of popupPrimitives) {
      expect(wrapper.get(`[data-testid="${testid}"]`).attributes('data-portal-class')).toBe(MARKER)
    }

    const vm = wrapper.vm as unknown as { open: () => void; close: () => void }
    vm.open()
    vm.close()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="slideover"]').exists()).toBe(false)
  })

  it('keeps error/isActive wiring unchanged while portalClass is forwarded', () => {
    const wrapper = mount(DataTableFilters, {
      props: {
        schema,
        state: { ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] },
        errors: { paymentMethod: 'Error método' },
        embedded: true,
        portalClass: MARKER,
      },
      global: { stubs: baseStubs },
    })

    const enumPrimitive = wrapper.findComponent({ name: 'MultiSelectEnumFilter' })
    expect(wrapper.get('[data-testid="primitive-enum"]').attributes('data-is-active')).toBe('true')
    expect(enumPrimitive.props('error')).toBe('Error método')
    expect(enumPrimitive.props('portalClass')).toBe(MARKER)
  })

  it('never forwards an empty portal boundary when portalClass is absent', () => {
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), embedded: true },
      global: { stubs: baseStubs },
    })

    for (const testid of ['primitive-enum', 'primitive-async', 'primitive-date']) {
      expect(wrapper.get(`[data-testid="${testid}"]`).attributes('data-portal-class')).toBe('')
    }
  })

  it('keeps the opt-in off the wrapper surface itself (teleported content only)', () => {
    desktopRef.value = true
    const wrapper = mount(DataTableFilters, {
      props: { schema, state: schema.defaults(), portalClass: MARKER },
      global: { stubs: baseStubs },
    })

    expect(wrapper.element.classList.contains('hf-theme')).toBe(false)
    expect(wrapper.element.classList.contains('hf-ui')).toBe(false)
    expect(wrapper.element.classList.contains('quotations-list-portal')).toBe(false)
  })
})
