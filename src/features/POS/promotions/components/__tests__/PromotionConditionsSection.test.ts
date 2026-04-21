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

function mountSection(state: PromotionFormState = makeState()) {
  const queryClient = makeQueryClient()
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
})
