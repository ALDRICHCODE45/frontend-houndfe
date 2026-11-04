/**
 * O1 S7 — the compact slideover: "Usar stock" is locked while the product has
 * stock (one-line reason beside it) and shows the backend's stock copy under it.
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

function mountSlide(
  mode: 'create' | 'edit',
  overrides: Partial<ProductDetail> = {},
  errors: Record<string, string> = {},
) {
  return mountWithUApp(ProductUpsertSlideover, {
    props: {
      mode,
      product: mode === 'edit' ? { ...product, ...overrides } : null,
      open: true,
      errors,
    },
    attachTo: document.body,
    global: { stubs: { SatKeySelect: { name: 'SatKeySelect', template: '<div />' } } },
  })
}

const useStockCheckbox = () => {
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === 'Usar stock')!
  return document.getElementById(label.getAttribute('for')!) as HTMLButtonElement
}
const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductUpsertSlideover — "Usar stock" lock', () => {
  it('is disabled with a one-line reason while the product has stock', async () => {
    mountSlide('edit')
    await flushPromises()
    expect(useStockCheckbox().hasAttribute('disabled')).toBe(true)
    expect(byId('use-stock-locked-reason')!.textContent?.trim()).toBe(
      'Hay existencias: ajusta el stock a 0 para desactivarlo.',
    )
  })

  it('is disabled when only the variants hold stock', async () => {
    mountSlide('edit', { quantity: 0, variantStockTotal: 6, hasVariants: true })
    await flushPromises()
    expect(useStockCheckbox().hasAttribute('disabled')).toBe(true)
  })

  it('is enabled, with no reason, at zero stock', async () => {
    mountSlide('edit', { quantity: 0 })
    await flushPromises()
    expect(useStockCheckbox().hasAttribute('disabled')).toBe(false)
    expect(byId('use-stock-locked-reason')).toBeNull()
  })

  it('is enabled when stock tracking is off, even if units remain', async () => {
    mountSlide('edit', { useStock: false, quantity: 5 })
    await flushPromises()
    expect(useStockCheckbox().hasAttribute('disabled')).toBe(false)
  })

  it('is enabled and editable in create mode', async () => {
    mountSlide('create')
    await flushPromises()
    expect(useStockCheckbox().hasAttribute('disabled')).toBe(false)
    expect(byId('use-stock-locked-reason')).toBeNull()
  })

  it('shows the backend stock copy under the toggle', async () => {
    mountSlide('edit', {}, { useStock: 'Hay existencias. Ajusta el stock a 0 antes de desactivar «Usar stock».' })
    await flushPromises()
    const error = byId('use-stock-error')!
    expect(error.getAttribute('role')).toBe('alert')
    expect(error.textContent).toContain('antes de desactivar «Usar stock»')
  })
})
