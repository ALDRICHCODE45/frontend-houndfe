import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getMapProvider, resetMapProvider, setMapProvider } from '@/core/shared/maps/map-provider'
import type { GeoPoint, MapProvider } from '@/core/shared/maps/map-provider'
import {
  createLeafletMapProvider,
  resetPlaceSearchBudget,
} from '@/core/shared/maps/leaflet-map-provider'

/**
 * Port-contract spec. This asserts the SHAPE and BEHAVIOR of the MapProvider
 * seam (kind, createMap handle, searchPlaces + AbortController, request budget, failure swallow) —
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
    expect(typeof provider.searchPlaces).toBe('function')
  })

  it('returns the same lazily-created provider instance across calls', () => {
    expect(getMapProvider()).toBe(getMapProvider())
  })

  it('allows swapping the provider (vendor-migration seam)', () => {
    const fake = {
      kind: 'leaflet',
      createMap: vi.fn(),
      searchPlaces: vi.fn(),
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

  it('notifies onMapClick with the tapped GeoPoint so a first pin can be placed (S5)', () => {
    const onMapClick = vi.fn()
    const handle = createLeafletMapProvider().createMap(createContainer(), {
      center: CDMX,
      zoom: 15,
      onMapClick,
    })

    handle.simulateMapClick({ lat: 19.5, lng: -99.2 })

    expect(onMapClick).toHaveBeenCalledWith({ lat: 19.5, lng: -99.2 })
    handle.destroy()
  })

  it('wraps a tapped longitude back into ±180 (S5)', () => {
    const onMapClick = vi.fn()
    const handle = createLeafletMapProvider().createMap(createContainer(), {
      center: CDMX,
      zoom: 15,
      onMapClick,
    })

    handle.simulateMapClick({ lat: 19.5, lng: -99.2 + 360 })

    const [point] = onMapClick.mock.calls[0] ?? []
    expect(point.lat).toBe(19.5)
    expect(point.lng).toBeCloseTo(-99.2, 9)
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

describe('leaflet map provider — Nominatim place search', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    resetPlaceSearchBudget()
  })

  function mockFetch(impl: (url: string, init?: RequestInit) => unknown) {
    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => impl(String(url), init))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  const okJson = (payload: unknown) => () => ({ ok: true, json: async () => payload })

  it('asks Nominatim for up to 5 Mexican results in Spanish and returns them by name (S2, S3)', async () => {
    const fetchMock = mockFetch(
      okJson([
        { lat: '19.37', lon: '-99.17', display_name: 'Insurgentes Sur 1458, Actipan, CDMX' },
        { lat: '19.38', lon: '-99.18', display_name: 'Avenida Insurgentes Sur, Del Valle, CDMX' },
      ]),
    )

    const outcome = await createLeafletMapProvider().searchPlaces('Insurgentes Sur 1458')

    expect(outcome).toEqual({
      status: 'ok',
      results: [
        { point: { lat: 19.37, lng: -99.17 }, label: 'Insurgentes Sur 1458, Actipan, CDMX' },
        { point: { lat: 19.38, lng: -99.18 }, label: 'Avenida Insurgentes Sur, Del Valle, CDMX' },
      ],
    })
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]))
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search')
    expect(url.searchParams.get('q')).toBe('Insurgentes Sur 1458')
    expect(url.searchParams.get('format')).toBe('json')
    expect(url.searchParams.get('limit')).toBe('5')
    expect(url.searchParams.get('countrycodes')).toBe('mx')
    expect(url.searchParams.get('accept-language')).toBe('es')
  })

  it('keeps at most 5 results even if the service sends more (S2)', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      lat: String(19 + i / 100),
      lon: '-99.1',
      display_name: `Lugar ${i}`,
    }))
    mockFetch(okJson(many))

    const outcome = await createLeafletMapProvider().searchPlaces('Lugar')

    expect(outcome.status === 'ok' && outcome.results.map((r) => r.label)).toEqual([
      'Lugar 0',
      'Lugar 1',
      'Lugar 2',
      'Lugar 3',
      'Lugar 4',
    ])
  })

  it('drops results without a name or with non-finite or out-of-range coordinates (S5)', async () => {
    mockFetch(
      okJson([
        { lat: 'abc', lon: '-99.1', display_name: 'Bad lat' },
        { lat: '91', lon: '-99.1', display_name: 'Lat out of range' },
        { lat: '19', lon: '-181', display_name: 'Lng out of range' },
        { lat: '19', lon: '-99', display_name: '   ' },
        { lat: '0', lon: '0', display_name: 'Null Island' },
      ]),
    )

    const outcome = await createLeafletMapProvider().searchPlaces('x')

    expect(outcome).toEqual({
      status: 'ok',
      results: [{ point: { lat: 0, lng: 0 }, label: 'Null Island' }],
    })
  })

  it('returns ok with no results on zero matches (S4)', async () => {
    mockFetch(okJson([]))
    await expect(createLeafletMapProvider().searchPlaces('asdfqwerty')).resolves.toEqual({
      status: 'ok',
      results: [],
    })
  })

  it('reports unavailable on a network failure without throwing (S4)', async () => {
    mockFetch(() => {
      throw new Error('network down')
    })
    await expect(createLeafletMapProvider().searchPlaces('Av. Reforma')).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('reports unavailable on a non-ok HTTP response such as a rate limit (S4)', async () => {
    mockFetch(() => ({ ok: false, status: 429, json: async () => [] }))
    await expect(createLeafletMapProvider().searchPlaces('Av. Reforma')).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('reports unavailable on a malformed payload (S4)', async () => {
    mockFetch(okJson({ not: 'an array' }))
    await expect(createLeafletMapProvider().searchPlaces('Av. Reforma')).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('skips the request for a blank query', async () => {
    const fetchMock = mockFetch(okJson([]))
    await expect(createLeafletMapProvider().searchPlaces('   ')).resolves.toEqual({
      status: 'ok',
      results: [],
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('forwards the abort signal and reports aborted when cancelled (S5)', async () => {
    const controller = new AbortController()
    const fetchMock = mockFetch((_url, init) => {
      expect(init?.signal).toBe(controller.signal)
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    })

    const outcome = await createLeafletMapProvider().searchPlaces('Av. Reforma', controller.signal)

    expect(outcome).toEqual({ status: 'aborted' })
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal)
  })

  it('reuses the cached answer for the same query, ignoring case and spacing (S3)', async () => {
    const fetchMock = mockFetch(okJson([{ lat: '19', lon: '-99', display_name: 'Centro' }]))
    const provider = createLeafletMapProvider()

    const first = await provider.searchPlaces('Centro CDMX')
    const second = await provider.searchPlaces('  centro   cdmx ')

    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache an unavailable answer (S3, S4)', async () => {
    let calls = 0
    const fetchMock = mockFetch(() => {
      calls += 1
      if (calls === 1) return { ok: false, status: 503, json: async () => [] }
      return { ok: true, json: async () => [{ lat: '19', lon: '-99', display_name: 'Centro' }] }
    })
    const provider = createLeafletMapProvider()

    await provider.searchPlaces('Centro')
    vi.useFakeTimers()
    const retry = provider.searchPlaces('Centro')
    await vi.advanceTimersByTimeAsync(1000)

    await expect(retry).resolves.toMatchObject({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('waits until one second has passed since the previous request (S3)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch(okJson([]))
    const provider = createLeafletMapProvider()

    await provider.searchPlaces('Uno')
    const second = provider.searchPlaces('Dos')
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await second
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares the one-request-per-second budget across providers (app-wide) (S3)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch(okJson([]))

    await createLeafletMapProvider().searchPlaces('Uno')
    const other = createLeafletMapProvider().searchPlaces('Dos')
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(500)
    await other
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up waiting without a request when aborted during the wait (S5)', async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch(okJson([]))
    const provider = createLeafletMapProvider()
    await provider.searchPlaces('Uno')

    const controller = new AbortController()
    const waiting = provider.searchPlaces('Dos', controller.signal)
    controller.abort()
    await vi.advanceTimersByTimeAsync(1000)

    await expect(waiting).resolves.toEqual({ status: 'aborted' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
