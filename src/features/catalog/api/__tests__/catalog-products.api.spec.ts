import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCatalogProducts } from '../catalog-products.api'

const priceContext = { priceListId: 'list-1', name: 'Lista pública', isCatalogDefault: true }
const systemStock = { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null }
const product = {
  id: 'product-1',
  name: 'Café molido',
  slug: null,
  description: null,
  category: { id: 'category-1', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: { url: 'https://example.test/cafe.jpg' },
  price: { fromPriceCents: 2500, priceCents: 2500, hidden: false },
  availability: 'available',
  stockPresentation: systemStock,
  hasVariants: false,
  rating: null,
  featuredLabel: null,
}
const response = {
  items: [product],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  facets: { categories: [{ id: 'category-1', name: 'Café', count: 1 }] },
  excludedCount: 0,
  priceContext,
}

const withProduct = (overrides: Record<string, unknown>) => ({
  ...response,
  items: [{ ...product, ...overrides }],
})

describe('fetchCatalogProducts', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('uses the isolated anonymous first-page endpoint with an encoded tenant slug and no request extras', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalogProducts('north & south')).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/public/catalog/north%20%26%20south/products',
      { method: 'GET', credentials: 'omit' },
    )
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init).not.toHaveProperty('headers')
    expect(init).not.toHaveProperty('body')
  })

  it.each([
    [
      'an empty page',
      {
        ...response,
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        facets: { categories: [] },
      },
    ],
    ['a simple SYSTEM_STATUS product', response],
    [
      'a variant card with no priceCents',
      withProduct({ price: { fromPriceCents: 2500, priceCents: null, hidden: false } }),
    ],
    [
      'a hidden price card',
      withProduct({ price: { fromPriceCents: null, priceCents: null, hidden: true } }),
    ],
    [
      'an ABSTRACT_STATUS product',
      withProduct({
        availability: 'out_of_stock',
        stockPresentation: {
          mode: 'ABSTRACT_STATUS',
          status: 'out_of_stock',
          customQuantity: null,
        },
      }),
    ],
    [
      'a CUSTOM_QUANTITY zero product',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
      }),
    ],
    [
      'an individual CUSTOM_QUANTITY out-of-stock product',
      withProduct({
        availability: 'out_of_stock',
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'out_of_stock', customQuantity: 3 },
      }),
    ],
    [
      'an aggregate CUSTOM_QUANTITY available variant product',
      withProduct({
        availability: 'available',
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'available', customQuantity: null },
      }),
    ],
    [
      'an aggregate CUSTOM_QUANTITY low-stock variant product',
      withProduct({
        availability: 'low_stock',
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'low_stock', customQuantity: null },
      }),
    ],
    [
      'an aggregate CUSTOM_QUANTITY out-of-stock variant product',
      withProduct({
        availability: 'out_of_stock',
        stockPresentation: {
          mode: 'CUSTOM_QUANTITY',
          status: 'out_of_stock',
          customQuantity: null,
        },
      }),
    ],
    [
      'a nullable HIDDEN product',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
      }),
    ],
  ])('accepts %s', async (_, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    )
    await expect(fetchCatalogProducts('centro')).resolves.toEqual(body)
  })

  it.each([
    ['a non-object body', []],
    ['a missing stock presentation', withProduct({ stockPresentation: undefined })],
    [
      'a missing excluded count',
      (() => {
        const { excludedCount: _, ...body } = response
        return body
      })(),
    ],
    [
      'a missing price context',
      (() => {
        const { priceContext: _, ...body } = response
        return body
      })(),
    ],
    [
      'an incomplete price context',
      { ...response, priceContext: { ...priceContext, isCatalogDefault: undefined } },
    ],
    ['a non-null rating', withProduct({ rating: 4.5 })],
    ['a non-null featured label', withProduct({ featuredLabel: 'Nuevo' })],
    [
      'an availability/status mismatch',
      withProduct({
        availability: 'available',
        stockPresentation: { mode: 'SYSTEM_STATUS', status: 'low_stock', customQuantity: null },
      }),
    ],
    [
      'SYSTEM_STATUS with null status',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'SYSTEM_STATUS', status: null, customQuantity: null },
      }),
    ],
    [
      'SYSTEM_STATUS with custom quantity',
      withProduct({
        availability: 'available',
        stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: 0 },
      }),
    ],
    [
      'ABSTRACT_STATUS with low stock',
      withProduct({
        availability: 'low_stock',
        stockPresentation: { mode: 'ABSTRACT_STATUS', status: 'low_stock', customQuantity: null },
      }),
    ],
    [
      'ABSTRACT_STATUS with null status',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'ABSTRACT_STATUS', status: null, customQuantity: null },
      }),
    ],
    [
      'ABSTRACT_STATUS with custom quantity',
      withProduct({
        availability: 'available',
        stockPresentation: { mode: 'ABSTRACT_STATUS', status: 'available', customQuantity: 1 },
      }),
    ],
    [
      'individual CUSTOM_QUANTITY with available status',
      withProduct({
        availability: 'available',
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'available', customQuantity: 0 },
      }),
    ],
    [
      'individual CUSTOM_QUANTITY with low-stock status',
      withProduct({
        availability: 'low_stock',
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'low_stock', customQuantity: 0 },
      }),
    ],
    [
      'CUSTOM_QUANTITY with neither quantity nor aggregate status',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: null },
      }),
    ],
    [
      'HIDDEN with status',
      withProduct({
        availability: 'available',
        stockPresentation: { mode: 'HIDDEN', status: 'available', customQuantity: null },
      }),
    ],
    [
      'HIDDEN with quantity',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: 0 },
      }),
    ],
    [
      'zero fromPriceCents',
      withProduct({ price: { fromPriceCents: 0, priceCents: null, hidden: false } }),
    ],
    [
      'negative priceCents',
      withProduct({ price: { fromPriceCents: 2500, priceCents: -1, hidden: false } }),
    ],
    [
      'fractional cents',
      withProduct({ price: { fromPriceCents: 2500, priceCents: 25.5, hidden: false } }),
    ],
    [
      'a hidden numeric price',
      withProduct({ price: { fromPriceCents: 2500, priceCents: null, hidden: true } }),
    ],
    [
      'a visible card without fromPriceCents',
      withProduct({ price: { fromPriceCents: null, priceCents: 2500, hidden: false } }),
    ],
    ['fractional pagination', { ...response, meta: { ...response.meta, page: 1.5 } }],
    ['a non-positive page', { ...response, meta: { ...response.meta, page: 0 } }],
    ['a negative total', { ...response, meta: { ...response.meta, total: -1 } }],
    [
      'a negative facet count',
      { ...response, facets: { categories: [{ id: 'category-1', name: 'Café', count: -1 }] } },
    ],
    ['a negative excluded count', { ...response, excludedCount: -1 }],
    [
      'a fractional custom quantity',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 1.5 },
      }),
    ],
    [
      'a negative custom quantity',
      withProduct({
        availability: null,
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: -1 },
      }),
    ],
  ])('rejects %s as a recoverable server failure', async (_, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    )
    await expect(fetchCatalogProducts('centro')).rejects.toMatchObject({
      kind: 'server',
      status: 200,
    })
  })

  it.each([
    [429, 'rate-limit'],
    [400, 'server'],
    [404, 'server'],
    [500, 'server'],
    [503, 'server'],
    [201, 'server'],
  ])('classifies HTTP %i as %s', async (status, kind) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status })),
    )
    await expect(fetchCatalogProducts('centro')).rejects.toMatchObject({ kind, status })
  })

  it('classifies a transport rejection as a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchCatalogProducts('centro')).rejects.toMatchObject({ kind: 'network' })
  })

  it('forwards the exact AbortSignal and classifies an in-flight abort as network', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(controller.signal.reason), {
            once: true,
          })
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const request = fetchCatalogProducts('centro', controller.signal)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/public/catalog/centro/products', {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal,
    })
    controller.abort()
    await expect(request).rejects.toMatchObject({ kind: 'network' })
  })
})
