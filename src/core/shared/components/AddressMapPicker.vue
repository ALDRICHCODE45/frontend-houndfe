<script lang="ts">
import type { GeoPoint } from '@/core/shared/maps/map-provider'

/** Loose shape of any address-ish form state carrying optional coordinates. */
export interface AddressPinSource {
  latitude?: number | null
  longitude?: number | null
}

/**
 * Map an address form state's `latitude`/`longitude` pair to the `GeoPoint` the
 * picker's v-model speaks. Extracted so the emit shape is unit-testable without
 * mounting a map (design §4.3 REFACTOR note). `0,0` is a legal pin; only
 * missing or non-finite coordinates collapse to `null`.
 */
export function pinToGeoPoint(source: AddressPinSource): GeoPoint | null {
  const lat = source.latitude
  const lng = source.longitude
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Whether an address carries a usable saved location (a finite lat/lng pair). */
export function hasSavedLocation(source: AddressPinSource): boolean {
  return pinToGeoPoint(source) !== null
}
</script>

<script setup lang="ts">
/**
 * AddressMapPicker — the single reusable map primitive in the app.
 *
 * Consumes the `MapProvider` port only; it NEVER imports `leaflet` (spec
 * REQ-AMP-001). Two modes:
 *   - `write` (inside `AddressModal`): explicit place search («Buscar» or Enter,
 *     never per keystroke) with up to 5 named results to pick from, tap-to-pin,
 *     draggable pin and «Quitar pin». A picked result is announced as
 *     approximate; zero results or an unavailable search say so and point the
 *     user to tapping the map. Any newer search, tap, drag or clear aborts the
 *     search in flight so a late answer can never move the pin.
 *   - `read`  (inside `DriverStopDetail`): static marker + optional popup;
 *     renders nothing when `modelValue` is null. Taps are ignored.
 *
 * A tile failure keeps the map and shows a short notice (both modes). Only
 * finite, in-range points are ever emitted. The pin is always optional and
 * NEVER gates address validation (REQ-AMP-005).
 */

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  getMapProvider,
  isValidGeoPoint,
  type CreateMapOptions,
  type MapHandle,
  type PlaceResult,
  type PlaceSearchOutcome,
} from '@/core/shared/maps/map-provider'

const props = withDefaults(
  defineProps<{
    /** `write` = editable pin + place search; `read` = static marker. */
    mode: 'write' | 'read'
    /** Current pin, or null when the address has no coordinates. */
    modelValue: GeoPoint | null
    /** Popup content bound to the marker (read mode). */
    popupText?: string | null
    /** Zoom used when a pin exists. */
    zoom?: number
  }>(),
  {
    popupText: null,
    zoom: 15,
  },
)

const emit = defineEmits<{ 'update:modelValue': [GeoPoint | null] }>()

/** Mexico City — neutral fallback view when there is no pin yet. */
const FALLBACK_CENTER: GeoPoint = { lat: 19.4326, lng: -99.1332 }
const MAX_RESULTS = 5

const MESSAGES = {
  approximate: 'Ubicación aproximada. Arrastra el pin o toca el mapa para ajustarla.',
  notFound: 'No encontramos esa dirección. Toca el mapa para poner el pin.',
  unavailable: 'La búsqueda no está disponible ahora. Toca el mapa para poner el pin.',
} as const

const isWrite = computed(() => props.mode === 'write')
const canvas = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const isSearching = ref(false)
const results = ref<PlaceResult[]>([])
const searchMessage = ref<string | null>(null)
const tileFailed = ref(false)

// shallowRef: the handle is an opaque imperative object, never reactive data.
const handle = shallowRef<MapHandle | null>(null)

/**
 * Read mode with no pin renders nothing at all — the host shows the formatted
 * address alone (REQ-AMP-002). Write mode always shows the map so the user can
 * place a first pin.
 */
const showCanvas = computed(() => isWrite.value || props.modelValue !== null)
const showClearPin = computed(() => isWrite.value && props.modelValue !== null)
const showPinHint = computed(
  () => isWrite.value && props.modelValue === null && !searchMessage.value,
)

function syncMarker(point: GeoPoint | null) {
  const current = handle.value
  if (!current) return
  if (point) current.setMarker(point, { popupText: props.popupText })
  else current.clearMarker()
}

function emitPoint(point: GeoPoint) {
  if (isValidGeoPoint(point)) emit('update:modelValue', point)
}

/** A manual pin (tap or drag) wins over any search still in flight. */
function placeManualPin(point: GeoPoint) {
  cancelSearch()
  emitPoint(point)
}

