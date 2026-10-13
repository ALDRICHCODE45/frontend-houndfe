import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { reactive } from 'vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import AssignCustomerSlideover from '../AssignCustomerSlideover.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ActiveSalePanel from '../ActiveSalePanel.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import CustomerUpsertSlideover from '@/features/POS/customers/components/CustomerUpsertSlideover.vue'
import { customerApi } from '@/features/POS/customers/api/customer.api'
import {
  resetMapProvider,
  setMapProvider,
  type CreateMapOptions,
  type MapProvider,
} from '@/core/shared/maps/map-provider'
import type { PaginatedResponse } from '@/core/shared/types/table.types'
import type {
  Customer,
  CustomerAddress,
  CustomerDetail,
} from '@/features/POS/customers/interfaces/customer.types'
import type { Sale } from '../../interfaces/sale.types'

/*
 * T7 — the complete customer / address presentation when it is opened from
 * Venta (S1-S7).
 *
 * Three things have to be proven together, so they live in one spec:
 *
 *   1. the gate is the real `sales-pos-customer` portal token, never any
 *      truthy `portalClass`. Quotations own a different token and must keep
 *      the accepted presentation, including the step-2 legacy CTA that
 *      `SalesEntryPortalTheme.spec.ts` protects.
 *   2. the narrow opt-in forwarding reaches the ACTUAL teleported roots of the
 *      shared wrappers (`Nuevo cliente`, `Añadir dirección` and the select
 *      popups inside them) by APPENDING the sale-only marker to each wrapper's
 *      own default. Omitting the opt-in yields the byte-identical prior value,
 *      which is what `clients-form-portal` consumers keep.
 *   3. the sale presentation itself is real: a labelled search, a secondary
 *      outlined new-client action, a readable contact hierarchy, context that
 *      only reflects loaded state, a clear no-address option, 44px targets and
 *      keyboard access. Public events, queries and permissions stay untouched.
 *
 * These are DOM/attribute contracts in jsdom. They do not prove browser
 * fidelity, measured contrast or visual acceptance; that stays user-owned.
 */

const SALE_PORTAL = 'hf-theme hf-ui sales-entry-portal sales-pos-customer'
const ENTRY_PORTAL = 'hf-theme hf-ui sales-entry-portal'
const QUOTATION_PORTAL = 'hf-theme hf-ui hf-form-overlay quotations-workspace-portal'

/** The nested sale-only marker, appended (never replacing) each default. */
const FORM_MARKER = 'sales-pos-customer-form'

const CUSTOMER_SHELL_DEFAULT = 'hf-theme hf-ui hf-form-overlay clients-form-portal'
const ADDRESS_MODAL_DEFAULT = 'sm:max-w-lg hf-theme hf-ui hf-form-overlay clients-form-portal'

const assignCustomerMock = vi.fn()
const setShippingAddressMock = vi.fn()
const authStoreMock = reactive({
  userCan: vi.fn((_action: string, _subject: string) => true),
})
const customerApiMock = vi.mocked(customerApi)

vi.mock('@/features/POS/customers/api/customer.api', () => ({
  customerApi: {
    getPaginated: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    createAddress: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authStoreMock,
}))

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

// The real AddressMapPicker stays real; only the tile/geocode boundary is
// replaced, exactly like the accepted AddressModal spec does.
const MOCK_MAP_PROVIDER: MapProvider = {
  kind: 'leaflet',
  createMap(_container: HTMLElement, _opts: CreateMapOptions) {
    return {
      setMarker: () => undefined,
      clearMarker: () => undefined,
      getMarker: () => null,
      getPopupText: () => null,
      isMarkerDraggable: () => false,
      simulateMarkerDrag: () => undefined,
      simulateTileError: () => undefined,
      destroy: () => undefined,
    }
  },
  geocode: async () => null,
}

beforeAll(() => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  setMapProvider(MOCK_MAP_PROVIDER)
  assignCustomerMock.mockReset().mockResolvedValue(undefined)
  setShippingAddressMock.mockReset().mockResolvedValue(undefined)
  customerApiMock.getPaginated.mockReset()
  customerApiMock.getById.mockReset()
  vi.mocked(authStoreMock.userCan).mockReset().mockReturnValue(true)
})

