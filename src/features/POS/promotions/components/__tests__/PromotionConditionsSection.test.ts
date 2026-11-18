import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import PromotionConditionsSection from '../PromotionConditionsSection.vue'
import type { PromotionFormState } from '../../interfaces/promotion.types'
import { getInitialState } from '../../composables/usePromotionForm'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<PromotionFormState> = {}): PromotionFormState {
  return { ...getInitialState('PRODUCT_DISCOUNT'), ...overrides }
}

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

// Full stubs map — render slots so v-if directives evaluate
const FULL_STUBS = {
  UCard: {
    inheritAttrs: false,
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  UCheckbox: {
    inheritAttrs: false,
    props: ['modelValue', 'label'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  URadioGroup: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  UInput: {
    inheritAttrs: false,
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<input v-bind="$attrs" />',
  },
  UFormField: {
    template: '<div><slot /></div>',
  },
  UBadge: {
    template: '<span><slot /></span>',
  },
  UIcon: {
    template: '<span />',
  },
}

function mountSection(
  state: PromotionFormState = makeState(),
  priceLists?: { id: string; name: string }[],
) {
  const queryClient = makeQueryClient()
  if (priceLists) queryClient.setQueryData(['price-lists'], priceLists)
  return mount(PromotionConditionsSection, {
    props: { modelValue: state, mode: 'create' },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: FULL_STUBS,
    },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PromotionConditionsSection', () => {
  it('mounts without error', () => {
    const wrapper = mountSection()
    expect(wrapper.exists()).toBe(true)
  })

  it('renders vigencia section', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="vigencia-section"]').exists()).toBe(true)
  })

  it('renders conditions section', () => {
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="conditions-section"]').exists()).toBe(true)
  })

  it('shows date inputs when hasVigencia is true', () => {
    const wrapper = mountSection(makeState({ hasVigencia: true }))
    expect(wrapper.find('[data-testid="start-date-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="end-date-input"]').exists()).toBe(true)
  })

  it('hides date inputs when hasVigencia is false', () => {
    const wrapper = mountSection(makeState({ hasVigencia: false }))
    expect(wrapper.find('[data-testid="start-date-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="end-date-input"]').exists()).toBe(false)
  })

  it('shows price lists selector when hasPriceLists is true', () => {
    const wrapper = mountSection(makeState({ hasPriceLists: true }))
    expect(wrapper.find('[data-testid="price-lists-select"]').exists()).toBe(true)
  })

  it('hides price lists selector when hasPriceLists is false', () => {
    const wrapper = mountSection(makeState({ hasPriceLists: false }))
    expect(wrapper.find('[data-testid="price-lists-select"]').exists()).toBe(false)
  })

  it('shows days of week checkboxes when hasDaysOfWeek is true', () => {
    const wrapper = mountSection(makeState({ hasDaysOfWeek: true }))
    expect(wrapper.find('[data-testid="days-of-week-section"]').exists()).toBe(true)
  })

  it('hides days of week when hasDaysOfWeek is false', () => {
    const wrapper = mountSection(makeState({ hasDaysOfWeek: false }))
    expect(wrapper.find('[data-testid="days-of-week-section"]').exists()).toBe(false)
  })

  it('shows customer search when customerScope is SPECIFIC', () => {
    const wrapper = mountSection(makeState({ customerScope: 'SPECIFIC' }))
    expect(wrapper.find('[data-testid="customer-search-section"]').exists()).toBe(true)
  })

  it('hides customer search when customerScope is ALL', () => {
    const wrapper = mountSection(makeState({ customerScope: 'ALL' }))
    expect(wrapper.find('[data-testid="customer-search-section"]').exists()).toBe(false)
  })

  it('emits update:modelValue when updateField is called for hasVigencia', async () => {
    const state = makeState({ hasVigencia: false })
    const wrapper = mountSection(state)
    await (
      wrapper.vm as unknown as { updateField: (key: string, value: unknown) => void }
    ).updateField('hasVigencia', true)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    const emitted = wrapper.emitted('update:modelValue') as PromotionFormState[][]
    expect(emitted[0]![0]!.hasVigencia).toBe(true)
  })

  it('emits update:modelValue with all other fields preserved', async () => {
    const state = makeState({ title: 'my-promo', hasVigencia: false })
    const wrapper = mountSection(state)
    await (
      wrapper.vm as unknown as { updateField: (key: string, value: unknown) => void }
    ).updateField('startDate', '2026-06-01')
    const emitted = wrapper.emitted('update:modelValue') as PromotionFormState[][]
    expect(emitted[0]![0]!.title).toBe('my-promo')
    expect(emitted[0]![0]!.startDate).toBe('2026-06-01')
  })

  it('emits update:modelValue when hasPriceLists changes', async () => {
    const state = makeState({ hasPriceLists: false })
    const wrapper = mountSection(state)
    await (
      wrapper.vm as unknown as { updateField: (key: string, value: unknown) => void }
    ).updateField('hasPriceLists', true)
    const emitted = wrapper.emitted('update:modelValue') as PromotionFormState[][]
    expect(emitted[0]![0]!.hasPriceLists).toBe(true)
  })

  // ── Selección sin checkboxes (T4b, S1) ──────────────────────────────────

  describe('switch rows and weekday chips', () => {
    const lastEmit = (wrapper: ReturnType<typeof mountSection>) => {
      const emitted = wrapper.emitted('update:modelValue') as PromotionFormState[][]
      return emitted[emitted.length - 1]![0]!
    }

    it('leaves no checkbox, even with every condition on', () => {
      const wrapper = mountSection(
        makeState({ hasVigencia: true, customerScope: 'SPECIFIC', hasPriceLists: true, hasDaysOfWeek: true }),
      )
      expect(wrapper.findAll('[role="checkbox"], input[type="checkbox"]')).toHaveLength(0)
      expect(wrapper.findComponent({ name: 'UCheckbox' }).exists()).toBe(false)
    })

    it.each([
      ['vigencia-switch', 'Limitar su uso a ciertas fechas'],
      ['customers-switch', 'Limitar a ciertos clientes'],
      ['price-lists-switch', 'Limitar a ciertas listas de precio'],
      ['days-switch', 'Limitar a ciertos días de la semana'],
    ])('%s is a whole-row switch named «%s», off by default', (testId, label) => {
      const row = mountSection().get(`[data-testid="${testId}"]`)
      expect(row.element.tagName).toBe('BUTTON')
      expect(row.attributes('role')).toBe('switch')
      expect(row.attributes('aria-checked')).toBe('false')
      expect(row.text()).toContain(label)
    })

    it('reflects each condition that is on with aria-checked="true"', () => {
      const wrapper = mountSection(
        makeState({ hasVigencia: true, customerScope: 'REGISTERED_ONLY', hasPriceLists: true, hasDaysOfWeek: true }),
      )
      for (const id of ['vigencia-switch', 'customers-switch', 'price-lists-switch', 'days-switch']) {
        expect(wrapper.get(`[data-testid="${id}"]`).attributes('aria-checked')).toBe('true')
      }
    })

    it.each([
      ['vigencia-switch', { hasVigencia: false }, { hasVigencia: true }],
      ['vigencia-switch', { hasVigencia: true }, { hasVigencia: false }],
      ['price-lists-switch', { hasPriceLists: false }, { hasPriceLists: true }],
      ['days-switch', { hasDaysOfWeek: false }, { hasDaysOfWeek: true }],
      ['customers-switch', { customerScope: 'ALL' }, { customerScope: 'REGISTERED_ONLY' }],
      ['customers-switch', { customerScope: 'SPECIFIC' }, { customerScope: 'ALL' }],
    ] as [string, Partial<PromotionFormState>, Partial<PromotionFormState>][])(
      'clicking %s from %j emits exactly %j',
      async (testId, from, patch) => {
        const state = makeState({ title: 'promo', ...from })
        const wrapper = mountSection(state)
        await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
        expect(lastEmit(wrapper)).toEqual({ ...state, ...patch })
      },
    )

    it('chooses the customer scope in a segmented control once limited', async () => {
      const state = makeState({ customerScope: 'REGISTERED_ONLY' })
      const wrapper = mountSection(state)
      const group = wrapper.get('[data-testid="customer-scope"]')
      expect(group.attributes('role')).toBe('radiogroup')
      const radios = group.findAll('[role="radio"]')
      // T8 D5: short segment labels under «Qué clientes» so «Solo clientes regi…» never truncates at 390.
      expect(radios.map((r) => r.text())).toEqual(['Registrados', 'Específicos'])
      expect(radios[0]!.attributes('aria-checked')).toBe('true')
      await radios[1]!.trigger('click')
      expect(lastEmit(wrapper)).toEqual({ ...state, customerScope: 'SPECIFIC' })
    })

    it('shows the seven weekdays as toggle chips with aria-pressed', () => {
      const wrapper = mountSection(makeState({ hasDaysOfWeek: true, daysOfWeek: ['MONDAY', 'FRIDAY'] }))
      const section = wrapper.get('[data-testid="days-of-week-section"]')
      expect(section.attributes('role')).toBe('group')
      const chips = section.findAll('button[aria-pressed]')
      expect(chips).toHaveLength(7)
      const pressed = chips.filter((c) => c.attributes('aria-pressed') === 'true').map((c) => c.attributes('data-value'))
      expect(pressed).toEqual(['MONDAY', 'FRIDAY'])
    })

    it('toggling a weekday chip keeps the previous payload order (appends, removes in place)', async () => {
      const state = makeState({ hasDaysOfWeek: true, daysOfWeek: ['FRIDAY'] })
      const wrapper = mountSection(state)
      await wrapper.get('[data-testid="days-of-week-section"] [data-value="MONDAY"]').trigger('click')
      expect(lastEmit(wrapper)).toEqual({ ...state, daysOfWeek: ['FRIDAY', 'MONDAY'] })

      await wrapper.setProps({ modelValue: { ...state, daysOfWeek: ['FRIDAY', 'MONDAY'] } })
      await wrapper.get('[data-testid="days-of-week-section"] [data-value="FRIDAY"]').trigger('click')
      expect(lastEmit(wrapper)).toEqual({ ...state, daysOfWeek: ['MONDAY'] })
    })

    it('reveals each field inside its condition, not as an indented block', () => {
      const wrapper = mountSection(
        makeState({ hasVigencia: true, customerScope: 'SPECIFIC', hasPriceLists: true, hasDaysOfWeek: true }),
      )
      expect(wrapper.html()).not.toMatch(/\bpl-6\b/)
      expect(wrapper.findAll('.promotions-condition__body').length).toBe(4)
    })

    it('groups the conditions in design-system section cards', () => {
      const wrapper = mountSection()
      for (const id of ['vigencia-section', 'conditions-section']) {
        const card = wrapper.get(`[data-testid="${id}"]`)
        expect(card.element.tagName).toBe('SECTION')
        expect(card.classes()).toContain('hf-section-card')
      }
    })
  })

  // T6d/S1: price lists are a local list, so they are selectable rows (≤ 12)
  // or a multiple HfCombobox (more); customers keep a server-searched USelectMenu.
  describe('multiple pickers (T6d)', () => {
    const lastEmit = (wrapper: ReturnType<typeof mountSection>) => {
      const emitted = wrapper.emitted('update:modelValue') as PromotionFormState[][]
      return emitted[emitted.length - 1]![0]!
    }
    const lists = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `pl-${i + 1}`, name: `Lista ${i + 1}` }))
    const PRICE_ROWS = '[data-testid="price-lists-select"] [role="listbox"][aria-multiselectable="true"]'

    it('shows up to 12 price lists as selectable rows with their selection', () => {
      const wrapper = mountSection(makeState({ hasPriceLists: true, priceListIds: ['pl-2'] }), lists(3))
      const listbox = wrapper.get(PRICE_ROWS)
      expect(listbox.attributes('aria-label')).toBe('Listas de precio')
      const options = listbox.findAll('[role="option"]')
      expect(options.map((o) => o.text())).toEqual(['Lista 1', 'Lista 2', 'Lista 3'])
      expect(options.map((o) => o.attributes('aria-selected'))).toEqual(['false', 'true', 'false'])
      expect(wrapper.text()).toContain('1 de 3 seleccionadas')
      expect(wrapper.findAll('input[type="checkbox"], [role="checkbox"]')).toHaveLength(0)
    })

    it('toggling a price list row keeps the previous payload order (appends, removes in place)', async () => {
      const state = makeState({ hasPriceLists: true, priceListIds: ['pl-3'] })
      const wrapper = mountSection(state, lists(3))
      await wrapper.get(`${PRICE_ROWS} [data-value="pl-1"]`).trigger('click')
      expect(lastEmit(wrapper)).toEqual({ ...state, priceListIds: ['pl-3', 'pl-1'] })

      await wrapper.setProps({ modelValue: { ...state, priceListIds: ['pl-3', 'pl-1'] } })
      await wrapper.get(`${PRICE_ROWS} [data-value="pl-3"]`).trigger('click')
      expect(lastEmit(wrapper)).toEqual({ ...state, priceListIds: ['pl-1'] })
    })

    it('moves to a multiple HfCombobox past 12 price lists', () => {
      const wrapper = mountSection(makeState({ hasPriceLists: true }), lists(13))
      expect(wrapper.find(PRICE_ROWS).exists()).toBe(false)
      const combobox = wrapper.getComponent({ name: 'HfCombobox' })
      expect(combobox.props('multiple')).toBe(true)
      expect(combobox.props('items')).toHaveLength(13)
    })

    it('a price list picked in the combobox keeps the previous payload order', async () => {
      const state = makeState({ hasPriceLists: true, priceListIds: ['pl-9'] })
      const wrapper = mountSection(state, lists(13))
      wrapper.getComponent({ name: 'HfCombobox' }).vm.$emit('update:modelValue', ['pl-2', 'pl-9'])
      expect(lastEmit(wrapper)).toEqual({ ...state, priceListIds: ['pl-9', 'pl-2'] })
    })

    it('still says it is loading before the price lists arrive', () => {
      const wrapper = mountSection(makeState({ hasPriceLists: true }))
      expect(wrapper.get('[data-testid="price-lists-select"]').text()).toContain('Cargando listas de precio')
    })

    it('searches customers on the server: the typed term reaches the query and the menu does not filter', async () => {
      const wrapper = mountSection(makeState({ customerScope: 'SPECIFIC' }))
      const menu = wrapper
        .get('[data-testid="customer-search-section"]')
        .findComponent({ name: 'SelectMenu' })
      expect(menu.props('multiple')).toBe(true)
      expect(menu.props('ignoreFilter')).toBe(true)
      menu.vm.$emit('update:searchTerm', 'ana')
      await wrapper.vm.$nextTick()
      expect(menu.props('searchTerm')).toBe('ana')
    })
  })
})
