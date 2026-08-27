/**
 * MapProvider port — the ONE vendor-migration seam for maps.
 *
 * UI code (AddressMapPicker, and by extension AddressModal / DriverStopDetail)
 * imports this module only. The concrete Leaflet + OpenStreetMap + Nominatim
 * implementation lives in `leaflet-map-provider.ts`, which is the only file in
 * the codebase allowed to `import 'leaflet'`. Swapping to Mapbox/Google means
 * writing one new module and changing one factory line — no consumer edits.
 *
 * Design refs: §4.3 (component split), §4.5 (why core/shared), spec REQ-AMP-001.
 */

import { createLeafletMapProvider } from './leaflet-map-provider'

/** A geographic point in WGS84 degrees. */
export interface GeoPoint {
  lat: number
  lng: number
}

/** Options accepted by `MapProvider.createMap`. */
export interface CreateMapOptions {
  /** Initial map center. Also used as the fallback view when no marker is set. */
  center: GeoPoint
  /** Initial zoom level. */
  zoom: number
  /** When true the marker can be dragged by the user (write mode). */
  draggableMarker?: boolean
  /** Called with the new position after the user finishes dragging the marker. */
  onMarkerDrag?: (point: GeoPoint) => void
  /**
   * Called when a tile request fails. The provider ALWAYS swallows the error
   * itself; this hook only lets the consumer degrade gracefully (hide the map
   * and keep the formatted address text — spec REQ-AMP-007).
   */
  onTileError?: (error: unknown) => void
}

/** Options accepted by `MapHandle.setMarker`. */
export interface SetMarkerOptions {
  /** Popup content bound to the marker (read mode). */
  popupText?: string | null
}

/**
 * Imperative handle over a mounted map instance. Deliberately tiny: only the
 * operations `AddressMapPicker` needs, so alternate providers stay cheap.
 *
 * `simulateMarkerDrag` / `simulateTileError` are part of the port on purpose:
 * both events originate inside the vendor SDK and are unreachable in jsdom, so
 * the port owns a deterministic way to raise them. Tests use them to exercise
 * the CONSUMER contract without asserting anything about tile rendering.
 */
export interface MapHandle {
  /** Place (or move) the single marker. */
  setMarker: (point: GeoPoint, options?: SetMarkerOptions) => void
  /** Remove the marker, if any. */
  clearMarker: () => void
  /** Current marker position, or null when no marker is placed. */
  getMarker: () => GeoPoint | null
  /** Popup text currently bound to the marker, or null. */
  getPopupText: () => string | null
  /** Whether the current marker is user-draggable. */
  isMarkerDraggable: () => boolean
  /** Raise the vendor's marker-dragend event with the given position. */
  simulateMarkerDrag: (point: GeoPoint) => void
  /** Raise the vendor's tile-error event. Never throws. */
  simulateTileError: (error?: unknown) => void
  /** Tear the map down. Idempotent. */
  destroy: () => void
}

/** The map vendor port. */
export interface MapProvider {
  /** Vendor discriminator. Widen this union when a second vendor lands. */
  kind: 'leaflet'
  /** Mount a map into `container` and return an imperative handle. */
  createMap: (container: HTMLElement, options: CreateMapOptions) => MapHandle
  /**
   * Forward-geocode a free-text query. Resolves the first result, or `null`
   * for zero results / errors / abort — geocoding NEVER throws at the port
   * boundary so the caller can always fall back to manual pin placement
   * (spec REQ-AMP-004).
   */
  geocode: (query: string, signal?: AbortSignal) => Promise<GeoPoint | null>
}

let activeProvider: MapProvider | null = null

/**
 * Resolve the active provider, lazily creating the default Leaflet one on first
 * use. Lazy so a consumer that never renders a map never constructs a provider,
 * and so tests can swap the vendor before the first resolution.
 */
export function getMapProvider(): MapProvider {
  if (!activeProvider) {
    activeProvider = createLeafletMapProvider()
  }
  return activeProvider
}

/** Override the active provider (vendor swap / tests). */
export function setMapProvider(provider: MapProvider): void {
  activeProvider = provider
}

/** Drop the override so the next `getMapProvider()` rebuilds the default. */
export function resetMapProvider(): void {
  activeProvider = null
}
