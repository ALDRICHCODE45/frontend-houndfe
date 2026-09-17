import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCatalogProductDetail } from '../catalog-product-detail.api'

const priceListId = 'fdf84f88-7d2c-4e5f-8f7a-b056db1f0627'
const productId = '6de2ae1d-91a0-481a-a9e2-df0327b0e4db'
const systemStock = { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: null }
const response = {
  id: productId,
  name: 'Café molido',
  slug: null,
  description: 'Tostado medio',
  category: { id: 'category-1', name: 'Café' },
  brand: { name: 'Tostadores' },
  images: [{ id: 'image-1', url: 'https://example.test/cafe.jpg', isMain: true }],
  price: { priceCents: 2500, hidden: false },
  availability: 'available',
  stockPresentation: systemStock,
  hasVariants: true,
  variants: [
    {
      id: 'variant-1',
      name: '250 g',
      option: 'Peso',
      value: '250 g',
      image: { url: 'https://example.test/cafe-250.jpg' },
      price: { priceCents: 2500, hidden: false },
      availabilityByBranch: [
        {
          branchId: 'branch-1',
          branchName: 'Centro',
          branchSlug: 'centro',
          availability: 'available',
          isSelected: true,
        },
      ],
      stockPresentation: systemStock,
    },
  ],
  rating: null,
  featuredLabel: null,
  priceContext: { priceListId, name: 'Lista pública', isCatalogDefault: true },
  excludedCount: 0,
}

function withResponse(overrides: Record<string, unknown>) {
  return { ...response, ...overrides }
}

