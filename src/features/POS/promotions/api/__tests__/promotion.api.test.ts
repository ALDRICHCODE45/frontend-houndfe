import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosResponse } from 'axios'
import { promotionApi } from '../promotion.api'
import { http } from '@/core/shared/api/http'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

const httpMock = vi.mocked(http)
const httpPostMock = vi.mocked(http.post)

// ── Tests ─────────────────────────────────────────────────────────────────────

// BD-REQ-002: `promotionApi.batchDelete(ids: string[])` MUST POST `{ ids }` to
// `/promotions/batch-delete` and return `{ deleted: number }`. The backend is
// all-or-nothing atomic; the frontend is the validation surface for the cap.

describe('promotionApi.batchDelete (sdd-10 promotions-batch-delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs to /promotions/batch-delete with { ids } body and returns { deleted: number }', async () => {
    httpPostMock.mockResolvedValueOnce({ data: { deleted: 3 } } as never)

    const result = await promotionApi.batchDelete(['a', 'b', 'c'])

    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post).toHaveBeenCalledWith('/promotions/batch-delete', { ids: ['a', 'b', 'c'] })
    expect(result).toEqual({ deleted: 3 })
  })

  it('deduplicates ids before POST (same id twice → one network entry)', async () => {
    httpPostMock.mockResolvedValueOnce({ data: { deleted: 2 } } as never)

    const result = await promotionApi.batchDelete(['a', 'b', 'a', 'b'])

    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post).toHaveBeenCalledWith('/promotions/batch-delete', { ids: ['a', 'b'] })
    expect(result).toEqual({ deleted: 2 })
  })

  it('rejects empty arrays client-side (no network call) — UI guards 0-row selection', async () => {
    await expect(promotionApi.batchDelete([])).rejects.toThrow()
    expect(httpMock.post).not.toHaveBeenCalled()
  })

  it('rejects arrays longer than 100 client-side — UI guards cap', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    await expect(promotionApi.batchDelete(tooMany)).rejects.toThrow()
    expect(httpMock.post).not.toHaveBeenCalled()
  })

  it('accepts arrays at exactly the 100-row cap', async () => {
    const exactly100 = Array.from({ length: 100 }, (_, i) => `id-${i}`)
    httpPostMock.mockResolvedValueOnce({ data: { deleted: 100 } } as never)

    const result = await promotionApi.batchDelete(exactly100)

    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post).toHaveBeenCalledWith('/promotions/batch-delete', { ids: exactly100 })
    expect(result).toEqual({ deleted: 100 })
  })

  it('propagates axios errors unchanged so callers can dispatch on response.data.error', async () => {
    const axiosError = new Error('Network Error') as Error & { response?: unknown }
    httpPostMock.mockRejectedValueOnce(axiosError as never)

    await expect(promotionApi.batchDelete(['a'])).rejects.toBe(axiosError)
  })

  it('does not touch other API methods on the promotionApi object (single-purpose addition)', () => {
    expect(typeof promotionApi.batchDelete).toBe('function')
    // The 5 existing methods MUST stay untouched.
    expect(typeof promotionApi.getPaginated).toBe('function')
    expect(typeof promotionApi.getById).toBe('function')
    expect(typeof promotionApi.create).toBe('function')
    expect(typeof promotionApi.update).toBe('function')
    expect(typeof promotionApi.end).toBe('function')
    expect(typeof promotionApi.remove).toBe('function')
  })
})

// BE-REQ-002: `promotionApi.batchEnd(ids: string[])` MUST deduplicate ids,
// enforce the 100-id cap, POST to `/promotions/batch-end`, and return `{ ended }`.
describe('promotionApi.batchEnd (promotions-batch-end)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deduplicates ids before POST and returns { ended: number }', async () => {
    httpPostMock.mockResolvedValueOnce({ data: { ended: 2 } } as never)

    const result = await promotionApi.batchEnd(['a', 'a', 'b'])

    expect(httpPostMock).toHaveBeenCalledWith('/promotions/batch-end', { ids: ['a', 'b'] })
    expect(result).toEqual({ ended: 2 })
  })

  it('rejects empty arrays client-side without a network call', async () => {
    await expect(promotionApi.batchEnd([])).rejects.toThrow()
    expect(httpPostMock).not.toHaveBeenCalled()
  })

  it('rejects arrays longer than 100 client-side without a network call', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`)

    await expect(promotionApi.batchEnd(tooMany)).rejects.toThrow()
    expect(httpPostMock).not.toHaveBeenCalled()
  })
})

// BA-REQ-002: `promotionApi.batchActivate(ids: string[])` MUST deduplicate ids,
// enforce the 100-id cap, POST to `/promotions/batch-activate`, and return
// `{ activated }`. Mirror of `batchEnd` per the SDD-13 deltas.
describe('promotionApi.batchActivate (promotions-batch-activate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deduplicates ids before POST and returns { activated: number }', async () => {
    httpPostMock.mockResolvedValueOnce({ data: { activated: 2 } } as never)

    const result = await promotionApi.batchActivate(['a', 'a', 'b'])

    expect(httpPostMock).toHaveBeenCalledWith('/promotions/batch-activate', { ids: ['a', 'b'] })
    expect(result).toEqual({ activated: 2 })
  })

  it('rejects empty arrays client-side without a network call', async () => {
    await expect(promotionApi.batchActivate([])).rejects.toThrow()
    expect(httpPostMock).not.toHaveBeenCalled()
  })

  it('rejects arrays longer than 100 client-side without a network call', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `id-${i}`)

    await expect(promotionApi.batchActivate(tooMany)).rejects.toThrow()
    expect(httpPostMock).not.toHaveBeenCalled()
  })
})

// IA-REQ-001: `promotionApi.activate(id: string)` MUST PATCH
// `/promotions/${id}/activate` and return the updated `PromotionResponse`.
// Mirrors `promotionApi.end(id)` per the SDD-13 deltas.
describe('promotionApi.activate (promotions-batch-activate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /promotions/:id/activate and returns the updated promotion', async () => {
    const updated = { id: 'promo-1', status: 'ACTIVE' }
    const httpPatchMock = vi.mocked(http.patch)
    httpPatchMock.mockResolvedValueOnce({ data: updated } as never)

    const result = await promotionApi.activate('promo-1')

    expect(httpPatchMock).toHaveBeenCalledWith('/promotions/promo-1/activate')
    expect(result).toEqual(updated)
  })
})
