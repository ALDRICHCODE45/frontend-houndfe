/**
 * ProductImageGallery — the compact «Imágenes» card (artboard 01 «Tira compacta»):
 * main photo plus a strip, and its states: with images, empty, dragging over,
 * uploading, a failed file, read-only and load error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductImageGallery from '../ProductImageGallery.vue'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.stubGlobal('useToast', () => toast)
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToast: () => toast,
}))

const api = vi.hoisted(() => ({
  getImages: vi.fn(),
  uploadProductImage: vi.fn(),
  uploadVariantImage: vi.fn(),
}))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return { ...actual, productApi: Object.assign({}, actual.productApi, api) }
})

const image = (id: string, isMain: boolean, variantId: string | null = null, sortOrder = 0) => ({
  id,
  productId: 'product-1',
  variantId,
  url: `/img/${id}.png`,
  isMain,
  sortOrder,
  createdAt: '2026-11-01T00:00:00Z',
  fileId: null,
})

const variant = (id: string, value: string) => ({
  id,
  productId: 'product-1',
  name: value,
  option: 'Talla',
  value,
  sku: null,
  barcode: null,
  priceCents: 0,
  quantity: 0,
  minQuantity: 0,
  purchaseNetCostCents: null,
  purchaseNetCostDecimal: null,
  variantPrices: [],
})

function mountGallery(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mountWithUApp(ProductImageGallery, {
    attachTo: document.body,
    props: { productId: 'product-1', variants: [], canUpdate: true, canDelete: true, ...props },
    global: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [[VueQueryPlugin, { queryClient }]] as any,
    },
  })
}

/** A drag/drop event carrying files, as the browser sends it. */
function fileDragEvent(type: string, files: File[]) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', {
    value: {
      files,
      items: files.map((file) => ({ kind: 'file', type: file.type })),
      dropEffect: 'none',
    },
  })
  return event
}

const png = (name: string) => new File(['x'], name, { type: 'image/png' })

