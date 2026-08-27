/**
 * Default MapProvider implementation: Leaflet + OpenStreetMap tiles +
 * Nominatim forward geocoding.
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
  SetMarkerOptions,
} from './map-provider'

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; OpenStreetMap'
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

/** Shape of the single Nominatim search result field we consume. */
interface NominatimResult {
  lat?: unknown
  lon?: unknown
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

function parseFirstResult(payload: unknown): GeoPoint | null {
  if (!Array.isArray(payload)) return null
  const first = payload[0] as NominatimResult | undefined
  if (!first) return null

  const lat = Number(first.lat)
  const lng = Number(first.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return { lat, lng }
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
  // it can hide the map and keep the formatted address (spec REQ-AMP-007).
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

  const handle: MapHandle = {
    setMarker(point, markerOptions?: SetMarkerOptions) {
      if (destroyed) return
      popupText = markerOptions?.popupText ?? null

      if (!marker) {
        marker = L.marker([point.lat, point.lng], { draggable, icon }).addTo(map)
        if (draggable) {
          marker.on('dragend', () => {
            if (marker) emitDrag(toGeoPoint(marker.getLatLng()))
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
  return {
    kind: 'leaflet',

    createMap(container, options) {
      return createLeafletMapHandle(container, options)
    },

    async geocode(query, signal) {
      const trimmed = query.trim()
      if (!trimmed) return null

      const url = `${NOMINATIM_SEARCH_URL}?q=${encodeURIComponent(trimmed)}&format=json&limit=1`

      try {
        const response = await fetch(url, {
          signal,
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) return null
        return parseFirstResult(await response.json())
      } catch {
        // Zero results, abort, rate limit, and network failures all resolve to
        // `null` so the caller can fall back to manual pin placement
        // (spec REQ-AMP-004). Geocoding never throws at the port boundary.
        return null
      }
    },
  }
}
