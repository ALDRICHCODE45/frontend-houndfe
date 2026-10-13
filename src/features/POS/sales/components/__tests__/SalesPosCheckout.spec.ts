import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed, reactive, type Component } from 'vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import PaymentModal from '../PaymentModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import PaymentSuccessModal from '../PaymentSuccessModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import PromotionCapacityRequoteModal from '../PromotionCapacityRequoteModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import GlobalDiscountModal from '../GlobalDiscountModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ItemDiscountModal from '../ItemDiscountModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import PriceOverrideModal from '../PriceOverrideModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ProductDetailModal from '../ProductDetailModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import VariantPickerModal from '../VariantPickerModal.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import PriceListSelector from '../PriceListSelector.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import CashSaleSessionPicker from '../CashSaleSessionPicker.vue'
import type { PosCatalogVariant, SaleItem } from '../../interfaces/sale.types'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'

/*
 * Checkout / support-window presentation contracts (T3 / S1-S5).
 *
 * These mounts exercise the REAL components against the INSTALLED Nuxt UI /
 * Reka primitives: the owned `sales-pos-checkout` marker reaches the native
 * content root, the composition hooks are reached where they live, the public
 * payment / delivery / cash / debt / re-quote actions keep working, and the
 * omitted opt-in stays byte-identical for the shared consumers (quotations,
 * catalog).
 *
 * jsdom has no layout engine: computed paint, contrast, media queries and touch
 * ergonomics are NOT proven here. Visual smoke remains user-owned.
 */
const PORTAL = 'hf-theme hf-ui sales-entry-portal'
const QUOTATIONS = 'hf-theme hf-ui quotations-workspace-portal'
const FORM_PORTAL = 'hf-theme hf-ui hf-form-overlay quotations-workspace-portal'
const OPEN_UUID = '11111111-1111-4111-8111-111111111111'

// ── Native primitive shims (jsdom has no pointer/layout engine) ─────────────

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
})

// ── Module mocks: keep the mounts local and offline ─────────────────────────

vi.mock('../../composables/useSalePaymentMethods', () => ({
  useSalePaymentMethods: () => ({
    data: computed(() => []),
    isLoading: { value: false },
    isFetching: { value: false },
    isError: { value: false },
    error: { value: null },
    refetch: vi.fn(),
  }),
}))

const cashAuth = vi.hoisted(() => ({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: [] as string[],
  permissionsLoaded: true,
  isSuperAdmin: false,
  canReadSessions: false,
  // A stable function identity reading the mutable flag, mirroring the real
  // ability store so the picker visibility can be toggled per test.
  userCan: (action: string, subject: string): boolean =>
    action === 'read' && subject === 'CashSession' && cashAuth.canReadSessions,
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authStore }))

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

// The auth store is a REACTIVE proxy over the mutable fixture so an identity /
// permission transition can drive the composable's sync selection reset (the
// real lost-binding path), while `userCan` still reads the same target.
const authStore = reactive(cashAuth)

const listSessions = vi.hoisted(() => vi.fn())
vi.mock('@/features/POS/cash-register/api/cash.api', () => ({
  cashApi: { listSessions },
}))
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    getAvailablePrices: vi.fn(async () => ({ prices: [] })),
    getProductDetail: vi.fn(async () => ({
      id: 'prod-1',
      name: 'Ibuprofeno',
      sku: null,
      barcode: null,
      description: null,
      mainImage: null,
      category: null,
      brand: null,
      price: null,
      stock: null,
      variants: [],
    })),
  },
}))

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn(async () => []) },
}))

const wrappers: VueWrapper[] = []

function track<T extends VueWrapper>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}

function cleanup() {
  while (wrappers.length) {
    const wrapper = wrappers.pop()!
    try {
      wrapper.unmount()
    } catch {
      /* already unmounted */
    }
  }
  document.body.innerHTML = ''
}

afterEach(() => {
  cleanup()
  authStore.canReadSessions = false
  authStore.currentTenantId = 'tenant-1'
  authStore.permissionCodes = []
  listSessions.mockReset()
})

function freshQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function queryGlobal(): { plugins: [(typeof VueQueryPlugin), { queryClient: QueryClient }][] } {
  return { plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]] }
}

function contentRoot(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[data-slot="content"]')
}

