import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { computed } from 'vue'
import type { Component } from 'vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import GlobalDiscountModal from '../GlobalDiscountModal.vue'
import ItemDiscountModal from '../ItemDiscountModal.vue'
import PriceOverrideModal from '../PriceOverrideModal.vue'
import ProductDetailModal from '../ProductDetailModal.vue'
import PaymentSuccessModal from '../PaymentSuccessModal.vue'
import PromotionCapacityRequoteModal from '../PromotionCapacityRequoteModal.vue'
import CashSaleSessionPicker from '../CashSaleSessionPicker.vue'
import SaleItemRow from '../SaleItemRow.vue'
import PaymentModal from '../PaymentModal.vue'
import AssignCustomerSlideover from '../AssignCustomerSlideover.vue'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'
import type { SaleItem } from '../../interfaces/sale.types'
import type { Customer, CustomerAddress, CustomerDetail } from '@/features/POS/customers/interfaces/customer.types'
import type { PaginatedResponse } from '@/core/shared/types/table.types'

/*
 * Sales entry portal opt-ins — T3 / S1, S3-S5.
 *
 * Two things are proven here against the INSTALLED Nuxt UI / Reka primitives
 * (never against a stub):
 *
 *   1. the optional marker reaches the real native content root
 *      (`[data-slot="content"]`) and the primitive's own `ui` prop path, and
 *   2. omitting the opt-in leaves the prior `ui` value and native defaults
 *      exactly as they were (including the drawer's mobile geometry).
 *
 * The AppResponsiveDrawer seam is covered at both breakpoints and for lifecycle
 * forwarding, and the payment sheet's existing Caja binding contract is
 * re-checked with the opt-in enabled so the presentation change cannot have
 * moved it. `AssignCustomerSlideover` is shared and protected: the sales flow
 * reaches its step-2 labels/footer with a real `saleId`, so that reached state
 * is what this spec inspects.
 *
 * These are DOM/attribute contracts. They do not prove browser fidelity,
 * measured contrast or exhaustive visual acceptance.
 */
const PORTAL = 'hf-theme hf-ui sales-entry-portal'
const MOBILE_CONTENT =
  'h-[90dvh] max-h-[90dvh] rounded-t-2xl motion-reduce:transition-none'

const { mobileViewport } = vi.hoisted(() => ({ mobileViewport: { value: false } }))
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { computed: vueComputed } = await import('vue')
  return {
    ...actual,
    useBreakpoints: () => ({ smaller: () => vueComputed(() => mobileViewport.value) }),
  }
})

// Product/variant detail + available prices are the only data these dialogs
// read on open; the fixtures keep the mounts local and offline.
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

const cashAuth = vi.hoisted(() => ({
  accessToken: 'token-1' as string | null,
  currentTenantId: 'tenant-1',
  user: { id: 'user-1' } as { id: string } | null,
  permissionCodes: [] as string[],
  permissionsLoaded: true,
  isSuperAdmin: false,
  // Only `create:Customer` is granted: the Caja session read stays closed, so
  // the payment sheet keeps its legacy unbound path in this spec.
  userCan: (action: string, subject: string) => action === 'create' && subject === 'Customer',
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => cashAuth }))
vi.mock('@/features/POS/cash-register/api/cash.api', () => ({
  cashApi: { listSessions: vi.fn(async () => ({ data: [], total: 0 })) },
}))
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

const { assignCustomerMock, setShippingAddressMock, customerApiMock } = vi.hoisted(() => ({
  assignCustomerMock: vi.fn(),
  setShippingAddressMock: vi.fn(),
  customerApiMock: {
    getPaginated: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    createAddress: vi.fn(),
  },
}))
vi.mock('@/features/POS/customers/api/customer.api', () => ({ customerApi: customerApiMock }))
vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({ value: 'tenant-1' }),
}))
vi.mock('@/features/POS/sales/composables/useDraftCustomerAssignment', () => ({
  DraftCustomerAssignmentError: class DraftCustomerAssignmentError extends Error {
    constructor(public readonly code: string) {
      super(code)
    }
  },
  useDraftCustomerAssignment: () => ({
    assignCustomer: assignCustomerMock,
    setShippingAddress: setShippingAddressMock,
    isPending: { value: false },
    lastError: { value: null },
  }),
}))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

