/**
 * O1 S7 — the compact slideover: "Usar stock" is locked while the product has
 * stock (one-line reason beside it) and shows the backend's stock copy under it.
 * T4c (selection-and-design-audit S1): the product options are switch rows
 * (HfSwitchRow), never checkboxes; the locked row stays focusable with its reason.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductUpsertSlideover from '../ProductUpsertSlideover.vue'
import type { ProductDetail } from '../../interfaces/product.types'
import { toUpdatePayload } from '../../composables/useProductForm'
import type { ProductFormValues } from '../../composables/useProductForm'

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

const switchRow = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((el) => {
    const label = document.getElementById(el.getAttribute('aria-labelledby') ?? '')
    return label?.textContent?.trim() === name
  })!
const useStockSwitch = () => switchRow('Usar stock')
const isLocked = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true'
const describedText = (el: HTMLElement) =>
  (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
const LOCK_REASON = 'Hay existencias: ajusta el stock a 0 para desactivarlo.'
const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductUpsertSlideover — "Usar stock" lock', () => {
  it('is disabled with a one-line reason while the product has stock', async () => {
    mountSlide('edit')
    await flushPromises()
    const toggle = useStockSwitch()
    expect(isLocked(toggle)).toBe(true)
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    expect(describedText(toggle)).toContain(LOCK_REASON)
    toggle.click()
    await flushPromises()
    expect(useStockSwitch().getAttribute('aria-checked')).toBe('true')
  })

  it('is disabled when only the variants hold stock', async () => {
    mountSlide('edit', { quantity: 0, variantStockTotal: 6, hasVariants: true })
    await flushPromises()
    expect(isLocked(useStockSwitch())).toBe(true)
  })

  it('is enabled, with no reason, at zero stock', async () => {
    mountSlide('edit', { quantity: 0 })
    await flushPromises()
    expect(isLocked(useStockSwitch())).toBe(false)
    expect(document.body.textContent).not.toContain(LOCK_REASON)
  })

  it('is enabled when stock tracking is off, even if units remain', async () => {
    mountSlide('edit', { useStock: false, quantity: 5 })
    await flushPromises()
    expect(isLocked(useStockSwitch())).toBe(false)
  })

  it('is enabled and editable in create mode', async () => {
    mountSlide('create')
    await flushPromises()
    expect(isLocked(useStockSwitch())).toBe(false)
    expect(document.body.textContent).not.toContain(LOCK_REASON)
  })

  it('shows the backend stock copy under the toggle', async () => {
    mountSlide('edit', {}, { useStock: 'Hay existencias. Ajusta el stock a 0 antes de desactivar «Usar stock».' })
    await flushPromises()
    const error = byId('use-stock-error')!
    expect(error.getAttribute('role')).toBe('alert')
    expect(error.textContent).toContain('antes de desactivar «Usar stock»')
  })
})

describe('ProductUpsertSlideover — product options as switch rows (T4c S1)', () => {
  it('renders the four options as whole-row switches and no checkbox', async () => {
    mountSlide('edit', { quantity: 0 })
    await flushPromises()
    for (const name of ['Usar stock', 'Vender en POS', 'Catálogo online', 'Cobrar impuestos']) {
      const row = switchRow(name)
      expect(row, name).toBeDefined()
      expect(row.closest('.hf-switch-row'), name).not.toBeNull()
    }
    expect(switchRow('Vender en POS').getAttribute('aria-checked')).toBe('true')
    expect(document.querySelector('[role="checkbox"]')).toBeNull()
    expect(document.querySelector('input[type="checkbox"]')).toBeNull()
  })

  it('keeps the toggled options in the same payload fields', async () => {
    const wrapper = mountSlide('edit', { quantity: 0 })
    await flushPromises()
    switchRow('Vender en POS').click()
    switchRow('Cobrar impuestos').click()
    switchRow('Usar stock').click()
    await flushPromises()
    expect(switchRow('Vender en POS').getAttribute('aria-checked')).toBe('false')
    // onSubmit emits toUpdatePayload(form data); the switches bind the same form state.
    const formState = (wrapper.vm as unknown as { state: ProductFormValues }).state
    expect(toUpdatePayload(formState)).toMatchObject({
      sellInPos: false,
      chargeProductTaxes: false,
      useStock: false,
      includeInOnlineCatalog: true,
    })
  })
})