function hasCheckoutMarker(): boolean {
  return contentRoot()?.classList.contains('sales-pos-checkout') ?? false
}

/**
 * The installed Slideover/Modal primitives teleport their content OUT of the
 * mounted wrapper, so reached controls are queried from `document.body` and
 * wrapped so `trigger`/`setValue` stay available.
 */
function bodyEl(selector: string): DOMWrapper<Element> {
  const element = document.body.querySelector(selector)
  if (!element) throw new Error(`Missing teleported element: ${selector}`)
  return new DOMWrapper(element)
}

/** The number field's real `<input>` lives inside the primitive root. */
function amountInput(index: number): DOMWrapper<Element> {
  const element = document.body.querySelector(
    `[data-testid="payment-amount-${index}"] input, input[data-testid="payment-amount-${index}"]`,
  )
  if (!element) throw new Error(`Missing payment amount input ${index}`)
  return new DOMWrapper(element)
}

const item: SaleItem = {
  id: 'item-1',
  productId: 'prod-1',
  variantId: null,
  productName: 'Ibuprofeno',
  variantName: null,
  quantity: 2,
  unitPriceCents: 10000,
  unitPriceCurrency: 'MXN',
}

const variantRow: PosCatalogVariant = {
  id: 'var-1',
  name: 'Ibuprofeno 400mg',
  sku: 'IBU-400',
  barcode: null,
  mainImage: null,
  price: { priceCents: 8500, priceDecimal: 85, priceListName: 'PUBLICO' },
  stock: { quantity: 150, minQuantity: 10 },
}

const linkedSession: CashSession = {
  id: OPEN_UUID,
  tenantId: 'tenant-1',
  registerId: 'r-1',
  status: 'OPEN',
  cashierUserId: 'user-1',
  openingCents: 0,
  frozenAt: null,
  drawerReleasedAt: null,
  blind: false,
}

const selectStub = {
  props: ['modelValue', 'items', 'disabled', 'placeholder'],
  emits: ['update:modelValue'],
  template:
    '<select v-bind="$attrs" :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option value="">{{ placeholder }}</option><option v-for="entry in items" :key="entry.value" :value="entry.value">{{ entry.label }}</option></select>',
}

function checkoutStubs() {
  return { USelect: selectStub, Select: selectStub }
}

// ── R1 — the checkout boundary and its native root ──────────────────────────

describe('R1 — checkout composition on the native slideover root', () => {
  it('owns the native content root and composes header, scrollable body and always-reachable footer', async () => {
    const wrapper = track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050, portalClass: PORTAL },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    const root = contentRoot()
    expect(root).not.toBeNull()
    expect(root!.classList.contains('sales-entry-portal')).toBe(true)
    expect(root!.classList.contains('sales-pos-checkout')).toBe(true)

    const body = root!.querySelector('.sales-pos-checkout-body')!
    const footer = root!.querySelector('.sales-pos-checkout-footer')!
    expect(body).not.toBeNull()
    expect(footer).not.toBeNull()
    // The footer must stay OUTSIDE the scrolling region to remain reachable.
    expect(body.contains(footer)).toBe(false)
    expect(footer.querySelector('[data-testid="confirm-charge"]')).not.toBeNull()

    expect(root!.querySelector('.sales-pos-checkout-total')).not.toBeNull()
    expect(root!.querySelector('.sales-pos-checkout-methods')).not.toBeNull()
    expect(root!.querySelector('.sales-pos-checkout-entries')).not.toBeNull()
    expect(root!.querySelector('.sales-pos-checkout-due-date')).not.toBeNull()
    expect(root!.querySelector('.sales-pos-checkout-delivery')).not.toBeNull()

    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as { content: string }
    expect(ui.content).toContain(PORTAL)
    expect(ui.content).toContain('sales-pos-checkout')
  })

  it('keeps the omitted opt-in byte-identical (no marker class)', async () => {
    const wrapper = track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050 },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    expect(hasCheckoutMarker()).toBe(false)
    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as { content: string }
    expect(ui.content).toBe('sm:max-w-lg overflow-hidden')
  })
})

// ── R2 — method tiles, selection and counts ─────────────────────────────────

