/**
 * T17 — Identidad on the Hf* form patterns: section cards grouped by meaning, the required
 * amber dot, a calm toggle list, and its own HfSaveBar (the header save stays for the other
 * operational tasks). Saving from the bar sends byte-identical payloads to the header save.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'
import { useConfirm } from '@/core/shared/composables/useConfirm'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}

const route = vi.hoisted(() => vi.fn(() => ({ params: { id: 'prod-1' } as Record<string, string> })))
const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: route,
  useRouter: () => ({ push }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    currentTenantId: 'tenant-1',
    userCan: (_action: string, resource: string) => resource !== 'TenantCatalogSettings',
  }),
}))

const api = vi.hoisted(() => ({
  getById: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  getCategories: vi.fn(),
}))

vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      ...api,
      getVariants: vi.fn(async () => []),
      getBrands: vi.fn(async () => []),
      getGlobalPriceLists: vi.fn(async () => []),
      getLots: vi.fn(async () => []),
      getPriceLists: vi.fn(async () => []),
      getImages: vi.fn(async () => []),
    },
  }
})

const product = {
  id: 'prod-1',
  name: 'Croquetas',
  type: 'PRODUCT',
  sku: 'CRO-1',
  barcode: '',
  categoryId: '',
  brandId: '',
  description: '',
  location: '',
  satKey: '',
  unit: 'UNIDAD',
  priceCents: 1000,
  quantity: 0,
  minQuantity: 2,
  useStock: true,
  useLotsAndExpirations: false,
  hasVariants: false,
  sellInPos: true,
  includeInOnlineCatalog: true,
  requiresPrescription: false,
  chargeProductTaxes: true,
  ivaRate: 'IVA_16',
  iepsRate: 'NO_APLICA',
  purchaseCostMode: 'NET',
  purchaseNetCostCents: 0,
  purchaseGrossCostCents: 0,
  status: 'active',
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
}

let queryClient: QueryClient
let root: VueWrapper | undefined

async function mountView(params: Record<string, string> = { id: 'prod-1' }) {
  route.mockReturnValue({ params })
  root = mount(
    defineComponent({
      render: () => h(UApp, null, { default: () => h(ProductDetailView as Component) }),
    }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('input[name="name"]')).not.toBeNull())
  return root
}

const identity = () => document.querySelector<HTMLElement>('[data-product-task="identity"]')!
const saveBar = () => document.querySelector<HTMLElement>('[data-testid="identity-save-bar"]')
const barStatus = () => saveBar()!.querySelector('.hf-save-bar__status')!.textContent!.trim()
const barButton = (label: string) =>
  [...saveBar()!.querySelectorAll('button')].find((button) => button.textContent?.trim() === label)
const headerSave = () => document.querySelector('.product-workspace-header button[type="submit"]')
const mobileBar = () => document.querySelector('[data-testid="mobile-action-bar"]')

async function selectTask(task: string) {
  document.querySelector<HTMLElement>(`[data-task="${task}"]`)!.click()
  await flushPromises()
}

async function type(name: string, value: string) {
  await root!.get(`input[name="${name}"]`).setValue(value)
  await flushPromises()
}

function toggleRow(label: string) {
  return [...identity().querySelectorAll<HTMLElement>('.product-toggle-row')].find((row) =>
    row.textContent?.includes(label),
  )!
}

async function flip(label: string) {
  toggleRow(label).querySelector<HTMLElement>('[role="switch"]')!.click()
  await flushPromises()
}

async function saveFromBar(label = 'Guardar') {
  barButton(label)!.click()
  await flushPromises()
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  api.getById.mockReset().mockResolvedValue(product)
  api.update.mockReset().mockResolvedValue(product)
  api.create.mockReset().mockResolvedValue({ id: 'new-1', _raw: {} })
  api.getCategories.mockReset().mockResolvedValue([{ id: 'cat-1', name: 'Alimento' }])
  push.mockReset()
})

afterEach(() => {
  useConfirm().cancelAll()
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

describe('Identidad — sections and fields', () => {
  it('groups the fields by meaning into section cards, with no header dividers', async () => {
    await mountView()
    const titles = [...identity().querySelectorAll('.hf-section-card__title')].map((t) => t.textContent?.trim())
    expect(titles).toEqual(['Qué es', 'Códigos', 'Dónde se vende'])
    const cards = [...identity().querySelectorAll<HTMLElement>('.hf-section-card')]
    const textOf = (index: number) => cards[index]!.textContent ?? ''
    for (const label of ['Tipo', 'Nombre', 'Unidad', 'Categoría', 'Marca', 'Ubicación en almacén', 'Descripción']) {
      expect(textOf(0)).toContain(label)
    }
    for (const label of ['Código de barras', 'SKU', 'Clave SAT']) expect(textOf(1)).toContain(label)
    expect(identity().querySelector('hr, [role="separator"]')).toBeNull()
    expect(identity().textContent).not.toContain('Datos del producto')
    expect(identity().querySelectorAll('.hf-field-grid').length).toBeGreaterThanOrEqual(2)
  })

  it('marks Nombre with the amber required dot instead of a red asterisk', async () => {
    await mountView()
    const nameField = identity().querySelector('#product-name')!.closest('.hf-form-field')!
    const marker = nameField.querySelector('.hf-form-field__required')!
    expect(marker.querySelector('.hf-form-field__dot')).not.toBeNull()
    expect(marker.textContent?.trim()).toBe('Obligatorio')
    expect(identity().querySelectorAll('.hf-form-field__required')).toHaveLength(1)
    expect(nameField.querySelector('label')!.getAttribute('for')).toBe('product-name')
  })

  it('chooses the type in a segmented control and turns a service into service fields', async () => {
    await mountView()
    const group = identity().querySelector('.hf-segmented[role="radiogroup"]')!
    const segments = [...group.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(segments.map((s) => s.textContent?.trim())).toEqual(['Producto', 'Servicio'])
    expect(segments[0]!.getAttribute('aria-checked')).toBe('true')
    segments[1]!.click()
    await flushPromises()
    expect(identity().textContent).toContain('Zona de servicio')
    expect(identity().querySelector('input[name="sku"]')).toBeNull()
  })

  it('uses HfCombobox for unit, category and brand; categories offer «Crear categoría»', async () => {
    await mountView()
    const labels = [...identity().querySelectorAll('.hf-combobox__trigger')].map((t) => t.getAttribute('aria-label'))
    expect(labels).toEqual(['Unidad', 'Categoría', 'Marca'])
    expect(identity().querySelector('.category-select')).toBeNull()
  })

  it('lists the three channel toggles as calm rows inside one card', async () => {
    await mountView()
    const rows = [...identity().querySelectorAll('.product-toggle-list .product-toggle-row')]
    expect(rows.map((row) => row.querySelector('.product-toggle-row__label')?.textContent?.trim())).toEqual([
      'Vender en punto de venta',
      'Incluir en catálogo en línea',
      'Requerir receta médica',
    ])
    for (const row of rows) expect(row.querySelector('[role="switch"]')).not.toBeNull()
  })
})

describe('Identidad — save bar and the header save per task', () => {
  it('saves from the bar on Identidad, and from the header on Presentaciones and Inventario', async () => {
    await mountView()
    expect(saveBar()).not.toBeNull()
    expect(headerSave()).toBeNull()
    expect(mobileBar()).toBeNull()
    await selectTask('presentations')
    expect(saveBar()).toBeNull()
    expect(headerSave()?.textContent?.trim()).toBe('Guardar cambios')
    expect(mobileBar()).not.toBeNull()
    await selectTask('content')
    expect(saveBar()).toBeNull()
    expect(headerSave()).toBeNull()
    await selectTask('identity')
    expect(saveBar()).not.toBeNull()
  })

  it('keeps the header and mobile «Guardar cambios» disabled while the product has no edits', async () => {
    await mountView()
    await selectTask('presentations')
    const mobileSubmit = () => mobileBar()!.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect((headerSave() as HTMLButtonElement).disabled).toBe(true)
    expect(mobileSubmit().disabled).toBe(true)
    await type('name', 'Croquetas premium')
    expect((headerSave() as HTMLButtonElement).disabled).toBe(false)
    expect(mobileSubmit().disabled).toBe(false)
  })

  it('counts unsaved changes, keeps Guardar disabled while clean, and saves once dirty', async () => {
    await mountView()
    expect(barStatus()).not.toContain('sin guardar')
    expect(barButton('Guardar')!.disabled).toBe(true)
    expect(barButton('Descartar')).toBeUndefined()
    await type('name', 'Croquetas premium')
    expect(barStatus()).toBe('1 cambio sin guardar')
    await flip('Requerir receta médica')
    expect(barStatus()).toBe('2 cambios sin guardar')
    expect(barButton('Guardar')!.disabled).toBe(false)
    await saveFromBar()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(1))
  })

  it('Descartar asks, then puts every field back', async () => {
    await mountView()
    await type('name', 'Otro nombre')
    await type('sku', 'OTRO')
    barButton('Descartar')!.click()
    await flushPromises()
    const { pending, settle } = useConfirm()
    expect(pending.value?.options.title).toBe('¿Descartar los cambios?')
    settle(true)
    await flushPromises()
    expect((root!.get('input[name="name"]').element as HTMLInputElement).value).toBe('Croquetas')
    expect((root!.get('input[name="sku"]').element as HTMLInputElement).value).toBe('CRO-1')
    expect(barButton('Descartar')).toBeUndefined()
    expect(api.update).not.toHaveBeenCalled()
  })

  it('create mode: the bar says «Crear producto» (or «Crear servicio») and the header keeps it for the other tasks', async () => {
    await mountView({})
    expect(barButton('Crear producto')!.disabled).toBe(true)
    await type('name', 'Arnés')
    expect(barButton('Crear producto')!.disabled).toBe(false)
    identity().querySelectorAll<HTMLElement>('.hf-segmented [role="radio"]')[1]!.click()
    await flushPromises()
    expect(barButton('Crear servicio')).toBeDefined()
    await selectTask('presentations')
    expect(headerSave()?.textContent?.trim()).toBe('Crear servicio')
  })

  it('guards leaving while Identidad has unsaved edits', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    await mountView()
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(false)
    await type('name', 'Sin guardar')
    expect(add.mock.calls.some(([type]) => type === 'beforeunload')).toBe(true)
    add.mockRestore()
  })
})

describe('Identidad — payloads are byte-identical to the header save', () => {
  async function editIdentity() {
    await type('name', '  Croquetas premium ')
    await type('barcode', '750100')
    await flip('Vender en punto de venta')
    await flip('Requerir receta médica')
  }

  it('update: the bar and the header send the same PATCH, and the expected one', async () => {
    await mountView()
    await editIdentity()
    await saveFromBar()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(1))
    const fromBar = JSON.stringify(api.update.mock.calls[0])
    root!.unmount()
    document.body.innerHTML = ''
    queryClient.clear()

    await mountView()
    await editIdentity()
    await selectTask('presentations')
    ;(document.getElementById('product-detail-form') as HTMLFormElement).requestSubmit()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
    expect(JSON.stringify(api.update.mock.calls[1])).toBe(fromBar)
    expect(api.update.mock.calls[0]).toEqual([
      'prod-1',
      {
        name: 'Croquetas premium',
        type: 'PRODUCT',
        sku: 'CRO-1',
        barcode: '750100',
        brandId: null,
        unit: 'UNIDAD',
        useStock: true,
        useLotsAndExpirations: false,
        hasVariants: false,
        minQuantity: 2,
        sellInPos: false,
        includeInOnlineCatalog: true,
        requiresPrescription: true,
        chargeProductTaxes: true,
        ivaRate: 'IVA_16',
        iepsRate: 'NO_APLICA',
      },
    ])
  })

  it('create: the bar and the header send the same POST', async () => {
    await mountView({})
    await editIdentity()
    await saveFromBar('Crear producto')
    await vi.waitFor(() => expect(api.create).toHaveBeenCalledTimes(1))
    const fromBar = JSON.stringify(api.create.mock.calls[0])
    expect(push).toHaveBeenCalledWith('/pos/products/new-1')
    root!.unmount()
    document.body.innerHTML = ''
    queryClient.clear()

    await mountView({})
    await editIdentity()
    await selectTask('presentations')
    ;(document.getElementById('product-detail-form') as HTMLFormElement).requestSubmit()
    await vi.waitFor(() => expect(api.create).toHaveBeenCalledTimes(2))
    expect(JSON.stringify(api.create.mock.calls[1])).toBe(fromBar)
    expect(api.create.mock.calls[0]![0]).toMatchObject({
      name: 'Croquetas premium',
      barcode: '750100',
      sellInPos: false,
      requiresPrescription: true,
    })
  })
})
