import { DOMWrapper, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import CatalogProductDetailModal from '@/features/catalog/components/CatalogProductDetailModal.vue'

/**
 * The Nuxt UI Vite plugin injects `UModal` as a direct component import, so `@vue/test-utils` name
 * stubs never intercept it: the real dialog, its semantic header, its theme classes and its Escape
 * dismissal are what these tests observe. This stub only pins the UModal prop contract the redesign
 * depends on (`close`, `ui`) and keeps `update:open` as the dismissal path for any suite that does
 * stub `UModal`.
 */
const UModal = defineComponent({
  props: {
    open: Boolean,
    title: String,
    description: String,
    content: Object,
    close: { type: [Boolean, Object], default: true },
    ui: Object,
  },
  emits: ['update:open'],
  setup(props, { emit, slots }) {
    const titleId = 'stub-u-modal-title'
    return () =>
      props.open
        ? h(
            'div',
            {
              role: 'dialog',
              'aria-labelledby': titleId,
              'data-slot': 'content',
              class: [props.content?.class, props.ui?.content],
            },
            [
              h('div', { 'data-slot': 'header', class: props.ui?.header }, [
                h('h2', { id: titleId, 'data-slot': 'title' }, props.title),
                h('p', { 'data-slot': 'description' }, props.description),
              ]),
              props.close
                ? h('button', {
                    type: 'button',
                    'aria-label': 'Cerrar diálogo',
                    'data-slot': 'close',
                    onClick: () => emit('update:open', false),
                  })
                : null,
              h('div', { 'data-slot': 'body', class: props.ui?.body }, [slots.body?.()]),
            ],
          )
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

function getAllRendered(selector: string) {
  return Array.from(document.body.querySelectorAll(selector)).map(
    (element) => new DOMWrapper(element as HTMLElement),
  )
}

function getNthRendered(selector: string, index: number) {
  const element = document.body.querySelectorAll(selector)[index]
  if (!element) throw new Error(`Missing rendered element: ${selector} at ${index}`)
  return new DOMWrapper(element as HTMLElement)
}

const renderedText = () => document.body.textContent ?? ''

describe('CatalogProductDetailModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('renders a real dialog whose semantic header is visually hidden without duplicating it in the body', async () => {
    mountModal()
    await nextTick()

    const content = getRendered('[data-slot="content"]')
    expect(content.attributes('role')).toBe('dialog')

    const header = getRendered('[data-slot="header"]')
    expect(header.classes()).toContain('sr-only')
    expect(header.text()).toContain('Detalle del producto')
    expect(header.text()).toContain('Información del producto seleccionado')

    // The dialog keeps its accessible name from the hidden title, never from duplicated visible copy.
    const labelledBy = content.attributes('aria-labelledby') ?? ''
    expect(labelledBy).not.toBe('')
    expect(document.getElementById(labelledBy)?.textContent?.trim()).toBe('Detalle del producto')

    const body = getRendered('[data-slot="body"]')
    expect(body.text()).not.toContain('Detalle del producto')
    expect(body.text()).not.toContain('Información del producto seleccionado')
  })

  it('suppresses the generated close control and widens the dialog into a scroll-safe surface', async () => {
    mountModal()
    await nextTick()

    // `:close="false"` removes the generated control; the redesign owns its one explicit close target.
    expect(document.body.querySelector('[data-slot="close"]')).toBeNull()
    expect(document.body.querySelector('button[aria-label="Cerrar diálogo"]')).toBeNull()

    const content = getRendered('[data-slot="content"]')
    expect(content.classes()).toContain('max-w-4xl')
    expect(content.classes()).not.toContain('max-w-lg')
    expect(content.classes()).toContain('rounded-2xl')
    expect(content.classes()).toContain('overflow-hidden')
    expect(
      content.classes().some((className) => className.startsWith('max-h-[')),
      'the dialog must stay inside the viewport height',
    ).toBe(true)

    const body = getRendered('[data-slot="body"]')
    expect(body.classes()).toContain('p-0')
    expect(body.classes()).toContain('sm:p-0')
    expect(body.classes()).not.toContain('p-4')
    expect(body.classes()).not.toContain('sm:p-6')
    expect(body.classes()).toContain('overflow-y-auto')
  })

  it('composes the desktop split from a cobalt media region and a details region that collapse to one column', async () => {
    mountModal()
    await nextTick()

    const split = getRendered('[data-testid="catalog-detail-split"]')
    expect(split.classes()).toContain('grid')
    expect(split.classes()).toContain('grid-cols-1')
    expect(split.classes().some((className) => className.startsWith('md:grid-cols-'))).toBe(true)
    expect(split.element.children).toHaveLength(2)

    const media = getRendered('[data-testid="catalog-detail-media-panel"]')
    const details = getRendered('[data-testid="catalog-detail-details-panel"]')
    expect(media.classes()).toContain('bg-coco-50')
    expect(media.classes()).toContain('min-w-0')
    expect(details.classes()).toContain('min-w-0')
    expect(details.classes()).toContain('p-6')
    expect(media.element.parentElement).toBe(split.element)
    expect(details.element.parentElement).toBe(split.element)
    expect(split.element.children[0]).toBe(media.element)
    expect(split.element.children[1]).toBe(details.element)

    // An explicit 44px close target is the only dialog action in a populated read-only detail.
    expect(getAllRendered('button')).toHaveLength(1)
    const close = getNthRendered('button', 0)
    expect(close.attributes('aria-label')).toBe('Cerrar detalle del producto')
    expect(close.attributes('type')).toBe('button')
    expect(close.classes()).toContain('size-11')
  })

  it('renders the populated detail with main image, plain-text description, price, category, availability, and read-only variants', async () => {
    mountModal()
    await nextTick()

    expect(getRendered('img').attributes()).toMatchObject({
      src: 'https://example.test/main.jpg',
      alt: `Imagen de ${detail.name}`,
    })
    expect(getRendered('[data-testid="catalog-detail-brand"]').text()).toBe('Tostadores')
    expect(getRendered('[data-testid="catalog-detail-category"]').text()).toBe('Café')
    expect(getRendered('[data-testid="catalog-detail-name"]').text()).toBe(detail.name)
    expect(getRendered('[data-testid="catalog-detail-price"]').text()).toBe('$25.99')
    expect(renderedText()).toContain('Disponible')
    expect(getRendered('[data-testid="catalog-detail-availability"]').text()).toContain(
      'Disponible',
    )

    const description = getRendered('[data-testid="catalog-detail-description"]')
    expect(description.text()).toBe(detail.description)
    expect(document.body.innerHTML).not.toContain('<strong>sin formato HTML</strong>')

    // `section[aria-labelledby]` is what exposes the variants region to assistive technology.
    const variantRegion = getRendered('section[aria-labelledby="catalog-detail-variants"]')
    expect(variantRegion.findAll('button, input, select').length).toBe(0)
    expect(renderedText()).toContain('Variantes disponibles')
    expect(renderedText()).toContain('Tamaño: 500 g')
    expect(renderedText()).toContain('$29.99')
    expect(renderedText()).toContain('0 unidades')
    expect(renderedText()).toContain('Pocas piezas')
    expect(renderedText()).not.toContain('Agotado')
  })

  it('renders each variant card from the selected branch only and never implies a chosen variant', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          {
            ...detail.variants[0],
            id: 'variant-low',
            name: 'Bolsa chica',
            price: { priceCents: 1999, hidden: false },
            availabilityByBranch: [
              {
                branchId: 'branch-other',
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
              mode: 'SYSTEM_STATUS' as const,
              status: 'low_stock' as const,
              customQuantity: null,
            },
          },
          {
            ...detail.variants[0],
            id: 'variant-out',
            name: 'Bolsa grande',
            option: null,
            value: null,
            price: { priceCents: null, hidden: true },
            availabilityByBranch: [
              {
                branchId: 'branch-other',
                branchName: 'Sucursal Norte',
                branchSlug: 'norte',
                availability: 'available' as const,
                isSelected: false,
              },
              {
                branchId: 'branch-1',
                branchName: 'Sucursal Centro',
                branchSlug: 'centro',
                availability: 'out_of_stock' as const,
                isSelected: true,
              },
            ],
            stockPresentation: {
              mode: 'ABSTRACT_STATUS' as const,
              status: 'out_of_stock' as const,
              customQuantity: null,
            },
          },
        ],
      },
    })
    await nextTick()

    expect(getAllRendered('[data-testid="catalog-detail-variant"]')).toHaveLength(2)
    const cheapCard = getNthRendered('[data-testid="catalog-detail-variant"]', 0)
    const costlyCard = getNthRendered('[data-testid="catalog-detail-variant"]', 1)

    // Only the selected branch decides the card status, never another branch of the same variant.
    expect(cheapCard.text()).toContain('Bolsa chica')
    expect(cheapCard.text()).toContain('Pocas piezas')
    expect(cheapCard.text()).toContain('$19.99')
    expect(cheapCard.text()).not.toContain('Agotado')

    expect(costlyCard.text()).toContain('Bolsa grande')
    expect(costlyCard.text()).toContain('Agotado')
    expect(costlyCard.text()).toContain('Consultar precio')
    expect(costlyCard.text()).not.toContain('$')
    expect(costlyCard.text()).not.toContain('Disponible')

    for (const card of getAllRendered('[data-testid="catalog-detail-variant"]')) {
      // Read-only semantics: a card is a list row, never a control and never a selected state.
      expect(card.element.tagName).toBe('LI')
      expect(card.attributes('role')).toBeUndefined()
      expect(card.attributes('tabindex')).toBeUndefined()
      expect(card.attributes('aria-selected')).toBeUndefined()
      expect(card.attributes('aria-pressed')).toBeUndefined()
      expect(card.findAll('button, input, select, a').length).toBe(0)
      expect(card.text()).not.toMatch(/seleccionad|elegido|selected/i)
    }
  })

  it('renders the brand badge only when the response carries a real brand', async () => {
    mountModal({ detail: { ...detail, brand: null } })
    await nextTick()
    expect(document.body.querySelector('[data-testid="catalog-detail-brand"]')).toBeNull()
    expect(renderedText()).not.toContain('Tostadores')
  })

  it('keeps a long real brand inside the mobile close gutter instead of truncating it', async () => {
    const longBrand = 'Distribuidora Agroindustrial del Valle de México'
    mountModal({ detail: { ...detail, brand: { name: longBrand } } })
    await nextTick()

    const brand = getRendered('[data-testid="catalog-detail-brand"]')
    // The real brand is authoritative: it wraps, it is never clipped.
    expect(brand.text()).toBe(longBrand)
    expect(brand.classes()).not.toContain('truncate')
    expect(brand.classes()).toContain('break-words')
    expect(brand.classes()).toContain('self-start')
    // 44px close control + its 16px inset = the reserved 3.75rem gutter.
    expect(brand.classes()).toContain('max-w-[calc(100%_-_3.75rem)]')
    expect(brand.classes()).toContain('md:self-center')
    expect(brand.classes()).toContain('md:max-w-full')

    // The badge shares the top edge of the panel with the absolute close control.
    const media = getRendered('[data-testid="catalog-detail-media-panel"]')
    expect(brand.element.parentElement).toBe(media.element)
    expect(media.element.children[0]).toBe(brand.element)
    expect(getRendered('[data-testid="catalog-detail-image-frame"]').classes()).toContain(
      'aspect-square',
    )
    expect(getRendered('button[aria-label="Cerrar detalle del producto"]').classes()).toContain(
      'size-11',
    )
  })

  it('lets authoritative variant price and quantity wrap instead of overflowing their card', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          {
            ...detail.variants[0],
            price: { priceCents: 123456789, hidden: false },
            stockPresentation: {
              mode: 'CUSTOM_QUANTITY' as const,
              status: null,
              customQuantity: 987654,
            },
          },
        ],
      },
    })
    await nextTick()

    const price = getRendered('[data-testid="catalog-detail-variant-price"]')
    const quantity = getRendered('[data-testid="catalog-detail-variant-quantity"]')
    expect(price.text()).toBe('$1,234,567.89')
    expect(quantity.text()).toBe('987654 unidades')

    for (const value of [price, quantity]) {
      expect(value.classes()).toContain('min-w-0')
      expect(value.classes()).toContain('max-w-full')
      expect(value.classes()).toContain('break-words')
      // No shrink-only behaviour and no ellipsis: an authoritative value is never truncated.
      expect(value.classes()).not.toContain('shrink-0')
      expect(value.classes()).not.toContain('truncate')
      expect(value.text()).not.toContain('…')
      expect(value.element.parentElement?.className).toContain('flex-wrap')
    }
  })

  it('offers retry as a full 44px target with its exact label and copy intact', async () => {
    mountModal({ detail: null, state: 'rate-limit' })
    await nextTick()

    const retry = getRendered('[data-testid="catalog-detail-retry"]')
    expect(retry.classes()).toContain('min-h-11')
    expect(retry.classes()).toContain('inline-flex')
    expect(retry.classes()).toContain('items-center')
    expect(retry.attributes('type')).toBe('button')
    expect(retry.text()).toBe('Reintentar')
    expect(renderedText()).toContain(
      'Hay muchas solicitudes en este momento. Intenta de nuevo en unos momentos.',
    )
    expect(document.body.querySelector('[data-testid="catalog-detail-retry"]')).toBe(retry.element)
  })

  it('exposes no rating, featured label, or commerce surface', async () => {
    mountModal()
    await nextTick()

    expect(renderedText()).not.toMatch(/rating|reseñ|valoraci|calificaci|destacad|featured|[★⭐]/i)
    expect(renderedText()).not.toMatch(/Agregar|cantidad|carrito|checkout|WhatsApp/i)
    expect(document.body.querySelectorAll('[data-testid*="rating"]').length).toBe(0)
    expect(document.body.querySelectorAll('input, select, textarea').length).toBe(0)
    expect(document.body.querySelectorAll('a[href]').length).toBe(0)
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

  it('clears a failed image when the requested product identity changes', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered('img').trigger('error')
    expect(document.body.querySelector('img')).toBeNull()

    await wrapper.setProps({ detail: { ...detail, id: 'product-2' } })
    await nextTick()
    expect(getRendered('img').attributes('src')).toBe('https://example.test/main.jpg')
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
      if ('price' in overrides) {
        expect(getRendered('[data-testid="catalog-detail-price"]').text()).toBe('Consultar precio')
        expect(renderedText()).not.toContain('$0')
      }
      if ('stockPresentation' in overrides && overrides.stockPresentation.mode === 'HIDDEN') {
        expect(
          document.body.querySelector('[data-testid="catalog-detail-availability"]'),
        ).toBeNull()
      }
    },
  )

  it('keeps the split silhouette with skeletons while the detail is loading', async () => {
    mountModal({ detail: null, state: 'loading' })
    await nextTick()

    const loading = getRendered('[data-testid="catalog-detail-loading"]')
    expect(loading.attributes('aria-busy')).toBe('true')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.classes()).toContain('grid')
    expect(loading.classes()).toContain('grid-cols-1')
    expect(loading.classes().some((className) => className.startsWith('md:grid-cols-'))).toBe(true)
    expect(getRendered('[data-testid="catalog-detail-media-skeleton"]').classes()).toContain(
      'bg-coco-50',
    )
    getRendered('[data-testid="catalog-detail-details-skeleton"]')
    expect(document.body.querySelectorAll('[aria-label="loading"]').length).toBeGreaterThanOrEqual(
      4,
    )
    expect(document.body.querySelector('[data-testid="catalog-detail-split"]')).toBeNull()
    expect(renderedText()).toContain('Cargando detalle del producto')

    // Closing stays available while the request is still in flight.
    expect(document.body.querySelectorAll('button')).toHaveLength(1)
  })

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
    const error = document.body.querySelector('[data-testid="catalog-detail-error"]')

    if (state === 'loading' || state === 'retry-pending') {
      expect(error).toBeNull()
      getRendered('[data-testid="catalog-detail-loading"]')
      return
    }

    expect(error).not.toBeNull()
    expect(new DOMWrapper(error as HTMLElement).attributes('role')).toBe('status')
    expect(renderedText()).toContain('No pudimos mostrar este producto')
    expect(renderedText()).not.toMatch(/carrito|checkout|WhatsApp/i)

    const retry = new DOMWrapper(error?.querySelector('button') as HTMLElement | null)
    expect(retry.exists()).toBe(canRetry)
    if (canRetry) {
      await retry.trigger('click')
      expect(wrapper.emitted('retry')).toEqual([[]])
    }
  })

  it('emits close from the real UModal dismissal event independently of the explicit control and Escape', async () => {
    /**
     * Evidence boundary: reka-ui owns the real outside-pointer and Escape dismissal, and jsdom cannot
     * produce an outside pointer press, so this test drives the same `update:open` contract that the
     * dialog emits on dismissal directly on the real UModal instance. The Escape path is covered by
     * the preceding test through the real dialog.
     */
    const wrapper = mountModal()
    await nextTick()

    const modal = wrapper.findComponent({ name: 'Modal' })
    expect(modal.exists(), 'the real UModal must render for this contract to be observable').toBe(
      true,
    )
    expect(wrapper.emitted('close')).toBeUndefined()

    modal.vm.$emit('update:open', false)
    await nextTick()
    expect(wrapper.emitted('close')).toEqual([[]])

    // Opening again and dismissing through the event must stay an independent, repeatable close path.
    modal.vm.$emit('update:open', true)
    await nextTick()
    expect(wrapper.emitted('close')).toEqual([[]])
    modal.vm.$emit('update:open', false)
    await nextTick()
    expect(wrapper.emitted('close')).toEqual([[], []])

    // The explicit control remains a separate path from the dismissal event.
    await getRendered('button[aria-label="Cerrar detalle del producto"]').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[], [], []])
  })

  it('emits close from its explicit close control and from real Escape dismissal', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered('button[aria-label="Cerrar detalle del producto"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('close')).toEqual([[], []])
  })
})
