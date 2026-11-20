/**
 * Backorder transport. Mocks the shared axios `http`; pins URLs, the allow-listed params (status as
 * a comma list, blanks dropped, unknown keys never sent) and the cancel body.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { backordersApi } from '../backorders.api'
import { countsFixture, makeBackorder } from '../../interfaces/__tests__/backorder.fixture'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const signal = new AbortController().signal

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('backordersApi.list', () => {
  it('GET /backorders with every S3 param, status joined by comma, and the signal', async () => {
    const page = { items: [makeBackorder()], page: 2, limit: 20, total: 31, counts: countsFixture }
    get.mockResolvedValue({ data: page })

    const result = await backordersApi.list(
      {
        page: 2,
        limit: 20,
        status: ['WAITING', 'RESERVED'],
        productId: 'p1',
        variantId: 'v1',
        customerId: 'c1',
        q: 'Rosa',
        from: '2026-11-01T06:00:00.000Z',
        to: '2026-11-08T06:00:00.000Z',
        sortBy: 'reservedUntil',
        sortOrder: 'desc',
        // @ts-expect-error unknown params must never reach the wire
        foo: 'bar',
      },
      { signal },
    )

    expect(result).toBe(page)
    expect(get).toHaveBeenCalledWith('/backorders', {
      params: {
        page: 2,
        limit: 20,
        status: 'WAITING,RESERVED',
        productId: 'p1',
        variantId: 'v1',
        customerId: 'c1',
        q: 'Rosa',
        from: '2026-11-01T06:00:00.000Z',
        to: '2026-11-08T06:00:00.000Z',
        sortBy: 'reservedUntil',
        sortOrder: 'desc',
      },
      signal,
    })
  })

  it('drops blanks, undefined and an empty status list', async () => {
    get.mockResolvedValue({ data: { items: [], page: 1, limit: 10, total: 0, counts: countsFixture } })
    await backordersApi.list({ page: 1, status: [], q: '  ', productId: '', from: undefined })
    expect(get).toHaveBeenCalledWith('/backorders', { params: { page: 1 }, signal: undefined })
  })
})

describe('backordersApi.get / cancel', () => {
  it('GET /backorders/:id encodes the id', async () => {
    const row = makeBackorder()
    get.mockResolvedValue({ data: row })
    expect(await backordersApi.get('a/b', { signal })).toBe(row)
    expect(get).toHaveBeenCalledWith('/backorders/a%2Fb', { signal })
  })

  it('POST /backorders/:id/cancel sends the version and the trimmed reason', async () => {
    const row = makeBackorder({ status: 'CANCELLED' })
    post.mockResolvedValue({ data: row })
    expect(await backordersApi.cancel('b1', { version: 3, reason: '  Sin stock del proveedor ' })).toBe(row)
    expect(post).toHaveBeenCalledWith('/backorders/b1/cancel', { reason: 'Sin stock del proveedor', version: 3 })
  })

  it('omits a blank reason and fields outside the body contract', async () => {
    post.mockResolvedValue({ data: makeBackorder() })
    // @ts-expect-error unknown body fields must never reach the wire
    await backordersApi.cancel('b1', { version: 0, reason: '   ', extra: 1 })
    expect(post).toHaveBeenCalledWith('/backorders/b1/cancel', { version: 0 })
  })
})
