/**
 * Default MapProvider implementation: Leaflet + OpenStreetMap tiles +
 * Nominatim place search.
 *
 * Nominatim usage policy: no autocomplete (search only runs on an explicit
 * action, enforced by the caller), at most one request per second across the
 * whole app (module-level budget below), and identical queries reuse a cached
 * answer. Results are limited to Mexico and named in Spanish.
 *
 * THIS IS THE ONLY FILE IN THE CODEBASE THAT MAY IMPORT `leaflet`.
 * Everything else goes through the `MapProvider` port in `./map-provider`
 * (spec REQ-AMP-001, design §4.3). The only import back into the port is
 * type-only, so there is no runtime cycle.
 */

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {
  CreateMapOptions,
  GeoPoint,
  MapHandle,
  MapProvider,
  PlaceResult,
  PlaceSearchOutcome,
  SetMarkerOptions,
} from './map-provider'
// Value import of a pure function. The port's own import of this module is
// only reached inside `getMapProvider()`, so the cycle is safe at load time.
import { isValidGeoPoint } from './map-provider'

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; OpenStreetMap'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'
const MAX_PLACE_RESULTS = 5
const PLACE_CACHE_SIZE = 50
const MIN_REQUEST_INTERVAL_MS = 1000

/** Shape of the Nominatim search result fields we consume. */
interface NominatimResult {
  lat?: unknown
  lon?: unknown
  display_name?: unknown
}

// ─── App-wide request budget ──────────────────────────────────────────────────
// Every provider instance shares this slot so the app never exceeds one
// Nominatim request per second. Each caller reserves the next free slot
// synchronously, so concurrent searches queue instead of bursting.
let nextRequestSlotAt = 0

/** Forget the shared request budget (tests only). */
export function resetPlaceSearchBudget(): void {
  nextRequestSlotAt = 0
}

/** Wait for this caller's request slot. Resolves false when aborted first. */
function waitForRequestSlot(signal?: AbortSignal): Promise<boolean> {
  const now = Date.now()
  const slot = Math.max(now, nextRequestSlotAt)
  nextRequestSlotAt = slot + MIN_REQUEST_INTERVAL_MS
  const delay = slot - now
  if (delay <= 0) return Promise.resolve(!signal?.aborted)

  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer)
      resolve(false)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve(!signal?.aborted)
    }, delay)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Leaflet bundles its marker icons as build-time asset URLs that Vite rewrites
 * incorrectly by default. Pointing the icon paths at the packaged assets keeps
 * markers visible without a global side effect on other Leaflet consumers.
 */
function resolveDefaultIcon(): L.Icon<L.IconOptions> {
  return L.icon({
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  })
}

function toGeoPoint(latLng: L.LatLng): GeoPoint {
  return { lat: latLng.lat, lng: latLng.lng }
}

/**
 * Leaflet reports positions on copies of the world east/west of the original,
 * so bring the longitude back into ±180. In-range points are returned as they
 * are because `wrap()` adds float noise even when nothing needs wrapping.
 */
function toWrappedGeoPoint(latLng: L.LatLng): GeoPoint {
  return toGeoPoint(Math.abs(latLng.lng) <= 180 ? latLng : latLng.wrap())
}

/** Collapse a query so trivially different spellings share one cache entry. */
function normalizeQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ')
}

