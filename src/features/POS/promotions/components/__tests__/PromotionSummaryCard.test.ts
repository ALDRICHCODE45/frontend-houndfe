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

  // T6d/S2: the summary is a design-system section card, not a UCard.
  it('is an HfSectionCard titled «Resumen» that keeps the sticky rail at lg only', () => {
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: makeState({ method: 'AUTOMATIC' }) },
      global: { stubs: { UIcon: { template: '<span />' } } },
    })
    const card = wrapper.get('section.hf-section-card')
    expect(card.attributes('data-testid')).toBe('summary-card')
    // T8 D5: below lg the card follows the form in the stacked column, so it is not sticky there.
    expect(card.classes()).toEqual(expect.arrayContaining(['lg:sticky', 'lg:top-6']))
    expect(card.classes()).not.toContain('sticky')
    expect(card.get('.hf-section-card__title').text()).toBe('Resumen')
    expect(card.attributes('aria-labelledby')).toBe(card.get('.hf-section-card__title').attributes('id'))
  })

  // T8 D10: the summary names the price-list condition too.
  it.each([
    [['pl-1'], 'Solo con 1 lista de precio'],
    [['pl-1', 'pl-2'], 'Solo con 2 listas de precio'],
  ])('includes the price-list condition for %j', (priceListIds, text) => {
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: makeState({ hasPriceLists: true, priceListIds }) },
      global: { stubs: STUBS },
    })
    expect(wrapper.findAll('.promotions-summary-item').map((item) => item.text())).toContain(text)
  })

  // T1/S1: with the names at hand the summary names the lists (first 3, then «y N más»).
  it.each([
    [['pl-1'], ['Mayoreo'], 'Solo con: Mayoreo'],
    [['pl-1', 'pl-2'], ['Mayoreo', 'Veterinarias'], 'Solo con: Mayoreo, Veterinarias'],
    [['a', 'b', 'c'], ['Mayoreo', 'Veterinarias', 'Clínicas'], 'Solo con: Mayoreo, Veterinarias, Clínicas'],
    [['a', 'b', 'c', 'd'], ['Mayoreo', 'Veterinarias', 'Clínicas', 'Criadores'], 'Solo con: Mayoreo, Veterinarias, Clínicas y 1 más'],
    [['a', 'b', 'c', 'd', 'e'], ['A', 'B', 'C', 'D', 'E'], 'Solo con: A, B, C y 2 más'],
  ])('names the price lists %j', (priceListIds, priceListNames, text) => {
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: makeState({ hasPriceLists: true, priceListIds }), priceListNames },
      global: { stubs: STUBS },
    })
    const items = wrapper.findAll('.promotions-summary-item').map((item) => item.text())
    expect(items).toContain(text)
    expect(wrapper.text()).not.toMatch(/listas? de precio/)
  })

  it('falls back to the count while the names are not loaded yet', () => {
    const wrapper = mount(PromotionSummaryCard, {
      props: { formState: makeState({ hasPriceLists: true, priceListIds: ['a', 'b'] }), priceListNames: ['Mayoreo'] },
      global: { stubs: STUBS },
    })
    expect(wrapper.findAll('.promotions-summary-item').map((item) => item.text())).toContain('Solo con 2 listas de precio')
  })

  it('omits the price-list condition while it is off or has no list chosen', () => {
    for (const patch of [{ hasPriceLists: false, priceListIds: ['pl-1'] }, { hasPriceLists: true, priceListIds: [] }]) {
      const wrapper = mount(PromotionSummaryCard, {
        props: { formState: makeState(patch) },
        global: { stubs: STUBS },
      })
      expect(wrapper.text()).not.toContain('lista de precio')
      expect(wrapper.text()).not.toContain('listas de precio')
    }
  })
})
