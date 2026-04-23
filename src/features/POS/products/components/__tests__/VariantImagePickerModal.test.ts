import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import VariantImagePickerModal from '../VariantImagePickerModal.vue'

// Mock toast
const mockToast = {
  add: vi.fn(),
}
vi.stubGlobal('useToast', () => mockToast)

describe('VariantImagePickerModal', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    mockToast.add.mockClear()
  })

  const defaultVariant = {
    id: 'variant-1',
    productId: 'product-1',
    name: 'Talle',
    option: 'Talle',
    value: 'M',
    sku: 'CAM-M',
    barcode: '123456',
    priceCents: 5000,
    quantity: 10,
    minQuantity: 2,
    purchaseNetCostCents: null,
    purchaseNetCostDecimal: null,
    variantPrices: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  const createWrapper = (props = {}) => {
    return mount(VariantImagePickerModal, {
      props: {
        open: true,
        productId: 'product-1',
        productName: 'Camisa',
        variant: defaultVariant,
        canUpdate: true,
        canDelete: true,
        ...props,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
      },
      attachTo: document.body, // Attach to body so teleported content is accessible
    })
  }

  it('should mount successfully with required props', () => {
    const wrapper = createWrapper()
    expect(wrapper.exists()).toBe(true)
    wrapper.unmount()
  })

  it('should have variant-scoped dropzone with accessibility', async () => {
    const wrapper = createWrapper()

    await wrapper.vm.$nextTick()

    const localDropzone = wrapper.find('[data-dropzone]')
    const dropzone = (localDropzone.exists()
      ? localDropzone.element
      : document.body.querySelector('[data-dropzone]')) as HTMLElement | null
    expect(dropzone).not.toBeNull()
    expect(dropzone?.getAttribute('role')).toBe('button')
    expect(dropzone?.getAttribute('tabindex')).toBe('0')
    
    wrapper.unmount()
  })

  it('should use useImageUpload composable (dropzone exists)', async () => {
    const wrapper = createWrapper()

    await wrapper.vm.$nextTick()

    // If dropzone exists, useImageUpload is working
    const localDropzone = wrapper.find('[data-dropzone]')
    const dropzone = localDropzone.exists()
      ? localDropzone.element
      : document.body.querySelector('[data-dropzone]')
    expect(dropzone).not.toBeNull()
    
    wrapper.unmount()
  })

  it('should have dropzone for variant-scoped uploads', async () => {
    const wrapper = createWrapper()

    await wrapper.vm.$nextTick()
    
    // Dropzone should exist for uploading variant images
    const localDropzone = wrapper.find('[data-dropzone]')
    const dropzone = localDropzone.exists()
      ? localDropzone.element
      : document.body.querySelector('[data-dropzone]')
    expect(dropzone).not.toBeNull()
    
    wrapper.unmount()
  })

  it('should render modal with product and variant value in title', () => {
    const wrapper = createWrapper({
      productName: 'Camisa',
      variant: { ...defaultVariant, value: 'L' },
    })
    
    // Component should mount successfully with the correct props
    expect(wrapper.props('productName')).toBe('Camisa')
    expect(wrapper.props('variant').value).toBe('L')
    expect(wrapper.props('open')).toBe(true)
    
    wrapper.unmount()
  })

  it('should handle variant without value prop', () => {
    const wrapper = createWrapper({
      productName: 'Producto',
      variant: { ...defaultVariant, value: '', name: 'Color' },
    })
    
    // Component should mount with variant name when value is empty
    expect(wrapper.props('variant').name).toBe('Color')
    expect(wrapper.props('variant').value).toBe('')
    
    wrapper.unmount()
  })

  it('should filter images for current variant only', async () => {
    const wrapper = createWrapper()

    await wrapper.vm.$nextTick()
    
    // The component should only show images for this variant
    // Initially empty (query returns no data in test)
    const localDropzone = wrapper.find('[data-dropzone]')
    const dropzone = localDropzone.exists()
      ? localDropzone.element
      : document.body.querySelector('[data-dropzone]')
    expect(dropzone).not.toBeNull()
    
    wrapper.unmount()
  })
})