describe('fetchCatalogProductDetail', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('uses the exact anonymous endpoint with encoded identities and exactly one price-list query', async () => {
    const encodedResponse = {
      ...response,
      priceContext: { ...response.priceContext, priceListId: 'price list' },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(encodedResponse), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchCatalogProductDetail('north & south', 'product/id', 'price list'),
    ).resolves.toEqual(encodedResponse)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/public/catalog/north%20%26%20south/products/product%2Fid?priceListId=price%20list',
      { method: 'GET', credentials: 'omit' },
    )
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init).not.toHaveProperty('headers')
    expect(init).not.toHaveProperty('body')
  })

  it.each([
    [
      'a hidden product and hidden variant',
      withResponse({
        price: { priceCents: null, hidden: true },
        variants: [{ ...response.variants[0], price: { priceCents: null, hidden: true } }],
      }),
    ],
    [
      'an ABSTRACT_STATUS product',
      withResponse({
        availability: 'out_of_stock',
        stockPresentation: {
          mode: 'ABSTRACT_STATUS',
          status: 'out_of_stock',
          customQuantity: null,
        },
      }),
    ],
    [
      'a zero CUSTOM_QUANTITY product',
      withResponse({
        availability: null,
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
      }),
    ],
    [
      'aggregate CUSTOM_QUANTITY variant availability',
      withResponse({
        variants: [
          {
            ...response.variants[0],
            availabilityByBranch: [
              { ...response.variants[0]!.availabilityByBranch[0]!, availability: 'low_stock' },
            ],
            stockPresentation: {
              mode: 'CUSTOM_QUANTITY',
              status: 'low_stock',
              customQuantity: null,
            },
          },
        ],
      }),
    ],
    [
      'HIDDEN stock presentation',
      withResponse({
        availability: null,
        stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
      }),
    ],
  ])('accepts %s', async (_, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    )
    await expect(fetchCatalogProductDetail('centro', productId, priceListId)).resolves.toEqual(body)
  })

  it('accepts documented nullable detail fields', async () => {
    const nullableResponse = withResponse({
      description: null,
      category: null,
      brand: null,
      images: [],
      variants: [
        {
          ...response.variants[0],
          option: null,
          value: null,
          image: null,
        },
      ],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(nullableResponse), { status: 200 })),
    )

    await expect(fetchCatalogProductDetail('centro', productId, priceListId)).resolves.toEqual(
      nullableResponse,
    )
  })

  it.each([
    ['a category without its id', withResponse({ category: { name: 'Café' } })],
    ['a category without its name', withResponse({ category: { id: 'category-1' } })],
    [
      'a category with a non-string name',
      withResponse({ category: { id: 'category-1', name: 1 } }),
    ],
    ['a brand without its name', withResponse({ brand: {} })],
    [
      'an image without its id',
      withResponse({ images: [{ url: 'https://example.test/cafe.jpg', isMain: true }] }),
    ],
    ['an image without its url', withResponse({ images: [{ id: 'image-1', isMain: true }] })],
    [
      'an image without its main marker',
      withResponse({ images: [{ id: 'image-1', url: 'https://example.test/cafe.jpg' }] }),
    ],
    ['a missing hasVariants flag', withResponse({ hasVariants: undefined })],
    [
      'a variant without its id',
      withResponse({ variants: [{ ...response.variants[0], id: undefined }] }),
    ],
    [
      'a variant without its name',
      withResponse({ variants: [{ ...response.variants[0], name: undefined }] }),
    ],
    [
      'a variant without its option',
      withResponse({ variants: [{ ...response.variants[0], option: undefined }] }),
    ],
    [
      'a variant without its value',
      withResponse({ variants: [{ ...response.variants[0], value: undefined }] }),
    ],
    [
      'a variant without its image',
      withResponse({ variants: [{ ...response.variants[0], image: undefined }] }),
    ],
    [
      'a variant image object without its url',
      withResponse({ variants: [{ ...response.variants[0], image: {} }] }),
    ],
    [
      'a price context without its name',
      withResponse({ priceContext: { ...response.priceContext, name: undefined } }),
    ],
    [
      'a price context without its catalog-default marker',
      withResponse({ priceContext: { ...response.priceContext, isCatalogDefault: undefined } }),
    ],
    ['a non-null slug', withResponse({ slug: 'cafe-molido' })],
    ['a non-null rating', withResponse({ rating: 4 })],
    ['a non-null featured label', withResponse({ featuredLabel: 'Nuevo' })],
    ['a non-zero excluded count', withResponse({ excludedCount: 1 })],
    [
      'a wrong price context',
      withResponse({ priceContext: { ...response.priceContext, priceListId: 'wrong-list' } }),
    ],
    ['a visible null price', withResponse({ price: { priceCents: null, hidden: false } })],
    ['a hidden numeric price', withResponse({ price: { priceCents: 2500, hidden: true } })],
    ['a zero visible price', withResponse({ price: { priceCents: 0, hidden: false } })],
    [
      'a product availability/status mismatch',
      withResponse({
        availability: 'low_stock',
        stockPresentation: systemStock,
      }),
    ],
    [
      'a SYSTEM_STATUS with a quantity',
      withResponse({
        stockPresentation: { mode: 'SYSTEM_STATUS', status: 'available', customQuantity: 0 },
      }),
    ],
    [
      'an ABSTRACT_STATUS low-stock status',
      withResponse({
        availability: 'low_stock',
        stockPresentation: { mode: 'ABSTRACT_STATUS', status: 'low_stock', customQuantity: null },
      }),
    ],
    [
      'an invalid CUSTOM_QUANTITY status',
      withResponse({
        availability: 'available',
        stockPresentation: { mode: 'CUSTOM_QUANTITY', status: 'available', customQuantity: 0 },
      }),
    ],
    [
      'a HIDDEN stock presentation with status',
      withResponse({
        availability: 'available',
        stockPresentation: { mode: 'HIDDEN', status: 'available', customQuantity: null },
      }),
    ],
    [
      'more than one variant availability record',
      withResponse({
        variants: [
          {
            ...response.variants[0],
            availabilityByBranch: [
              response.variants[0]!.availabilityByBranch[0]!,
              response.variants[0]!.availabilityByBranch[0]!,
            ],
          },
        ],
      }),
    ],
    [
      'an unselected variant availability record',
      withResponse({
        variants: [
          {
            ...response.variants[0],
            availabilityByBranch: [
              { ...response.variants[0]!.availabilityByBranch[0]!, isSelected: false },
            ],
          },
        ],
      }),
    ],
    [
      'a variant availability/status mismatch',
      withResponse({
        variants: [
          {
            ...response.variants[0],
            availabilityByBranch: [
              { ...response.variants[0]!.availabilityByBranch[0]!, availability: 'low_stock' },
            ],
          },
        ],
      }),
    ],
  ])('rejects %s as a recoverable server failure', async (_, body) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
    )
    await expect(fetchCatalogProductDetail('centro', productId, priceListId)).rejects.toMatchObject(
      { kind: 'server', status: 200 },
    )
  })

  it.each([
    [404, 'not-found'],
    [429, 'rate-limit'],
    [400, 'server'],
    [500, 'server'],
    [201, 'server'],
  ])('classifies HTTP %i as %s', async (status, kind) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status })),
    )
    await expect(fetchCatalogProductDetail('centro', productId, priceListId)).rejects.toMatchObject(
      { kind, status },
    )
  })

  it('forwards the exact AbortSignal and classifies a transport abort as network', async () => {
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

    const request = fetchCatalogProductDetail('centro', productId, priceListId, controller.signal)
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3000/public/catalog/centro/products/${productId}?priceListId=${priceListId}`,
      { method: 'GET', credentials: 'omit', signal: controller.signal },
    )
    controller.abort()
    await expect(request).rejects.toMatchObject({ kind: 'network' })
  })
})
