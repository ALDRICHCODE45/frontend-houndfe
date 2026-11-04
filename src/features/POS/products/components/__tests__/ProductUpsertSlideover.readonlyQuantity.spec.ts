/**
 * O1 S1 — the compact slideover: quantity is read-only on edit (figure + hint,
 * no input) and the emitted edit payload never carries it; creating a product
 * still has the Stock input and still sends quantity.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductUpsertSlideover from '../ProductUpsertSlideover.vue'
import type { ProductDetail } from '../../interfaces/product.types'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: {} })),
  useRouter: () => ({ push: vi.fn() }),
}))

const product: ProductDetail = {
  id: 'prod-1',
  name: 'Croquetas',
  type: 'PRODUCT',
  sku: 'CRO-1',
  barcode: null,
  categoryId: null,
  categoryName: 'Sin categoría',
  brandId: null,
  brandName: 'Sin marca',
  priceCents: 19900,
  quantity: 42,
  minQuantity: 3,
  useStock: true,
  hasVariants: false,
  useLotsAndExpirations: false,
  sellInPos: true,
  includeInOnlineCatalog: true,
  requiresPrescription: false,
  chargeProductTaxes: true,
  variantStockTotal: null,
  variantCount: null,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  description: null,
  location: null,
  satKey: null,
  unit: 'KILOGRAMO',
  ivaRate: 'IVA_16',
  iepsRate: 'NO_APLICA',
  purchaseCostMode: 'NET',
  purchaseNetCostCents: 0,
  purchaseGrossCostCents: 0,
  serviceDetail: null,
}

const satStub = { name: 'SatKeySelect', template: '<div />' }

const onCreate = vi.fn()
const onEdit = vi.fn()

function mountSlide(mode: 'create' | 'edit') {
  return mountWithUApp(ProductUpsertSlideover, {
    props: { mode, product: mode === 'edit' ? product : null, open: true, onCreate, onEdit },
    attachTo: document.body,
    global: { stubs: { SatKeySelect: satStub } },
  })
}

const form = (id: string) => document.getElementById(id) as HTMLFormElement
const submit = async (id: string) => {
  form(id).requestSubmit()
  await flushPromises()
}

afterEach(() => {
  onCreate.mockClear()
  onEdit.mockClear()
  document.body.innerHTML = ''
})

describe('ProductUpsertSlideover — read-only quantity', () => {
  it('shows the stock as a figure with the hint on edit, with no Stock input', async () => {
    mountSlide('edit')
    await flushPromises()
    const stock = document.querySelector('[data-testid="product-stock-readonly"]')!
    expect(stock.textContent).toContain('42')
    expect(stock.textContent).toContain('Se ajusta desde Inventario')
    expect(document.querySelector('input[name="quantity"]')).toBeNull()
  })

  it('emits an edit payload without quantity, and keeps minQuantity', async () => {
    mountSlide('edit')
    await flushPromises()
    await submit('edit-product-form')
    await vi.waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1))
    const payload = onEdit.mock.calls[0]![0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('quantity')
    expect(payload).toMatchObject({ name: 'Croquetas', minQuantity: 3, useStock: true })
  })

  it('create mode keeps the editable Stock input and sends quantity', async () => {
    mountSlide('create')
    await flushPromises()
    expect(document.querySelector('[data-testid="product-stock-readonly"]')).toBeNull()
    expect(document.body.textContent).toContain('Stock')
    const name = document.querySelector<HTMLInputElement>('input[placeholder="Ej: Jabón artesanal"]')!
    name.value = 'Nuevo'
    name.dispatchEvent(new Event('input'))
    await flushPromises()
    await submit('create-product-form')
    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0]![0]).toHaveProperty('quantity')
  })
})
