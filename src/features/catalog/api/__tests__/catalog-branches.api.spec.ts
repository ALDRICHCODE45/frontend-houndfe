import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCatalogBranches } from '../catalog-branches.api'

const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }

describe('fetchCatalogBranches', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('uses the isolated anonymous branches endpoint and preserves response order', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([branch, { ...branch, id: 'b-2', name: 'Norte' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalogBranches()).resolves.toEqual([branch, { ...branch, id: 'b-2', name: 'Norte' }])
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/public/catalog/branches', { method: 'GET', credentials: 'omit' })
  })

  it('accepts an empty published list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))

    await expect(fetchCatalogBranches()).resolves.toEqual([])
  })

  it.each([['non-array', '{"branches": []}'], ['invalid json', 'not-json']])('rejects %s payloads as a recoverable server failure', async (_, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))

    await expect(fetchCatalogBranches()).rejects.toMatchObject({ kind: 'server' })
  })

  it('rejects items with wrong field types as a recoverable server failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...branch, id: 7 }]), { status: 200 })))

    await expect(fetchCatalogBranches()).rejects.toMatchObject({ kind: 'server' })
  })

  it.each([[429, 'rate-limit'], [503, 'server'], [500, 'server'], [401, 'server'], [201, 'server']])('classifies HTTP %i as %s', async (status, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([branch]), { status })))

    await expect(fetchCatalogBranches()).rejects.toMatchObject({ kind })
  })

  it('classifies a transport rejection as a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchCatalogBranches()).rejects.toMatchObject({ kind: 'network' })
  })

  it('classifies an in-flight abort as network and forwards the exact signal', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn((_url: string, init?: { signal?: AbortSignal }) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const request = fetchCatalogBranches(controller.signal)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/public/catalog/branches', { method: 'GET', credentials: 'omit', signal: controller.signal })
    controller.abort()
    expect(controller.signal.aborted).toBe(true)
    await expect(request).rejects.toMatchObject({ kind: 'network' })
  })
})
