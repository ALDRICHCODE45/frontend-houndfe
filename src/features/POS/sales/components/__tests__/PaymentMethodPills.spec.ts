import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentMethodPills from '../PaymentMethodPills.vue'

const badgeStub = {
  props: ['color', 'variant', 'size', 'icon', 'ariaLabel'],
  template: `<span data-testid="badge" :data-color="color" :data-icon="icon" :aria-label="ariaLabel"><slot /></span>`,
}

const tooltipStub = {
  props: ['text'],
  template: `<div data-testid="tooltip" :data-text="text"><slot /></div>`,
}

// Minimal stubs for Nuxt UI components used inside PaymentMethodPills
const globalConfig = {
  stubs: {
    UBadge: badgeStub,
    Badge: badgeStub,
    UTooltip: tooltipStub,
    Tooltip: tooltipStub,
  },
}

describe('PaymentMethodPills', () => {
  it('renders em-dash when methods array is empty', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: [] },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('—')
    expect(wrapper.findAll('[data-testid="badge"]')).toHaveLength(0)
  })

  it('renders exactly 1 pill with no overflow for single method', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH'] },
      global: globalConfig,
    })
    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges).toHaveLength(1)
    expect(wrapper.find('[data-testid="tooltip"]').exists()).toBe(false)
  })

  it('renders exactly 2 pills with no overflow for two methods', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH', 'CARD_DEBIT'] },
      global: globalConfig,
    })
    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges).toHaveLength(2)
    expect(wrapper.find('[data-testid="tooltip"]').exists()).toBe(false)
  })

  it('renders 2 visible pills + overflow chip "+1" for 3 methods', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH', 'CARD_DEBIT', 'TRANSFER'] },
      global: globalConfig,
    })
    // 2 visible pills + 1 overflow badge = 3 badges total (overflow badge is inside tooltip)
    const tooltip = wrapper.find('[data-testid="tooltip"]')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('+1')
  })

  it('renders 2 visible pills + overflow chip "+3" for 5 methods', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH', 'CARD_DEBIT', 'TRANSFER', 'CARD_CREDIT', 'CREDIT'] },
      global: globalConfig,
    })
    const tooltip = wrapper.find('[data-testid="tooltip"]')
    expect(tooltip.exists()).toBe(true)
    expect(tooltip.text()).toContain('+3')
  })

  it('overflow chip aria-label includes hidden method names', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH', 'CARD_DEBIT', 'TRANSFER'] },
      global: globalConfig,
    })
    const tooltip = wrapper.find('[data-testid="tooltip"]')
    expect(tooltip.exists()).toBe(true)
    // The overflow badge inside the tooltip must carry an aria-label with hidden labels
    const overflowBadge = tooltip.find('[data-testid="badge"]')
    expect(overflowBadge.attributes('aria-label')).toContain('Transferencia')
  })

  it('CASH pill uses success color', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH'] },
      global: globalConfig,
    })
    const badge = wrapper.find('[data-testid="badge"]')
    expect(badge.attributes('data-color')).toBe('success')
  })

  it('CARD_DEBIT pill uses warning color', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CARD_DEBIT'] },
      global: globalConfig,
    })
    const badge = wrapper.find('[data-testid="badge"]')
    expect(badge.attributes('data-color')).toBe('warning')
  })

  it('CREDIT pill uses error color', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CREDIT'] },
      global: globalConfig,
    })
    const badge = wrapper.find('[data-testid="badge"]')
    expect(badge.attributes('data-color')).toBe('error')
  })

  it('renders only icon text when compact prop is true', () => {
    const wrapper = mount(PaymentMethodPills, {
      props: { methods: ['CASH'], compact: true },
      global: globalConfig,
    })
    // Label span should have class that hides it when compact
    const labelSpan = wrapper.find('[data-testid="pill-label"]')
    expect(labelSpan.exists()).toBe(true)
    expect(labelSpan.classes()).toContain('hidden')
  })
})