describe('R2 — method tiles select, count and preserve the public action', () => {
  it('marks the tile and toggles the explicit selection without changing the charge action', async () => {
    const wrapper = track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050, portalClass: PORTAL },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    const tile = bodyEl('[data-testid="add-payment-entry"]')
    expect(tile.classes()).toContain('sales-pos-checkout-method-tile')
    expect(tile.attributes('data-sales-pos-checkout-state')).toBe('idle')

    await tile.trigger('click')
    expect(bodyEl('[data-testid="add-payment-entry"]').attributes('data-sales-pos-checkout-state')).toBe(
      'selected',
    )
    expect(document.body.querySelectorAll('[data-testid^="payment-entry-"]')).toHaveLength(1)

    await bodyEl('[data-testid="confirm-charge"]').trigger('click')
    const submitted = wrapper.emitted('submit')?.[0]?.[0] as {
      payload: Record<string, unknown>
    }
    expect(submitted.payload).toEqual({ method: 'cash', amountCents: 45050 })
  })
})

// ── R3 — stacked payment fields and references ──────────────────────────────

describe('R3 — payment entries keep readable stacked fields and references', () => {
  it('renders the entry card hook, amount field and optional reference for card methods', async () => {
    track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050, portalClass: PORTAL },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    await bodyEl('[data-testid="payment-method-tile-card_credit"]').trigger('click')

    const entry = bodyEl('[data-testid="payment-entry-0"]')
    expect(entry.classes()).toContain('sales-pos-checkout-payment-entry')
    expect(entry.find('[data-testid="payment-amount-0"]').exists()).toBe(true)
    expect(entry.find('[data-testid="payment-reference-0"]').exists()).toBe(true)
  })
})

// ── R4 — Caja session binding, pagination and the lost-binding decision ─────

describe('R4 — Caja session choice and lost binding stay explicit', () => {
  it('keeps the installed Select listbox contract and the owned picker hook', async () => {
    const wrapper = track(
      mount(CashSaleSessionPicker, {
        props: {
          sessions: [linkedSession],
          selectedId: null,
          isSelectionEligible: false,
          isFetching: false,
          isError: false,
          page: 1,
          pageCount: 2,
          total: 30,
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    // The nested listbox marker stays exactly the caller's opt-in (never a
    // second class), while the owned section carries the composition hook.
    expect(wrapper.findComponent({ name: 'Select' }).props('ui')).toEqual({ content: PORTAL })
    expect(wrapper.get('[data-testid="cash-session-binding"]').classes()).toContain(
      'sales-pos-cash-session',
    )

    expect(
      wrapper.get('[data-testid="cash-session-prev-page"]').attributes('disabled'),
    ).toBeDefined()
    await wrapper.get('[data-testid="cash-session-next-page"]').trigger('click')
    const events = wrapper.emitted('update:page') as number[][] | undefined
    expect(events?.[events.length - 1]?.[0]).toBe(2)
  })

  it('requires an explicit decision after a lost binding and preserves the rest of the draft', async () => {
    authStore.canReadSessions = true
    listSessions.mockResolvedValue({ items: [linkedSession], page: 1, limit: 25, total: 1 })

    track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050, portalClass: PORTAL },
        attachTo: document.body,
        global: { ...queryGlobal(), stubs: checkoutStubs() },
      }),
    )
    await flushPromises()

    await bodyEl('[data-testid="cash-session-select"]').setValue(OPEN_UUID)
    await flushPromises()

    // An identity transition clears the ACTUAL selection synchronously; the
    // modal then requires an explicit decision instead of silently charging
    // unbound.
    authStore.currentTenantId = 'tenant-2'
    await flushPromises()

    const lost = document.body.querySelector('[data-testid="cash-session-binding-lost"]')
    expect(lost).not.toBeNull()
    expect(lost!.classList.contains('sales-pos-checkout-binding-lost')).toBe(true)

    await bodyEl('[data-testid="cash-session-binding-optout"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="cash-session-binding-lost"]')).toBeNull()
  })
})

// ── R5 — delivery and customer CTA keep the real gating (never always disabled)