const wrappers: VueWrapper[] = []

function track<T extends VueWrapper>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  while (wrappers.length) {
    const wrapper = wrappers.pop()!
    try {
      wrapper.unmount()
    } catch {
      /* already unmounted */
    }
  }
  document.body.innerHTML = ''
  resetMapProvider()
})

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
    latitude: null,
    longitude: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
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
    ...overrides,
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

function freshQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function mountSheet(options: {
  portalClass?: string
  saleId?: string
  stubChildren?: boolean
} = {}) {
  const { portalClass, saleId = 'sale-1', stubChildren = false } = options
  return track(
    mount(AssignCustomerSlideover, {
      props: { open: true, saleId, portalClass },
      attachTo: document.body,
      global: {
        plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]],
        ...(stubChildren
          ? {
              stubs: {
                CustomerUpsertSlideover: {
                  name: 'CustomerUpsertSlideover',
                  props: ['portalClass'],
                  template: '<div />',
                },
                AddressModal: {
                  name: 'AddressModal',
                  props: ['portalClass'],
                  template: '<div />',
                },
              },
            }
          : {}),
      },
    }),
  )
}

function contentRoots(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'))
}

function seedCustomers() {
  customerApiMock.getPaginated.mockResolvedValue(makePaginated([makeCustomer()]))
  customerApiMock.getById.mockResolvedValue(
    makeDetail(makeCustomer(), [makeAddress('address-1')]),
  )
}

/** The real sale flow: pick a customer, stay open, land on the address step. */
async function openAtAddressStep(options: { portalClass?: string } = {}) {
  seedCustomers()
  const wrapper = mountSheet(options)
  await flushPromises()
  const row = document.body.querySelector<HTMLElement>('[data-testid="customer-row-customer-1"]')!
  expect(row, 'the customer card must render before the sheet can advance').not.toBeNull()
  row.click()
  await flushPromises()
  expect(
    document.body.querySelector('[data-testid="shipping-address-option-address-1"]'),
    'the address step must be reached',
  ).not.toBeNull()
  return wrapper
}

// ── S1/S4 — the gate is the token, and the defaults stay byte-exact ─────────

