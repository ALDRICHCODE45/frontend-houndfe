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
</script>

<script setup lang="ts">
/**
 * AddressMapPicker — the single reusable map primitive in the app.
 *
 * Consumes the `MapProvider` port only; it NEVER imports `leaflet` (spec
 * REQ-AMP-001). Two modes:
 *   - `write` (inside `AddressModal`): debounced geocode search + draggable pin
 *     + "Quitar pin". Geocode failures degrade silently to manual placement.
 *   - `read`  (inside `DriverStopDetail`): static marker + optional popup;
 *     renders nothing when `modelValue` is null or a tile request fails.
 *
 * The pin is always optional and NEVER gates address validation (REQ-AMP-005).
 */

import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import {
  getMapProvider,
  type CreateMapOptions,
  type MapHandle,
} from '@/core/shared/maps/map-provider'

const props = withDefaults(
  defineProps<{
    /** `write` = editable pin + geocode search; `read` = static marker. */
    mode: 'write' | 'read'
    /** Current pin, or null when the address has no coordinates. */
    modelValue: GeoPoint | null
    /** Popup content bound to the marker (read mode). */
    popupText?: string | null
    /** Debounce window for the geocode search, in ms. */
    debounceMs?: number
    /** Zoom used when a pin exists. */
    zoom?: number
  }>(),
  {
    popupText: null,
    debounceMs: 400,
    zoom: 15,
  },
)

const emit = defineEmits<{ 'update:modelValue': [GeoPoint | null] }>()

/** Mexico City — neutral fallback view when there is no pin yet. */
const FALLBACK_CENTER: GeoPoint = { lat: 19.4326, lng: -99.1332 }

const isWrite = computed(() => props.mode === 'write')
const canvas = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const isSearching = ref(false)
const tileFailed = ref(false)

// shallowRef: the handle is an opaque imperative object, never reactive data.
const handle = shallowRef<MapHandle | null>(null)

/**
 * Read mode with no pin renders nothing at all — the host shows the formatted
 * address alone (REQ-AMP-002). Write mode always shows the map so the user can
 * place a first pin. A tile failure hides the canvas in both modes without any
 * error surface (REQ-AMP-007).
 */
const showCanvas = computed(
  () => !tileFailed.value && (isWrite.value || props.modelValue !== null),
)
const showClearPin = computed(() => isWrite.value && props.modelValue !== null)

function syncMarker(point: GeoPoint | null) {
  const current = handle.value
  if (!current) return
  if (point) current.setMarker(point, { popupText: props.popupText })
  else current.clearMarker()
}

function mountMap(container: HTMLElement) {
  const options: CreateMapOptions = {
    center: props.modelValue ?? FALLBACK_CENTER,
    zoom: props.zoom,
    draggableMarker: isWrite.value,
    onMarkerDrag: (point) => emit('update:modelValue', point),
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

// ─── Debounced geocode ────────────────────────────────────────────────────────
// One request per settled typing burst; the previous in-flight request is
// aborted so a slow response can never overwrite a newer pin (REQ-AMP-003).
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let inFlight: AbortController | null = null

async function runGeocode(query: string) {
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller
  isSearching.value = true

  try {
    const point = await getMapProvider().geocode(query, controller.signal)
    if (controller.signal.aborted) return
    // Zero results / failure: keep the map interactive, surface nothing. The
    // user drags the pin manually instead (REQ-AMP-004).
    if (point) emit('update:modelValue', point)
  } catch {
    // The port contract already swallows failures; this is belt-and-braces so a
    // misbehaving provider still cannot surface a blocking error.
  } finally {
    if (inFlight === controller) {
      inFlight = null
      isSearching.value = false
    }
  }
}

watch(searchQuery, (query) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const trimmed = query.trim()
  if (!trimmed) return

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runGeocode(trimmed)
  }, props.debounceMs)
})

function handleClearPin() {
  emit('update:modelValue', null)
}

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
  inFlight?.abort()
  destroyMap()
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="isWrite" class="flex items-center gap-2">
      <UInput
        v-model="searchQuery"
        data-testid="address-map-search"
        class="flex-1"
        icon="i-lucide-search"
        placeholder="Buscar dirección…"
        :loading="isSearching"
        aria-label="Buscar dirección en el mapa"
      />
      <UButton
        v-if="showClearPin"
        data-testid="address-map-clear-pin"
        color="neutral"
        variant="subtle"
        icon="i-lucide-map-pin-off"
        @click="handleClearPin"
      >
        Quitar pin
      </UButton>
    </div>

    <div
      v-if="showCanvas"
      ref="canvas"
      data-testid="address-map-canvas"
      class="h-56 w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
      role="application"
      aria-label="Mapa de la dirección"
    />
  </div>
</template>
