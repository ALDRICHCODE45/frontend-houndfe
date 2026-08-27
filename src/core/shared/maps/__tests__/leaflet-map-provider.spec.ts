import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMapProvider, resetMapProvider, setMapProvider } from '@/core/shared/maps/map-provider'
import type { GeoPoint, MapProvider } from '@/core/shared/maps/map-provider'
import { createLeafletMapProvider } from '@/core/shared/maps/leaflet-map-provider'

/**
 * Port-contract spec. This asserts the SHAPE and BEHAVIOR of the MapProvider
 * seam (kind, createMap handle, geocode + AbortController, failure swallow) —
 * NOT that Leaflet paints tiles in jsdom. Tile rendering is a vendor concern
 * behind the port and is deliberately out of scope (design §4.3).
 */

function createContainer(): HTMLElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'clientWidth', { value: 640, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 360, configurable: true })
  document.body.appendChild(el)
  return el
}

const CDMX: GeoPoint = { lat: 19.4326, lng: -99.1332 }

describe('map-provider port', () => {
  beforeEach(() => {
    resetMapProvider()
    vi.restoreAllMocks()
  })

  it('resolves the Leaflet provider by default (REQ-AMP-001)', () => {
    const provider = getMapProvider()
    expect(provider.kind).toBe('leaflet')
    expect(typeof provider.createMap).toBe('function')
    expect(typeof provider.geocode).toBe('function')
  })

  it('returns the same lazily-created provider instance across calls', () => {
    expect(getMapProvider()).toBe(getMapProvider())
  })

  it('allows swapping the provider (vendor-migration seam)', () => {
    const fake = {
      kind: 'leaflet',
      createMap: vi.fn(),
      geocode: vi.fn(),
    } as unknown as MapProvider
    setMapProvider(fake)
    expect(getMapProvider()).toBe(fake)
    resetMapProvider()
    expect(getMapProvider()).not.toBe(fake)
  })
})

describe('leaflet map provider — createMap handle', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a map handle exposing the port surface', () => {
    const provider = createLeafletMapProvider()
    const handle = provider.createMap(createContainer(), { center: CDMX, zoom: 15 })

    expect(typeof handle.setMarker).toBe('function')
    expect(typeof handle.clearMarker).toBe('function')
    expect(typeof handle.destroy).toBe('function')
    handle.destroy()
  })

  it('mounts an OSM tile layer into the container (REQ-AMP-001)', () => {
    const container = createContainer()
    const handle = createLeafletMapProvider().createMap(container, { center: CDMX, zoom: 15 })

    // Leaflet marks the host element itself and injects its tile pane inside it.
    expect(container.classList.contains('leaflet-container')).toBe(true)
    expect(container.querySelector('.leaflet-tile-pane')).not.toBeNull()
    handle.destroy()
  })

  it('places a draggable marker when draggable is requested (REQ-AMP-002)', () => {
    const container = createContainer()
    const handle = createLeafletMapProvider().createMap(container, {
      center: CDMX,
      zoom: 15,
      draggableMarker: true,
    })
    handle.setMarker(CDMX)

    expect(handle.isMarkerDraggable()).toBe(true)
    handle.destroy()
  })

  it('places a static marker when draggable is not requested (REQ-AMP-002)', () => {
    const container = createContainer()
    const handle = createLeafletMapProvider().createMap(container, { center: CDMX, zoom: 15 })
    handle.setMarker(CDMX)

    expect(handle.isMarkerDraggable()).toBe(false)
    handle.destroy()
  })

  it('reports the marker position and clears it on clearMarker (REQ-AMP-003)', () => {
    const container = createContainer()
    const handle = createLeafletMapProvider().createMap(container, { center: CDMX, zoom: 15 })

    handle.setMarker(CDMX)
    expect(handle.getMarker()).toEqual(CDMX)

    handle.clearMarker()
    expect(handle.getMarker()).toBeNull()
    handle.destroy()
  })

  it('notifies onMarkerDrag with the new GeoPoint when the marker is dragged (REQ-AMP-003)', () => {
    const onMarkerDrag = vi.fn()
    const handle = createLeafletMapProvider().createMap(createContainer(), {
      center: CDMX,
      zoom: 15,
      draggableMarker: true,
      onMarkerDrag,
    })
    handle.setMarker(CDMX)

    handle.simulateMarkerDrag({ lat: 19.5, lng: -99.2 })

    expect(onMarkerDrag).toHaveBeenCalledWith({ lat: 19.5, lng: -99.2 })
    handle.destroy()
  })

  it('binds a popup when popupText is provided (read mode)', () => {
    const container = createContainer()
    const handle = createLeafletMapProvider().createMap(container, { center: CDMX, zoom: 15 })
    handle.setMarker(CDMX, { popupText: 'Casa, Av. Reforma #123' })

    expect(handle.getPopupText()).toBe('Casa, Av. Reforma #123')
    handle.destroy()
  })

  it('swallows tile-load failures and reports them via onTileError (REQ-AMP-007)', () => {
    const onTileError = vi.fn()
    const handle = createLeafletMapProvider().createMap(createContainer(), {
      center: CDMX,
      zoom: 15,
      onTileError,
    })

    expect(() => handle.simulateTileError()).not.toThrow()
    expect(onTileError).toHaveBeenCalledTimes(1)
    handle.destroy()
  })

  it('swallows tile-load failures even when no onTileError handler is provided', () => {
    const handle = createLeafletMapProvider().createMap(createContainer(), {
      center: CDMX,
      zoom: 15,
    })
    expect(() => handle.simulateTileError()).not.toThrow()
    handle.destroy()
  })

  it('is idempotent on destroy', () => {
    const handle = createLeafletMapProvider().createMap(createContainer(), {
      center: CDMX,
      zoom: 15,
    })
    handle.destroy()
    expect(() => handle.destroy()).not.toThrow()
  })
})

