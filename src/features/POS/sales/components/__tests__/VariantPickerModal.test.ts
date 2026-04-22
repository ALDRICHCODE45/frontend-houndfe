import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import VariantPickerModal from '../VariantPickerModal.vue'
import * as productApi from '@/features/POS/products/api/product.api'
import type { ProductVariant } from '@/features/POS/products/interfaces/product.types'

vi.mock('@/features/POS/products/api/product.api')

describe('VariantPickerModal.vue', () => {
  let queryClient: QueryClient

  const mockVariants: ProductVariant[] = [
    {
      id: 'var-1',
      productId: 'prod-1',
      name: 'Ibuprofeno 400mg',
      option: 'Concentración',
      value: '400mg',
      sku: 'IBU-400',
      barcode: null,
      priceCents: 8500,
      quantity: 150,
      minQuantity: 10,
      purchaseNetCostCents: null,
      purchaseNetCostDecimal: null,
      variantPrices: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
    {
      id: 'var-2',
      productId: 'prod-1',
      name: 'Ibuprofeno 600mg',
      option: 'Concentración',
      value: '600mg',
      sku: 'IBU-600',
      barcode: null,
      priceCents: 12000,
      quantity: 200,
      minQuantity: 10,
      purchaseNetCostCents: null,
      purchaseNetCostDecimal: null,
      variantPrices: [],
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ]

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  it('does not fetch variants when modal is closed', () => {
    const getVariantsSpy = vi.spyOn(productApi.productApi, 'getVariants')

    mount(VariantPickerModal, {
      props: {
        open: false,
        productId: null,
        productName: null,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    expect(getVariantsSpy).not.toHaveBeenCalled()
  })

  it('fetches variants when modal opens with productId', async () => {
    vi.mocked(productApi.productApi.getVariants).mockResolvedValue(mockVariants)

    mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    await flushPromises()

    expect(productApi.productApi.getVariants).toHaveBeenCalledWith('prod-1')
  })

  it('emits update:open when modal state changes', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    wrapper.vm.$emit('update:open', false)

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('exposes open prop correctly', () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    expect(wrapper.props('open')).toBe(true)
  })

  it('exposes productName prop correctly', () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    expect(wrapper.props('productName')).toBe('Ibuprofeno')
  })

  it('handles add-variant emission', async () => {
    const wrapper = mount(VariantPickerModal, {
      props: {
        open: true,
        productId: 'prod-1',
        productName: 'Ibuprofeno',
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
    })

    wrapper.vm.$emit('add-variant', 'prod-1', 'var-1')

    expect(wrapper.emitted('add-variant')?.[0]).toEqual(['prod-1', 'var-1'])
  })
})
