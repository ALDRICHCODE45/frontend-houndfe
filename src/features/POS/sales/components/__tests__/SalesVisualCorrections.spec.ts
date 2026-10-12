import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, shallowRef, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mountWithUApp } from '@/test/mountWithUApp'
import ActiveSalePanel from '../ActiveSalePanel.vue'
import SaleItemRow from '../SaleItemRow.vue'
import SaleTotalsFooter from '../SaleTotalsFooter.vue'
import SaleItemBadges from '../SaleItemBadges.vue'
import SaleDetailItemsList from '../SaleDetailItemsList.vue'
import PaymentMethodPills from '../PaymentMethodPills.vue'
import type { Sale, SaleItem, SaleDetailItem } from '../../interfaces/sale.types'

// Native owners, not tooltip/card stubs. Auto-unmount tracks the UApp root
// created inside mountWithUApp, rather than trying to unmount its child wrapper.
enableAutoUnmount(afterEach)
const PORTAL = 'hf-theme hf-ui sales-entry-portal'
const item: SaleItem = {
  id: 'item-1', productId: 'product-1', variantId: null, productName: 'Producto local',
  variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN',
  promotionId: 'promo-1', discountTitle: 'Descuento local',
  discountType: 'percentage', discountValue: 10, discountAmountCents: 100,
}
const draft: Sale = {
  id: 'sale-1', userId: 'user-1', status: 'DRAFT', items: [item],
  customer: null, shippingAddress: null,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}
const detailItem: SaleDetailItem = {
  productName: item.productName, variantName: null, imageUrl: null,
  quantity: 1, unitPriceCents: 1000, discountCents: 100, subtotalCents: 900,
  promotionId: item.promotionId, discountTitle: item.discountTitle,
  discountType: item.discountType, discountValue: item.discountValue,
  discountAmountCents: item.discountAmountCents,
}
const callbacks = {
  onSubmitPriceOverride: vi.fn(async () => undefined),
  onApplyDiscount: vi.fn(async () => undefined),
  onRemoveDiscount: vi.fn(async () => undefined),
}
const cases: { name: string; component: Component; props: Record<string, unknown> }[] = [
  { name: 'ActiveSalePanel (including its rows/footer)', component: ActiveSalePanel,
    props: { drafts: [draft], activeDraft: draft, activeTabId: draft.id,
      isLoadingList: false, isMutating: false, ...callbacks,
      onRemoveItem: vi.fn(async () => undefined),
      onApplyGlobalDiscount: vi.fn(async () => undefined),
      onRemoveGlobalDiscount: vi.fn(async () => undefined) } },
  { name: 'SaleItemRow draft', component: SaleItemRow, props: { item, saleId: draft.id, ...callbacks } },
  { name: 'SaleItemRow confirmed badges', component: SaleItemRow,
    props: { item, saleId: draft.id, isDraft: false, ...callbacks } },
  { name: 'SaleTotalsFooter', component: SaleTotalsFooter, props: { sale: draft } },
  { name: 'SaleItemBadges', component: SaleItemBadges, props: { ...item } },
  { name: 'SaleDetailItemsList forwarding', component: SaleDetailItemsList, props: { items: [detailItem] } },
  { name: 'PaymentMethodPills overflow', component: PaymentMethodPills,
    props: { methods: ['CASH', 'CARD_DEBIT', 'TRANSFER'] } },
]