// jsdom has no layout engine, so Reka's listbox highlight calls
// `scrollIntoView`, and Reka's pointer-capture path needs the capture API.
// Local, test-only shims (product code is untouched).
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

afterEach(cleanup)

function contentRoots(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'))
}

function hasMarker(): boolean {
  return contentRoots().some((root) => root.classList.contains('sales-entry-portal'))
}

function freshQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
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

const sessions: CashSession[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'tenant-1',
    registerId: 'r-1',
    status: 'OPEN',
    cashierUserId: 'user-1',
    openingCents: 0,
    frozenAt: null,
    drawerReleasedAt: null,
    blind: false,
  },
]

type ModalCase = {
  name: string
  component: Component
  props: Record<string, unknown>
  priorContent?: string
  /** Extra stubs: e.g. the product detail footer links through the router. */
  stubs?: Record<string, Component>
}

const linkStub = { template: '<button type="button"><slot /></button>' }

const modalCases: ModalCase[] = [
  {
    name: 'GlobalDiscountModal',
    component: GlobalDiscountModal,
    props: { itemCount: 1, hasExistingDiscounts: false, onApplyGlobalDiscount: vi.fn() },
  },
  {
    name: 'ItemDiscountModal',
    component: ItemDiscountModal,
    props: { item, onApplyDiscount: vi.fn() },
  },
  {
    name: 'PriceOverrideModal',
    component: PriceOverrideModal,
    props: { saleId: 'sale-1', itemId: 'item-1', onSubmit: vi.fn() },
  },
  {
    name: 'ProductDetailModal',
    component: ProductDetailModal,
    props: { productId: 'prod-1', variantId: null },
    stubs: { UButton: linkStub, Button: linkStub },
  },
  {
    name: 'PaymentSuccessModal',
    component: PaymentSuccessModal,
    props: { folio: 'A-1', totalCents: 10000, paidCents: 10000, confirmedAt: '2026-05-06T21:00:00.000Z' },
    priorContent: 'sm:max-w-md',
  },
  {
    name: 'PromotionCapacityRequoteModal',
    component: PromotionCapacityRequoteModal,
    props: { subtotalCents: 12000, discountCents: 2000, totalCents: 10000 },
    priorContent: 'sm:max-w-md',
  },
]