function mountMap(container: HTMLElement) {
  const options: CreateMapOptions = {
    center: props.modelValue ?? FALLBACK_CENTER,
    zoom: props.zoom,
    draggableMarker: isWrite.value,
    onMarkerDrag: placeManualPin,
    onMapClick: isWrite.value ? placeManualPin : undefined,
    onTileError: () => {
      tileFailed.value = true
    },
  }

  handle.value = getMapProvider().createMap(container, options)
  syncMarker(props.modelValue)
}

function destroyMap() {
  handle.value?.destroy()
  handle.value = null
}

// The canvas is v-if'd, so mount/destroy follow the element rather than the
// component lifecycle (read mode can gain/lose its canvas at runtime).
watch(canvas, (container, previous) => {
  if (previous || !container) destroyMap()
  if (container) mountMap(container)
})

watch(
  () => props.modelValue,
  (point) => syncMarker(point),
)

watch(
  () => props.popupText,
  () => syncMarker(props.modelValue),
)

// ─── Explicit place search ────────────────────────────────────────────────────
let inFlight: AbortController | null = null

/** Abort the search in flight and forget its results and messages. */
function cancelSearch() {
  inFlight?.abort()
  inFlight = null
  isSearching.value = false
  results.value = []
  searchMessage.value = null
}

async function runSearch() {
  cancelSearch()
  const query = searchQuery.value.trim()
  if (!query) return

  const controller = new AbortController()
  inFlight = controller
  isSearching.value = true

  let outcome: PlaceSearchOutcome
  try {
    outcome = await getMapProvider().searchPlaces(query, controller.signal)
  } catch {
    // The port never throws; a misbehaving provider still degrades gracefully.
    outcome = { status: 'unavailable' }
  }

  // A newer search, a manual pin or «Quitar pin» took over meanwhile.
  if (inFlight !== controller) return
  inFlight = null
  isSearching.value = false

  if (outcome.status === 'ok') {
    results.value = outcome.results
      .filter((result) => isValidGeoPoint(result.point))
      .slice(0, MAX_RESULTS)
    if (!results.value.length) searchMessage.value = MESSAGES.notFound
  } else if (outcome.status === 'unavailable') {
    searchMessage.value = MESSAGES.unavailable
  }
}

function pickResult(result: PlaceResult) {
  cancelSearch()
  if (!isValidGeoPoint(result.point)) return
  emitPoint(result.point)
  searchMessage.value = MESSAGES.approximate
}

function handleClearPin() {
  cancelSearch()
  emit('update:modelValue', null)
}

onBeforeUnmount(() => {
  inFlight?.abort()
  destroyMap()
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <template v-if="isWrite">
      <!-- items-stretch: the buttons take the input's height so the row lines up. -->
      <div class="flex flex-wrap items-stretch gap-2">
        <UInput
          v-model="searchQuery"
          data-testid="address-map-search"
          class="min-w-48 flex-1"
          icon="i-lucide-search"
          placeholder="Buscar dirección…"
          :loading="isSearching"
          aria-label="Buscar dirección en el mapa"
          @keydown.enter.prevent="runSearch"
        />
        <UButton
          type="button"
          data-testid="address-map-search-submit"
          color="neutral"
          variant="outline"
          @click="runSearch"
        >
          Buscar
        </UButton>
        <UButton
          v-if="showClearPin"
          type="button"
          data-testid="address-map-clear-pin"
          color="neutral"
          variant="subtle"
          icon="i-lucide-map-pin-off"
          @click="handleClearPin"
        >
          Quitar pin
        </UButton>
      </div>

      <ul
        v-if="results.length"
        data-testid="address-map-results"
        class="flex flex-col overflow-hidden rounded-md border border-default bg-default"
        aria-label="Resultados de la búsqueda"
      >
        <li v-for="(result, index) in results" :key="index" class="border-default not-last:border-b">
          <UButton
            type="button"
            data-testid="address-map-result"
            color="neutral"
            variant="ghost"
            icon="i-lucide-map-pin"
            block
            class="justify-start rounded-none text-left whitespace-normal"
            @click="pickResult(result)"
          >
            {{ result.label }}
          </UButton>
        </li>
      </ul>

      <p
        v-if="searchMessage"
        data-testid="address-map-search-message"
        role="status"
        class="text-sm text-muted"
      >{{ searchMessage }}</p>
      <p v-else-if="showPinHint" data-testid="address-map-hint" class="text-sm text-muted">Toca el mapa para poner el pin.</p>
    </template>

    <div
      v-if="showCanvas"
      ref="canvas"
      data-testid="address-map-canvas"
      class="h-56 w-full overflow-hidden rounded-lg border border-default"
      role="application"
      aria-label="Mapa de la dirección"
    />
    <p
      v-if="showCanvas && tileFailed"
      data-testid="address-map-tile-notice"
      role="status"
      class="flex items-center gap-1.5 text-xs text-muted"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" aria-hidden="true" />
      <span>Parte del mapa no cargó.</span>
    </p>
  </div>
</template>
