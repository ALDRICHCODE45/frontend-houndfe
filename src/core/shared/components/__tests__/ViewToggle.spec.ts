import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ViewToggle from '../ViewToggle.vue'

// S1 contract tests (mobile-dashboard-list-density). jsdom asserts class,
// attribute, and emit contracts only — the ≥44×44 CSS px touch-target
// geometry itself is rendered-verification work and is never claimed from
// jsdom.

const CUSTOM_OPTIONS = [
  { value: 'list', label: 'Lista', icon: 'i-lucide-list' },
  { value: 'grid', label: 'Cuadrícula', icon: 'i-lucide-grid' },
]

function mountToggle(propsOverride: Record<string, unknown> = {}) {
  return mount(ViewToggle, { props: { modelValue: 'table', ...propsOverride } })
}

/** Native button + 44px floor + compact padding + semantic focus outline + label. */
function expectTabTargetContract(tab: {
  classes: () => string[]
  attributes: () => Record<string, unknown>
  text: () => string
}) {
  expect(tab.attributes().type).toBe('button')
  expect(tab.classes()).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11', 'px-3']))
  expect(tab.classes().some(c => c.includes('focus-visible:outline'))).toBe(true)
  // The control must not become icon-only.
  expect(tab.text().trim().length).toBeGreaterThan(0)
}

describe('ViewToggle — unchanged segmented-control contract', () => {
  it('renders a labeled tablist with both visible default labels', () => {
    const wrapper = mountToggle()
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Seleccionar vista')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]!.text()).toContain('Tabla')
    expect(tabs[1]!.text()).toContain('Tarjetas')
  })

  it('reflects aria-selected from modelValue and emits update:modelValue on click', async () => {
    const wrapper = mountToggle({ modelValue: 'card' })
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0]!.attributes('aria-selected')).toBe('false')
    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
    await tabs[1]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['card']])
  })

  it('supports custom options, custom ariaLabel, and emits their values', async () => {
    const wrapper = mountToggle({
      modelValue: 'grid',
      ariaLabel: 'Vista de inventario',
      options: CUSTOM_OPTIONS,
    })
    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('Vista de inventario')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(tabs[0]!.text()).toContain('Lista')
    expect(tabs[1]!.attributes('aria-selected')).toBe('true')
    await tabs[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['list']])
  })

  it('emits on every activation and keeps selection until the parent updates', async () => {
    const wrapper = mountToggle()
    const tabs = wrapper.findAll('[role="tab"]')
    await tabs[0]!.trigger('click')
    await tabs[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['table'], ['table']])
  })
})

describe('ViewToggle — accessibility, touch targets, and containment (S1)', () => {
  it('keeps every tab a native 44px keyboard-activatable labeled target with visible focus', () => {
    for (const options of [undefined, CUSTOM_OPTIONS]) {
      const wrapper = mountToggle(options ? { options } : {})
      for (const tab of wrapper.findAll('[role="tab"]')) {
        expectTabTargetContract(tab)
      }
    }
  })

  it('contains the control with max-w-full min-w-0 on the root', () => {
    const classes = mountToggle().get('[role="tablist"]').classes()
    expect(classes).toEqual(expect.arrayContaining(['max-w-full', 'min-w-0']))
  })
})
