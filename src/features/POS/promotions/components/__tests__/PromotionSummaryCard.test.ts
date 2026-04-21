import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  buildPromotionSummaryBullets,
} from '../../utils/promotionSummary.utils'
import type { PromotionFormState } from '../../interfaces/promotion.types'
import { getInitialState } from '../../composables/usePromotionForm'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<PromotionFormState> = {}): PromotionFormState {
  return { ...getInitialState('PRODUCT_DISCOUNT'), ...overrides }
}

// ── Pure logic tests ──────────────────────────────────────────────────────────

describe('buildPromotionSummaryBullets', () => {
  it('includes automatic method bullet', () => {
    const state = makeState({ method: 'AUTOMATIC' })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets).toContain('Se aplicará automáticamente en el Punto de Venta')
  })

  it('includes manual method bullet', () => {
    const state = makeState({ method: 'MANUAL' })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets).toContain('Se aplica manualmente')
  })

  it('includes percentage discount bullet for PRODUCT_DISCOUNT', () => {
    const state = makeState({
      type: 'PRODUCT_DISCOUNT',
      discountType: 'PERCENTAGE',
      discountValue: 10,
    })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.includes('10%') && b.includes('descuento'))).toBe(true)
  })

  it('includes fixed discount bullet for ORDER_DISCOUNT', () => {
    const state = makeState({
      type: 'ORDER_DISCOUNT',
      discountType: 'FIXED',
      discountValue: 500,
    })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.includes('$500') && b.includes('descuento'))).toBe(true)
  })

  it('includes target names when items are selected', () => {
    const state = makeState({
      type: 'PRODUCT_DISCOUNT',
      targetItems: [
        { targetId: 'p1', name: 'Camisa' },
        { targetId: 'p2', name: 'Zapato' },
      ],
    })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.includes('Camisa') && b.includes('Zapato'))).toBe(true)
  })

  it('includes date range when vigencia is set', () => {
    const state = makeState({
      hasVigencia: true,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.includes('2026'))).toBe(true)
  })

  it('does not include date range when hasVigencia is false', () => {
    const state = makeState({ hasVigencia: false })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.toLowerCase().includes('vigente'))).toBe(false)
  })

  it('includes BUY_X_GET_Y preset label when detected', () => {
    const state = makeState({
      type: 'BUY_X_GET_Y',
      buyQuantity: 2,
      getQuantity: 1,
      getDiscountPercent: 0,
    })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.includes('2') && b.includes('1'))).toBe(true)
  })

  it('includes customer scope bullet when not ALL', () => {
    const state = makeState({ customerScope: 'REGISTERED_ONLY' })
    const bullets = buildPromotionSummaryBullets(state)
    expect(bullets.some((b) => b.toLowerCase().includes('registrado'))).toBe(true)
  })
})

// ── Component tests ───────────────────────────────────────────────────────────

import PromotionSummaryCard from '../PromotionSummaryCard.vue'

const STUBS = {
  UCard: {
    inheritAttrs: false,
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  UIcon: { template: '<span />' },
}

describe('PromotionSummaryCard component', () => {
  it('renders summary section', () => {
    const state = makeState({ method: 'AUTOMATIC' })
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: state },
      global: { stubs: STUBS },
    })
    expect(wrapper.find('[data-testid="summary-list"]').exists()).toBe(true)
  })

  it('shows method bullet in rendered output', () => {
    const state = makeState({ method: 'AUTOMATIC' })
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: state },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toContain('automáticamente')
  })

  it('shows discount info for PRODUCT_DISCOUNT with percentage', () => {
    const state = makeState({
      type: 'PRODUCT_DISCOUNT',
      method: 'AUTOMATIC',
      discountType: 'PERCENTAGE',
      discountValue: 15,
    })
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: state },
      global: { stubs: STUBS },
    })
    expect(wrapper.text()).toContain('15%')
  })
})
