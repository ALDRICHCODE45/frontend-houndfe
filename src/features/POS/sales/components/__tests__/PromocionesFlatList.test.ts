import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PromocionesFlatList from '../PromocionesFlatList.vue'
import type { ApplicablePromotion } from '../../interfaces/sale.types'

const stubs = {
  UButton: {
    props: ['disabled', 'loading', 'label', 'icon', 'size', 'color', 'variant', 'ariaLabel'],
    emits: ['click'],
    template: '<button :disabled="disabled" :aria-label="ariaLabel" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  UIcon: { template: '<i />' },
  USkeleton: { template: '<div class="skeleton" />' },
  AppBadge: {
    name: 'AppBadge',
    props: ['label', 'tone', 'icon', 'variant'],
    template: '<span>{{ label }}</span>',
  },
}

function makePromo(overrides: Partial<ApplicablePromotion> = {}): ApplicablePromotion {
  return {
    id: 'promo-1',
    title: '2x1 Pawfect Bites',
    type: 'PRODUCT_DISCOUNT',
    ...overrides,
  }
}

function mountComponent(props: {
  promotions: ApplicablePromotion[]
  loading?: boolean
  appliedIds?: string[]
}) {
  return mount(PromocionesFlatList, {
    props: {
      loading: false,
      appliedIds: [],
      ...props,
    },
    global: { stubs },
  })
}

describe('PromocionesFlatList', () => {
  it('renders promo card title', () => {
    const wrapper = mountComponent({
      promotions: [makePromo({ title: '2x1 Pawfect Bites' })],
    })

    expect(wrapper.text()).toContain('2x1 Pawfect Bites')
  })

  it('renders Aplicar button for unapplied promo', () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
    })

    expect(wrapper.text()).toContain('Aplicar')
  })

  it('renders X remove button for applied promo', () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
      appliedIds: ['promo-1'],
    })

    expect(wrapper.text()).toContain('Quitar')
  })

  it('emits apply when Aplicar button is clicked', async () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
    })

    const applyBtn = wrapper.find('[data-testid="promo-apply-promo-1"]')
    expect(applyBtn.exists()).toBe(true)
    await applyBtn.trigger('click')

    expect(wrapper.emitted('apply')).toBeTruthy()
    expect(wrapper.emitted('apply')?.[0]).toEqual(['promo-1'])
  })

  it('emits remove when Quitar button is clicked', async () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
      appliedIds: ['promo-1'],
    })

    const removeBtn = wrapper.find('[data-testid="promo-remove-promo-1"]')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')?.[0]).toEqual(['promo-1'])
  })

  it('adds applied style (green border) when promo is applied', () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
      appliedIds: ['promo-1'],
    })

    const card = wrapper.find('[data-testid="promo-card-promo-1"]')
    expect(card.classes()).toContain('border-l-success')
  })

  it('renders disabled Aplicar when promo.eligible is false', () => {
    const wrapper = mountComponent({
      promotions: [makePromo({ eligible: false })],
    })

    const btn = wrapper.find('[data-testid="promo-apply-promo-1"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('renders loading skeletons when loading is true', () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
      loading: true,
    })

    // Loading state replaces card list with skeleton placeholders
    expect(wrapper.find('[data-testid="promociones-loading"]').exists()).toBe(true)
  })

  it('renders nothing when promotions array is empty', () => {
    const wrapper = mountComponent({
      promotions: [],
    })

    expect(wrapper.find('[data-testid="promociones-flat-list"]').exists()).toBe(false)
  })

  it('renders BXGY hint when unitsNeeded is present', () => {
    const wrapper = mountComponent({
      promotions: [makePromo({ type: 'BUY_X_GET_Y', unitsNeeded: 3 })],
    })

    expect(wrapper.text()).toContain('requiere 3 unidades más')
  })

  it('renders multiple promos as separate cards', () => {
    const wrapper = mountComponent({
      promotions: [
        makePromo({ id: 'p1', title: 'Promo A' }),
        makePromo({ id: 'p2', title: 'Promo B' }),
      ],
      appliedIds: ['p1'],
    })

    expect(wrapper.text()).toContain('Promo A')
    expect(wrapper.text()).toContain('Promo B')
  })

  it('applies section header text when promos exist', () => {
    const wrapper = mountComponent({
      promotions: [makePromo()],
    })

    expect(wrapper.text()).toContain('Promociones disponibles')
  })
})
