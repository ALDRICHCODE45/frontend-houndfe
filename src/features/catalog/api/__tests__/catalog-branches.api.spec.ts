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
})
