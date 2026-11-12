/**
 * S7 — ProductDetailView «Agregar lote»: «Fabricación» and «Caducidad» are the app's calendar field
 * (UInputDate + UCalendar), never the browser's native date input. The form still sends AAAA-MM-DD.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { CalendarDate } from '@internationalized/date'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const route = vi.hoisted(() => vi.fn(() => ({ params: { id: 'prod-1' } as Record<string, string> })))
vi.mock('vue-router', () => ({
  useRoute: route,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    currentTenantId: 'tenant-1',
    authPhase: 'authenticated',
    permissionsLoaded: true,
    userCan: (_action: string, resource: string) => resource !== 'TenantCatalogSettings',
  }),
}))

const api = vi.hoisted(() => ({ getById: vi.fn(), getVariants: vi.fn(), createLot: vi.fn() }))

vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      getById: api.getById,
      getVariants: api.getVariants,
      createLot: api.createLot,
      getCategories: vi.fn(async () => []),
      getBrands: vi.fn(async () => []),
      getGlobalPriceLists: vi.fn(async () => []),
      getLots: vi.fn(async () => []),
      getPriceLists: vi.fn(async () => []),
    },
  }
})

const product = {
  id: 'prod-1', name: 'Croquetas', type: 'PRODUCT', sku: 'CRO-1', barcode: '', categoryId: '', brandId: '',
  description: '', location: '', satKey: '', unit: 'UNIDAD', priceCents: 1000, quantity: 50, minQuantity: 2,
  useStock: true, useLotsAndExpirations: true, hasVariants: false, sellInPos: true,
  includeInOnlineCatalog: true, requiresPrescription: false, chargeProductTaxes: true, ivaRate: 'IVA_16',
  iepsRate: 'NO_APLICA', purchaseCostMode: 'NET', purchaseNetCostCents: 0, purchaseGrossCostCents: 0,
  status: 'active', createdAt: '2026-04-23T00:00:00.000Z', updatedAt: '2026-04-23T00:00:00.000Z',
}

let queryClient: QueryClient
let root: VueWrapper | undefined

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  api.getById.mockReset().mockResolvedValue(product)
  api.getVariants.mockReset().mockResolvedValue([])
  api.createLot.mockReset().mockResolvedValue({ id: 'lot-1' })
  route.mockReturnValue({ params: { id: 'prod-1' } })
  root = mount(
    defineComponent({ render: () => h(UApp, null, { default: () => h(ProductDetailView as Component) }) }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('input[name="name"]')).not.toBeNull())
})

afterEach(() => {
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

const nativeDates = () =>
  [...document.querySelectorAll('input[type="date"], input[type="time"], input[type="datetime-local"]')].filter(
    (item) => item.getAttribute('aria-hidden') !== 'true',
  )

async function openLotModal() {
  const open = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Agregar lote'))!
  open.click()
  await vi.waitFor(() => expect(document.querySelector('#create-lot-modal-form')).not.toBeNull())
  await flushPromises()
}

describe('ProductDetailView — lot dates', () => {
  it('«Fabricación» and «Caducidad» are calendar fields, not native date inputs', async () => {
    await openLotModal()
    const form = document.querySelector('#create-lot-modal-form')!
    expect(nativeDates()).toHaveLength(0)
    const fields = root!.findAllComponents({ name: 'InputDate' })
    expect(fields).toHaveLength(2)
    expect(form.querySelectorAll('[data-slot="base"][role="group"]').length).toBeGreaterThanOrEqual(2)
    expect(fields.map((field) => field.props('modelValue'))).toEqual([undefined, undefined])
  })

  it('sends the chosen dates as AAAA-MM-DD and refuses a missing caducidad', async () => {
    await openLotModal()
    const [manufacture, expiration] = root!.findAllComponents({ name: 'InputDate' })
    const form = document.querySelector<HTMLFormElement>('#create-lot-modal-form')!
    const lotNumber = form.querySelector<HTMLInputElement>('input[placeholder="Ej: LOTE-2026-04"]')!
    lotNumber.value = 'LOTE-2026-11'
    lotNumber.dispatchEvent(new Event('input', { bubbles: true }))

    form.requestSubmit()
    await flushPromises()
    expect(api.createLot).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('La fecha de vencimiento es obligatoria')

    manufacture!.vm.$emit('update:modelValue', new CalendarDate(2026, 10, 1))
    expiration!.vm.$emit('update:modelValue', new CalendarDate(2027, 3, 9))
    await flushPromises()
    expect(String(expiration!.props('modelValue'))).toBe('2027-03-09')

    form.requestSubmit()
    await flushPromises()
    await vi.waitFor(() => expect(api.createLot).toHaveBeenCalled())
    expect(api.createLot).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({ lotNumber: 'LOTE-2026-11', expirationDate: '2027-03-09', manufactureDate: '2026-10-01' }),
    )
  })

  it('an emptied «Fabricación» is simply not sent', async () => {
    await openLotModal()
    const [manufacture, expiration] = root!.findAllComponents({ name: 'InputDate' })
    const form = document.querySelector<HTMLFormElement>('#create-lot-modal-form')!
    const lotNumber = form.querySelector<HTMLInputElement>('input[placeholder="Ej: LOTE-2026-04"]')!
    lotNumber.value = 'LOTE-2026-12'
    lotNumber.dispatchEvent(new Event('input', { bubbles: true }))
    manufacture!.vm.$emit('update:modelValue', new CalendarDate(2026, 10, 1))
    manufacture!.vm.$emit('update:modelValue', undefined)
    expiration!.vm.$emit('update:modelValue', new CalendarDate(2027, 3, 9))
    await flushPromises()
    form.requestSubmit()
    await flushPromises()
    await vi.waitFor(() => expect(api.createLot).toHaveBeenCalled())
    expect(api.createLot.mock.calls[0]![1]).not.toHaveProperty('manufactureDate')
  })
})
