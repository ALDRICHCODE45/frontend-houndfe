// promotions-in-sale C.3 — STRICT TDD tests for the manual-promo
// accordion. RED → GREEN. Asserts:
//
//   (a) 2 promotions ⇒ 2 rows + 2 Apply controls; clicking Apply emits
//       `apply` with that id.
//   (b) A promotion whose id is in `appliedIds` ⇒ shows a Remove control
//       that emits `remove` with the id (and NO Apply control).
//   (c) Empty `promotions` ⇒ component root NOT in DOM (parent v-if + this
//       root guard both hide the section).
//   (d) `loading` true ⇒ a loading/skeleton affordance renders with a
//       stable data-testid.
//
// Test conventions follow the repo:
//   - mountWithUApp (Nuxt UI v4 provider context).
//   - Stable data-testids on every interactive element so we never query
//     by text or component-name internals.
//   - data-slot="trigger" queries follow the ActionsAccordion precedent
//     (Nuxt UI's UAccordion does not expose itself as a queryable name).
import { describe, it, expect } from 'vitest'
import PromocionesDisponiblesAccordion from '../PromocionesDisponiblesAccordion.vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { ApplicablePromotion } from '../../interfaces/sale.types'

function makePromotions(): ApplicablePromotion[] {
  return [
    { id: 'promo-a', title: '2x1 Aspirinas', type: 'PRODUCT_DISCOUNT' },
    { id: 'promo-b', title: '10% en subtotal', type: 'ORDER_DISCOUNT' },
  ]
}

function mountAccordion(props: Record<string, unknown> = {}) {
  return mountWithUApp(PromocionesDisponiblesAccordion, {
    props: {
      promotions: makePromotions(),
      ...props,
    },
  })
}

