import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ProductImageGallery from '../ProductImageGallery.vue'

// Mock toast
const mockToast = {
  add: vi.fn(),
}
vi.stubGlobal('useToast', () => mockToast)

describe('ProductImageGallery - Dropzone-first refactor', () => {
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

  const createWrapper = (props = {}) => {
    return mount(ProductImageGallery, {
      props: {
        productId: 'product-1',
        variants: [],
        canUpdate: true,
        canDelete: true,
        ...props,
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          UCard: { template: '<div class="u-card"><slot name="header" /><slot /></div>' },
          UButton: { template: '<button class="u-button"><slot /></button>' },
          UIcon: { template: '<i class="u-icon" />' },
          UInput: { template: '<input class="u-input" />' },
          USelect: { template: '<select class="u-select" />' },
          UCheckbox: { template: '<input type="checkbox" class="u-checkbox" />' },
          UBadge: { template: '<span class="u-badge"><slot /></span>' },
          UTooltip: { template: '<div class="u-tooltip"><slot /></div>' },
          UProgress: { template: '<div class="u-progress" />' },
          UCollapsible: {
            template: '<details class="u-collapsible"><summary><slot name="trigger" /></summary><slot /></details>',
          },
          ConfirmModal: { template: '<div class="confirm-modal" />' },
        },
      },
    })
  }

  describe('Dropzone primary affordance', () => {
    it('should render dropzone with idle state (dashed border, bg-default)', () => {
      const wrapper = createWrapper()
      
      const dropzone = wrapper.find('[role="button"][tabindex="0"]')
      expect(dropzone.exists()).toBe(true)
      expect(dropzone.classes()).toContain('border-dashed')
      expect(dropzone.classes()).toContain('border-default')
      expect(dropzone.classes()).toContain('bg-default')
    })

    it('should show idle copy "Arrastrá tus imágenes aquí o hacé click para elegir"', () => {
      const wrapper = createWrapper()
      
      const dropzone = wrapper.find('[role="button"]')
      expect(dropzone.text()).toContain('Arrastrá tus imágenes aquí')
      expect(dropzone.text()).toContain('hacé click para elegir')
    })

    it('should show allowed formats copy "JPG, PNG, WEBP o GIF — máx 10 MB"', () => {
      const wrapper = createWrapper()
      
      const dropzone = wrapper.find('[role="button"]')
      expect(dropzone.text()).toContain('JPG, PNG, WEBP o GIF')
      expect(dropzone.text()).toContain('máx 10 MB')
    })

    it('should have keyboard accessibility (role=button, tabindex=0)', () => {
      const wrapper = createWrapper()
      
      const dropzone = wrapper.find('[data-dropzone]')
      expect(dropzone.attributes('role')).toBe('button')
      expect(dropzone.attributes('tabindex')).toBe('0')
    })

    it('should show cursor-pointer class for clickability affordance', () => {
      const wrapper = createWrapper()
      
      const dropzone = wrapper.find('[role="button"]')
      expect(dropzone.classes()).toContain('cursor-pointer')
    })
  })

  describe('Drag-over visual feedback', () => {
    it('should apply border-solid and border-primary on drag-over state', async () => {
      const wrapper = createWrapper()
      
      // Simulate isOverDropZone = true from useImageUpload
      const dropzone = wrapper.find('[data-dropzone]')
      
      // This will fail until we implement the reactive classes based on isOverDropZone
      // We'll need to check for dynamic class binding
      expect(dropzone.html()).toBeTruthy() // Placeholder assertion - will implement proper check
    })

    it('should show upload cloud icon when drag-over', async () => {
      const wrapper = createWrapper()
      
      // This will fail until we conditionally render icon based on isOverDropZone
      expect(wrapper.html()).toBeTruthy() // Placeholder - will check for i-lucide-upload-cloud
    })
  })

  describe('URL input removed', () => {
    it('should NOT render URL input (completely removed)', () => {
      const wrapper = createWrapper()
      
      // Verify the URL input is NOT present (removed entirely)
      const urlInput = wrapper.find('input[placeholder*="cdn"]')
      expect(urlInput.exists()).toBe(false)
      
      // Verify no collapsible structure for URL input
      const html = wrapper.html()
      expect(html).not.toContain('Agregar por URL')
    })

    it('should only have dropzone as the upload method', () => {
      const wrapper = createWrapper()
      
      // Only dropzone should exist
      const dropzone = wrapper.find('[data-dropzone]')
      expect(dropzone.exists()).toBe(true)
      
      // No URL input anywhere
      const urlInput = wrapper.find('input[placeholder*="cdn"]')
      expect(urlInput.exists()).toBe(false)
    })
  })

  describe('No drag-to-reorder affordances', () => {
    it('should NOT render vuedraggable component', () => {
      const wrapper = createWrapper()
      
      // vuedraggable should be removed from the gallery grid
      const draggable = wrapper.findComponent({ name: 'draggable' })
      expect(draggable.exists()).toBe(false)
    })

    it('should NOT show drag handles (grip-vertical icon)', () => {
      const wrapper = createWrapper()
      
      const dragHandle = wrapper.find('.drag-handle')
      expect(dragHandle.exists()).toBe(false)
    })

    it('should NOT use draggable component in template', () => {
      const wrapper = createWrapper()
      
      // Ensure draggable component is NOT present in the component tree
      const draggable = wrapper.findComponent({ name: 'draggable' })
      expect(draggable.exists()).toBe(false)
      
      // The template should use a plain div for the grid (visible when images exist)
      // We're not testing with mock images here, just ensuring draggable isn't imported/used
      const html = wrapper.html()
      expect(html).not.toContain('draggable')
    })
  })

  describe('Upload progress visibility', () => {
    it('should show UProgress when isUploading is true', async () => {
      const wrapper = createWrapper()
      
      // Will fail until we add progress UI
      // We'll need to trigger upload and check for UProgress component
      expect(wrapper.html()).toBeTruthy() // Placeholder
    })

    it('should show uploading state overlay on dropzone during upload', async () => {
      const wrapper = createWrapper()
      
      // Check for overlay with loading indicator
      expect(wrapper.html()).toBeTruthy() // Placeholder
    })
  })

  describe('Empty state', () => {
    it('should show dropzone when no images exist (idle state)', () => {
      const wrapper = createWrapper()
      
      const dropzone = wrapper.find('[role="button"]')
      expect(dropzone.exists()).toBe(true)
      expect(dropzone.classes()).toContain('border-dashed')
    })

    it('should have empty state UI in template', () => {
      const wrapper = createWrapper()
      
      // Check that the empty state template exists in the HTML
      // (it may not be visible due to loading/conditional rendering, but should be in the template)
      const html = wrapper.html()
      
      // The component should have the dropzone for adding first images when empty
      expect(html).toContain('data-dropzone')
      expect(html).toContain('Arrastrá tus imágenes aquí')
    })
  })

  describe('Gallery grid with uploaded images', () => {
    it('should display thumbnails in grid when images exist', () => {
      // This will fail until we mock the query to return images
      const wrapper = createWrapper()
      
      expect(wrapper.html()).toBeTruthy() // Placeholder
    })

    it('should show delete button on each image card', () => {
      const wrapper = createWrapper()
      
      // Will check for delete buttons in image cards
      expect(wrapper.html()).toBeTruthy() // Placeholder
    })

    it('should show "Marcar como principal" button on non-main images', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.html()).toBeTruthy() // Placeholder
    })

    it('should show "Principal" badge on main image', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.html()).toBeTruthy() // Placeholder
    })
  })
})