describe('leaflet map provider — Nominatim geocode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => impl(String(url), init))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('queries Nominatim with format=json and returns the first result', async () => {
    const fetchMock = mockFetch(() => ({
      ok: true,
      json: async () => [
        { lat: '19.4326', lon: '-99.1332' },
        { lat: '20.0', lon: '-100.0' },
      ],
    }))

    const point = await createLeafletMapProvider().geocode('Av. Reforma 123')

    expect(point).toEqual({ lat: 19.4326, lng: -99.1332 })
    const requestedUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(requestedUrl).toContain('https://nominatim.openstreetmap.org/search')
    expect(requestedUrl).toContain('format=json')
    expect(requestedUrl).toContain(encodeURIComponent('Av. Reforma 123'))
  })

  it('returns null on zero results without throwing (REQ-AMP-004)', async () => {
    mockFetch(() => ({ ok: true, json: async () => [] }))
    await expect(createLeafletMapProvider().geocode('asdfqwerty')).resolves.toBeNull()
  })

  it('returns null on a network failure without throwing (REQ-AMP-004)', async () => {
    mockFetch(() => {
      throw new Error('network down')
    })
    await expect(createLeafletMapProvider().geocode('Av. Reforma')).resolves.toBeNull()
  })

  it('returns null on a non-ok HTTP response (rate limit)', async () => {
    mockFetch(() => ({ ok: false, status: 429, json: async () => [] }))
    await expect(createLeafletMapProvider().geocode('Av. Reforma')).resolves.toBeNull()
  })

  it('returns null on a malformed payload', async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ not: 'an array' }) }))
    await expect(createLeafletMapProvider().geocode('Av. Reforma')).resolves.toBeNull()
  })

  it('returns null when the first result has non-numeric coordinates', async () => {
    mockFetch(() => ({ ok: true, json: async () => [{ lat: 'abc', lon: 'def' }] }))
    await expect(createLeafletMapProvider().geocode('Av. Reforma')).resolves.toBeNull()
  })

  it('skips the request and returns null for a blank query', async () => {
    const fetchMock = mockFetch(() => ({ ok: true, json: async () => [] }))
    await expect(createLeafletMapProvider().geocode('   ')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards the AbortController signal to fetch and resolves null when aborted', async () => {
    const controller = new AbortController()
    const fetchMock = mockFetch((_url, init) => {
      expect(init?.signal).toBe(controller.signal)
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    })

    const point = await createLeafletMapProvider().geocode('Av. Reforma', controller.signal)

    expect(point).toBeNull()
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })
})
