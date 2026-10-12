import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import DateFieldPopover from '../DateFieldPopover.vue'
import VariantPickerModal from '../VariantPickerModal.vue'
import PriceListSelector from '../PriceListSelector.vue'
import type { PosCatalogVariant, Sale } from '../../interfaces/sale.types'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'
import { productQueryKeys } from '@/core/shared/constants/query-keys'

/*
 * Shared Sales portal opt-in (T6 / S1,S3,S4).
 *
 * The four shared Sales popups (customer sheet, price-list menu, date
 * popover, variant modal) forward an optional `portalClass` onto the installed
 * Nuxt UI `ui.content` path. This spec proves the marker reaches the real
 * installed native component and its rendered content root
 * (`[data-slot="content"]`), and that an absent opt-in leaves the native
 * defaults untouched.
 *
 * AssignCustomerSlideover's installed USlideover is covered in its own spec
 * because that component needs the customer/tanstack harness.
 */
const FORM_PORTAL = 'hf-theme hf-ui hf-form-overlay quotations-workspace-portal'
const LISTBOX_PORTAL = 'hf-theme hf-ui quotations-workspace-portal'

// jsdom has no layout engine, so Reka's listbox highlight calls
// `scrollIntoView`, which is undefined there. This local, test-only shim keeps
// the installed listbox open path exerciseable without touching product code
// or the shared vitest setup.
beforeAll(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const wrappers: VueWrapper[] = []

function cleanup() {
  while (wrappers.length) {
    wrappers.pop()!.unmount()
  }
  document.body.innerHTML = ''
}

afterEach(cleanup)

function track<T extends VueWrapper>(wrapper: T): T {
  wrappers.push(wrapper)
  return wrapper
}

function contentRoots(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>('[data-slot="content"]'))
}

function hasMarker(): boolean {
  return contentRoots().some((root) => root.classList.contains('quotations-workspace-portal'))
}

async function settle() {
  await flushPromises()
}

const variants: PosCatalogVariant[] = [
  {
    id: 'var-1',
    name: 'Ibuprofeno 400mg',
    sku: 'IBU-400',
    barcode: null,
    mainImage: null,
    price: { priceCents: 8500, priceDecimal: 85, priceListName: 'PUBLICO' },
    stock: { quantity: 150, minQuantity: 10 },
  },
]

const lists: GlobalPriceList[] = [
  { id: 'list-mayoreo', name: 'MAYOREO', isDefault: false, createdAt: 'x', updatedAt: 'x' },
]

function makeDraft(): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [],
    customer: null,
    shippingAddress: null,
    createdAt: '2026-04-21T10:00:00.000Z',
    updatedAt: '2026-04-21T10:00:00.000Z',
  }
}

function queryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  client.setQueryData(productQueryKeys.globalPriceLists(), lists)
  return client
}

describe('Shared Sales portal opt-in — installed native content root', () => {
  it('VariantPickerModal themes the installed Modal content root only when opted in', async () => {
    const optedIn = track(
      mount(VariantPickerModal, {
        props: {
          open: true,
          productId: 'prod-1',
          productName: 'Ibuprofeno',
          variants,
          portalClass: FORM_PORTAL,
        },
        attachTo: document.body,
      }),
    )
    await settle()

    expect(optedIn.findComponent({ name: 'Modal' }).props('ui')).toEqual({ content: FORM_PORTAL })
    expect(hasMarker()).toBe(true)

    cleanup()

    const inert = track(
      mount(VariantPickerModal, {
        props: { open: true, productId: 'prod-1', productName: 'Ibuprofeno', variants },
        attachTo: document.body,
      }),
    )
    await settle()

    expect(inert.findComponent({ name: 'Modal' }).props('ui')).toBeUndefined()
    expect(contentRoots().length).toBeGreaterThan(0)
    expect(hasMarker()).toBe(false)
  })

  it('DateFieldPopover themes the installed Popover content root only when opted in', async () => {
    const optedIn = track(
      mount(DateFieldPopover, {
        props: { modelValue: null, portalClass: LISTBOX_PORTAL },
        attachTo: document.body,
      }),
    )
    expect(optedIn.findComponent({ name: 'Popover' }).props('ui')).toEqual({
      content: LISTBOX_PORTAL,
    })

    await optedIn.get('[data-testid="date-field-popover"]').trigger('click')
    await settle()

    expect(hasMarker()).toBe(true)

    cleanup()

    const inert = track(
      mount(DateFieldPopover, {
        props: { modelValue: null },
        attachTo: document.body,
      }),
    )
    expect(inert.findComponent({ name: 'Popover' }).props('ui')).toBeUndefined()
  })

  it('PriceListSelector themes the installed InputMenu content root only when opted in', async () => {
    const optedIn = track(
      mount(PriceListSelector, {
        props: { activeDraft: makeDraft(), isMutating: false, portalClass: LISTBOX_PORTAL },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: queryClient() }]] },
      }),
    )
    await settle()

    expect(optedIn.findComponent({ name: 'InputMenu' }).props('ui')).toEqual({
      content: LISTBOX_PORTAL,
    })

    await optedIn.get('[data-slot="trailing"]').trigger('click')
    await settle()

    expect(hasMarker()).toBe(true)

    cleanup()

    const inert = track(
      mount(PriceListSelector, {
        props: { activeDraft: makeDraft(), isMutating: false },
        attachTo: document.body,
        global: { plugins: [[VueQueryPlugin, { queryClient: queryClient() }]] },
      }),
    )
    await settle()

    expect(inert.findComponent({ name: 'InputMenu' }).props('ui')).toBeUndefined()
    expect(hasMarker()).toBe(false)
  })

  it('never renders a workspace marker when no shared popup opts in', async () => {
    track(
      mount(VariantPickerModal, {
        props: { open: true, productId: 'prod-1', productName: 'Ibuprofeno', variants },
        attachTo: document.body,
      }),
    )
    track(
      mount(DateFieldPopover, {
        props: { modelValue: null },
        attachTo: document.body,
      }),
    )
    await settle()

    expect(document.body.querySelectorAll('.quotations-workspace-portal').length).toBe(0)
  })
})
