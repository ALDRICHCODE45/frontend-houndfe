/**
 * style-cleanup U3 (owner S3/S4) guard: the counter checkout stays on the shared payment sheet and
 * the dead opt-in branches do not come back.
 *
 * Every Venta checkout component has a single caller that always passes the sales entry portal
 * (`SalesView` → PaymentModal, PaymentSuccessModal, PromotionCapacityRequoteModal, ActiveSalePanel;
 * ActiveSalePanel → SaleTotalsFooter). Choosing class strings from the mere presence of
 * `portalClass` (or the `themed` / token flags derived from it) only ever ran one side, so those
 * ternaries are refused here. Forwarding the marker itself (`:ui="{ content: portalClass }"`)
 * is not a class choice and stays allowed.
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import SaleHistoryRowDetail from '../history/SaleHistoryRowDetail.vue'

vi.mock('@/features/POS/sales/api/sale.api', () => ({
  // Never resolves: the guard only reads the detail's own surface, not its data.
  saleApi: { getById: vi.fn(() => new Promise(() => undefined)) },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn() }),
}))

const read = (path: string) => readFileSync(path, 'utf8')
const component = (name: string) => read(`src/features/POS/sales/components/${name}.vue`)
const withoutComments = (source: string) =>
  source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const OPT_IN_FILES = [
  'PaymentModal',
  'PaymentSuccessModal',
  'PromotionCapacityRequoteModal',
  'SaleTotalsFooter',
  'ActiveSalePanel',
] as const

/** `portalClass ? '…'`, `props.themed\n ? \`…\``, `isThemed ? "…"`: a class string picked by a flag. */
const CLASS_TERNARY = /\b(?:props\.)?(?:portalClass|themed|isThemed|isSalesEntry\w*)\s*\?\s*['"`]/

describe('U3 guard — no dead `portalClass ?` class branches in the Venta checkout', () => {
  it.each(OPT_IN_FILES)('%s does not choose class strings from the portal opt-in', (name) => {
    const source = withoutComments(component(name))
    expect(source).not.toMatch(CLASS_TERNARY)
    expect(source).not.toMatch(/if\s*\(\s*!props\.portalClass\s*\)/)
    expect(source).not.toContain('hasSalesEntryToken')
    expect(source).not.toMatch(/\bisThemed\b|\bisSalesEntry(?:Composition|Customer)\b/)
  })

  it('SaleTotalsFooter no longer takes the always-on `themed` / `composition` opt-ins', () => {
    const source = withoutComments(component('SaleTotalsFooter'))
    expect(source).not.toMatch(/\bthemed\??\s*:/)
    expect(source).not.toMatch(/\bcomposition\??\s*:/)
    expect(source).not.toContain('Artic · ')
  })

  it('ActiveSalePanel drops the legacy footer accordion and toolbar branches', () => {
    const source = withoutComments(component('ActiveSalePanel'))
    // One promotions accordion (in the scroll body) and one actions toolbar (in the heading).
    expect(source.match(/<PromocionesDisponiblesAccordion\b/g)).toHaveLength(1)
    expect(source.match(/data-testid="cart-actions-toolbar"/g)).toHaveLength(1)
  })
})

describe('U3 guard — the counter checkout uses the shared payment sheet', () => {
  const modal = withoutComments(component('PaymentModal'))
  const checkoutCss = read('src/features/POS/sales/styles/sales-pos-checkout.css').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  )

  it('PaymentModal renders total, tiles, entries, summary and panels with `hf-pay-*`', () => {
    expect(modal).toContain("import '@/core/shared/components/payments/payment-sheet.css'")
    for (const hook of [
      'hf-pay-total',
      'hf-pay-total-value',
      'hf-pay-methods',
      'class="hf-pay-tile"',
      'hf-pay-tile-icon',
      'hf-pay-tile-label',
      'hf-pay-tile-count',
      'hf-pay-tile-subtitle',
      'hf-pay-empty',
      'hf-pay-entries',
      'class="hf-pay-entry"',
      'hf-pay-entry-head',
      'hf-pay-summary',
      'hf-pay-summary-row',
      'hf-pay-panel',
    ]) {
      expect(modal).toContain(hook)
    }
    // Selection rides on aria-pressed; the old state attribute and corner badge are gone.
    expect(modal).toMatch(/:aria-pressed="getMethodCount\(wireEntries, option\) > 0"/)
    expect(modal).not.toContain('data-sales-pos-checkout-state')
    expect(modal).not.toMatch(/absolute right-2 top-2/)
    expect(modal.match(/data-tone="warning"/g)).toHaveLength(2)
  })

  it('PaymentModal no longer carries the removed checkout hooks or the old tile grid', () => {
    for (const removed of [
      'sales-pos-checkout-total',
      'sales-pos-checkout-methods',
      'sales-pos-checkout-method-tile',
      'sales-pos-checkout-entries',
      'sales-pos-checkout-payment-entry',
      'sales-pos-checkout-summary',
      'sales-pos-checkout-binding-lost',
      'grid grid-cols-2 gap-3',
    ]) {
      expect(modal).not.toContain(removed)
    }
  })

  it('the checkout adapter does not re-define the sheet pieces or the app-wide Nuxt colours', () => {
    expect(checkoutCss).not.toMatch(/--ui-(?:warning|primary)\s*:/)
    for (const removed of [
      'sales-pos-checkout-total',
      'sales-pos-checkout-methods',
      'sales-pos-checkout-method-tile',
      'sales-pos-checkout-entries',
      'sales-pos-checkout-payment-entry',
      'sales-pos-checkout-summary',
      'sales-pos-checkout-binding-lost',
    ]) {
      expect(checkoutCss).not.toContain(removed)
    }
  })
})

