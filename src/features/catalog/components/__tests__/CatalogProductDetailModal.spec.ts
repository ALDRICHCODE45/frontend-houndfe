import { DOMWrapper, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import CatalogProductDetailModal from '@/features/catalog/components/CatalogProductDetailModal.vue'

const UModal = defineComponent({
  props: { open: Boolean, title: String, description: String, content: Object },
  emits: ['update:open'],
  setup(props, { emit, slots }) {
    return () =>
      props.open
        ? h('section', { role: 'dialog', 'aria-label': props.title }, [
            h('button', {
              type: 'button',
              'aria-label': 'Cerrar diálogo',
              onClick: () => emit('update:open', false),
            }),
            slots.body?.(),
          ])
        : null
  },
})
const stubs = {
  UModal,
  UIcon: defineComponent({ setup: () => () => h('span') }),
  USkeleton: defineComponent({ setup: () => () => h('span', { 'data-testid': 'skeleton' }) }),
}

const detail = {
  id: 'product-1',
  name: 'Café molido de altura',
  slug: null,
  description: 'Notas de cacao <strong>sin formato HTML</strong>.',
  category: { id: 'coffee', name: 'Café' },
  brand: { name: 'Tostadores' },
  images: [
    { id: 'secondary', url: 'https://example.test/secondary.jpg', isMain: false },
    { id: 'main', url: 'https://example.test/main.jpg', isMain: true },
  ],
  price: { priceCents: 2599, hidden: false },
  availability: 'available' as const,
  stockPresentation: {
    mode: 'SYSTEM_STATUS' as const,
    status: 'available' as const,
    customQuantity: null,
  },
  hasVariants: true,
  variants: [
    {
      id: 'variant-1',
      name: 'Bolsa mediana',
      option: 'Tamaño',
      value: '500 g',
      image: null,
      price: { priceCents: 2999, hidden: false },
      availabilityByBranch: [
        {
          branchId: 'branch-conflicting',
          branchName: 'Sucursal Norte',
          branchSlug: 'norte',
          availability: 'out_of_stock' as const,
          isSelected: false,
        },
        {
          branchId: 'branch-1',
          branchName: 'Sucursal Centro',
          branchSlug: 'centro',
          availability: 'low_stock' as const,
          isSelected: true,
        },
      ],
      stockPresentation: {
        mode: 'CUSTOM_QUANTITY' as const,
        status: null,
        customQuantity: 0,
      },
    },
  ],
  rating: null,
  featuredLabel: null,
  priceContext: { priceListId: 'list-1', name: 'Lista pública', isCatalogDefault: true },
  excludedCount: 0 as const,
}

const mountModal = (props = {}) =>
  mount(CatalogProductDetailModal, {
    attachTo: document.body,
    props: { open: true, detail, state: 'populated', ...props },
    global: { stubs },
  })

function getRendered(selector: string) {
  const element = document.body.querySelector(selector)
  if (!element) throw new Error(`Missing rendered element: ${selector}`)
  return new DOMWrapper(element as HTMLElement)
}

const renderedText = () => document.body.textContent ?? ''

describe('CatalogProductDetailModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })
  it('renders accessible populated detail with main image, plain-text description, price, stock, and read-only variants', async () => {
    mountModal()
    await nextTick()

    expect(renderedText()).toContain('Detalle del producto')
    expect(renderedText()).toContain('Información del producto seleccionado')
    expect(getRendered('img').attributes()).toMatchObject({
      src: 'https://example.test/main.jpg',
      alt: `Imagen de ${detail.name}`,
    })
    expect(renderedText()).toContain(detail.description)
    expect(document.body.innerHTML).not.toContain('<strong>sin formato HTML</strong>')
    expect(renderedText()).toContain('$25.99')
    expect(renderedText()).toContain('Disponible')
    expect(renderedText()).toContain('Variantes disponibles')
    expect(renderedText()).toContain('Tamaño: 500 g')
    expect(renderedText()).toContain('$29.99')
    expect(renderedText()).toContain('0 unidades')
    expect(renderedText()).toContain('Pocas piezas')
    expect(renderedText()).not.toContain('Agotado')
    expect(
      getRendered('section[aria-labelledby="catalog-detail-variants"]').findAll(
        'button, input, select',
      ).length,
    ).toBe(0)
    expect(renderedText()).not.toMatch(/Agregar|cantidad|carrito|checkout|WhatsApp/i)
  })

  it('uses a safe fallback when no product image exists or its main image fails', async () => {
    mountModal({ detail: { ...detail, images: [] } })
    await nextTick()
    expect(document.body.querySelector('img')).toBeNull()
    expect(
      getRendered('[data-testid="catalog-detail-image-fallback"]').attributes('aria-label'),
    ).toBe(`Imagen no disponible para ${detail.name}`)

    mountModal()
    await nextTick()
    await getRendered('img').trigger('error')
    expect(document.body.querySelector('img')).toBeNull()
    expect(
      document.body.querySelector('[data-testid="catalog-detail-image-fallback"]'),
    ).not.toBeNull()
  })

  it.each([
    [{ price: { priceCents: null, hidden: true } }, 'Consultar precio', false],
    [
      {
        availability: 'out_of_stock',
        stockPresentation: {
          mode: 'ABSTRACT_STATUS',
          status: 'out_of_stock',
          customQuantity: null,
        },
      },
      'Agotado',
      true,
    ],
    [
      {
        availability: null,
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
      },
      '0 unidades',
      false,
    ],
    [
      {
        availability: null,
        stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
      },
      'Información no disponible',
      false,
    ],
  ] as const)(
    'preserves hidden price and stock presentation %o',
    async (overrides, expectedCopy, hasOutOfStock) => {
      mountModal({ detail: { ...detail, ...overrides } })
      await nextTick()

      expect(renderedText()).toContain(expectedCopy)
      expect(renderedText().includes('Agotado')).toBe(hasOutOfStock)
      if ('price' in overrides) expect(renderedText()).not.toContain('$0')
    },
  )

  it.each([
    ['loading', 'Cargando detalle del producto', false],
    ['retry-pending', 'Reintentando detalle del producto', false],
    ['not-found', 'Este producto ya no está disponible en esta sucursal.', false],
    ['rate-limit', 'Hay muchas solicitudes en este momento.', true],
    ['network', 'No se pudo conectar para cargar el detalle.', true],
    ['server', 'No pudimos cargar el detalle del producto.', true],
  ] as const)('renders the %s detail state with guarded retry', async (state, copy, canRetry) => {
    const wrapper = mountModal({ detail: null, state })
    await nextTick()

    expect(renderedText()).toContain(copy)
    const retry = new DOMWrapper(
      document.body.querySelector('button:not([aria-label])') as HTMLElement | null,
    )
    expect(retry.exists()).toBe(canRetry)
    if (canRetry) {
      await retry.trigger('click')
      expect(wrapper.emitted('retry')).toEqual([[]])
    }
  })

  it('emits close from both its explicit close control and modal dismiss event', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered('button[aria-label="Cerrar detalle del producto"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('close')).toEqual([[], []])
  })
})
