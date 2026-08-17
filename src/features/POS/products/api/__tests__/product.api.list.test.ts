/**
 * WU-B RED tests — list API surface (Product.type, ?type= filter, idempotent
 * local fallback). product.api.ts is a thin axios wrapper; we exercise it via
 * a mocked `http` so no network or Pinia mount is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { productApi } from '../product.api'
import { http } from '@/core/shared/api/http'
import type { ProductBackendResponse } from '../../interfaces/product.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

function buildRow(overrides: Partial<ProductBackendResponse>): ProductBackendResponse {
  return {
    id: 'p',
    name: 'Row',
    type: 'PRODUCT',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('WU-B · productApi.getPaginated type param', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
  })

  it('sends type=SERVICE only when filter is SERVICE', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [buildRow({ id: 'p1', name: 'Walk', type: 'SERVICE' })],
    })

    await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      type: 'SERVICE',
    })

    const calls = vi.mocked(http.get).mock.calls
    const params = calls[0]?.[1]?.params as Record<string, unknown> | undefined
    expect(params?.type).toBe('SERVICE')
  })

  it('omits type param when no filter is set (PRODUCT/SERVICE both)', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [
        buildRow({ id: 'p1', name: 'Walk', type: 'SERVICE' }),
        buildRow({ id: 'p2', name: 'Kibble', type: 'PRODUCT' }),
      ],
    })

    await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
    })

    const calls = vi.mocked(http.get).mock.calls
    const params = calls[0]?.[1]?.params as Record<string, unknown> | undefined
    expect(params?.type).toBeUndefined()
  })

  it('local fallback filters mixed rows to type=SERVICE only', async () => {
    // Backend ignored ?type= and returned both SERVICE and PRODUCT rows
    vi.mocked(http.get).mockResolvedValue({
      data: [
        buildRow({ id: 'p1', name: 'Walk', type: 'SERVICE' }),
        buildRow({ id: 'p2', name: 'Kibble', type: 'PRODUCT' }),
        buildRow({ id: 'p3', name: 'Board', type: 'SERVICE' }),
      ],
    })

    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      type: 'SERVICE',
    })

    expect(result.data.map((r) => r.id)).toEqual(['p1', 'p3'])
    expect(result.pagination.totalCount).toBe(2)
  })

  it('local fallback is idempotent when server already filtered', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: [
        buildRow({ id: 'p1', name: 'Walk', type: 'SERVICE' }),
        buildRow({ id: 'p3', name: 'Board', type: 'SERVICE' }),
      ],
    })

    const result = await productApi.getPaginated({
      pageIndex: 0,
      pageSize: 10,
      type: 'SERVICE',
    })

    expect(result.data.map((r) => r.id)).toEqual(['p1', 'p3'])
    expect(result.pagination.totalCount).toBe(2)
  })
})