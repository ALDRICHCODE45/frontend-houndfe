import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCatalogPriceContexts } from '../catalog-price-contexts.api'

const catalogDefault = {
  priceListId: 'price-list-publico',
  name: 'Público',
  isCatalogDefault: true,
}
const mayoreo = { priceListId: 'price-list-mayoreo', name: 'Mayoreo', isCatalogDefault: false }

describe('fetchCatalogPriceContexts', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('uses the isolated anonymous discovery endpoint with an encoded tenant slug and no request extras', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([catalogDefault, mayoreo]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalogPriceContexts('north & south')).resolves.toEqual([
      catalogDefault,
      mayoreo,
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/public/catalog/north%20%26%20south/price-contexts',
      { method: 'GET', credentials: 'omit' },
    )
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(init).not.toHaveProperty('headers')
    expect(init).not.toHaveProperty('body')
  })

  it('accepts an empty discovery array with zero published defaults', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))

    await expect(fetchCatalogPriceContexts('centro')).resolves.toEqual([])
  })

  it('accepts a single published context and preserves the returned order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify([mayoreo]), { status: 200 })),
    )

    await expect(fetchCatalogPriceContexts('centro')).resolves.toEqual([mayoreo])
  })

  it('rejects duplicate display names while priceListId stays the stable identity', async () => {
    const duplicateNames = [
      { priceListId: 'list-a', name: 'Mayoreo', isCatalogDefault: true },
      { priceListId: 'list-b', name: 'Mayoreo', isCatalogDefault: false },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(duplicateNames), { status: 200 })),
    )

    await expect(fetchCatalogPriceContexts('centro')).rejects.toMatchObject({
      kind: 'server',
      status: 200,
    })
  })

  it.each([
    ['a non-array object envelope', JSON.stringify({ priceContexts: [catalogDefault] })],
    ['a null payload', 'null'],
    ['a non-json payload', 'not-json'],
    ['a primitive row', JSON.stringify(['price-list-publico'])],
    ['a row without a priceListId', JSON.stringify([{ name: 'Público', isCatalogDefault: true }])],
    ['a row with a numeric priceListId', JSON.stringify([{ ...catalogDefault, priceListId: 7 }])],
    ['a row with an empty priceListId', JSON.stringify([{ ...catalogDefault, priceListId: '' }])],
    [
      'a row with a whitespace-only priceListId',
      JSON.stringify([{ ...catalogDefault, priceListId: '   ' }]),
    ],
    [
      'a row without a name',
      JSON.stringify([{ priceListId: 'price-list-publico', isCatalogDefault: true }]),
    ],
    ['a row with an empty name', JSON.stringify([{ ...catalogDefault, name: '' }])],
    ['a row with a whitespace-only name', JSON.stringify([{ ...catalogDefault, name: ' \t ' }])],
    [
      'a row with a non-boolean default flag',
      JSON.stringify([{ ...catalogDefault, isCatalogDefault: 'yes' }]),
    ],
    [
      'duplicate price list ids',
      JSON.stringify([catalogDefault, { ...mayoreo, priceListId: catalogDefault.priceListId }]),
    ],
    [
      'more than one default context',
      JSON.stringify([catalogDefault, { ...mayoreo, isCatalogDefault: true }]),
    ],
    [
      'a row with an extra enumerable key',
      JSON.stringify([{ ...catalogDefault, internalId: 'not-public' }]),
    ],
  ])('rejects %s as a recoverable server failure', async (_, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))

    await expect(fetchCatalogPriceContexts('centro')).rejects.toMatchObject({
      kind: 'server',
      status: 200,
    })
  })

  it.each([
    [404, 'unavailable'],
    [429, 'rate-limit'],
    [400, 'server'],
    [500, 'server'],
    [503, 'server'],
    [201, 'server'],
  ])('classifies HTTP %i as %s', async (status, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status })))

    await expect(fetchCatalogPriceContexts('centro')).rejects.toMatchObject({ kind, status })
  })

  it('classifies a transport rejection as a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchCatalogPriceContexts('centro')).rejects.toMatchObject({ kind: 'network' })
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

    const request = fetchCatalogPriceContexts('centro', controller.signal)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/public/catalog/centro/price-contexts',
      { method: 'GET', credentials: 'omit', signal: controller.signal },
    )
    controller.abort()
    await expect(request).rejects.toMatchObject({ kind: 'network' })
  })
})
