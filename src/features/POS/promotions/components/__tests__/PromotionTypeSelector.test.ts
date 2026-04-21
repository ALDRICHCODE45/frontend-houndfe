import { describe, it, expect, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import {
  PROMOTION_TYPE_CARDS,
  getPromotionCreateRoute,
} from '../../utils/promotionTypeCards.utils'

// ── Router setup ──────────────────────────────────────────────────────────────

function createTestRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
}

// ── Pure logic tests ──────────────────────────────────────────────────────────

describe('PROMOTION_TYPE_CARDS config', () => {
  it('contains exactly 4 cards', () => {
    expect(PROMOTION_TYPE_CARDS).toHaveLength(4)
  })

  it('PRODUCT_DISCOUNT card has correct title', () => {
    const card = PROMOTION_TYPE_CARDS.find((c) => c.type === 'PRODUCT_DISCOUNT')
    expect(card?.title).toBe('Descuento en productos')
  })

  it('ORDER_DISCOUNT card has correct title', () => {
    const card = PROMOTION_TYPE_CARDS.find((c) => c.type === 'ORDER_DISCOUNT')
    expect(card?.title).toBe('Descuento en el total del pedido')
  })

  it('BUY_X_GET_Y card has correct title', () => {
    const card = PROMOTION_TYPE_CARDS.find((c) => c.type === 'BUY_X_GET_Y')
    expect(card?.title).toBe('2x1, 3x2 o similares')
  })

  it('ADVANCED card has correct title', () => {
    const card = PROMOTION_TYPE_CARDS.find((c) => c.type === 'ADVANCED')
    expect(card?.title).toBe('Promoción avanzada')
  })

  it('all cards have a Lucide icon defined', () => {
    for (const card of PROMOTION_TYPE_CARDS) {
      expect(card.icon).toBeTruthy()
      expect(card.icon).toMatch(/^i-lucide-/)
    }
  })

  it('all cards have a non-empty example starting with Ej.:', () => {
    for (const card of PROMOTION_TYPE_CARDS) {
      expect(card.example).toBeTruthy()
      expect(card.example.startsWith('Ej.:')).toBe(true)
    }
  })
})

describe('getPromotionCreateRoute', () => {
  it('returns correct route for PRODUCT_DISCOUNT', () => {
    expect(getPromotionCreateRoute('PRODUCT_DISCOUNT')).toBe(
      '/pos/promociones/crear/PRODUCT_DISCOUNT',
    )
  })

  it('returns correct route for ADVANCED', () => {
    expect(getPromotionCreateRoute('ADVANCED')).toBe('/pos/promociones/crear/ADVANCED')
  })

  it('returns correct route for ORDER_DISCOUNT', () => {
    expect(getPromotionCreateRoute('ORDER_DISCOUNT')).toBe(
      '/pos/promociones/crear/ORDER_DISCOUNT',
    )
  })

  it('returns correct route for BUY_X_GET_Y', () => {
    expect(getPromotionCreateRoute('BUY_X_GET_Y')).toBe('/pos/promociones/crear/BUY_X_GET_Y')
  })
})

// ── Component behavior tests (via exposed selectType) ─────────────────────────
// NOTE: shallowMount stubs UModal so its #body slot is not rendered in DOM.
// We test the component's behavioral contract through vm.selectType() calls
// which are the same code paths triggered by card clicks.

import PromotionTypeSelector from '../PromotionTypeSelector.vue'

describe('PromotionTypeSelector component — selectType behavior', () => {
  let router: ReturnType<typeof createTestRouter>

  beforeEach(() => {
    router = createTestRouter()
  })

  function mountComponent() {
    return shallowMount(PromotionTypeSelector, {
      props: { open: true },
      global: { plugins: [router] },
    })
  }

  it('emits select with PRODUCT_DISCOUNT on selectType call', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as { selectType: (t: string) => void }).selectType('PRODUCT_DISCOUNT')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual(['PRODUCT_DISCOUNT'])
  })

  it('emits update:open false on selectType call (closes modal)', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as { selectType: (t: string) => void }).selectType('BUY_X_GET_Y')
    expect(wrapper.emitted('update:open')).toBeTruthy()
    expect(wrapper.emitted('update:open')![0]).toEqual([false])
  })

  it('navigates to PRODUCT_DISCOUNT create route on selectType', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as { selectType: (t: string) => void }).selectType('PRODUCT_DISCOUNT')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/pos/promociones/crear/PRODUCT_DISCOUNT')
  })

  it('navigates to ORDER_DISCOUNT create route on selectType', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as { selectType: (t: string) => void }).selectType('ORDER_DISCOUNT')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/pos/promociones/crear/ORDER_DISCOUNT')
  })

  it('navigates to ADVANCED create route on selectType', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as { selectType: (t: string) => void }).selectType('ADVANCED')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/pos/promociones/crear/ADVANCED')
  })
})
