import { DOMWrapper, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

/** The read-only image preview is a distinct dialog, so it is addressed by its own modal title. */
const previewTitle = 'Vista ampliada de imagen'
const mainPreviewTrigger = '[data-testid="catalog-detail-image-preview-trigger"]'
const variantPreviewTrigger = '[data-testid="catalog-detail-variant-image-preview-trigger"]'
const previewSurface = '[data-testid="catalog-detail-image-preview"]'
const previewImage = '[data-testid="catalog-detail-image-preview-img"]'
const previewFallback = '[data-testid="catalog-detail-image-preview-fallback"]'
const previewClose = '[data-testid="catalog-detail-image-preview-close"]'
const mainZoomAffordance = '[data-testid="catalog-detail-image-zoom-affordance"]'
const variantZoomAffordance = '[data-testid="catalog-detail-variant-image-zoom-affordance"]'
const variantImageFrame = '[data-testid="catalog-detail-variant-image-frame"]'
const emptyDetailNote = '[data-testid="catalog-detail-empty-note"]'
/** `size-[4.5rem]` is the exact 72px square the variant media contract asks for. */
const VARIANT_FRAME_SIZE_CLASS = 'size-[4.5rem]'

function findDialogByTitle(wrapper: ReturnType<typeof mountModal>, title: string) {
  /**
   * The dialog is teleported, so a DOM path cannot reach its instance, and VTU v2 matches components
   * only by name or DOM selector. Its declared `title` prop is therefore the semantic selector and
   * the component name is only the bridge to the instance.
   */
  const dialog = wrapper
    .findAllComponents({ name: 'Modal' })
    .find((candidate) => candidate.props('title') === title)
  if (!dialog) throw new Error(`Missing rendered dialog: ${title}`)
  return dialog
}

/**
 * The read-only preview is dismissed by reka-ui on a later frame, so its `after:leave` event is
 * driven directly: the tests observe this component's own leave contract, not a timer.
 */
const leavePreview = async (wrapper: ReturnType<typeof mountModal>) => {
  findDialogByTitle(wrapper, previewTitle).vm.$emit('after:leave')
  await nextTick()
}

describe('CatalogProductDetailModal', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
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

    // The only controls in a populated read-only detail are the 44px close target and media previews.
    expect(getAllRendered('button').map((button) => button.attributes('aria-label'))).toEqual([
      'Cerrar detalle del producto',
      `Ampliar imagen de ${detail.name}`,
    ])
    const close = getNthRendered('button', 0)
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
    expect(variantRegion.findAll('input, select').length).toBe(0)
    for (const button of variantRegion.findAll('button')) {
      // Read-only media preview is the only control a variant row may expose.
      expect(button.attributes('aria-label') ?? '').toMatch(/^Ampliar imagen de la variante /)
    }
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
      expect(card.findAll('input, select, a').length).toBe(0)
      for (const button of card.findAll('button')) {
        // A media preview is a media control: never selection, never pressed state, never commerce.
        expect(button.attributes('aria-label') ?? '').toMatch(/^Ampliar imagen de la variante /)
        expect(button.attributes('aria-pressed')).toBeUndefined()
        expect(button.attributes('aria-selected')).toBeUndefined()
      }
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

  it('re-attempts the product image when the display URL changes under the same detail identity', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered('img').trigger('error')
    expect(document.body.querySelector('img')).toBeNull()
    expect(
      document.body.querySelector('[data-testid="catalog-detail-image-fallback"]'),
    ).not.toBeNull()

    // Same detail identity, different main image URL: the failure is re-keyed and attempted again.
    await wrapper.setProps({
      detail: {
        ...detail,
        images: [{ id: 'main-2', url: 'https://example.test/main-v2.jpg', isMain: true }],
      },
    })
    await nextTick()

    expect(getRendered('img').attributes('src')).toBe('https://example.test/main-v2.jpg')
    expect(document.body.querySelector('[data-testid="catalog-detail-image-fallback"]')).toBeNull()
  })

  it('fills the detail frame with a written no-image state that keeps its testid, role and product label', async () => {
    mountModal({ detail: { ...detail, images: [] } })
    await nextTick()

    const frame = getRendered('[data-testid="catalog-detail-image-frame"]')
    const fallback = getRendered('[data-testid="catalog-detail-image-fallback"]')

    // The state owns the whole reserved frame instead of leaving a mostly blank white square.
    expect(frame.element.firstElementChild).toBe(fallback.element)
    expect(fallback.classes()).toEqual(
      expect.arrayContaining(['size-full', 'flex', 'flex-col', 'items-center', 'justify-center']),
    )
    expect(fallback.attributes('role')).toBe('img')
    expect(fallback.attributes('aria-label')).toBe(`Imagen no disponible para ${detail.name}`)
    expect(fallback.text()).toContain('Imagen no disponible')
    expect(fallback.find('span').exists()).toBe(true)

    // No gradient placeholder and no invented media URL.
    expect(fallback.classes().some((className) => className.startsWith('bg-gradient'))).toBe(false)
    expect(document.body.querySelector('img')).toBeNull()
    expect(document.body.innerHTML).not.toMatch(/gradient|placeholder|picsum|dicebear/i)
  })

  it('renders a real variant thumbnail with variant-scoped alt text inside a read-only row', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-grande.jpg' } },
        ],
      },
    })
    await nextTick()

    const card = getRendered('[data-testid="catalog-detail-variant"]')
    expect(card.get('img').attributes()).toMatchObject({
      src: 'https://example.test/variant-grande.jpg',
      alt: 'Imagen de la variante Bolsa mediana',
    })
    expect(card.find('[data-testid="catalog-detail-variant-image-fallback"]').exists()).toBe(false)

    // A thumbnail only opens the media preview: its read-only list row never becomes selectable.
    expect(card.element.tagName).toBe('LI')
    expect(card.attributes('role')).toBeUndefined()
    expect(card.attributes('tabindex')).toBeUndefined()
    expect(card.attributes('aria-selected')).toBeUndefined()
    expect(card.findAll('input, select, a').length).toBe(0)
    const trigger = card.get(variantPreviewTrigger)
    expect(trigger.attributes('type')).toBe('button')
    expect(trigger.attributes('aria-label')).toBe('Ampliar imagen de la variante Bolsa mediana')
    expect(trigger.classes()).toContain('size-full')
  })

  it('renders a compact honest variant fallback with a variant-scoped label when the variant has no image', async () => {
    mountModal()
    await nextTick()

    const card = getRendered('[data-testid="catalog-detail-variant"]')
    expect(card.element.querySelectorAll('img').length).toBe(0)

    const fallback = card.get('[data-testid="catalog-detail-variant-image-fallback"]')
    expect(fallback.attributes('role')).toBe('img')
    expect(fallback.attributes('aria-label')).toBe(
      'Imagen no disponible para la variante Bolsa mediana',
    )
    expect(fallback.classes()).toContain('size-full')
    expect(fallback.classes().some((className) => className.startsWith('bg-gradient'))).toBe(false)
    expect(card.html()).not.toMatch(/gradient|placeholder|picsum|dicebear/i)
    expect(card.findAll('button, input, select, a').length).toBe(0)
  })

  it('degrades only the variant whose real thumbnail fails, never the product media', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-broken.jpg' } },
        ],
      },
    })
    await nextTick()

    const card = getRendered('[data-testid="catalog-detail-variant"]')
    await card.get('img').trigger('error')
    await nextTick()

    expect(card.element.querySelectorAll('img').length).toBe(0)
    expect(
      card.get('[data-testid="catalog-detail-variant-image-fallback"]').attributes('aria-label'),
    ).toBe('Imagen no disponible para la variante Bolsa mediana')
    // A failed thumbnail is not interactive: no preview control survives the failure.
    expect(card.findAll('button')).toHaveLength(0)

    // The product-level media slot keeps its own failure state.
    expect(getRendered('[data-testid="catalog-detail-image-frame"]').find('img').exists()).toBe(
      true,
    )
    expect(document.body.querySelector('[data-testid="catalog-detail-image-fallback"]')).toBeNull()
  })

  it('isolates variant image failures per variant and clears them when the detail identity changes', async () => {
    const baseVariant = detail.variants[0]
    if (baseVariant === undefined) throw new Error('fixture variant missing')
    const variants = [
      {
        ...baseVariant,
        id: 'variant-rojo',
        name: 'Rojo',
        image: { url: 'https://example.test/rojo.jpg' },
      },
      {
        ...baseVariant,
        id: 'variant-grande',
        name: 'Grande',
        image: { url: 'https://example.test/grande.jpg' },
      },
    ]
    const wrapper = mountModal({ detail: { ...detail, variants } })
    await nextTick()

    const cards = getAllRendered('[data-testid="catalog-detail-variant"]')
    expect(cards).toHaveLength(2)
    const failing = getNthRendered('[data-testid="catalog-detail-variant"]', 0)
    const healthy = getNthRendered('[data-testid="catalog-detail-variant"]', 1)
    await failing.get('img').trigger('error')
    await nextTick()

    // Only the failing variant degrades; its sibling keeps its real thumbnail.
    expect(failing.element.querySelectorAll('img').length).toBe(0)
    expect(failing.find('[data-testid="catalog-detail-variant-image-fallback"]').exists()).toBe(
      true,
    )
    expect(
      failing.get('[data-testid="catalog-detail-variant-image-fallback"]').attributes('aria-label'),
    ).toBe('Imagen no disponible para la variante Rojo')
    expect(healthy.get('img').attributes('src')).toBe('https://example.test/grande.jpg')
    expect(healthy.find('[data-testid="catalog-detail-variant-image-fallback"]').exists()).toBe(
      false,
    )
    expect(healthy.find(variantPreviewTrigger).exists()).toBe(true)
    expect(failing.find(variantPreviewTrigger).exists()).toBe(false)

    // A new detail identity is a new media set: the stale per-variant failure is cleared.
    await wrapper.setProps({ detail: { ...detail, id: 'product-2', variants } })
    await nextTick()

    expect(
      getNthRendered('[data-testid="catalog-detail-variant"]', 0).get('img').attributes('src'),
    ).toBe('https://example.test/rojo.jpg')
    expect(
      getNthRendered('[data-testid="catalog-detail-variant"]', 1).get('img').attributes('src'),
    ).toBe('https://example.test/grande.jpg')
    expect(
      document.body.querySelector('[data-testid="catalog-detail-variant-image-fallback"]'),
    ).toBeNull()
  })

  it('renders variant media in a square 72px frame with a modest radius instead of a shrunken circle', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-grande.jpg' } },
        ],
      },
    })
    await nextTick()

    const card = getRendered('[data-testid="catalog-detail-variant"]')
    const frame = getRendered(variantImageFrame)

    // The frame is the variant row's own media box, not a detached wrapper.
    expect(frame.element.parentElement).toBe(card.element)
    expect(frame.element.tagName).toBe('DIV')
    expect(frame.classes()).toContain(VARIANT_FRAME_SIZE_CLASS)
    expect(frame.classes()).toContain('shrink-0')
    expect(frame.classes()).toContain('overflow-hidden')

    // A modest radius reads as a rounded square. Anything farther from it is a regression, and a
    // circular or pill-like frame would misread variant media as an avatar.
    expect(frame.classes()).toContain('rounded-lg')
    for (const forbidden of [
      'rounded-full',
      'rounded-3xl',
      'rounded-2xl',
      'rounded-xl',
      'size-14',
    ]) {
      expect(frame.classes(), `the variant media frame must not carry ${forbidden}`).not.toContain(
        forbidden,
      )
    }
    // One square class fixes both edges: no separate width or height utility can disagree with it.
    const sizingClasses = frame.classes().filter((className) => /^(w|h|size)-/.test(className))
    expect(sizingClasses).toEqual([VARIANT_FRAME_SIZE_CLASS])

    // The real media fills the whole frame and is the frame's own control.
    const trigger = card.get(variantPreviewTrigger)
    expect(trigger.classes()).toContain('size-full')
    expect(trigger.classes()).toContain('relative')
    expect(trigger.get('img').classes()).toContain('object-cover')
    expect(frame.element.firstElementChild).toBe(trigger.element)
  })

  it('overlays an always-visible zoom affordance on real media without adding a second control', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          {
            ...detail.variants[0],
            id: 'variant-real',
            name: 'Bolsa mediana',
            image: { url: 'https://example.test/variant-grande.jpg' },
          },
          { ...detail.variants[0], id: 'variant-null', name: 'Bolsa grande', image: null },
        ],
      },
    })
    await nextTick()

    const mainTrigger = getRendered(mainPreviewTrigger)
    const mainBadge = getRendered(mainZoomAffordance)

    // The main image names the affordance in words, inside the already-labelled media button.
    expect(mainBadge.element.tagName).toBe('SPAN')
    expect(mainBadge.attributes('aria-hidden')).toBe('true')
    expect(mainBadge.attributes('role')).toBeUndefined()
    expect(mainBadge.attributes('aria-label')).toBeUndefined()
    expect(mainBadge.attributes('type')).toBeUndefined()
    expect(mainBadge.text()).toBe('Ampliar')
    expect(mainTrigger.element.contains(mainBadge.element)).toBe(true)
    expect(mainTrigger.attributes('aria-label')).toBe(`Ampliar imagen de ${detail.name}`)

    // Always visible, overlaid on the media, and never a gradient placeholder.
    expect(mainBadge.classes()).toContain('absolute')
    expect(mainBadge.classes()).not.toContain('hidden')
    expect(mainBadge.classes()).not.toContain('sr-only')
    expect(mainBadge.classes().some((className) => className.startsWith('opacity-0'))).toBe(false)
    expect(mainBadge.html()).not.toMatch(/gradient|placeholder|picsum|dicebear/i)

    const realCard = getNthRendered('[data-testid="catalog-detail-variant"]', 0)
    const nullCard = getNthRendered('[data-testid="catalog-detail-variant"]', 1)
    const variantBadge = realCard.get(variantZoomAffordance)

    // A real thumbnail repeats the same promise at thumbnail scale, still as presentation only.
    expect(variantBadge.element.tagName).toBe('SPAN')
    expect(variantBadge.attributes('aria-hidden')).toBe('true')
    expect(variantBadge.attributes('aria-label')).toBeUndefined()
    expect(variantBadge.classes()).toContain('absolute')
    expect(variantBadge.classes()).not.toContain('hidden')
    expect(variantBadge.text()).toBe('')
    expect(realCard.get(variantPreviewTrigger).element.contains(variantBadge.element)).toBe(true)
    expect(realCard.get(variantPreviewTrigger).attributes('aria-label')).toBe(
      'Ampliar imagen de la variante Bolsa mediana',
    )
    expect(realCard.findAll('button')).toHaveLength(1)
    expect(realCard.findAll('a, input, select, [role="button"]').length).toBe(0)

    // Only real media is decorated: the null thumbnail keeps its plain honest fallback.
    expect(nullCard.find(variantZoomAffordance).exists()).toBe(false)
    expect(nullCard.findAll('button, a, input, select').length).toBe(0)

    // The affordances are decorations: the whole detail still exposes exactly the media controls.
    expect(getAllRendered('button').map((button) => button.attributes('aria-label'))).toEqual([
      'Cerrar detalle del producto',
      `Ampliar imagen de ${detail.name}`,
      'Ampliar imagen de la variante Bolsa mediana',
    ])
    expect(document.body.querySelectorAll('[data-testid$="zoom-affordance"]').length).toBe(2)
    expect(document.body.querySelectorAll('a[href]').length).toBe(0)
    expect(document.body.querySelectorAll('input, select, textarea').length).toBe(0)
    expect(document.body.querySelectorAll('[role="button"]').length).toBe(0)
  })

  it('keeps every zoom affordance off absent and failed media', async () => {
    // No product media at all: no frame badge and no media control for it to decorate.
    const emptyWrapper = mountModal({ detail: { ...detail, images: [], variants: [] } })
    await nextTick()
    expect(document.body.querySelector(mainZoomAffordance)).toBeNull()
    expect(document.body.querySelector(mainPreviewTrigger)).toBeNull()
    expect(getAllRendered('button').map((button) => button.attributes('aria-label'))).toEqual([
      'Cerrar detalle del producto',
    ])
    emptyWrapper.unmount()

    // A product image that fails loses the affordance together with the control that owned it.
    const failingWrapper = mountModal()
    await nextTick()
    expect(getRendered(mainZoomAffordance)).toBeDefined()
    await getRendered('img').trigger('error')
    await nextTick()
    expect(document.body.querySelector(mainZoomAffordance)).toBeNull()
    expect(
      document.body.querySelector('[data-testid="catalog-detail-image-fallback"]'),
    ).not.toBeNull()
    failingWrapper.unmount()

    // The base fixture variant carries null media: its fallback fills the same square, undecorated.
    const nullMediaWrapper = mountModal()
    await nextTick()
    const nullFrame = getRendered(variantImageFrame)
    expect(nullFrame.classes()).toContain(VARIANT_FRAME_SIZE_CLASS)
    expect(nullFrame.classes()).toContain('rounded-lg')
    expect(nullFrame.find(variantZoomAffordance).exists()).toBe(false)
    const nullFallback = getRendered('[data-testid="catalog-detail-variant-image-fallback"]')
    expect(nullFallback.attributes('role')).toBe('img')
    expect(nullFallback.attributes('aria-label')).toBe(
      'Imagen no disponible para la variante Bolsa mediana',
    )
    expect(nullFallback.classes()).toContain('size-full')
    nullMediaWrapper.unmount()

    // A failed thumbnail degrades to the same inert fallback, without a surviving badge.
    const brokenWrapper = mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-broken.jpg' } },
        ],
      },
    })
    await nextTick()
    const brokenCard = getRendered('[data-testid="catalog-detail-variant"]')
    expect(brokenCard.find(variantZoomAffordance).exists()).toBe(true)
    await brokenCard.get('img').trigger('error')
    await nextTick()
    expect(brokenCard.find(variantZoomAffordance).exists()).toBe(false)
    expect(brokenCard.findAll('button, a, input, select').length).toBe(0)
    brokenWrapper.unmount()
  })

  it('keeps the square variant frame intact beside long variant copy and prices', async () => {
    mountModal({
      detail: {
        ...detail,
        description: null,
        variants: [
          {
            ...detail.variants[0],
            name: 'Bolsa mediana de café de altura con empaque compostable y sello de origen',
            option: 'Presentación',
            value: 'Dos kilogramos seleccionados a mano',
            image: { url: 'https://example.test/variant-grande.jpg' },
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

    const card = getRendered('[data-testid="catalog-detail-variant"]')
    const frame = getRendered(variantImageFrame)

    // The media never absorbs the long copy: its exact square is held by its own non-shrinking box.
    expect(frame.classes()).toContain(VARIANT_FRAME_SIZE_CLASS)
    expect(frame.classes()).toContain('shrink-0')
    expect(frame.element.parentElement).toBe(card.element)

    // The text column is the only side that flexes, so the row wraps instead of overflowing at 320px.
    expect(card.classes()).toContain('min-w-0')
    expect(card.classes()).toContain('items-start')
    const textColumn = card.element.children[1]
    if (!textColumn) throw new Error('missing variant text column')
    expect(textColumn.className).toContain('flex-1')
    expect(textColumn.className).toContain('min-w-0')

    // Authoritative copy is never clipped: no ellipsis, no nowrap, and wrapping values only.
    expect(card.html()).not.toContain('truncate')
    expect(card.html()).not.toContain('whitespace-nowrap')
    const price = card.get('[data-testid="catalog-detail-variant-price"]')
    expect(price.text()).toBe('$1,234,567.89')
    expect(price.classes()).toContain('break-words')
    expect(card.get('[data-testid="catalog-detail-variant-quantity"]').text()).toBe(
      '987654 unidades',
    )

    // The thumbnail overlay stays a small decoration inside the frame it belongs to.
    const badge = card.get(variantZoomAffordance)
    expect(badge.classes()).toContain('absolute')
    expect(badge.classes()).toContain('size-5')
  })

  it('explains the absence of description and variants with a calm contained note', async () => {
    mountModal({ detail: { ...detail, description: null, hasVariants: false, variants: [] } })
    await nextTick()

    // The honest empty state replaces the two content blocks instead of sitting next to them.
    expect(document.body.querySelector('[data-testid="catalog-detail-description"]')).toBeNull()
    expect(
      document.body.querySelector('section[aria-labelledby="catalog-detail-variants"]'),
    ).toBeNull()

    const note = getRendered(emptyDetailNote)
    expect(note.attributes('role')).toBe('note')
    expect(note.get('h3').text()).toBe('Sin información adicional')
    expect(note.get('p').text()).toBe(
      'Por ahora no hay descripción ni variantes publicadas para este producto.',
    )
    expect(note.find('span[aria-hidden="true"]').exists()).toBe(true)

    // A deliberately sized, contained surface that settles at the bottom of the sparse column.
    expect(note.classes()).toContain('mt-auto')
    expect(note.classes()).toContain('min-h-48')
    expect(note.classes()).toContain('items-center')
    expect(note.classes()).toContain('justify-center')
    expect(note.classes()).toContain('ring-1')
    expect(note.classes()).not.toContain('truncate')
    expect(note.get('p').classes()).toContain('break-words')

    const detailsPanel = getRendered('[data-testid="catalog-detail-details-panel"]')
    expect(detailsPanel.element.lastElementChild).toBe(note.element)

    // The note is information, not a failure and not a commerce prompt.
    expect(note.text()).not.toMatch(
      /error|no pudimos|intenta de nuevo|carrito|agregar|comprar|whatsapp|precio/i,
    )
    expect(note.findAll('button, a, input, select').length).toBe(0)
    expect(getAllRendered('button').map((button) => button.attributes('aria-label'))).toEqual([
      'Cerrar detalle del producto',
      `Ampliar imagen de ${detail.name}`,
    ])
  })

  it('never shows the empty note once a real description or real variants are published', async () => {
    // A real description alone already fills the panel.
    const described = mountModal({
      detail: { ...detail, description: 'Notas de cata.', variants: [] },
    })
    await nextTick()
    expect(getRendered('[data-testid="catalog-detail-description"]').text()).toBe('Notas de cata.')
    expect(document.body.querySelector(emptyDetailNote)).toBeNull()
    described.unmount()

    // Real variants alone already fill the panel.
    const varied = mountModal({
      detail: { ...detail, description: null, variants: detail.variants },
    })
    await nextTick()
    expect(getRendered('[data-testid="catalog-detail-variant"]')).toBeDefined()
    expect(document.body.querySelector(emptyDetailNote)).toBeNull()
    varied.unmount()

    // Neither a blank nor a whitespace-only string counts as a published description.
    const blank = mountModal({ detail: { ...detail, description: '   ', variants: [] } })
    await nextTick()
    expect(document.body.querySelector('[data-testid="catalog-detail-description"]')).toBeNull()
    expect(getRendered(emptyDetailNote)).toBeDefined()
    blank.unmount()
  })

  it('opens a distinct labelled read-only preview of the real main image from its full-frame button', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const wrapper = mountModal()
    await nextTick()

    const trigger = getRendered(mainPreviewTrigger)
    expect(trigger.element.tagName).toBe('BUTTON')
    expect(trigger.attributes('type')).toBe('button')
    expect(trigger.attributes('aria-label')).toBe(`Ampliar imagen de ${detail.name}`)
    expect(trigger.classes()).toContain('size-full')
    expect(trigger.get('img').attributes()).toMatchObject({
      src: 'https://example.test/main.jpg',
      alt: `Imagen de ${detail.name}`,
    })

    await trigger.trigger('click')
    await nextTick()

    const surface = getRendered(previewSurface)
    expect(surface.element.closest('[role="dialog"]')).not.toBeNull()
    expect(findDialogByTitle(wrapper, previewTitle).props('title')).toBe(previewTitle)
    expect(
      getRendered('[data-testid="catalog-detail-split"]').element.closest('[role="dialog"]'),
    ).not.toBe(surface.element.closest('[role="dialog"]'))

    expect(getRendered(previewImage).attributes()).toMatchObject({
      src: 'https://example.test/main.jpg',
      alt: `Imagen de ${detail.name}`,
    })
    expect(getRendered(previewImage).classes()).toContain('object-contain')

    // The preview reuses the URL the detail already delivered: it issues no request of its own.
    expect(fetchSpy).not.toHaveBeenCalled()
    // Opening the preview is not closing the detail.
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('opens the real variant preview with the variant URL and its own alt', async () => {
    mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-grande.jpg' } },
        ],
      },
    })
    await nextTick()

    const card = getRendered('[data-testid="catalog-detail-variant"]')
    const trigger = card.get(variantPreviewTrigger)
    expect(trigger.attributes('type')).toBe('button')
    expect(trigger.attributes('aria-label')).toBe('Ampliar imagen de la variante Bolsa mediana')

    await trigger.trigger('click')
    await nextTick()

    const image = getRendered(previewImage)
    expect(image.attributes()).toMatchObject({
      src: 'https://example.test/variant-grande.jpg',
      alt: 'Imagen de la variante Bolsa mediana',
    })
    // Variant media never downgrades to the product-level image.
    expect(image.attributes('src')).not.toBe('https://example.test/main.jpg')
  })

  it('keeps null or failed media noninteractive with no preview control at all', async () => {
    // A variant without media keeps its honest fallback and exposes nothing to activate.
    const variantWrapper = mountModal()
    await nextTick()
    const card = getRendered('[data-testid="catalog-detail-variant"]')
    expect(card.find('[data-testid="catalog-detail-variant-image-fallback"]').exists()).toBe(true)
    expect(card.find(variantPreviewTrigger).exists()).toBe(false)
    expect(card.findAll('button')).toHaveLength(0)
    variantWrapper.unmount()

    // A product without media keeps its frame fallback and exposes no preview control.
    const emptyWrapper = mountModal({ detail: { ...detail, images: [] } })
    await nextTick()
    expect(document.body.querySelector(mainPreviewTrigger)).toBeNull()
    expect(
      document.body.querySelector('[data-testid="catalog-detail-image-fallback"]'),
    ).not.toBeNull()
    emptyWrapper.unmount()

    // A failed main image loses the preview control instead of opening a broken preview.
    const failingWrapper = mountModal()
    await nextTick()
    await getRendered('img').trigger('error')
    await nextTick()
    expect(document.body.querySelector(mainPreviewTrigger)).toBeNull()
    expect(
      document.body.querySelector('[data-testid="catalog-detail-image-fallback"]'),
    ).not.toBeNull()
    failingWrapper.unmount()

    // A failed variant thumbnail loses the preview control too.
    const brokenThumbWrapper = mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-broken.jpg' } },
        ],
      },
    })
    await nextTick()
    const brokenCard = getRendered('[data-testid="catalog-detail-variant"]')
    await brokenCard.get('img').trigger('error')
    await nextTick()
    expect(brokenCard.find(variantPreviewTrigger).exists()).toBe(false)
    expect(brokenCard.findAll('button')).toHaveLength(0)
    brokenThumbWrapper.unmount()
  })

  it('closes the preview from its custom 44px control and restores focus only once it has left', async () => {
    const wrapper = mountModal()
    await nextTick()

    const triggerElement = getRendered(mainPreviewTrigger).element as HTMLButtonElement
    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    expect(getRendered(previewSurface)).toBeDefined()

    const close = getRendered(previewClose)
    expect(close.element.tagName).toBe('BUTTON')
    expect(close.attributes('type')).toBe('button')
    expect(close.attributes('aria-label')).toBe('Cerrar vista de imagen')
    expect(close.classes()).toContain('size-11')
    expect(close.classes()).toContain('items-center')
    expect(close.classes()).toContain('justify-center')

    const dialog = findDialogByTitle(wrapper, previewTitle)
    const focusSpy = vi.spyOn(triggerElement, 'focus')

    await close.trigger('click')
    await nextTick()

    // Only the preview closes: the detail stays open and keeps its own close contract.
    expect(dialog.props('open')).toBe(false)
    expect(findDialogByTitle(wrapper, 'Detalle del producto').props('open')).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()
    // The dismissed dialog releases its restore target on the way out, back to the image button.
    expect(document.activeElement).toBe(triggerElement)

    // The restore is consumed once: repeated leave callbacks for this dismissal move nothing.
    const focusCallsAfterRestore = focusSpy.mock.calls.length
    await leavePreview(wrapper)
    await leavePreview(wrapper)
    expect(focusSpy.mock.calls.length).toBe(focusCallsAfterRestore)
    expect(document.activeElement).toBe(triggerElement)
  })

  it('closes only the preview when the preview dialog dismisses through update:open', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()

    const dialog = findDialogByTitle(wrapper, previewTitle)

    dialog.vm.$emit('update:open', false)
    await nextTick()

    // The dismissal contract is the same one the explicit control uses: preview only, never the detail.
    expect(dialog.props('open')).toBe(false)
    expect(findDialogByTitle(wrapper, 'Detalle del producto').props('open')).toBe(true)
    expect(wrapper.emitted('close')).toBeUndefined()

    // Repeated leave callbacks for this dismissal never reach the detail's close event either.
    await leavePreview(wrapper)
    await leavePreview(wrapper)
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(findDialogByTitle(wrapper, 'Detalle del producto').props('open')).toBe(true)
  })

  it('never restores focus for a preview that is still open', async () => {
    const wrapper = mountModal()
    await nextTick()

    const triggerElement = getRendered(mainPreviewTrigger).element as HTMLButtonElement
    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()

    const focusSpy = vi.spyOn(triggerElement, 'focus')

    // An early or duplicated leave callback while the preview is open has no dismissed trigger to
    // consume, and it never falls back to the trigger the preview still owns.
    await leavePreview(wrapper)
    await leavePreview(wrapper)

    expect(focusSpy).not.toHaveBeenCalled()
    expect(findDialogByTitle(wrapper, previewTitle).props('open')).toBe(true)
    expect(document.body.querySelector(previewSurface)).not.toBeNull()
  })

  it('never lets a leave callback from an older preview steal focus from a newer one', async () => {
    const wrapper = mountModal({
      detail: {
        ...detail,
        variants: [
          { ...detail.variants[0], image: { url: 'https://example.test/variant-grande.jpg' } },
        ],
      },
    })
    await nextTick()

    const mainTrigger = getRendered(mainPreviewTrigger).element as HTMLButtonElement
    const variantTrigger = getRendered(variantPreviewTrigger).element as HTMLButtonElement

    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    await getRendered(previewClose).trigger('click')
    await nextTick()

    // A newer preview opens before the dismissed dialog's leave callback arrives.
    await getRendered(variantPreviewTrigger).trigger('click')
    await nextTick()
    const focusSpy = vi.spyOn(variantTrigger, 'focus')
    const focusedAfterReopen = document.activeElement
    expect(focusedAfterReopen).not.toBe(mainTrigger)

    // The stale callback moves nothing and does not consume the newer preview's own restore.
    await leavePreview(wrapper)
    expect(document.activeElement).toBe(focusedAfterReopen)
    expect(focusSpy).not.toHaveBeenCalled()

    await getRendered(previewClose).trigger('click')
    await nextTick()
    await leavePreview(wrapper)
    expect(document.activeElement).toBe(variantTrigger)
  })

  it('never forwards a preview open or dismissal to the outer detail close event', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()

    await getRendered(previewClose).trigger('click')
    await nextTick()
    expect(wrapper.emitted('close')).toBeUndefined()

    // The detail's own close contract still fires exactly once, from its own control.
    await getRendered('button[aria-label="Cerrar detalle del producto"]').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
  })

  it('renders a visible and accessible preview fallback when the preview URL fails', async () => {
    mountModal()
    await nextTick()

    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    await getRendered(previewImage).trigger('error')
    await nextTick()

    expect(document.body.querySelector(previewImage)).toBeNull()
    const fallback = getRendered(previewFallback)
    expect(fallback.attributes('role')).toBe('img')
    expect(fallback.attributes('aria-label')).toBe(
      `Imagen no disponible en la vista ampliada de ${detail.name}`,
    )
    expect(fallback.text()).toContain('Imagen no disponible')
    expect(fallback.classes().some((className) => className.startsWith('bg-gradient'))).toBe(false)

    // The preview failure never degrades the detail's own media slot.
    expect(
      getRendered('[data-testid="catalog-detail-image-preview-trigger"]').find('img').exists(),
    ).toBe(true)
    expect(document.body.querySelector('[data-testid="catalog-detail-image-fallback"]')).toBeNull()
  })

  it('retries a changed preview URL after a keyed preview failure', async () => {
    const wrapper = mountModal()
    await nextTick()

    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    await getRendered(previewImage).trigger('error')
    await nextTick()
    expect(document.body.querySelector(previewImage)).toBeNull()

    await getRendered(previewClose).trigger('click')
    await wrapper.setProps({
      detail: {
        ...detail,
        images: [{ id: 'main-2', url: 'https://example.test/main-v2.jpg', isMain: true }],
      },
    })
    await nextTick()

    // Same identity, different URL: the failure is re-keyed and the new URL is attempted.
    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    expect(getRendered(previewImage).attributes('src')).toBe('https://example.test/main-v2.jpg')
    expect(document.body.querySelector(previewFallback)).toBeNull()
  })

  it('clears the open preview and its keyed failure when the detail identity changes', async () => {
    const wrapper = mountModal()
    await nextTick()

    const dialog = findDialogByTitle(wrapper, previewTitle)
    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    await getRendered(previewImage).trigger('error')
    await nextTick()
    expect(getRendered(previewFallback).text()).toContain('Imagen no disponible')

    await wrapper.setProps({ detail: { ...detail, id: 'product-2' } })
    await nextTick()

    // A new identity never keeps the previous preview open nor its keyed failure.
    expect(dialog.props('open')).toBe(false)

    await getRendered(mainPreviewTrigger).trigger('click')
    await nextTick()
    expect(getRendered(previewImage).attributes('src')).toBe('https://example.test/main.jpg')
    expect(document.body.querySelector(previewFallback)).toBeNull()
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

    const modal = findDialogByTitle(wrapper, 'Detalle del producto')
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
