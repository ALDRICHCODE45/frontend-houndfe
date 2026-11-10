/**
 * VariantImagesPopover — the variant's thumbnail in its row (artboard 01) opens
 * a small popover with that variant's photos: upload to the variant, mark
 * main, delete, view whole. It never offers to choose existing product photos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import VariantImagesPopover from '../VariantImagesPopover.vue'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.stubGlobal('useToast', () => toast)
// jsdom has no ResizeObserver; the popover's positioning (floating-ui) needs one.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToast: () => toast,
}))

const api = vi.hoisted(() => ({
  getImages: vi.fn(),
  uploadVariantImage: vi.fn(),
  uploadProductImage: vi.fn(),
  setMainImage: vi.fn(),
  removeImage: vi.fn(),
}))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return { ...actual, productApi: Object.assign({}, actual.productApi, api) }
})

const image = (id: string, isMain: boolean, variantId: string | null, sortOrder = 0) => ({
  id,
  productId: 'product-1',
  variantId,
  url: `/img/${id}.png`,
  isMain,
  sortOrder,
  createdAt: '2026-11-01T00:00:00Z',
  fileId: null,
})

const variant = {
  id: 'v-s',
  productId: 'product-1',
  name: 'S',
  option: 'Talla',
  value: 'S',
  sku: null,
  barcode: null,
  priceCents: 0,
  quantity: 0,
  minQuantity: 0,
  purchaseNetCostCents: null,
  purchaseNetCostDecimal: null,
  variantPrices: [],
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 50))

function mountPopover(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return mountWithUApp(VariantImagesPopover, {
    attachTo: document.body,
    props: { productId: 'product-1', variant, label: 'Talla: S', canUpdate: true, canDelete: true, ...props },
    global: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [[VueQueryPlugin, { queryClient }]] as any,
    },
  })
}

function dialog() {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

beforeEach(() => {
  api.getImages.mockReset().mockResolvedValue([
    image('p1', true, null),
    image('s1', true, 'v-s'),
    image('s2', false, 'v-s', 1),
  ])
  api.uploadVariantImage.mockReset()
  api.uploadProductImage.mockReset()
  api.setMainImage.mockReset().mockResolvedValue({})
  api.removeImage.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('VariantImagesPopover', () => {
  it('the row thumbnail shows the variant main photo and its count, named for assistive tech', async () => {
    const wrapper = mountPopover()
    await flushPromises()

    const thumb = wrapper.get('[data-testid="variant-photos-trigger"]')
    expect(thumb.attributes('aria-label')).toBe('Fotos de Talla: S: 2 fotos')
    expect(thumb.get('img').attributes('src')).toBe('/img/s1.png')
    expect(thumb.text()).toContain('2')
  })

  it('a variant without photos shows an add mark and says so', async () => {
    api.getImages.mockResolvedValue([image('p1', true, null)])
    const wrapper = mountPopover()
    await flushPromises()

    const thumb = wrapper.get('[data-testid="variant-photos-trigger"]')
    expect(thumb.attributes('aria-label')).toBe('Talla: S: sin fotos. Agregar fotos')
    expect(thumb.find('img').exists()).toBe(false)
  })

  it('opens a small dialog with only this variant photos, the main one starred, and «Agregar»', async () => {
    const wrapper = mountPopover()
    await flushPromises()

    await wrapper.get('[data-testid="variant-photos-trigger"]').trigger('click')
    await tick()

    const panel = dialog()!
    expect(panel.textContent).toContain('Fotos de Talla: S')
    expect(panel.textContent).toContain('Se muestran al elegir esta variante en la venta y el catálogo.')
    expect(panel.querySelectorAll('[data-testid="product-image-tile"]')).toHaveLength(2)
    expect(panel.textContent).toContain('Principal')
    expect(panel.querySelector('[aria-label="Agregar fotos a Talla: S"]')).not.toBeNull()
    expect(panel.textContent).not.toMatch(/Elegir fotos|existentes/)
  })

  it('opening from the parent (row ⋮ «Fotos») uses the same dialog', async () => {
    mountPopover({ open: true })
    await flushPromises()
    await tick()
    expect(dialog()?.textContent).toContain('Fotos de Talla: S')
  })

  it('files dropped on the dialog upload to this variant', async () => {
    api.uploadVariantImage.mockReturnValue(new Promise(() => {}))
    mountPopover({ open: true })
    await flushPromises()
    await tick()

    const zone = document.body.querySelector<HTMLElement>('[data-testid="variant-photos-panel"]')!
    const event = new Event('drop', { bubbles: true, cancelable: true })
    const file = new File(['x'], 'x.png', { type: 'image/png' })
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [file], items: [{ kind: 'file', type: 'image/png' }], dropEffect: 'none' },
    })
    zone.dispatchEvent(event)
    await flushPromises()

    expect(api.uploadVariantImage).toHaveBeenCalledWith('product-1', 'v-s', file, expect.any(Object))
    expect(api.uploadProductImage).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Subiendo x.png')
  })

  it('empty variant: the dialog says it has no photos yet', async () => {
    api.getImages.mockResolvedValue([])
    mountPopover({ open: true })
    await flushPromises()
    await tick()
    expect(dialog()?.textContent).toContain('Aún no tiene fotos propias.')
  })

  it('read-only: no «Agregar», no ⋯ and no drop hint; photos still open whole', async () => {
    mountPopover({ open: true, canUpdate: false, canDelete: false })
    await flushPromises()
    await tick()

    const panel = dialog()!
    expect(panel.querySelector('[aria-label^="Agregar fotos"]')).toBeNull()
    expect(panel.querySelector('[aria-label^="Acciones de la foto"]')).toBeNull()
    expect(panel.textContent).not.toContain('arrastrar')
    expect(panel.querySelector('[aria-label="Ver imagen completa: foto 2 de Talla: S"]')).not.toBeNull()
  })
})
