/**
 * ProductImageGallery — the photo ⋯ menu (Ver imagen completa, Marcar como
 * principal, Eliminar… with a confirm), plus source guards: --hf roles only,
 * no reorder affordance (no backend for it) and the confirm stacking over the
 * lightbox.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

const api = vi.hoisted(() => ({ getImages: vi.fn(), setMainImage: vi.fn(), removeImage: vi.fn() }))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return { ...actual, productApi: Object.assign({}, actual.productApi, api) }
})

const image = (id: string, isMain: boolean, sortOrder = 0) => ({
  id,
  productId: 'product-1',
  variantId: null,
  url: `/img/${id}.png`,
  isMain,
  sortOrder,
  createdAt: '2026-11-01T00:00:00Z',
  fileId: null,
})

const sfc = readFileSync(join(__dirname, '..', 'ProductImageGallery.vue'), 'utf-8')
const tick = () => new Promise((resolve) => setTimeout(resolve, 50))
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))

function mountGallery(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return mountWithUApp(ProductImageGallery, {
    attachTo: document.body,
    props: { productId: 'product-1', variants: [], canUpdate: true, canDelete: true, ...props },
    global: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [[VueQueryPlugin, { queryClient }]] as any,
    },
  })
}

async function openPhotoMenu(wrapper: ReturnType<typeof mountGallery>, label: string) {
  await wrapper.get(`button[aria-label="${label}"]`).trigger('click')
  await tick()
}

beforeEach(() => {
  api.getImages.mockReset().mockResolvedValue([image('a', true), image('b', false, 1)])
  api.setMainImage.mockReset().mockResolvedValue({})
  api.removeImage.mockReset().mockResolvedValue(undefined)
  toast.add.mockClear()
})
afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductImageGallery photo menu', () => {
  it('a photo ⋯ offers Ver imagen completa, Marcar como principal and a last Eliminar…', async () => {
    const wrapper = mountGallery()
    await flushPromises()

    await openPhotoMenu(wrapper, 'Acciones de la foto 2 del producto')
    expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
      'Ver imagen completa',
      'Marcar como principal',
      'Eliminar…',
    ])

    menuItems()[1]!.click()
    await flushPromises()
    expect(api.setMainImage).toHaveBeenCalledWith('product-1', 'b')
  })

  it('the main photo has no «Marcar como principal»', async () => {
    const wrapper = mountGallery()
    await flushPromises()

    await openPhotoMenu(wrapper, 'Acciones de la foto 1 del producto, principal')
    expect(menuItems().map((item) => item.textContent?.trim())).toEqual(['Ver imagen completa', 'Eliminar…'])
  })

  it('Eliminar… asks first and deletes only after the confirm', async () => {
    const wrapper = mountGallery()
    await flushPromises()

    await openPhotoMenu(wrapper, 'Acciones de la foto 2 del producto')
    menuItems().find((item) => item.textContent?.trim() === 'Eliminar…')!.click()
    await tick()

    expect(api.removeImage).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('¿Eliminar esta foto?')
    const confirm = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Eliminar',
    )!
    confirm.click()
    await flushPromises()
    expect(api.removeImage).toHaveBeenCalledWith('product-1', 'b')
  })

  it('with update but no delete rights, the menu has no Eliminar…', async () => {
    const wrapper = mountGallery({ canDelete: false })
    await flushPromises()

    await openPhotoMenu(wrapper, 'Acciones de la foto 2 del producto')
    expect(menuItems().map((item) => item.textContent?.trim())).toEqual([
      'Ver imagen completa',
      'Marcar como principal',
    ])
  })
})

describe('ProductImageGallery source guards', () => {
  it('uses --hf roles only: no coco-* classes, brand tokens or AppBadge', () => {
    expect(sfc).not.toMatch(/coco-|--brand-|AppBadge/)
  })

  it('has no URL input and no drag-to-reorder (the backend has no order endpoint)', () => {
    expect(sfc).not.toMatch(/draggable|drag-handle|Agregar por URL/)
  })

  it('renders the ConfirmModal with a z-[60]/z-[61] ui so it stacks above the image lightbox', () => {
    const confirmBlock = sfc.match(/<ConfirmModal[\s\S]*?\/>/)?.[0]
    expect(confirmBlock, 'ConfirmModal must exist in the gallery SFC').toBeTruthy()
    expect(confirmBlock).toMatch(/overlay:\s*'z-\[60\]'/)
    expect(confirmBlock).toMatch(/content:\s*'z-\[61\]'/)
  })
})