describe('U3 guard — Caja copy without «legacy» (owner S3)', () => {
  it.each(['PaymentModal', 'CashSaleSessionPicker'])('%s shows no «(legacy)» copy', (name) => {
    const template = component(name).split('<template>').slice(1).join('<template>')
    expect(template).not.toMatch(/\(legacy\)/i)
  })

  it('names the unbound choice «Sin caja» / «Cobrar sin vincular a caja»', () => {
    expect(component('CashSaleSessionPicker')).toContain("'Sin caja'")
    expect(component('CashSaleSessionPicker')).toContain('Cobrar sin vincular a caja')
    expect(component('PaymentModal')).toContain('Cobrar sin vincular a caja')
  })
})

describe('U3 guard — the history row detail does not nest a card when embedded', () => {
  const mounted: VueWrapper[] = []
  afterEach(() => mounted.splice(0).forEach((wrapper) => wrapper.unmount()))

  function mountDetail(props: Record<string, unknown>) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = mount(SaleHistoryRowDetail, {
      props: { saleId: 'sale-1', ...props },
      global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs: { USkeleton: true, UButton: true, UIcon: true } },
    })
    mounted.push(wrapper)
    return wrapper.get('[data-testid="sale-history-detail"]')
  }

  it('keeps its bordered panel by default (seller report)', () => {
    const root = mountDetail({ party: 'customer' })
    expect(root.classes()).toEqual(expect.arrayContaining(['rounded-lg', 'border', 'px-4', 'py-3']))
    expect(root.attributes('data-embedded')).toBeUndefined()
  })

  it('drops border, corner and fill when embedded in the customer history row', () => {
    const root = mountDetail({ embedded: true })
    expect(root.attributes('data-embedded')).toBe('true')
    expect(root.classes()).not.toContain('rounded-lg')
    expect(root.classes()).not.toContain('border')
    expect(root.classes().some((name) => name.startsWith('bg-'))).toBe(false)
    expect(root.classes()).toEqual(expect.arrayContaining(['px-4', 'py-3']))
  })

  it('the customer history embeds it in both layouts without extra wrapper padding', () => {
    const list = read('src/features/POS/customers/components/SalesHistoryList.vue')
    expect(list.match(/<SaleHistoryRowDetail embedded\b/g)).toHaveLength(2)
    expect(list).not.toMatch(/:id="detailId\(sale\)" class="px-2 pb-2"/)
    expect(list).not.toMatch(/<td colspan="5" class="[^"]*\bp-2\b/)
    // The seller report keeps the default bordered panel.
    const seller = read('src/features/admin/users/seller-report/components/SellerReportSalesList.vue')
    expect(seller).not.toMatch(/<SaleHistoryRowDetail[^>]*\bembedded\b/)
  })
})
