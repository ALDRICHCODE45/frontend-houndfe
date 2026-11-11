import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCatalogBranchDetail } from '../catalog-branch-detail.api'

const detail = {
  name: 'Sucursal Centro',
  phone: null,
  address: { formatted: 'Una dirección' },
  hours: null,
  pickupAvailable: true,
  deliveryAvailable: false,
  whatsappNumber: null,
}

describe('fetchCatalogBranchDetail', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('reads the anonymous branch endpoint of the slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchCatalogBranchDetail('centro')).resolves.toEqual(detail)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/public/catalog/centro/branch', {
      method: 'GET',
      credentials: 'omit',
    })
  })

  it('encodes the slug and forwards the abort signal', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchCatalogBranchDetail('a b', controller.signal)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/public/catalog/a%20b/branch', {
      method: 'GET',
      credentials: 'omit',
      signal: controller.signal,
    })
  })

  it('accepts a branch with nothing configured', async () => {
    const empty = { ...detail, address: null, pickupAvailable: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(empty), { status: 200 })))
    await expect(fetchCatalogBranchDetail('centro')).resolves.toEqual(empty)
  })

  it('accepts complete hours', async () => {
    const withHours = {
      ...detail,
      hours: {
        timeZone: 'America/Mexico_City',
        days: [{ day: 'MONDAY', label: 'Lunes', closed: false, ranges: [{ open: '09:00', close: '18:00' }] }],
        summary: 'Resumen',
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(withHours), { status: 200 })))
    await expect(fetchCatalogBranchDetail('centro')).resolves.toEqual(withHours)
  })

  it.each([
    ['404', 404, 'not-found'],
    ['429', 429, 'rate-limit'],
    ['500', 500, 'server'],
  ])('classifies HTTP %s as %s', async (_, status, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })))
    await expect(fetchCatalogBranchDetail('centro')).rejects.toMatchObject({ kind })
  })

  it.each([
    ['an array', '[]'],
    ['invalid json', 'nope'],
    ['a wrong flag', JSON.stringify({ ...detail, pickupAvailable: 'yes' })],
    ['a wrong address', JSON.stringify({ ...detail, address: 'text' })],
    ['broken hours', JSON.stringify({ ...detail, hours: { timeZone: 1 } })],
  ])('rejects %s as a server failure', async (_, body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })))
    await expect(fetchCatalogBranchDetail('centro')).rejects.toMatchObject({ kind: 'server' })
  })

  it('treats a missing whatsappNumber as null (backend without v0 fields)', async () => {
    const { whatsappNumber: _omit, ...legacy } = detail
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(legacy), { status: 200 })))
    await expect(fetchCatalogBranchDetail('centro')).resolves.toMatchObject({ whatsappNumber: null })
  })

  it('classifies a transport rejection as network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(fetchCatalogBranchDetail('centro')).rejects.toMatchObject({ kind: 'network' })
  })
})
