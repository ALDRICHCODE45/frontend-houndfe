import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PromotionCapacityStatus from '../PromotionCapacityStatus.vue'

// The status surface is presentational and reuses the shared `StatusBadge`
// (rendered for real: it has no runtime dependencies unless `urgent`).
function mountStatus(props: Record<string, unknown>) {
  return mount(PromotionCapacityStatus, { props })
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

  it('in list rows (hide-unlimited) an unlimited cap with consumption says only the consumption, short', () => {
    const many = mountStatus({
      maxProductUnits: null,
      consumedProductUnits: 113,
      remainingProductUnits: null,
      hideUnlimited: true,
    })
    expect(many.attributes('data-state')).toBe('unlimited_consumed')
    expect(many.text()).toBe('113 consumidas')
    // The full reading stays on the accessible label.
    expect(many.attributes('aria-label')).toContain('ilimitado')

    const one = mountStatus({
      maxProductUnits: null,
      consumedProductUnits: 1,
      remainingProductUnits: null,
      hideUnlimited: true,
    })
    expect(one.text()).toBe('1 consumida')
  })

  it('outside list rows an unlimited cap with consumption keeps «Sin límite»', () => {
    const wrapper = mountStatus({
      maxProductUnits: null,
      consumedProductUnits: 113,
      remainingProductUnits: null,
    })
    expect(wrapper.text()).toBe('Sin límite · 113 unidades consumidas')
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

  it.each([
    ['unlimited', { maxProductUnits: null, consumedProductUnits: 0, remainingProductUnits: null }, 'neutral'],
    ['available', { maxProductUnits: 100, consumedProductUnits: 10, remainingProductUnits: 90 }, 'success'],
    ['near_limit', { maxProductUnits: 100, consumedProductUnits: 80, remainingProductUnits: 20 }, 'warning'],
    ['exhausted', { maxProductUnits: 10, consumedProductUnits: 10, remainingProductUnits: 0 }, 'danger'],
  ])('paints the %s state with the %s StatusBadge tone', (_state, props, tone) => {
    const badge = mountStatus(props).get('.hf-status-badge')
    expect(badge.attributes('data-tone')).toBe(tone)
  })
})