describe('PromocionesDisponiblesAccordion C.3 — presentational contract', () => {
  // ── (a) 2 promotions ⇒ 2 rows + 2 Apply controls; click emits apply ─────

  it('renders one row per promotion, each with an Apply control that emits `apply` with the id', async () => {
    const wrapper = mountAccordion()

    const root = wrapper.find('[data-testid="promociones-disponibles-accordion"]')
    expect(root.exists()).toBe(true)

    const rowA = wrapper.find('[data-testid="promo-row-promo-a"]')
    const rowB = wrapper.find('[data-testid="promo-row-promo-b"]')
    expect(rowA.exists()).toBe(true)
    expect(rowB.exists()).toBe(true)

    expect(rowA.text()).toContain('2x1 Aspirinas')
    expect(rowB.text()).toContain('10% en subtotal')

    const applyA = wrapper.find('[data-testid="promo-apply-promo-a"]')
    const applyB = wrapper.find('[data-testid="promo-apply-promo-b"]')
    expect(applyA.exists()).toBe(true)
    expect(applyB.exists()).toBe(true)

    // No remove control should exist for non-applied promos.
    expect(wrapper.find('[data-testid="promo-remove-promo-a"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="promo-remove-promo-b"]').exists()).toBe(false)

    await applyA.trigger('click')

    const events = wrapper.emitted('apply')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['promo-a'])

    await applyB.trigger('click')
    expect(wrapper.emitted('apply')!).toHaveLength(2)
    expect(wrapper.emitted('apply')![1]).toEqual(['promo-b'])
  })

  // ── (b) Applied promo ⇒ Remove control, NOT Apply; emits `remove` ───────

  it('renders a Remove control (instead of Apply) for any promotion whose id is in `appliedIds`, and that Remove emits `remove` with the id', async () => {
    const wrapper = mountAccordion({ appliedIds: ['promo-a'] })

    // promo-a is applied: Remove only, no Apply.
    const rowA = wrapper.find('[data-testid="promo-row-promo-a"]')
    expect(rowA.exists()).toBe(true)

    const removeA = wrapper.find('[data-testid="promo-remove-promo-a"]')
    const applyA = wrapper.find('[data-testid="promo-apply-promo-a"]')
    expect(removeA.exists()).toBe(true)
    expect(applyA.exists()).toBe(false)

    // promo-b is not applied: Apply only.
    const applyB = wrapper.find('[data-testid="promo-apply-promo-b"]')
    const removeB = wrapper.find('[data-testid="promo-remove-promo-b"]')
    expect(applyB.exists()).toBe(true)
    expect(removeB.exists()).toBe(false)

    await removeA.trigger('click')

    const events = wrapper.emitted('remove')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['promo-a'])

    // `apply` must NOT have fired for the applied promo.
    expect(wrapper.emitted('apply')).toBeFalsy()
  })

  // ── (c) Empty `promotions` ⇒ component root NOT in DOM ───────────────────

  it('renders nothing (root not in DOM) when `promotions` is empty, even when `loading` is false', () => {
    const wrapper = mountAccordion({ promotions: [] })

    expect(wrapper.find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(false)
    // And no orphan rows or controls leak out.
    expect(wrapper.find('[data-testid="promo-row-promo-a"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="promo-apply-promo-a"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="promo-remove-promo-a"]').exists()).toBe(false)
  })

  it('still renders nothing when both `promotions` is empty AND `loading` is true (root guard wins)', () => {
    const wrapper = mountAccordion({ promotions: [], loading: true })

    // The empty-state guard takes priority over the loading affordance — a
    // section with no data AND no skeleton is the documented contract.
    expect(wrapper.find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(false)
  })

  // ── (d) `loading` true ⇒ a loading/skeleton affordance renders ───────────

  it('renders a loading affordance when `loading` is true and promotions are present', () => {
    const wrapper = mountAccordion({ loading: true })

    expect(wrapper.find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="promociones-loading"]').exists()).toBe(true)
  })

  // ── bxgy-promotion-followups REQ-5 — Aplicar disabled binding ────────────
  //
  // The gate is GENERIC on `eligible` (NOT on `promo.type`). It MUST use the
  // strict `eligible === false` check — `!eligible` would disable legacy rows
  // where the field is undefined, which the spec scenario 3 explicitly
  // forbids. Legacy fixtures (omitted eligible) MUST stay enabled.

  it('disables Aplicar when `eligible: false` and clicking it does NOT emit `apply`', async () => {
    const wrapper = mountAccordion({
      promotions: [
        { id: 'promo-a', title: '2x1 Aspirinas', type: 'PRODUCT_DISCOUNT', eligible: false },
      ],
    })

    const applyBtn = wrapper.get('[data-testid="promo-apply-promo-a"]')
    // UButton forwards the `disabled` attribute to the underlying button.
    expect(applyBtn.attributes('disabled')).toBeDefined()

    await applyBtn.trigger('click')

    // The disabled click must NOT bubble up an `apply` emit.
    expect(wrapper.emitted('apply')).toBeFalsy()
  })

  it('keeps Aplicar enabled when `eligible: true` and clicking emits `apply`', async () => {
    const wrapper = mountAccordion({
      promotions: [
        { id: 'promo-a', title: '2x1 Aspirinas', type: 'PRODUCT_DISCOUNT', eligible: true },
      ],
    })

    const applyBtn = wrapper.get('[data-testid="promo-apply-promo-a"]')
    expect(applyBtn.attributes('disabled')).toBeUndefined()

    await applyBtn.trigger('click')

    const events = wrapper.emitted('apply')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['promo-a'])
  })

  it('keeps Aplicar enabled for legacy fixtures that omit `eligible` (undefined stays eligible)', async () => {
    const wrapper = mountAccordion({
      promotions: [
        // No `eligible` field — pre-deploy / legacy fixture.
        { id: 'promo-a', title: '2x1 Aspirinas', type: 'PRODUCT_DISCOUNT' },
      ],
    })

    const applyBtn = wrapper.get('[data-testid="promo-apply-promo-a"]')
    // STRICT `=== false` check: undefined must NOT disable.
    expect(applyBtn.attributes('disabled')).toBeUndefined()

    await applyBtn.trigger('click')

    const events = wrapper.emitted('apply')
    expect(events).toBeTruthy()
    expect(events![0]).toEqual(['promo-a'])
  })

  it('leaves empty + loading variant unaffected by the eligible gate', () => {
    const wrapper = mountAccordion({ promotions: [], loading: true })

    expect(wrapper.find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="promo-apply-promo-a"]').exists()).toBe(false)
  })

  // ── bxgy-promotion-followups REQ-6 — `unitsNeeded` hint with plural ───────
  //
  // The hint testid is `promo-hint-${id}` and the text agrees with N:
  // N === 1 → singular "unidad"; N >= 2 → plural "unidades". When the field
  // is absent or null, the hint MUST NOT render at all (parent v-if gate).

  it('renders the singular hint "2x1 · requiere 1 unidad más" when unitsNeeded = 1', () => {
    const wrapper = mountAccordion({
      promotions: [
        {
          id: 'promo-a',
          title: '2x1 Vitaminas',
          type: 'BUY_X_GET_Y',
          buyQuantity: 2,
          getQuantity: 1,
          unitsNeeded: 1,
          method: 'MANUAL',
        },
      ],
    })

    const hint = wrapper.find('[data-testid="promo-hint-promo-a"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('2x1 · requiere 1 unidad más')
  })

  it('renders the plural hint "2x1 · requiere 2 unidades más" when unitsNeeded = 2', () => {
    const wrapper = mountAccordion({
      promotions: [
        {
          id: 'promo-a',
          title: '2x1 Vitaminas',
          type: 'BUY_X_GET_Y',
          buyQuantity: 2,
          getQuantity: 1,
          unitsNeeded: 2,
          method: 'MANUAL',
        },
      ],
    })

    const hint = wrapper.find('[data-testid="promo-hint-promo-a"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('2x1 · requiere 2 unidades más')
  })

  it('does NOT render the hint element when `unitsNeeded` is absent or null', () => {
    const wrapper = mountAccordion({
      promotions: [
        // unitsNeeded omitted — product/order discount with no BXGY hint.
        { id: 'promo-a', title: '2x1 Vitaminas', type: 'BUY_X_GET_Y' },
      ],
    })

    expect(wrapper.find('[data-testid="promo-hint-promo-a"]').exists()).toBe(false)
  })
})