describe('Sales tooltip opt-in — each reached installed owner', () => {
  it.each(cases)('$name forwards optional content paint and leaves omitted ui inert', async ({ component, props }) => {
    const portalClass = ref<string | undefined>(PORTAL)
    const tooltip = shallowRef<Component>()
    const ui = ref<unknown>()
    // Keep both native trees in one UApp: a second VTU mount replaces its
    // global stub transformer and can unstub the first tree during updates.
    const fixture = defineComponent({
      setup: () => () => h('section', [
        h(component, { ...props, portalClass: portalClass.value }),
        tooltip.value ? h(tooltip.value, { text: 'Detalle local', open: true, ui: ui.value },
          { default: () => h('button', 'Detalle') }) : null,
      ]),
    })
    const wrapper = mountWithUApp(fixture, {
      attachTo: document.body,
      // The selector is protected and unrelated to tooltips. Stubbing only it
      // prevents queries; all reached rows, badges, footer and tooltips are real.
      global: {
        plugins: [createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })],
        stubs: { PriceListSelector: { template: '<div />' } },
      },
    })
    const owners = wrapper.findAllComponents({ name: 'Tooltip' })
    expect(owners.length).toBeGreaterThan(0)
    for (const owner of owners) expect(owner.props('ui')).toEqual({ content: PORTAL })

    ui.value = owners[0]!.props('ui')
    tooltip.value = owners[0]!.vm.$options
    await flushPromises()
    // ActiveSalePanel also reaches tab/menu content slots. Identify this
    // native tooltip by its own text child, never by the marker under test.
    const content = Array.from(document.body.querySelectorAll('[data-slot="content"]'))
      .find(root => root.querySelector(':scope > [data-slot="text"]')?.textContent === 'Detalle local')!
    expect(content).toBeDefined()
    expect(content.classList.contains('sales-entry-portal')).toBe(true)
    // Installed tooltip is NOT inverted: do not replace this semantic pair.
    expect(content.classList.contains('bg-default')).toBe(true)
    expect(content.classList.contains('text-highlighted')).toBe(true)
    portalClass.value = undefined
    ui.value = undefined
    await flushPromises()
    for (const owner of wrapper.findAllComponents({ name: 'Tooltip' })) {
      expect(owner.props('ui')).toBeUndefined()
    }
    expect(content.classList.contains('sales-entry-portal')).toBe(false)
    expect(content.classList.contains('bg-default')).toBe(true)
    expect(content.classList.contains('text-highlighted')).toBe(true)
  })

  it.each([
    ['SalesListView', 'PaymentMethodPills', 'sales-list-portal'],
    ['SaleDetailView', 'SaleDetailItemsList', 'sales-detail-portal'],
  ])('%s opts its tooltip-bearing child into its own portal boundary', (view, child, marker) => {
    const source = readFileSync(`src/features/POS/sales/views/${view}.vue`, 'utf8')
    expect(source).toMatch(new RegExp(`<${child}\\b[^>]*portal-class="hf-theme hf-ui [^"]*${marker}"`))
  })
})

const styles: HTMLStyleElement[] = []
const originalDark = document.documentElement.classList.contains('dark')
afterEach(() => {
  styles.splice(0).forEach(style => style.remove())
  document.documentElement.classList.toggle('dark', originalDark)
})

// jsdom does not resolve custom properties/layers like a browser. Substitute
// two distinguishable semantic-role values to test native-child selector and
// utility precedence. These are harness colors, NOT fidelity/contrast proof.
function addPaint(adapter: string) {
  const style = document.createElement('style')
  style.textContent = `
    .bg-default, .bg-white { background-color: rgb(255, 255, 255); }
    .hf-theme .bg-default { background-color: rgb(20, 30, 40); }
    .dark .dark\\:bg-coco-neutral-900 { background-color: rgb(44, 36, 52); }
    ${adapter.replace(/^@import.*$/gm, '')
      .replace(/var\(--hf-surface-muted\)/g, 'rgb(60, 70, 80)')
      .replace(/var\(--hf-surface\)/g, 'rgb(20, 30, 40)')}
  `
  document.head.append(style)
  styles.push(style)
}

describe('Sales native card surface — scoped paint, not boundary variables only', () => {
  it.each([false, true])('repairs installed detail card (dark=%s), preserving muted facts/statuses and omitted opt-in', async (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    addPaint(readFileSync('src/features/POS/sales/styles/sales-detail-visual.css', 'utf8'))
    const marker = ref('hf-theme hf-ui sales-detail-visual')
    const fixture = defineComponent({
      components: { SaleDetailItemsList }, setup: () => ({ marker }),
      template: `<section :class="marker"><SaleDetailItemsList :items="[]" />
        <div class="sales-detail-fact" data-testid="fact">Dato</div>
        <div class="bg-success" data-testid="status">Confirmado</div></section>`,
    })
    const wrapper = mountWithUApp(fixture, { attachTo: document.body })
    const card = wrapper.get('div[data-slot="root"]:has(> div[data-slot="body"])').element
    // Installed outline variant removes the configured light bg-white via
    // class merging, but retains the literal dark utility: that is the escape.
    expect(card.classList.contains('bg-default')).toBe(true)
    expect(card.classList.contains('dark:bg-coco-neutral-900')).toBe(true)
    expect(getComputedStyle(card).backgroundColor).toBe('rgb(20, 30, 40)')
    expect(getComputedStyle(wrapper.get('[data-testid="fact"]').element).backgroundColor).toBe('rgb(60, 70, 80)')
    expect(getComputedStyle(wrapper.get('[data-testid="status"]').element).backgroundColor).not.toBe('rgb(20, 30, 40)')
    marker.value = 'quotations-visual'
    await flushPromises()
    expect(getComputedStyle(card).backgroundColor).toBe(dark ? 'rgb(44, 36, 52)' : 'rgb(255, 255, 255)')
  })
})