describe('R5 — delivery/customer gating is preserved (never hard-disabled)', () => {
  it('disables and explains the delivery toggle only while no address exists', async () => {
    const wrapper = track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050, portalClass: PORTAL },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    const toggle = bodyEl('[data-testid="delivery-toggle"]')
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(document.body.querySelector('[data-testid="delivery-hint"]')).not.toBeNull()

    await bodyEl('[data-testid="delivery-assign-cta"]').trigger('click')
    expect(wrapper.emitted('request-assign-customer')).toHaveLength(1)
  })

  it('enables the delivery toggle once the sale has a shipping address', async () => {
    track(
      mount(PaymentModal, {
        props: {
          open: true,
          saleId: 'sale-1',
          totalCents: 45050,
          portalClass: PORTAL,
          customer: { id: 'c-1', firstName: 'Ada', lastName: null },
          shippingAddress: {
            id: 'addr-1',
            customerId: 'c-1',
            street: 'Av. Reforma 123',
            exteriorNumber: '123',
            interiorNumber: null,
            zipCode: '06600',
            neighborhood: 'Centro',
            municipality: 'Cuauhtémoc',
            city: 'CDMX',
            state: 'CDMX',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    expect(bodyEl('[data-testid="delivery-toggle"]').attributes('disabled')).toBeUndefined()
    expect(document.body.querySelector('[data-testid="delivery-hint"]')).toBeNull()
  })
})

// ── R6 — debt / error / processing states stay inside the reachable footer ──

describe('R6 — the footer carries debt, error and processing states', () => {
  it('shows the debt summary with a customer and the inline error/processing gates', async () => {
    const wrapper = track(
      mount(PaymentModal, {
        props: {
          open: true,
          saleId: 'sale-1',
          totalCents: 15000,
          portalClass: PORTAL,
          customer: { id: 'c-1', firstName: 'Ada', lastName: null },
        },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    await bodyEl('[data-method="cash"]').trigger('click')
    await amountInput(0).setValue('100')
    // The installed Reka number field commits its model on blur.
    await amountInput(0).trigger('blur')
    await flushPromises()

    const footer = bodyEl('.sales-pos-checkout-footer')
    expect(footer.text()).toContain('Deuda a generar')
    expect(footer.get('[data-testid="confirm-charge"]').text()).toContain('Deuda')

    await wrapper.setProps({ externalError: 'No se pudo cobrar. Reintentá.' })
    expect(bodyEl('.sales-pos-checkout-footer').text()).toContain('No se pudo cobrar')

    await wrapper.setProps({ externalError: null, isSubmitting: true })
    expect(
      bodyEl('[data-testid="confirm-charge"]').attributes('disabled'),
    ).toBeDefined()
  })
})

// ── R7 — paid / partial / credit success and the forced re-quote decision ───

describe('R7 — success and re-quote windows own their native root', () => {
  it('themes and keeps the paid confirmation contract', async () => {
    const wrapper = track(
      mount(PaymentSuccessModal, {
        props: {
          open: true,
          folio: 'A-1',
          totalCents: 10000,
          paidCents: 10000,
          changeDueCents: 0,
          debtCents: 0,
          confirmedAt: '2026-05-06T21:00:00.000Z',
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toEqual({
      content: expect.stringContaining('sales-pos-checkout'),
    })
    expect(document.body.textContent).toContain('Pagado')
    const close = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Cerrar'),
    )
    expect(close).toBeDefined()
    await new DOMWrapper(close!).trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('keeps the re-quote non-dismissible and its explicit acceptance gate', async () => {
    const wrapper = track(
      mount(PromotionCapacityRequoteModal, {
        props: {
          open: true,
          subtotalCents: 12000,
          discountCents: 2000,
          totalCents: 10000,
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toEqual({
      content: expect.stringContaining('sales-pos-checkout'),
    })
    expect(wrapper.findComponent({ name: 'Modal' }).props('dismissible')).toBe(false)
    const requote = document.body.querySelector('[data-testid="requote-modal"]')
    expect(requote).not.toBeNull()
    expect(requote!.classList.contains('sales-pos-checkout-requote')).toBe(true)
    expect(wrapper.emitted('accept')).toBeUndefined()
    await bodyEl('[data-testid="requote-accept"]').trigger('click')
    expect(wrapper.emitted('accept')).toHaveLength(1)
  })
})

// ── R8 — support windows share the marker, hooks and public callbacks ───────

describe('R8 — supporting windows keep marker, hooks and callbacks', () => {
  const modalCases: Array<{
    name: string
    component: Component
    props: Record<string, unknown>
    hook: string
    stubs?: Record<string, Component>
  }> = [
    {
      name: 'GlobalDiscountModal',
      component: GlobalDiscountModal,
      props: { itemCount: 2, hasExistingDiscounts: false, onApplyGlobalDiscount: vi.fn() },
      hook: '.sales-pos-checkout-window',
    },
    {
      name: 'ItemDiscountModal',
      component: ItemDiscountModal,
      props: { item, onApplyDiscount: vi.fn() },
      hook: '.sales-pos-checkout-window',
    },
    {
      name: 'PriceOverrideModal',
      component: PriceOverrideModal,
      props: { saleId: 'sale-1', itemId: 'item-1', onSubmit: vi.fn() },
      hook: '.sales-pos-checkout-window',
    },
    {
      name: 'ProductDetailModal',
      component: ProductDetailModal,
      props: { productId: 'prod-1', variantId: null },
      hook: '.sales-pos-checkout-window',
      stubs: {
        UButton: { template: '<button type="button"><slot /></button>' },
        Button: { template: '<button type="button"><slot /></button>' },
      },
    },
    {
      name: 'VariantPickerModal',
      component: VariantPickerModal,
      props: { productId: 'prod-1', productName: 'Ibuprofeno', variants: [variantRow] },
      hook: '.sales-pos-checkout-variant-list',
    },
  ]

  it.each(modalCases)('$name appends the marker to its native root and keeps its hook', async ({ component, props, hook, stubs }) => {
    const wrapper = track(
      mount(component, {
        props: { open: true, ...props, portalClass: PORTAL },
        attachTo: document.body,
        global: stubs ? { stubs } : undefined,
      }),
    )
    await flushPromises()

    const ui = wrapper.findComponent({ name: 'Modal' }).props('ui') as { content?: string }
    expect(ui?.content).toContain(PORTAL)
    expect(ui?.content).toContain('sales-pos-checkout')
    expect(document.body.querySelector(hook)).not.toBeNull()
  })

  it('VariantPickerModal still emits add-variant from its real row', async () => {
    const wrapper = track(
      mount(VariantPickerModal, {
        props: {
          open: true,
          productId: 'prod-1',
          productName: 'Ibuprofeno',
          variants: [
            {
              id: 'var-1',
              name: 'Ibuprofeno 400mg',
              sku: 'IBU-400',
              barcode: null,
              mainImage: null,
              price: { priceCents: 8500, priceDecimal: 85, priceListName: 'PUBLICO' },
              stock: { quantity: 150, minQuantity: 10 },
            },
          ],
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    const row = document.body.querySelector<HTMLElement>('[data-testid="variant-row-var-1"]')!
    expect(row.classList.contains('sales-pos-checkout-variant-row')).toBe(true)
    row.click()
    await flushPromises()
    expect(wrapper.emitted('add-variant')?.[0]).toEqual(['prod-1', 'var-1'])
  })

  it('keeps the shared PriceListSelector defaults for the quotations opt-in', () => {
    const wrapper = track(
      mount(PriceListSelector, {
        props: { activeDraft: null, isMutating: false, portalClass: QUOTATIONS },
        global: queryGlobal(),
      }),
    )
    expect(wrapper.findComponent({ name: 'InputMenu' }).props('ui')).toEqual({
      content: QUOTATIONS,
    })
  })

  it('appends the checkout marker to the sales PriceListSelector listbox', () => {
    const wrapper = track(
      mount(PriceListSelector, {
        props: { activeDraft: null, isMutating: false, portalClass: PORTAL },
        global: queryGlobal(),
      }),
    )
    const ui = wrapper.findComponent({ name: 'InputMenu' }).props('ui') as { content: string }
    expect(ui.content).toContain(PORTAL)
    expect(ui.content).toContain('sales-pos-checkout')
  })

  it('never appends the checkout marker to a non-sales modal opt-in', async () => {
    const wrapper = track(
      mount(VariantPickerModal, {
        props: {
          open: true,
          productId: 'prod-1',
          productName: 'Ibuprofeno',
          variants: [],
          portalClass: FORM_PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toEqual({ content: FORM_PORTAL })
  })
})

// ── R9 — the omitted opt-in never paints the shared consumers ───────────────

describe('R9 — shared consumers keep their prior markers', () => {
  it('does not add the checkout marker to a shared modal without an opt-in', async () => {
    const wrapper = track(
      mount(GlobalDiscountModal, {
        props: {
          open: true,
          itemCount: 1,
          hasExistingDiscounts: false,
          onApplyGlobalDiscount: vi.fn(),
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toBeUndefined()
    expect(hasCheckoutMarker()).toBe(false)
  })

  it('keeps the CashSaleSessionPicker installed Select ui untouched without the opt-in', () => {
    const wrapper = track(
      mount(CashSaleSessionPicker, {
        props: {
          sessions: [linkedSession],
          selectedId: null,
          isSelectionEligible: false,
          isFetching: false,
          isError: false,
          page: 1,
          pageCount: 1,
          total: 1,
        },
      }),
    )
    expect(wrapper.findComponent({ name: 'Select' }).props('ui')).toBeUndefined()
  })
})

// ── R10 — the public charge workflow stays intact (draft switch lifecycle) ──

describe('R10 — draft lifecycle defaults', () => {
  it('keeps the prior body ui and a fresh unbound attempt on every open', async () => {
    const wrapper = track(
      mount(PaymentModal, {
        props: { open: false, saleId: 'sale-1', totalCents: 45050, portalClass: PORTAL },
        attachTo: document.body,
        global: queryGlobal(),
      }),
    )
    await flushPromises()

    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as { body: string }
    expect(ui.body).toBe('p-0 flex flex-col h-full')

    await wrapper.setProps({ open: true })
    await flushPromises()

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
  })
})
// ── R11 — exact-token opt-in: a near-match never receives the checkout paint ─

describe('R11 — the checkout marker requires the exact sales-entry-portal token', () => {
  const NEAR = 'hf-theme hf-ui not-sales-entry-portal'

  const modalCases: Array<{ name: string; component: Component; props: Record<string, unknown>; expected: string; stubs?: Record<string, Component> }> = [
    { name: 'GlobalDiscountModal', component: GlobalDiscountModal, props: { itemCount: 2, hasExistingDiscounts: false, onApplyGlobalDiscount: vi.fn() }, expected: NEAR },
    { name: 'ItemDiscountModal', component: ItemDiscountModal, props: { item, onApplyDiscount: vi.fn() }, expected: NEAR },
    { name: 'PriceOverrideModal', component: PriceOverrideModal, props: { saleId: 'sale-1', itemId: 'item-1', onSubmit: vi.fn() }, expected: NEAR },
    {
      name: 'ProductDetailModal',
      component: ProductDetailModal,
      props: { productId: 'prod-1', variantId: null },
      expected: NEAR,
      stubs: {
        UButton: { template: '<button type="button"><slot /></button>' },
        Button: { template: '<button type="button"><slot /></button>' },
      },
    },
    { name: 'VariantPickerModal', component: VariantPickerModal, props: { productId: 'prod-1', productName: 'Ibuprofeno', variants: [variantRow] }, expected: NEAR },
    {
      name: 'PaymentSuccessModal',
      component: PaymentSuccessModal,
      props: { folio: 'A-1', totalCents: 10000, paidCents: 10000, changeDueCents: 0, debtCents: 0, confirmedAt: '2026-05-06T21:00:00.000Z' },
      expected: `sm:max-w-md ${NEAR}`,
    },
    {
      name: 'PromotionCapacityRequoteModal',
      component: PromotionCapacityRequoteModal,
      props: { subtotalCents: 12000, discountCents: 2000, totalCents: 10000 },
      expected: `sm:max-w-md ${NEAR}`,
    },
  ]

  it.each(modalCases)('$name keeps a near-match token unpainted', async ({ component, props, expected, stubs }) => {
    const wrapper = track(
      mount(component, {
        props: { open: true, ...props, portalClass: NEAR },
        attachTo: document.body,
        global: stubs ? { stubs } : undefined,
      }),
    )
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Modal' }).props('ui')).toEqual({ content: expected })
    expect(hasCheckoutMarker()).toBe(false)
  })

  it('PriceListSelector keeps a near-match token unpainted', () => {
    const wrapper = track(
      mount(PriceListSelector, {
        props: { activeDraft: null, isMutating: false, portalClass: NEAR },
        global: queryGlobal(),
      }),
    )
    expect(wrapper.findComponent({ name: 'InputMenu' }).props('ui')).toEqual({ content: NEAR })
  })
})