beforeEach(() => {
  api.getImages.mockReset()
  api.uploadProductImage.mockReset()
  api.uploadVariantImage.mockReset()
  toast.add.mockClear()
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductImageGallery states', () => {
  it('with images: the main photo leads with a «Principal» badge and the rest sit in a strip', async () => {
    api.getImages.mockResolvedValue([image('a', true), image('b', false, null, 1), image('c', false, null, 2)])
    const wrapper = mountGallery()
    await flushPromises()

    const lead = wrapper.get('[data-testid="product-images-lead"]')
    expect(lead.get('.hf-status-badge').text()).toBe('Principal')
    expect(lead.get('button[aria-label^="Ver imagen completa"]').attributes('aria-label')).toBe(
      'Ver imagen completa: foto 1 del producto, principal',
    )
    expect(wrapper.findAll('[data-testid="product-images-rail"] [data-testid="product-image-tile"]')).toHaveLength(2)
    expect(wrapper.findAll('.hf-status-badge')).toHaveLength(1)
    expect(wrapper.get('[data-testid="product-images-count"]').text()).toBe('3 fotos')
    expect(wrapper.find('[data-testid="product-images-add"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Arrastra fotos a esta tarjeta para subirlas al producto')
    expect(wrapper.find('[data-testid="gallery-skeleton"]').exists()).toBe(false)
  })

  it('empty: one add button and the explanation that the first photo becomes the main one', async () => {
    api.getImages.mockResolvedValue([])
    const wrapper = mountGallery()
    await flushPromises()

    expect(wrapper.get('[data-testid="product-images-count"]').text()).toBe('Sin fotos')
    expect(wrapper.text()).toContain('Aún no hay fotos')
    expect(wrapper.text()).toContain('La primera que subas será la principal')
    expect(wrapper.get('[data-testid="product-images-add"]').text()).toContain('Subir fotos')
    expect(wrapper.find('[data-testid="product-images-lead"]').exists()).toBe(false)
  })

  it('dragging files over the card: an overlay says where they will go', async () => {
    api.getImages.mockResolvedValue([image('a', true)])
    const wrapper = mountGallery()
    await flushPromises()

    wrapper.get('[data-testid="product-images"]').element.dispatchEvent(fileDragEvent('dragenter', [png('a.png')]))
    await flushPromises()

    expect(wrapper.get('[data-testid="product-images-drop"]').text()).toContain('Suelta para subir a Producto')
  })

  it('uploading: each file has its own tile, with progress or «En cola», and the count says how far it is', async () => {
    api.getImages.mockResolvedValue([image('a', true)])
    api.uploadProductImage.mockReturnValue(new Promise(() => {}))
    const wrapper = mountGallery()
    await flushPromises()

    wrapper
      .get('[data-testid="product-images"]')
      .element.dispatchEvent(fileDragEvent('drop', [png('base.png'), png('caja.png')]))
    await flushPromises()

    const bars = wrapper.findAll('[role="progressbar"]')
    expect(bars.map((bar) => bar.attributes('aria-label'))).toEqual(['Subiendo base.png', 'En cola caja.png'])
    expect(bars[1]!.text()).toContain('En cola')
    expect(wrapper.get('[data-testid="product-images-count"]').text()).toBe('Subiendo 1 de 2…')
    expect(wrapper.get('[data-testid="product-images-count"]').attributes('role')).toBe('status')
  })

  it('a failed file: a tile says «No se subió» and an inline alert names it, with Elegir otra and Descartar', async () => {
    api.getImages.mockResolvedValue([image('a', true)])
    const wrapper = mountGallery()
    await flushPromises()

    wrapper
      .get('[data-testid="product-images"]')
      .element.dispatchEvent(fileDragEvent('drop', [new File(['x'], 'lado.heic', { type: 'image/heic' })]))
    await flushPromises()

    expect(wrapper.get('[data-testid="product-image-upload-failed"]').text()).toContain('No se subió')
    const alert = wrapper.get('[data-testid="product-images-upload-alert"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('lado.heic no se subió.')
    expect(alert.text()).toContain('Formato no soportado')
    const buttons = alert.findAll('button').map((button) => button.text())
    expect(buttons).toEqual(['Elegir otra', 'Descartar'])

    await alert.findAll('button')[1]!.trigger('click')
    expect(wrapper.find('[data-testid="product-images-upload-alert"]').exists()).toBe(false)
  })

  it('a network failure offers «Reintentar», which sends the file again', async () => {
    api.getImages.mockResolvedValue([image('a', true)])
    api.uploadProductImage.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(image('n', false))
    const wrapper = mountGallery()
    await flushPromises()

    wrapper.get('[data-testid="product-images"]').element.dispatchEvent(fileDragEvent('drop', [png('base.png')]))
    await flushPromises()

    const alert = wrapper.get('[data-testid="product-images-upload-alert"]')
    expect(alert.findAll('button').map((button) => button.text())).toEqual(['Reintentar', 'Descartar'])
    await alert.findAll('button')[0]!.trigger('click')
    await flushPromises()
    expect(api.uploadProductImage).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="product-images-upload-alert"]').exists()).toBe(false)
  })

  it('read-only: no add, no ⋯, no drop; says «Solo lectura» and a click opens the whole photo', async () => {
    api.getImages.mockResolvedValue([image('a', true), image('b', false, null, 1)])
    const wrapper = mountGallery({ canUpdate: false, canDelete: false })
    await flushPromises()

    expect(wrapper.text()).toContain('Solo lectura')
    expect(wrapper.find('[data-testid="product-images-add"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label^="Acciones de la foto"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Arrastra fotos')

    wrapper.get('[data-testid="product-images"]').element.dispatchEvent(fileDragEvent('dragenter', [png('a.png')]))
    wrapper.get('[data-testid="product-images"]').element.dispatchEvent(fileDragEvent('drop', [png('a.png')]))
    await flushPromises()
    expect(wrapper.find('[data-testid="product-images-drop"]').exists()).toBe(false)
    expect(api.uploadProductImage).not.toHaveBeenCalled()

    await wrapper.get('button[aria-label="Ver imagen completa: foto 2 del producto"]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('img[alt="Foto 2 del producto"]')).not.toBeNull()
  })

  it('load error: says the images did not load, with Reintentar, never as an empty card', async () => {
    api.getImages.mockRejectedValueOnce(new Error('boom')).mockResolvedValue([image('a', true)])
    const wrapper = mountGallery()
    await flushPromises()

    const alert = wrapper.get('[data-testid="product-images-load-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('No se pudieron cargar las imágenes.')
    expect(wrapper.text()).not.toContain('Aún no hay fotos')
    await alert.get('button').trigger('click')
    await flushPromises()
    expect(api.getImages).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="product-images-lead"]').exists()).toBe(true)
  })

  it('loading: skeleton squares and no photos', async () => {
    api.getImages.mockReturnValue(new Promise(() => {}))
    const wrapper = mountGallery()
    await flushPromises()

    expect(wrapper.get('[data-testid="gallery-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="product-image-tile"]').exists()).toBe(false)
  })

  it('variant chips filter the strip, set the upload destination and label each photo in «Todas»', async () => {
    api.getImages.mockResolvedValue([
      image('a', true),
      image('s1', true, 'v-s'),
      image('s2', false, 'v-s', 1),
    ])
    const wrapper = mountGallery({ variants: [variant('v-s', 'S'), variant('v-l', 'L')] })
    await flushPromises()

    const group = wrapper.get('[role="group"][aria-label="Mostrar fotos de"]')
    const chips = group.findAll('button')
    expect(chips.map((chip) => chip.text())).toEqual(['Todas 3', 'Producto 1', 'S 2', 'L 0'])
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')

    const scopes = wrapper.findAll('[data-testid="product-images-rail"] [data-testid="product-image-scope"]')
    expect(scopes.map((scope) => scope.text())).toEqual(['S', 'S'])
    // A variant's own main photo is marked with a star that names it, not color only.
    expect(wrapper.get('[data-testid="product-images-rail"]').text()).toContain('Principal de S')

    await chips[2]!.trigger('click')
    expect(chips[2]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-testid="product-image-scope"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="product-images-lead"] .hf-status-badge').text()).toBe('Principal')
    expect(wrapper.get('[data-testid="product-images-add"]').attributes('aria-label')).toBe('Agregar fotos a S')
    expect(wrapper.text()).toContain('para subirlas a S')

    api.uploadVariantImage.mockReturnValue(new Promise(() => {}))
    wrapper.get('[data-testid="product-images"]').element.dispatchEvent(fileDragEvent('drop', [png('x.png')]))
    await flushPromises()
    expect(api.uploadVariantImage).toHaveBeenCalledWith('product-1', 'v-s', expect.any(File), expect.any(Object))

    await chips[3]!.trigger('click')
    expect(wrapper.text()).toContain('L aún no tiene fotos propias')
  })
})