describe('Sales entry portal opt-in — installed native content roots', () => {
  it.each(modalCases)(
    '$name themes the installed Modal content root only when opted in',
    async ({ component, props, priorContent, stubs }) => {
      const global = stubs ? { stubs } : undefined
      const optedIn = track(
        mount(component, {
          props: { open: true, ...props, portalClass: PORTAL },
          attachTo: document.body,
          global,
        }),
      )
      await flushPromises()

      const ui = optedIn.findComponent({ name: 'Modal' }).props('ui') as
        | { content?: string }
        | undefined
      expect(ui?.content).toContain(PORTAL)
      expect(hasMarker()).toBe(true)

      cleanup()

      const inert = track(
        mount(component, { props: { open: true, ...props }, attachTo: document.body, global }),
      )
      await flushPromises()

      const inertUi = inert.findComponent({ name: 'Modal' }).props('ui') as
        | { content?: string }
        | undefined
      // Omission keeps the prior `ui` value exactly — never a new empty object.
      expect(inertUi?.content).toBe(priorContent)
      expect(inertUi).toEqual(priorContent === undefined ? undefined : { content: priorContent })
      expect(hasMarker()).toBe(false)
    },
  )

  it('CashSaleSessionPicker forwards the marker to the installed Select listbox only when opted in', async () => {
    const optedIn = track(
      mount(CashSaleSessionPicker, {
        props: {
          sessions,
          selectedId: null,
          isSelectionEligible: false,
          isFetching: false,
          isError: false,
          page: 1,
          pageCount: 1,
          total: 1,
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )

    expect(optedIn.findComponent({ name: 'Select' }).props('ui')).toEqual({ content: PORTAL })

    const trigger = optedIn.get('[data-testid="cash-session-select"]')
    await trigger.trigger('pointerdown')
    await trigger.trigger('click')
    await flushPromises()
    expect(hasMarker()).toBe(true)

    cleanup()

    const inert = track(
      mount(CashSaleSessionPicker, {
        props: {
          sessions,
          selectedId: null,
          isSelectionEligible: false,
          isFetching: false,
          isError: false,
          page: 1,
          pageCount: 1,
          total: 1,
        },
        attachTo: document.body,
      }),
    )
    expect(inert.findComponent({ name: 'Select' }).props('ui')).toBeUndefined()
  })

  it('SaleItemRow forwards the marker to its installed row menu only when opted in', async () => {
    const optedIn = track(
      mount(SaleItemRow, {
        props: {
          item, saleId: 'sale-1', portalClass: PORTAL,
          onSubmitPriceOverride: vi.fn(async () => undefined),
          onApplyDiscount: vi.fn(async () => undefined),
          onRemoveDiscount: vi.fn(async () => undefined),
        },
        attachTo: document.body,
      }),
    )

    expect(optedIn.findComponent({ name: 'DropdownMenu' }).props('ui')).toEqual({
      content: PORTAL,
    })

    cleanup()

    const inert = track(
      mount(SaleItemRow, {
        props: {
          item, saleId: 'sale-1',
          onSubmitPriceOverride: vi.fn(async () => undefined),
          onApplyDiscount: vi.fn(async () => undefined),
          onRemoveDiscount: vi.fn(async () => undefined),
        },
        attachTo: document.body,
      }),
    )
    expect(inert.findComponent({ name: 'DropdownMenu' }).props('ui')).toBeUndefined()
  })

  it('PaymentModal keeps its prior slideover ui and Caja binding when opted in', async () => {
    const optedIn = track(
      mount(PaymentModal, {
        props: {
          open: true,
          saleId: 'sale-1',
          totalCents: 45050,
          portalClass: PORTAL,
        },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]] },
      }),
    )
    await flushPromises()

    const ui = optedIn.findComponent({ name: 'Slideover' }).props('ui') as {
      content: string
      body: string
    }
    // Prior geometry/body are preserved; only the content marker is appended.
    expect(ui.body).toBe('p-0 flex flex-col h-full')
    expect(ui.content).toContain('sm:max-w-lg overflow-hidden')
    expect(ui.content).toContain(PORTAL)
    expect(hasMarker()).toBe(true)

    // The existing unbound (legacy) charge body is untouched by the opt-in:
    // `cashSessionId` is only ever present after an explicit selection. The
    // sheet content is teleported, so it is queried from the document body.
    const cashTile = document.body.querySelector<HTMLElement>('[data-testid="add-payment-entry"]')
    expect(cashTile).not.toBeNull()
    cashTile!.click()
    await flushPromises()

    const confirm = document.body.querySelector<HTMLElement>('[data-testid="confirm-charge"]')
    expect(confirm).not.toBeNull()
    confirm!.click()
    await flushPromises()

    const submitted = optedIn.emitted('submit')?.[0]?.[0] as {
      payload: Record<string, unknown>
    }
    expect(submitted.payload).toEqual({ method: 'cash', amountCents: 45050 })
    expect('cashSessionId' in submitted.payload).toBe(false)

    cleanup()

    const inert = track(
      mount(PaymentModal, {
        props: { open: true, saleId: 'sale-1', totalCents: 45050 },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]] },
      }),
    )
    await flushPromises()

    const inertUi = inert.findComponent({ name: 'Slideover' }).props('ui') as {
      content: string
    }
    expect(inertUi.content).toBe('sm:max-w-lg overflow-hidden')
    expect(hasMarker()).toBe(false)
  })
})

