import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VariantPickerModal from '../VariantPickerModal.vue'
import type { PosCatalogVariant } from '../../interfaces/sale.types'

describe('VariantPickerModal.vue', () => {
  const mockVariants: PosCatalogVariant[] = [
    {
      id: 'var-1',
      name: 'Ibuprofeno 400mg',
      sku: 'IBU-400',
      barcode: null,
      mainImage: null,
      price: {
        priceCents: 8500,
        priceDecimal: 85.0,
        priceListName: 'PUBLICO',
      },
      stock: {
        quantity: 150,
        minQuantity: 10,
      },
    },
    {
      id: 'var-2',
      name: 'Ibuprofeno 600mg',
      sku: 'IBU-600',
      barcode: null,
      mainImage: 'https://example.com/ibu600.jpg',
      price: {
        priceCents: 12000,
        priceDecimal: 120.0,
        priceListName: 'PUBLICO',
      },
      stock: {
        quantity: 200,
        minQuantity: 10,
      },
    },
  ]

  beforeEach(() => {
    // No setup needed for prop-driven modal
  })

  it('renders immediately with prop variants (no API fetch)', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
        variants: mockVariants,
      },
      attachTo: document.body, // Attach to body so teleported content is accessible
    })

    await wrapper.vm.$nextTick()

    // Verify modal renders variants immediately without loading state
    const variantRows = document.body.querySelectorAll('[data-testid^="variant-row-"]')
    expect(variantRows.length).toBe(2)

    wrapper.unmount()
  })

  it('displays variant details correctly (name, sku, price, stock)', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
        variants: mockVariants,
      },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()

    const firstRow = document.body.querySelector('[data-testid="variant-row-var-1"]')
    expect(firstRow).not.toBeNull()
    expect(firstRow?.textContent).toContain('Ibuprofeno 400mg')
    expect(firstRow?.textContent).toContain('IBU-400')
    expect(firstRow?.textContent).toContain('150 unidades')

    wrapper.unmount()
  })

  it('emits add-variant with productId and variantId on click', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
        variants: mockVariants,
      },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()

    const firstRow = document.body.querySelector('[data-testid="variant-row-var-1"]') as HTMLElement
    expect(firstRow).not.toBeNull()
    firstRow?.click()

    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('add-variant')?.[0]).toEqual(['prod-1', 'var-1'])

    wrapper.unmount()
  })

  it('displays placeholder icon when variant has no image', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
        variants: mockVariants,
      },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()

    const firstRow = document.body.querySelector('[data-testid="variant-row-var-1"]')
    expect(firstRow).not.toBeNull()
    // When no image, there should be no img tag
    const img = firstRow?.querySelector('img')
    expect(img).toBeNull()

    wrapper.unmount()
  })

  it('displays image when variant has mainImage', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
        variants: mockVariants,
      },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()

    const secondRow = document.body.querySelector('[data-testid="variant-row-var-2"]')
    expect(secondRow).not.toBeNull()
    const img = secondRow?.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/ibu600.jpg')

    wrapper.unmount()
  })

  it('shows empty state when no variants provided', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
        variants: [],
      },
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Sin resultados')

    wrapper.unmount()
  })
})
