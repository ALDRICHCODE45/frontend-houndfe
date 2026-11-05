/**
 * ProductImageGallery — S10 states: loading (skeleton squares), empty
 * (EmptyState), data (thumbnails with the Principal StatusBadge).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductImageGallery from '../ProductImageGallery.vue'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const api = vi.hoisted(() => ({ getImages: vi.fn() }))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return { ...actual, productApi: { ...actual.productApi, getImages: api.getImages } }
})

const image = (id: string, isMain: boolean) => ({
  id,
  productId: 'product-1',
  variantId: null,
  url: `/img/${id}.png`,
  isMain,
  sortOrder: 0,
})

function mountGallery(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mountWithUApp(ProductImageGallery, {
    props: { productId: 'product-1', variants: [], canUpdate: true, canDelete: true, ...props },
    global: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [[VueQueryPlugin, { queryClient }]] as any,
      stubs: {
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
        UModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
      },
    },
  })
}

beforeEach(() => {
  api.getImages.mockReset()
})

describe('ProductImageGallery states (S10)', () => {
  it('error: says the images did not load, with a retry, never «Sin imágenes»', async () => {
    api.getImages.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([image('a', true)])
    const wrapper = mountGallery()
    await flushPromises()

    const state = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(state.text()).toContain('No se pudieron cargar las imágenes')
    expect(wrapper.text()).not.toContain('Sin imágenes')
    await state.get('button').trigger('click')
    await flushPromises()
    expect(api.getImages).toHaveBeenCalledTimes(2)
    expect(wrapper.findAll('img')).toHaveLength(1)
  })

  it('data: the scope label and the Principal badge share one wrapping row, so they never overlap', async () => {
    api.getImages.mockResolvedValue([image('a', true)])
    const wrapper = mountGallery()
    await flushPromises()

    const row = wrapper.get('[data-testid="gallery-card-labels"]')
    expect(row.text()).toContain('Producto')
    expect(row.text()).toContain('Principal')
  })

  it('loading: shows skeleton squares and no thumbnails', async () => {
    api.getImages.mockReturnValue(new Promise(() => {}))
    const wrapper = mountGallery()
    await flushPromises()

    expect(wrapper.get('[data-testid="gallery-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('empty: shows the empty state, with the dropzone as the way to add', async () => {
    api.getImages.mockResolvedValue([])
    const wrapper = mountGallery()
    await flushPromises()

    const empty = wrapper.get('.hf-empty-state[data-kind="empty"]')
    expect(empty.text()).toContain('Sin imágenes')
    expect(wrapper.find('[data-dropzone]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="gallery-skeleton"]').exists()).toBe(false)
  })

  it('empty without update permission: no dropzone and no hint to upload', async () => {
    api.getImages.mockResolvedValue([])
    const wrapper = mountGallery({ canUpdate: false })
    await flushPromises()

    expect(wrapper.find('[data-dropzone]').exists()).toBe(false)
    expect(wrapper.get('.hf-empty-state').text()).not.toContain('Sube')
  })

  it('data: shows the thumbnails and one Principal badge, with named icon buttons', async () => {
    api.getImages.mockResolvedValue([image('a', true), image('b', false)])
    const wrapper = mountGallery()
    await flushPromises()

    expect(wrapper.findAll('img')).toHaveLength(2)
    expect(wrapper.findAll('.hf-status-badge')).toHaveLength(1)
    expect(wrapper.get('.hf-status-badge').text()).toBe('Principal')
    for (const button of wrapper.findAll('button[aria-label]')) {
      expect(button.attributes('aria-label')).toBeTruthy()
    }
    expect(wrapper.find('button[aria-label="Eliminar imagen"]').exists()).toBe(true)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})
