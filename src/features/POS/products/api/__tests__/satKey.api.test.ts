/**
 * satKey.api — HTTP client tests.
 *
 * Verifies the contract against the shared `http` instance:
 *  - searchSatKeys hits GET /sat-keys with {search, limit:20, offset:0}
 *    and NEVER sends tenantId.
 *  - getSatKey returns null on 404 and rethrows on other errors.
 *  - toSatKeySearchResponse tolerates BOTH documented envelope shapes:
 *      (A) { items, limit, offset, total } — the sat-catalog contract
 *      (B) { data, meta.total }           — the repo list convention
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AxiosError } from 'axios'
import { http } from '@/core/shared/api/http'
import { searchSatKeys, getSatKey, toSatKeySearchResponse } from '../satKey.api'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
  },
}))

describe('searchSatKeys', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
  })

  it('hits GET /sat-keys with trimmed search, limit=20, offset=0', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { items: [], limit: 20, offset: 0, total: 0 },
    })

    await searchSatKeys('  Servicio  ')

    expect(http.get).toHaveBeenCalledWith(
      '/sat-keys',
      expect.objectContaining({
        params: { search: 'Servicio', limit: 20, offset: 0 },
      }),
    )
  })

  it('NEVER sends tenantId in the params (tenant is in the JWT)', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { items: [], limit: 20, offset: 0, total: 0 },
    })

    await searchSatKeys('abc')

    const call = vi.mocked(http.get).mock.calls[0]
    const params = call?.[1]?.params as Record<string, unknown>
    expect(params).not.toHaveProperty('tenantId')
    expect(params).not.toHaveProperty('tenant')
  })

  it('forwards the AbortSignal to axios for cancellation', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { items: [], limit: 20, offset: 0, total: 0 },
    })
    const ac = new AbortController()

    await searchSatKeys('abc', { signal: ac.signal })

    const call = vi.mocked(http.get).mock.calls[0]
    expect(call?.[1]?.signal).toBe(ac.signal)
  })
})

describe('getSatKey', () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset()
  })

  it('returns the SatKey on a 2xx response', async () => {
    const row = {
      key: '12345678',
      description: 'Servicios',
      includeIva: 'OPTIONAL',
      includeIeps: 'NONE',
      validFrom: null,
      validTo: null,
    }
    vi.mocked(http.get).mockResolvedValue({ data: row })

    const result = await getSatKey('12345678')

    expect(http.get).toHaveBeenCalledWith('/sat-keys/12345678', expect.anything())
    expect(result).toEqual(row)
  })

  it('returns null on a 404 (legacy/retired key path)', async () => {
    const error = Object.assign(new Error('Not Found'), {
      isAxiosError: true,
      response: { status: 404, data: { message: 'not found' } },
    }) as AxiosError
    vi.mocked(http.get).mockRejectedValue(error)

    const result = await getSatKey('99999999')

    expect(result).toBeNull()
  })

  it('rethrows non-404 errors so callers can decide', async () => {
    const error = Object.assign(new Error('Server Error'), {
      isAxiosError: true,
      response: { status: 500, data: { message: 'oops' } },
    }) as AxiosError
    vi.mocked(http.get).mockRejectedValue(error)

    await expect(getSatKey('12345678')).rejects.toBe(error)
  })

  it('forwards the AbortSignal to axios', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { key: '1', description: 'x', includeIva: 'NONE', includeIeps: 'NONE', validFrom: null, validTo: null },
    })
    const ac = new AbortController()

    await getSatKey('12345678', { signal: ac.signal })

    const call = vi.mocked(http.get).mock.calls[0]
    expect(call?.[1]?.signal).toBe(ac.signal)
  })
})

describe('toSatKeySearchResponse — tolerant adapter', () => {
  it('parses the documented { items, limit, offset, total } shape', () => {
    const raw = {
      items: [{ key: '1', description: 'a', includeIva: 'NONE', includeIeps: 'NONE', validFrom: null, validTo: null }],
      limit: 20,
      offset: 0,
      total: 152,
    }
    expect(toSatKeySearchResponse(raw)).toEqual({
      items: raw.items,
      limit: 20,
      offset: 0,
      total: 152,
    })
  })

  it('parses the repo { data, meta.total } shape (defensive)', () => {
    const raw = {
      data: [{ key: '1', description: 'a', includeIva: 'NONE', includeIeps: 'NONE', validFrom: null, validTo: null }],
      meta: { total: 7, page: 1, limit: 20, totalPages: 1 },
    }
    expect(toSatKeySearchResponse(raw)).toEqual({
      items: raw.data,
      limit: 20,
      offset: 0,
      total: 7,
    })
  })

  it('returns an empty result when neither shape matches', () => {
    expect(toSatKeySearchResponse(null)).toEqual({
      items: [],
      limit: 0,
      offset: 0,
      total: 0,
    })
    expect(toSatKeySearchResponse({})).toEqual({
      items: [],
      limit: 0,
      offset: 0,
      total: 0,
    })
  })
})