describe('SalesPosCustomer gate — the opt-in is the venta token, not any portalClass', () => {
  it('marks the installed slideover root only when the venta token is present', async () => {
    mountSheet({ portalClass: SALE_PORTAL })
    await flushPromises()
    expect(
      contentRoots().some((root) => root.classList.contains('sales-pos-customer')),
    ).toBe(true)

    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''

    mountSheet({ portalClass: QUOTATION_PORTAL })
    await flushPromises()
    for (const root of contentRoots()) {
      expect(root.classList.contains('sales-pos-customer')).toBe(false)
      expect(root.classList.contains('sales-pos-customer-form')).toBe(false)
    }
  })

  it('forwards the nested form marker only to the venta path', async () => {
    const sale = mountSheet({ portalClass: SALE_PORTAL, stubChildren: true })
    await flushPromises()
    expect(sale.findComponent(CustomerUpsertSlideover).props('portalClass')).toBe(FORM_MARKER)

    const quotation = mountSheet({ portalClass: QUOTATION_PORTAL, stubChildren: true })
    await flushPromises()
    expect(quotation.findComponent(CustomerUpsertSlideover).props('portalClass')).toBeUndefined()

    const bare = mountSheet({ stubChildren: true })
    await flushPromises()
    expect(bare.findComponent(CustomerUpsertSlideover).props('portalClass')).toBeUndefined()
  })

  it('reaches the real Nuevo cliente root and keeps the shared default otherwise', async () => {
    mountSheet({ portalClass: SALE_PORTAL })
    await flushPromises()
    document
      .body.querySelector<HTMLElement>('[data-testid="open-create-customer"]')!
      .click()
    await flushPromises()
    const shells = contentRoots().filter((root) =>
      root.classList.contains('clients-form-portal'),
    )
    expect(shells).toHaveLength(1)
    for (const token of CUSTOMER_SHELL_DEFAULT.split(' ').concat(FORM_MARKER)) {
      expect(shells[0]!.classList.contains(token), token).toBe(true)
    }
  })

  it('keeps the untouched Clients default when the marker is not forwarded', async () => {
    mountSheet({ portalClass: QUOTATION_PORTAL })
    await flushPromises()
    document
      .body.querySelector<HTMLElement>('[data-testid="open-create-customer"]')!
      .click()
    await flushPromises()
    const shells = contentRoots().filter((root) => root.classList.contains('clients-form-portal'))
    expect(shells).toHaveLength(1)
    expect(shells[0]!.classList.contains(FORM_MARKER)).toBe(false)
    for (const token of CUSTOMER_SHELL_DEFAULT.split(' ')) {
      expect(shells[0]!.classList.contains(token), token).toBe(true)
    }
  })

  it('forwards the marker to every reachable AddressModal, including through Nuevo cliente', async () => {
    const wrapper = await openAtAddressStep({ portalClass: SALE_PORTAL })
    document.body.querySelector<HTMLElement>('[data-testid="open-create-address"]')!.click()
    await flushPromises()
    const modal = contentRoots().find((root) => root.classList.contains('sm:max-w-lg'))!
    expect(modal, 'the address modal must render on its native root').not.toBeNull()
    for (const token of ADDRESS_MODAL_DEFAULT.split(' ').concat(FORM_MARKER)) {
      expect(modal.classList.contains(token), token).toBe(true)
    }
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('keeps the address modal default for consumers outside the venta token', async () => {
    await openAtAddressStep({ portalClass: QUOTATION_PORTAL })
    document.body.querySelector<HTMLElement>('[data-testid="open-create-address"]')!.click()
    await flushPromises()
    const modal = contentRoots().find((root) => root.classList.contains('sm:max-w-lg'))!
    expect(modal.classList.contains(FORM_MARKER)).toBe(false)
    for (const token of ADDRESS_MODAL_DEFAULT.split(' ')) {
      expect(modal.classList.contains(token), token).toBe(true)
    }
  })

  it.each([
    { name: 'omitted opt-in', portalClass: undefined, saleVariant: false },
    { name: 'non-sale opt-in', portalClass: QUOTATION_PORTAL, saleVariant: false },
    { name: 'sale opt-in', portalClass: SALE_PORTAL, saleVariant: true },
  ])('preserves address-step content and action roles for $name', async ({ portalClass, saleVariant }) => {
    // A saleId makes this public default path reachable; this is not a claim
    // that the quotation caller currently advances to the address step.
    const wrapper = await openAtAddressStep({ portalClass })
    const contact = document.body.querySelector<HTMLElement>(
      '.sales-pos-customer-selected .sales-pos-customer-contact',
    )
    expect(contact !== null).toBe(saleVariant)
    if (saleVariant) {
      expect(contact!.textContent).toContain('ada@example.com')
      expect(contact!.textContent).toContain('+52 5512345678')
    }
    const newAddress = document.body.querySelector<HTMLElement>('[data-testid="open-create-address"]')!
    expect(newAddress.textContent).toContain('+ Nueva dirección')
    expect(newAddress.classList.contains('ring')).toBe(saleVariant)
    expect(assignCustomerMock).toHaveBeenCalledExactlyOnceWith({ customerId: 'customer-1' })
    expect(setShippingAddressMock).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })

  it('imports the adapter from the sheet and never from the view', () => {
    const sheet = readFileSync('src/features/POS/sales/components/AssignCustomerSlideover.vue', 'utf8')
    const view = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')
    expect(sheet).toContain("import '../styles/sales-pos-customer.css'")
    expect(view).not.toContain('sales-pos-customer.css')
  })
})

// ── S2/S3/S5 — the sale sheet itself ────────────────────────────────────────

describe('SalesPosCustomer sheet — readable, labelled, real-state presentation', () => {
  it('labels the search and gives the new-client action a secondary, full-width role', async () => {
    customerApiMock.getPaginated.mockResolvedValue(makePaginated([makeCustomer()]))
    mountSheet({ portalClass: SALE_PORTAL })
    await flushPromises()

    const label = document.body.querySelector<HTMLLabelElement>('label.sales-pos-customer-search-label')
    expect(label, 'the venta search needs a visible label').not.toBeNull()
    expect(label!.textContent?.trim()).toBe('Buscar cliente')
    const inputId = label!.getAttribute('for')!
    const input = document.getElementById(inputId)
    expect(input).not.toBeNull()
    expect(input!.tagName).toBe('INPUT')

    const cta = document.body.querySelector<HTMLElement>('[data-testid="open-create-customer"]')!
    expect(cta.classList.contains('sales-pos-customer-new-customer')).toBe(true)
    expect(cta.className).not.toMatch(/!bg-\(|!text-black|!font-\(|!text-\(/)
  })

  it('does not add the sale-only label for other consumers', async () => {
    customerApiMock.getPaginated.mockResolvedValue(makePaginated([makeCustomer()]))
    mountSheet({ portalClass: QUOTATION_PORTAL })
    await flushPromises()
    expect(
      document.body.querySelector('label.sales-pos-customer-search-label'),
    ).toBeNull()
    expect(
      document.getElementById('sales-pos-customer-search-input'),
    ).toBeNull()
  })

  it('keeps the contact card hierarchy and makes it keyboard reachable', async () => {
    customerApiMock.getPaginated.mockResolvedValue(makePaginated([makeCustomer()]))
    mountSheet({ portalClass: SALE_PORTAL })
    await flushPromises()

    const card = document.body.querySelector<HTMLElement>('[data-testid="customer-row-customer-1"]')!
    expect(card.getAttribute('role')).toBe('button')
    expect(card.getAttribute('tabindex')).toBe('0')
    expect(card.querySelector('.sales-pos-customer-card-name')?.textContent).toContain('Ada Lovelace')
    const meta = card.querySelector('.sales-pos-customer-card-meta')!
    expect(meta.textContent).toContain('ada@example.com')
    expect(meta.textContent).toContain('5512345678')

    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()
    expect(assignCustomerMock).toHaveBeenCalledWith({ customerId: 'customer-1' })
  })

  it('leaves the non-venta card markup exactly as it was', async () => {
    customerApiMock.getPaginated.mockResolvedValue(makePaginated([makeCustomer()]))
    mountSheet({ portalClass: QUOTATION_PORTAL })
    await flushPromises()
    const card = document.body.querySelector<HTMLElement>('[data-testid="customer-row-customer-1"]')!
    expect(card.getAttribute('role')).toBeNull()
    expect(card.getAttribute('tabindex')).toBeNull()
  })

  it('drops the duplicate new-client action from the venta address step only', async () => {
    await openAtAddressStep({ portalClass: SALE_PORTAL })
    expect(document.body.querySelectorAll('[data-testid="open-create-customer"]')).toHaveLength(0)
    // the address action and its permission gate stay reachable
    expect(document.body.querySelector('[data-testid="open-create-address"]')).not.toBeNull()

    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''

    // Same flow, non-venta portal token: the accepted legacy footer survives.
    await openAtAddressStep({ portalClass: ENTRY_PORTAL })
    const footerCta = document.body.querySelector<HTMLElement>('[data-testid="open-create-customer"]')!
    expect(footerCta).not.toBeNull()
    expect(footerCta.getAttribute('class')).toContain('!bg-(--brand-action)')
    expect(footerCta.getAttribute('class')).toContain('!text-black')
  })

  it('keeps both nested entry points behind the create permission', async () => {
    vi.mocked(authStoreMock.userCan).mockReturnValue(false)
    await openAtAddressStep({ portalClass: SALE_PORTAL })
    expect(document.body.querySelectorAll('[data-testid="open-create-customer"]')).toHaveLength(0)
    expect(document.body.querySelectorAll('[data-testid="open-create-address"]')).toHaveLength(0)
  })

  it('shows only state that actually exists on the address step', async () => {
    await openAtAddressStep({ portalClass: SALE_PORTAL })
    const header = document.body.querySelector('.sales-pos-customer-selected')!
    expect(header).not.toBeNull()
    expect(header.textContent).toContain('Ada Lovelace')
    expect(header.textContent).toContain('ada@example.com')
    expect(header.textContent).toContain('5512345678')

    // No invented selection draft: nothing is marked chosen before it is saved.
    for (const card of document.body.querySelectorAll(
      '[data-testid="shipping-address-option-address-1"], [data-testid="skip-shipping-address"]',
    )) {
      expect(card.getAttribute('aria-pressed')).toBeNull()
      expect(card.getAttribute('aria-checked')).toBeNull()
      expect(card.getAttribute('data-state')).toBeNull()
      expect(card.classList.contains('sales-pos-customer-card')).toBe(true)
    }
    expect(document.body.textContent).not.toContain('Usar selección')
    expect(document.body.textContent).not.toContain('vista previa')

    const noAddress = document.body.querySelector('[data-testid="skip-shipping-address"]')!
    expect(noAddress.textContent).toContain('Sin dirección de envío')
    expect(noAddress.querySelector('.sales-pos-customer-card-meta')?.textContent).toContain(
      'El cliente recogerá en persona',
    )
  })

  it('clears the legacy forced literals only under the venta token', async () => {
    await openAtAddressStep({ portalClass: SALE_PORTAL })
    const forced = Array.from(document.body.querySelectorAll<HTMLElement>('[class]')).filter((el) =>
      /(^|\s)!(?:bg|text|font|border|ring)-/.test(el.className?.toString() ?? ''),
    )
    expect(forced.map((el) => el.className)).toEqual([])
    expect(
      document.body.querySelector('.sales-pos-customer-selected [data-testid="change-customer-step"]')!
        .getAttribute('class'),
    ).not.toContain('text-coco-gold-800')
    expect(
      document.body.querySelector('.sales-pos-customer-selected [data-testid="change-customer-step"]')!
        .getAttribute('class'),
    ).toContain('sales-pos-customer-change')

    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    document.body.innerHTML = ''

    await openAtAddressStep({ portalClass: QUOTATION_PORTAL })
    expect(
      document.body.querySelector('[data-testid="change-customer-step"]')!.getAttribute('class'),
    ).toContain('text-coco-gold-800')
  })

  it('keeps the immediate assign and address-save behaviour', async () => {
    const wrapper = await openAtAddressStep({ portalClass: SALE_PORTAL })
    expect(assignCustomerMock).toHaveBeenCalledTimes(1)
    document.body.querySelector<HTMLElement>('[data-testid="shipping-address-option-address-1"]')!.click()
    await flushPromises()
    expect(setShippingAddressMock).toHaveBeenCalledWith({ shippingAddressId: 'address-1' })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('keeps the no-address choice reachable', async () => {
    const wrapper = await openAtAddressStep({ portalClass: SALE_PORTAL })
    document.body.querySelector<HTMLElement>('[data-testid="skip-shipping-address"]')!.click()
    await flushPromises()
    expect(setShippingAddressMock).toHaveBeenCalledWith({ shippingAddressId: null })
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})

// ── S1 — the cart trigger and the assigned / unassigned summary ─────────────

function makeDraft(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [],
    customer: null,
    shippingAddress: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountPanel(activeDraft: Sale | null, isCustomerMutationPending = false, portalClass?: string) {
  return track(
    mount(ActiveSalePanel, {
      props: {
        drafts: activeDraft ? [activeDraft] : [],
        activeDraft,
        activeTabId: activeDraft?.id ?? null,
        isLoadingList: false,
        isMutating: false,
        isCustomerMutationPending,
        ...(portalClass ? { portalClass } : {}),
        onSubmitPriceOverride: vi.fn(async () => undefined),
        onApplyDiscount: vi.fn(async () => undefined),
        onRemoveDiscount: vi.fn(async () => undefined),
        onRemoveItem: vi.fn(async () => undefined),
        onApplyGlobalDiscount: vi.fn(async () => undefined),
        onRemoveGlobalDiscount: vi.fn(async () => undefined),
        isLoadingPromotions: false,
        appliedManualPromotionIds: [],
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient: freshQueryClient() }]],
        stubs: {
          USlideover: { template: '<div />' },
          Slideover: { template: '<div />' },
          UTabs: { template: '<div />' },
          Tabs: { template: '<div />' },
          UTooltip: { template: '<div><slot /></div>' },
          UDropdownMenu: { template: '<div><slot /></div>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: {
            name: 'UButton',
            props: ['label', 'disabled', 'variant', 'color', 'loading'],
            emits: ['click'],
            inheritAttrs: false,
            template:
              '<button :disabled="disabled" v-on="$attrs" :data-variant="variant" :data-color="color">{{ label }}</button>',
          },
          USkeleton: { template: '<div data-testid="customer-slot-loading" />' },
          UIcon: {
            props: ['name'],
            template: '<i :data-icon="name" />',
          },
          SaleItemRow: { template: '<div />' },
          SaleTotalsFooter: { template: '<div />' },
          GlobalDiscountModal: { template: '<div />' },
          ConfirmModal: { template: '<div />' },
          PriceListSelector: { template: '<div />' },
          PromocionesDisponiblesAccordion: { template: '<div />' },
        },
      },
    }),
  )
}

describe('SalesPosCustomer summary — cart trigger and assigned state', () => {
  it('preserves the unthemed customer slot when the sale opt-in is omitted', () => {
    const wrapper = mountPanel(makeDraft())
    const footer = wrapper.get('[data-testid="cart-footer"]')
    expect(footer.find('.sales-pos-customer-summary').exists()).toBe(false)
    expect(footer.find('[data-testid="customer-state-icon"]').exists()).toBe(false)
    const trigger = footer.get('[data-testid="assign-customer-trigger"]')
    expect(trigger.classes().join(' ')).toContain('bg-primary')
    expect(footer.text()).toContain('Sin asignar')
  })

  it('presents the unassigned state as a labelled, icon-led quiet trigger', async () => {
    const wrapper = mountPanel(makeDraft(), false, ENTRY_PORTAL)
    const summary = wrapper.get('.sales-pos-customer-summary')
    expect(summary.get('[data-testid="customer-state-icon"]').classes()).toContain(
      'sales-pos-customer-icon',
    )
    expect(summary.get('.sales-pos-customer-label').text()).toContain('Cliente')
    expect(summary.text()).toContain('Sin asignar')

    const trigger = wrapper.get('[data-testid="assign-customer-trigger"]')
    expect(trigger.classes()).toContain('sales-pos-customer-trigger')
    // quieter than the cart's primary charge action
    expect(trigger.classes()).toContain('ring-accented')
    expect(trigger.text()).toContain('Asignar cliente')
    await trigger.trigger('click')
    expect(wrapper.emitted('open-customer-assignment')).toHaveLength(1)
  })

  it('presents the assigned state with a readable name and the real address only', async () => {
    const wrapper = mountPanel(
      makeDraft({
        customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
        shippingAddress: makeAddress('address-1'),
      }),
      false,
      ENTRY_PORTAL,
    )
    const summary = wrapper.get('.sales-pos-customer-summary')
    expect(summary.get('[data-testid="customer-state-icon"]').classes()).toContain(
      'sales-pos-customer-icon',
    )
    expect(summary.get('.sales-pos-customer-name').text()).toContain('Ada Lovelace')
    expect(summary.get('.sales-pos-customer-address').text()).toContain('Main St')
    expect(summary.find('[data-testid="customer-address-icon"]').exists()).toBe(true)

    const actions = summary.get('.sales-pos-customer-actions')
    expect(actions.findAll('.sales-pos-customer-action')).toHaveLength(2)
    await actions.get('[data-testid="change-customer-trigger"]').trigger('click')
    await actions.get('[data-testid="unassign-customer-trigger"]').trigger('click')
    expect(wrapper.emitted('open-customer-assignment')).toHaveLength(1)
    expect(wrapper.emitted('unassign-customer')).toHaveLength(1)
  })

  it('does not paint an address line when the draft has none', async () => {
    const wrapper = mountPanel(
      makeDraft({ customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' } }),
      false,
      ENTRY_PORTAL,
    )
    expect(wrapper.find('[data-testid="customer-address-icon"]').exists()).toBe(false)
    expect(wrapper.find('.sales-pos-customer-empty-address').exists()).toBe(true)
    expect(wrapper.get('.sales-pos-customer-empty-address').text()).toContain('Sin dirección de envío')
    expect(wrapper.get('.sales-pos-customer-name').text()).toContain('Ada Lovelace')
  })

  it('keeps the mutation-pending skeleton and the disabled actions', async () => {
    const wrapper = mountPanel(
      makeDraft({ customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' } }),
      true,
      ENTRY_PORTAL,
    )
    expect(wrapper.find('[data-testid="customer-slot-loading"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="change-customer-trigger"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="unassign-customer-trigger"]').attributes('disabled')).toBeDefined()
  })
})