describe('AppResponsiveDrawer portalClass seam — installed native roots', () => {
  beforeEach(() => {
    mobileViewport.value = false
  })

  it('owns the mobile native content root and keeps the sheet geometry', async () => {
    mobileViewport.value = true
    const wrapper = track(
      mount(AppResponsiveDrawer, {
        props: { open: true, title: 'Carrito', portalClass: PORTAL },
        slots: { body: '<div data-testid="drawer-body" />' },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as { content: string }
    expect(ui.content).toBe(`${MOBILE_CONTENT} ${PORTAL}`)
    expect(hasMarker()).toBe(true)

    // The slot content stays inside the marker boundary.
    expect(document.body.querySelector('[data-testid="drawer-body"]')).not.toBeNull()
  })

  it('keeps the mobile native defaults untouched when the seam is omitted', async () => {
    mobileViewport.value = true
    const wrapper = track(
      mount(AppResponsiveDrawer, {
        props: { open: true, title: 'Carrito' },
        slots: { body: '<div data-testid="drawer-body" />' },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as { content: string }
    expect(ui.content).toBe(MOBILE_CONTENT)
    expect(hasMarker()).toBe(false)
  })

  it('owns the desktop native content root through a conditional merge', async () => {
    const wrapper = track(
      mount(AppResponsiveDrawer, {
        props: {
          open: true,
          title: 'Carrito',
          desktopUi: { content: 'sm:!max-w-[520px]', body: 'p-0' },
          portalClass: PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    const ui = wrapper.findComponent({ name: 'Slideover' }).props('ui') as {
      content: string
      body: string
    }
    expect(ui.body).toBe('p-0')
    expect(ui.content).toBe(`sm:!max-w-[520px] ${PORTAL}`)
    expect(hasMarker()).toBe(true)
  })

  it('leaves the desktop ui default exactly as passed when the seam is omitted', async () => {
    const desktopUi = { content: 'sm:!max-w-[520px]', body: 'p-0' }
    const wrapper = track(
      mount(AppResponsiveDrawer, {
        props: { open: true, title: 'Carrito', desktopUi },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    expect(wrapper.findComponent({ name: 'Slideover' }).props('ui')).toEqual(desktopUi)
    expect(hasMarker()).toBe(false)
  })

  it('forwards lifecycle events exactly once with the opt-in enabled', async () => {
    mobileViewport.value = true
    const wrapper = track(
      mount(AppResponsiveDrawer, {
        props: { open: true, title: 'Carrito', portalClass: PORTAL },
        attachTo: document.body,
      }),
    )
    await flushPromises()

    const slideover = wrapper.findComponent({ name: 'Slideover' })
    slideover.vm.$emit('update:open', false)
    slideover.vm.$emit('after:leave')
    await flushPromises()

    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('after:leave')).toHaveLength(1)
  })
})

describe('AssignCustomerSlideover — reached sales flow keeps the opted-in boundary', () => {
  const adapter = readFileSync('src/features/POS/sales/styles/sales-entry-visual.css', 'utf8')
  const forcedBlock = adapter.replace(/\/\*[\s\S]*?\*\//g, '').match(/([^{}]+)\{[^{}]*!important[^{}]*\}/)!
  const forcedSelector = forcedBlock[1]!.trim()
  function cardPaint(card: Element) {
    const style = document.createElement('style')
    style.textContent = adapter.replace(/^@import.*$/gm, '')
    document.head.append(style)
    try {
      return Array.from(style.sheet!.cssRules).filter((rule): rule is CSSStyleRule => rule.type === CSSRule.STYLE_RULE)
        .find(rule => rule.style.getPropertyValue('background-color') === 'var(--hf-surface)' && card.matches(rule.selectorText))
    } finally { style.remove() }
  }
  function makeAddress(id: string): CustomerAddress {
    return {
      id,
      customerId: 'customer-1',
      street: 'Main St',
      exteriorNumber: '10',
      interiorNumber: null,
      zipCode: '64000',
      neighborhood: 'Centro',
      municipality: 'Monterrey',
      city: 'Monterrey',
      state: 'Nuevo León',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
  }

  function makeCustomer(): Customer {
    return {
      id: 'customer-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      phoneCountryCode: '+52',
      phone: '5512345678',
      email: 'ada@example.com',
      globalPriceListId: null,
      globalPriceListName: null,
      comments: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
  }

  function makeDetail(customer: Customer, addresses: CustomerAddress[]): CustomerDetail {
    return {
      ...customer,
      businessName: null,
      fiscalZipCode: null,
      rfc: null,
      fiscalRegime: null,
      billingStreet: null,
      billingExteriorNumber: null,
      billingInteriorNumber: null,
      billingZipCode: null,
      billingNeighborhood: null,
      billingMunicipality: null,
      billingCity: null,
      billingState: null,
      addresses,
    }
  }

  function makePaginated(customers: Customer[]): PaginatedResponse<Customer> {
    return {
      data: customers,
      pagination: { pageIndex: 0, pageSize: 10, totalCount: customers.length, pageCount: 1 },
    }
  }

  beforeEach(() => {
    assignCustomerMock.mockReset()
    setShippingAddressMock.mockReset()
    assignCustomerMock.mockResolvedValue(undefined)
    setShippingAddressMock.mockResolvedValue(undefined)
    customerApiMock.getPaginated.mockReset()
    customerApiMock.getById.mockReset()
  })

  it.each([PORTAL, 'hf-theme hf-ui quotations-portal', undefined])('does not force step-1 outline/empty CTAs (portal=%s)', async (portalClass) => {
    customerApiMock.getPaginated.mockResolvedValue(makePaginated([]))
    track(mount(AssignCustomerSlideover, {
      props: { open: true, saleId: 'sale-1', portalClass }, attachTo: document.body,
      global: {
        plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]],
        stubs: { CustomerUpsertSlideover: { template: '<div />' }, AddressModal: { template: '<div />' } },
      },
    }))
    await flushPromises()
    const buttons = Array.from(document.body.querySelectorAll('[data-testid="open-create-customer"]'))
    expect(buttons).toHaveLength(2)
    for (const button of buttons) expect(button.matches(forcedSelector)).toBe(false)
    expect(buttons[0]!.classList.contains('hf-primary-control')).toBe(false)
    expect(buttons[1]!.classList.contains('hf-primary-control')).toBe(Boolean(portalClass))
  })

  it('reaches step 2 with a real saleId and keeps the marker on the native root', async () => {
    const customer = makeCustomer()
    customerApiMock.getPaginated.mockResolvedValue(makePaginated([customer]))
    customerApiMock.getById.mockResolvedValue(makeDetail(customer, [makeAddress('address-1')]))

    const wrapper = track(
      mount(AssignCustomerSlideover, {
        props: { open: true, saleId: 'sale-1', portalClass: PORTAL },
        attachTo: document.body,
        global: {
          plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]],
          stubs: {
            CustomerUpsertSlideover: { template: '<div />' },
            AddressModal: { template: '<div />' },
          },
        },
      }),
    )
    await flushPromises()

    const row = document.body.querySelector('[data-testid="customer-row-customer-1"]')!
    expect(row).not.toBeNull()
    expect(row.getAttribute('data-slot')).toBe('root')
    expect(cardPaint(row)).toBeDefined()
    const outlineCta = document.body.querySelector('[data-testid="open-create-customer"]')!
    expect(outlineCta.matches(forcedSelector)).toBe(false)
    ;(row as HTMLElement).click()
    await flushPromises()

    // The real sales flow keeps the sheet open and moves to address selection.
    expect(wrapper.emitted('update:open') ?? []).toEqual([])
    expect(document.body.querySelector('[data-testid="skip-shipping-address"]')).not.toBeNull()
    expect(
      document.body.querySelector('[data-testid="shipping-address-option-address-1"]'),
    ).not.toBeNull()

    // Reached footer/labels are exactly what the feature stylesheet corrects:
    // the forced legacy CTA and the gold-family labels the boundary repaints.
    const footerCta = document.body.querySelector('[data-testid="open-create-customer"]')
    expect(footerCta).not.toBeNull()
    expect(footerCta!.matches(forcedSelector)).toBe(true)
    for (const testId of ['skip-shipping-address', 'shipping-address-option-address-1']) {
      const card = document.body.querySelector(`[data-testid="${testId}"]`)!
      expect(card.getAttribute('data-slot')).toBe('root')
      expect(cardPaint(card)).toBeDefined()
    }
    const root = footerCta!.closest('.sales-entry-portal')!
    root.classList.replace('sales-entry-portal', 'quotations-portal')
    expect(footerCta!.matches(forcedSelector)).toBe(false)
    expect(cardPaint(document.body.querySelector('[data-testid="skip-shipping-address"]')!)).toBeUndefined()
    root.classList.replace('quotations-portal', 'sales-entry-portal')
    expect(document.body.querySelectorAll('[class~="text-coco-gold-800"]').length).toBeGreaterThan(
      0,
    )
    expect(document.body.textContent).toContain('Seleccionado')
    expect(document.body.textContent).toContain('Cambiar cliente')

    // The boundary itself is on the installed native content root.
    expect(hasMarker()).toBe(true)
  })
})