/** Named, in-range results only; null when the payload is not a result list. */
function parsePlaceResults(payload: unknown): PlaceResult[] | null {
  if (!Array.isArray(payload)) return null

  const results: PlaceResult[] = []
  for (const item of payload as NominatimResult[]) {
    if (results.length >= MAX_PLACE_RESULTS) break
    if (!item || typeof item.display_name !== 'string') continue
    const label = item.display_name.trim()
    // Number('') is 0, so blank coordinates must be rejected before converting.
    if (!label || item.lat === '' || item.lon === '') continue
    const point = { lat: Number(item.lat), lng: Number(item.lon) }
    if (!isValidGeoPoint(point)) continue
    results.push({ point, label })
  }
  return results
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function createLeafletMapHandle(container: HTMLElement, options: CreateMapOptions): MapHandle {
  const map = L.map(container, {
    center: [options.center.lat, options.center.lng],
    zoom: options.zoom,
    // Scroll-wheel zoom hijacks page scrolling inside a form/slideover; the
    // zoom control and pinch gestures remain available.
    scrollWheelZoom: false,
    attributionControl: true,
  })

  const tileLayer = L.tileLayer(OSM_TILE_URL, {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  })

  // Tile failures are ALWAYS swallowed here. The consumer only gets a hook so
  // it can tell the user that part of the map did not load; the map stays.
  const handleTileError = (error?: unknown) => {
    try {
      options.onTileError?.(error)
    } catch {
      // A faulty consumer hook must not break the map either.
    }
  }
  tileLayer.on('tileerror', (event) => handleTileError(event))
  tileLayer.addTo(map)

  const icon = resolveDefaultIcon()
  const draggable = options.draggableMarker === true

  let marker: L.Marker | null = null
  let popupText: string | null = null
  let destroyed = false

  const emitDrag = (point: GeoPoint) => {
    try {
      options.onMarkerDrag?.(point)
    } catch {
      // Never let a consumer handler break the vendor event loop.
    }
  }

  const emitClick = (latLng: L.LatLng) => {
    try {
      options.onMapClick?.(toWrappedGeoPoint(latLng))
    } catch {
      // Never let a consumer handler break the vendor event loop.
    }
  }
  map.on('click', (event: L.LeafletMouseEvent) => emitClick(event.latlng))

  const handle: MapHandle = {
    setMarker(point, markerOptions?: SetMarkerOptions) {
      if (destroyed) return
      popupText = markerOptions?.popupText ?? null

      if (!marker) {
        marker = L.marker([point.lat, point.lng], { draggable, icon }).addTo(map)
        if (draggable) {
          marker.on('dragend', () => {
            if (marker) emitDrag(toWrappedGeoPoint(marker.getLatLng()))
          })
        }
      } else {
        marker.setLatLng([point.lat, point.lng])
      }

      if (popupText) marker.bindPopup(popupText)
      else marker.unbindPopup()

      map.setView([point.lat, point.lng], map.getZoom())
    },

    clearMarker() {
      if (!marker) return
      marker.remove()
      marker = null
      popupText = null
    },

    getMarker() {
      return marker ? toGeoPoint(marker.getLatLng()) : null
    },

    getPopupText() {
      return popupText
    },

    isMarkerDraggable() {
      return marker ? draggable : false
    },

    simulateMarkerDrag(point) {
      if (marker) marker.setLatLng([point.lat, point.lng])
      emitDrag(point)
    },

    simulateMapClick(point) {
      emitClick(L.latLng(point.lat, point.lng))
    },

    simulateTileError(error?: unknown) {
      handleTileError(error)
    },

    destroy() {
      if (destroyed) return
      destroyed = true
      marker = null
      popupText = null
      try {
        map.remove()
      } catch {
        // jsdom teardown ordering can already have detached the container.
      }
    },
  }

  return handle
}

/** Build a fresh Leaflet-backed provider. */
export function createLeafletMapProvider(): MapProvider {
  // Only `ok` answers are cached; insertion order makes the oldest entry the
  // first key, so evicting it keeps the cache bounded.
  const cache = new Map<string, PlaceResult[]>()

  return {
    kind: 'leaflet',

    createMap(container, options) {
      return createLeafletMapHandle(container, options)
    },

    async searchPlaces(query, signal): Promise<PlaceSearchOutcome> {
      const normalized = normalizeQuery(query)
      if (!normalized) return { status: 'ok', results: [] }
      if (signal?.aborted) return { status: 'aborted' }

      const cacheKey = normalized.toLowerCase()
      const cached = cache.get(cacheKey)
      if (cached) return { status: 'ok', results: cached }

      if (!(await waitForRequestSlot(signal))) return { status: 'aborted' }

      const params = new URLSearchParams({
        q: normalized,
        format: 'json',
        limit: String(MAX_PLACE_RESULTS),
        countrycodes: 'mx',
        'accept-language': 'es',
      })

      try {
        const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return { status: 'unavailable' }
        const results = parsePlaceResults(await response.json())
        if (!results) return { status: 'unavailable' }

        if (cache.size >= PLACE_CACHE_SIZE) {
          const oldest = cache.keys().next().value
          if (oldest !== undefined) cache.delete(oldest)
        }
        cache.set(cacheKey, results)
        return { status: 'ok', results }
      } catch (error) {
        // Search never throws at the port boundary, so the caller can always
        // fall back to placing the pin on the map.
        if (signal?.aborted || isAbortError(error)) return { status: 'aborted' }
        return { status: 'unavailable' }
      }
    },
  }
}
