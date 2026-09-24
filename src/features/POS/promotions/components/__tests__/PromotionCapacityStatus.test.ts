import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromotionCapacityStatus from '../PromotionCapacityStatus.vue'

// ── Stubs ─────────────────────────────────────────────────────────────────────
//
// The status surface is presentational and must reuse `AppBadge`, which itself
// delegates to Nuxt UI's `UBadge`. Stubbing keeps this suite focused on the
// server-owned state mapping instead of Nuxt UI rendering internals.
const STUBS = {
  AppBadge: {
    inheritAttrs: false,
    props: ['label', 'tone', 'icon', 'variant'],
    template:
      '<span data-testid="app-badge" :data-tone="tone" :data-icon="icon">{{ label }}</span>',
  },
}

function mountStatus(props: Record<string, unknown>) {
  return mount(PromotionCapacityStatus, { props, global: { stubs: STUBS } })
}

describe('PromotionCapacityStatus', () => {
  it('renders unlimited when the cap is null', () => {
    const wrapper = mountStatus({
      maxProductUnits: null,
      consumedProductUnits: 0,
      remainingProductUnits: null,
    })
    expect(wrapper.attributes('data-state')).toBe('unlimited')
    expect(wrapper.text()).toContain('Sin límite')
  })

  it('renders stale when the required counters are absent (never unlimited)', () => {
    const wrapper = mountStatus({})
    expect(wrapper.attributes('data-state')).toBe('stale')
  })

  it('reports an honest accessible label for an unlimited cap (never desconocido)', () => {
    const wrapper = mountStatus({
      maxProductUnits: null,
      consumedProductUnits: 0,
      remainingProductUnits: null,
    })
    const label = wrapper.attributes('aria-label') ?? ''
    expect(label).toContain('sin límite')
    expect(label).not.toContain('desconocido')
  })

  it('renders available with the server remaining value', () => {
    const wrapper = mountStatus({
      maxProductUnits: 100,
      consumedProductUnits: 10,
      remainingProductUnits: 90,
    })
    expect(wrapper.attributes('data-state')).toBe('available')
    expect(wrapper.text()).toContain('90')
  })

  it('renders near_limit at 80% consumption', () => {
    const wrapper = mountStatus({
      maxProductUnits: 100,
      consumedProductUnits: 80,
      remainingProductUnits: 20,
    })
    expect(wrapper.attributes('data-state')).toBe('near_limit')
    expect(wrapper.text()).toContain('20')
  })

  it('renders exhausted when remaining is 0', () => {
    const wrapper = mountStatus({
      maxProductUnits: 10,
      consumedProductUnits: 10,
      remainingProductUnits: 0,
    })
    expect(wrapper.attributes('data-state')).toBe('exhausted')
    expect(wrapper.text()).toContain('Sin cupo')
  })

  it('renders stale on inconsistent server values without crashing', () => {
    const wrapper = mountStatus({
      maxProductUnits: 100,
      consumedProductUnits: 80,
      remainingProductUnits: null,
    })
    expect(wrapper.attributes('data-state')).toBe('stale')
    expect(wrapper.text()).toContain('desactualizados')
  })

  it('renders stale on missing/garbage values without throwing', () => {
    const wrapper = mountStatus({
      maxProductUnits: 'oops' as unknown as number,
      consumedProductUnits: undefined,
      remainingProductUnits: Number.NaN,
    })
    expect(wrapper.attributes('data-state')).toBe('stale')
  })

  it('exposes a descriptive accessible label', () => {
    const wrapper = mountStatus({
      maxProductUnits: 100,
      consumedProductUnits: 25,
      remainingProductUnits: 75,
    })
    expect(wrapper.attributes('aria-label')).toContain('75')
  })
})
