import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import AddressMapPicker, { pinToGeoPoint } from '@/core/shared/components/AddressMapPicker.vue'
import {
  resetMapProvider,
  setMapProvider,
  type CreateMapOptions,
  type GeoPoint,
  type MapHandle,
  type MapProvider,
  type PlaceSearchOutcome,
} from '@/core/shared/maps/map-provider'
import { mountWithUApp } from '@/test/mountWithUApp'

const CDMX: GeoPoint = { lat: 19.43, lng: -99.13 }

/** `Array.prototype.at` is not in the vitest tsconfig lib; keep it local. */
function lastOf<T>(items: readonly T[]): T | undefined {
  return items.length ? items[items.length - 1] : undefined
}

/** Last payload emitted for `update:modelValue`. */
function lastEmit(wrapper: { emitted: (event: string) => unknown[][] | undefined }) {
  return lastOf(wrapper.emitted('update:modelValue') ?? [])
}

/** Selector note: Nuxt UI's UInput forwards `data-testid` onto the <input>. */
const SEARCH = '[data-testid="address-map-search"]'
const SEARCH_SUBMIT = '[data-testid="address-map-search-submit"]'
const RESULT = '[data-testid="address-map-result"]'
const MESSAGE = '[data-testid="address-map-search-message"]'
const HINT = '[data-testid="address-map-hint"]'
const TILE_NOTICE = '[data-testid="address-map-tile-notice"]'
const CLEAR_PIN = '[data-testid="address-map-clear-pin"]'
const CANVAS = '[data-testid="address-map-canvas"]'

const APPROXIMATE = 'Ubicación aproximada. Arrastra el pin o toca el mapa para ajustarla.'
const NOT_FOUND = 'No encontramos esa dirección. Toca el mapa para poner el pin.'
const UNAVAILABLE = 'La búsqueda no está disponible ahora. Toca el mapa para poner el pin.'

const REFORMA = { point: { lat: 19.43, lng: -99.16 }, label: 'Paseo de la Reforma 222, Juárez, CDMX' }
const INSURGENTES = { point: { lat: 19.37, lng: -99.17 }, label: 'Insurgentes Sur 1458, Actipan, CDMX' }

/** A search answer the test releases by hand, to model a slow request. */
function deferredOutcome() {
  let release!: (outcome: PlaceSearchOutcome) => void
  const promise = new Promise<PlaceSearchOutcome>((res) => {
    release = res
  })
  return { promise, release }
}

interface FakeHandle extends MapHandle {
  marker: GeoPoint | null
  popupText: string | null
  destroyed: boolean
}

/**
 * Fake provider standing in for the vendor. The component is tested against the
 * PORT — never against Leaflet's DOM (design §4.3).
 */
function createFakeProvider() {
  const handles: FakeHandle[] = []
  const searchPlaces = vi.fn<
    (query: string, signal?: AbortSignal) => Promise<PlaceSearchOutcome>
  >(async () => ({ status: 'ok', results: [REFORMA, INSURGENTES] }))

  const provider: MapProvider = {
    kind: 'leaflet',
    createMap(_container: HTMLElement, opts: CreateMapOptions) {
      const handle: FakeHandle = {
        marker: null,
        popupText: null,
        destroyed: false,
        setMarker(point, markerOpts) {
          handle.marker = point
          handle.popupText = markerOpts?.popupText ?? null
        },
        clearMarker() {
          handle.marker = null
          handle.popupText = null
        },
        getMarker: () => handle.marker,
        getPopupText: () => handle.popupText,
        isMarkerDraggable: () => opts.draggableMarker === true,
        simulateMarkerDrag(point) {
          handle.marker = point
          opts.onMarkerDrag?.(point)
        },
        simulateMapClick(point) {
          opts.onMapClick?.(point)
        },
        simulateTileError() {
          opts.onTileError?.(new Error('tile failed'))
        },
        destroy() {
          handle.destroyed = true
        },
      }
      handles.push(handle)
      return handle
    },
    searchPlaces,
  }

  return { provider, handles, searchPlaces, last: () => lastOf(handles)! }
}

describe('AddressMapPicker', () => {
  let fake: ReturnType<typeof createFakeProvider>

  beforeEach(() => {
    vi.useFakeTimers()
    fake = createFakeProvider()
    setMapProvider(fake.provider)
  })

  afterEach(() => {
    vi.useRealTimers()
    resetMapProvider()
  })

  async function settle() {
    await vi.runAllTimersAsync()
    await flushPromises()
  }

  /**
   * Reactive v-model host so `update:modelValue` feeds the prop back — exactly
   * how `AddressModal` / `DriverStopDetail` consume the picker. `mountWithUApp`
   * returns a child wrapper (no `setProps`), so the host owns the state.
   */
  async function mountPicker(props: {
    mode: 'write' | 'read'
    modelValue: GeoPoint | null
    popupText?: string | null
  }) {
    const model = ref<GeoPoint | null>(props.modelValue)
    // The picker lives inside AddressModal's form; any accidental submit shows here.
    const onSubmit = vi.fn()
    const Host = defineComponent({
      components: { AddressMapPicker },
      setup() {
        return { model, mode: props.mode, popupText: props.popupText ?? null, onSubmit }
      },
      template: `<form @submit.prevent="onSubmit"><AddressMapPicker v-model="model" :mode="mode" :popup-text="popupText" /></form>`,
    })

    const host = mountWithUApp(Host)
    const picker = host.findComponent(AddressMapPicker)
    await settle()
    return { host, picker, model, onSubmit }
  }

  /** Type a query and press «Buscar». */
  async function search(picker: Awaited<ReturnType<typeof mountPicker>>['picker'], query: string) {
    await picker.find(SEARCH).setValue(query)
    await picker.find(SEARCH_SUBMIT).trigger('click')
    await settle()
  }

  function pressEnter(picker: Awaited<ReturnType<typeof mountPicker>>['picker']) {
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    picker.find(SEARCH).element.dispatchEvent(event)
    return event
  }

  describe('write mode', () => {
    it('renders the search input and a draggable marker at the given coords (REQ-AMP-002)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })

      expect(picker.find(SEARCH).exists()).toBe(true)
      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(fake.last().isMarkerDraggable()).toBe(true)
      expect(fake.last().getMarker()).toEqual(CDMX)
    })

    it('renders the clear-pin button labelled "Quitar pin" when a pin exists', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })

      const clear = picker.find(CLEAR_PIN)
      expect(clear.exists()).toBe(true)
      expect(clear.text()).toContain('Quitar pin')
    })

    it('hides the clear-pin button when no pin is set', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })
      expect(picker.find(CLEAR_PIN).exists()).toBe(false)
    })

    it('still renders the map in write mode with a null modelValue so the user can place a pin', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(fake.last().getMarker()).toBeNull()
    })

    it('emits update:modelValue with the dragged GeoPoint (REQ-AMP-003)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })

      fake.last().simulateMarkerDrag({ lat: 19.5, lng: -99.2 })
      await settle()

      expect(lastEmit(picker)).toEqual([{ lat: 19.5, lng: -99.2 }])
    })

    it('emits null and clears the marker on clear-pin (REQ-AMP-003)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })

      await picker.find(CLEAR_PIN).trigger('click')
      await settle()

      expect(lastEmit(picker)).toEqual([null])
      // v-model write-back removes the marker and hides the clear button.
      expect(fake.last().getMarker()).toBeNull()
      expect(picker.find(CLEAR_PIN).exists()).toBe(false)
    })

    it('sends no request while typing (S1)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      const input = picker.find(SEARCH)
      await input.setValue('Av')
      await input.setValue('Av. Ref')
      await input.setValue('Av. Reforma')
      await settle()

      expect(fake.searchPlaces).not.toHaveBeenCalled()
    })

    it('searches once when «Buscar» is pressed (S1)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      expect(picker.find(SEARCH_SUBMIT).text()).toContain('Buscar')
      await search(picker, 'Av. Reforma')

      expect(fake.searchPlaces).toHaveBeenCalledTimes(1)
      expect(fake.searchPlaces.mock.calls[0]?.[0]).toBe('Av. Reforma')
    })

    it('searches once on Enter without submitting the enclosing form (S1)', async () => {
      const { picker, onSubmit } = await mountPicker({ mode: 'write', modelValue: null })

      await picker.find(SEARCH).setValue('Av. Reforma')
      const event = pressEnter(picker)
      await settle()

      expect(event.defaultPrevented).toBe(true)
      expect(fake.searchPlaces).toHaveBeenCalledTimes(1)
      expect(fake.searchPlaces.mock.calls[0]?.[0]).toBe('Av. Reforma')
      expect(onSubmit).not.toHaveBeenCalled()
      expect(picker.find('form').exists()).toBe(false)
    })

    it('never submits the enclosing form from «Buscar» or a result (S1)', async () => {
      const { picker, onSubmit } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Av. Reforma')
      await picker.find(RESULT).trigger('click')
      await settle()

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('skips the request for a blank query', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, '   ')

      expect(fake.searchPlaces).not.toHaveBeenCalled()
      expect(picker.find(MESSAGE).exists()).toBe(false)
    })

    it('lists the results by name without moving the pin (S2)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Reforma')

      expect(picker.findAll(RESULT).map((r) => r.text())).toEqual([REFORMA.label, INSURGENTES.label])
      expect(picker.emitted('update:modelValue')).toBeUndefined()
      expect(fake.last().getMarker()).toBeNull()
    })

    it('shows at most 5 results (S2)', async () => {
      const many = Array.from({ length: 7 }, (_, i) => ({
        point: { lat: 19 + i / 100, lng: -99.1 },
        label: `Lugar ${i}`,
      }))
      fake.searchPlaces.mockResolvedValueOnce({ status: 'ok', results: many })
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Lugar')

      expect(picker.findAll(RESULT)).toHaveLength(5)
    })

    it('picking a result places the pin, clears the list and says it is approximate (S2)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Reforma')
      await picker.findAll(RESULT)[1]!.trigger('click')
      await settle()

      expect(lastEmit(picker)).toEqual([INSURGENTES.point])
      expect(fake.last().getMarker()).toEqual(INSURGENTES.point)
      expect(picker.findAll(RESULT)).toHaveLength(0)
      expect(picker.find(MESSAGE).text()).toBe(APPROXIMATE)
    })

    it('says nothing was found and keeps the map usable on zero results (S4)', async () => {
      fake.searchPlaces.mockResolvedValueOnce({ status: 'ok', results: [] })
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'asdfqwerty')

      expect(picker.find(MESSAGE).text()).toBe(NOT_FOUND)
      expect(picker.emitted('update:modelValue')).toBeUndefined()
      expect(picker.find(CANVAS).exists()).toBe(true)

      fake.last().simulateMapClick({ lat: 19.5, lng: -99.2 })
      await settle()
      expect(lastEmit(picker)).toEqual([{ lat: 19.5, lng: -99.2 }])
    })

    it('says the search is unavailable and keeps the map usable (S4)', async () => {
      fake.searchPlaces.mockResolvedValueOnce({ status: 'unavailable' })
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Av. Reforma')

      expect(picker.find(MESSAGE).text()).toBe(UNAVAILABLE)
      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(picker.emitted('update:modelValue')).toBeUndefined()
    })

    it('treats a provider that throws as unavailable (S4)', async () => {
      fake.searchPlaces.mockRejectedValueOnce(new Error('network down'))
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Av. Reforma')

      expect(picker.find(MESSAGE).text()).toBe(UNAVAILABLE)
      expect(picker.find(CANVAS).exists()).toBe(true)
    })

    it('shows nothing for an aborted search', async () => {
      fake.searchPlaces.mockResolvedValueOnce({ status: 'aborted' })
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Av. Reforma')

      expect(picker.find(MESSAGE).exists()).toBe(false)
      expect(picker.findAll(RESULT)).toHaveLength(0)
    })

    it('tapping the map places the first pin and then moves it (S5)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })
      expect(picker.find(HINT).text()).toBe('Toca el mapa para poner el pin.')

      fake.last().simulateMapClick({ lat: 19.5, lng: -99.2 })
      await settle()
      expect(lastEmit(picker)).toEqual([{ lat: 19.5, lng: -99.2 }])
      expect(fake.last().getMarker()).toEqual({ lat: 19.5, lng: -99.2 })
      expect(picker.find(HINT).exists()).toBe(false)

      fake.last().simulateMapClick({ lat: 0, lng: 0 })
      await settle()
      expect(lastEmit(picker)).toEqual([{ lat: 0, lng: 0 }])
    })

    it('a newer search discards the answer of the one still in flight (S5)', async () => {
      const first = deferredOutcome()
      fake.searchPlaces.mockImplementationOnce(() => first.promise)
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await search(picker, 'Av. Reforma')
      const firstSignal = fake.searchPlaces.mock.calls[0]?.[1]
      expect(firstSignal?.aborted).toBe(false)

      fake.searchPlaces.mockResolvedValueOnce({ status: 'ok', results: [INSURGENTES] })
      await search(picker, 'Insurgentes Sur')
      expect(firstSignal?.aborted).toBe(true)

      first.release({ status: 'ok', results: [REFORMA] })
      await settle()
      expect(picker.findAll(RESULT).map((r) => r.text())).toEqual([INSURGENTES.label])
      expect(picker.emitted('update:modelValue')).toBeUndefined()
    })

    it.each([
      ['a map tap', (picker: Awaited<ReturnType<typeof mountPicker>>['picker']) => {
        void picker
        fake.last().simulateMapClick({ lat: 19.5, lng: -99.2 })
      }],
      ['a drag', (picker: Awaited<ReturnType<typeof mountPicker>>['picker']) => {
        void picker
        fake.last().simulateMarkerDrag({ lat: 19.5, lng: -99.2 })
      }],
      ['«Quitar pin»', (picker: Awaited<ReturnType<typeof mountPicker>>['picker']) =>
        picker.find(CLEAR_PIN).trigger('click')],
    ])('%s discards the answer of a search still in flight (S5)', async (_label, act) => {
      const pending = deferredOutcome()
      fake.searchPlaces.mockImplementationOnce(() => pending.promise)
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })

      await search(picker, 'Av. Reforma')
      const signal = fake.searchPlaces.mock.calls[0]?.[1]
      await act(picker)
      await settle()
      expect(signal?.aborted).toBe(true)
      const emitsAfterAction = picker.emitted('update:modelValue')?.length ?? 0

      pending.release({ status: 'ok', results: [REFORMA] })
      await settle()
      expect(picker.findAll(RESULT)).toHaveLength(0)
      expect(picker.find(MESSAGE).exists()).toBe(false)
      expect(picker.emitted('update:modelValue')?.length ?? 0).toBe(emitsAfterAction)
    })

    it('a map tap clears the result list (S5)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })
      await search(picker, 'Reforma')
      expect(picker.findAll(RESULT)).toHaveLength(2)

      fake.last().simulateMapClick({ lat: 19.5, lng: -99.2 })
      await settle()

      expect(picker.findAll(RESULT)).toHaveLength(0)
    })

    it.each([
      ['NaN latitude', { lat: Number.NaN, lng: -99 }],
      ['infinite longitude', { lat: 19, lng: Number.POSITIVE_INFINITY }],
      ['latitude above 90', { lat: 90.5, lng: -99 }],
      ['longitude below -180', { lat: 19, lng: -180.5 }],
    ])('never emits a point with %s (S5)', async (_label, bad) => {
      fake.searchPlaces.mockResolvedValueOnce({
        status: 'ok',
        results: [{ point: bad, label: 'Lugar raro' }],
      })
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      fake.last().simulateMapClick(bad)
      fake.last().simulateMarkerDrag(bad)
      await search(picker, 'Lugar raro')
      for (const result of picker.findAll(RESULT)) await result.trigger('click')
      await settle()

      expect(picker.emitted('update:modelValue')).toBeUndefined()
    })

    it('keeps the map and shows a short notice when tiles fail (S6)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })
      expect(picker.find(TILE_NOTICE).exists()).toBe(false)

      fake.last().simulateTileError()
      await settle()

      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(fake.last().destroyed).toBe(false)
      expect(picker.find(TILE_NOTICE).text()).toBe('Parte del mapa no cargó.')
      expect(picker.find(SEARCH).exists()).toBe(true)
    })
  })

  describe('read mode', () => {
    it('renders a static marker with no search input and no clear-pin (REQ-AMP-002)', async () => {
      const { picker } = await mountPicker({ mode: 'read', modelValue: CDMX })

      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(picker.find(SEARCH).exists()).toBe(false)
      expect(picker.find(CLEAR_PIN).exists()).toBe(false)
      expect(fake.last().isMarkerDraggable()).toBe(false)
      expect(fake.last().getMarker()).toEqual(CDMX)
    })

    it('binds the popup text to the marker when popupText is provided', async () => {
      await mountPicker({ mode: 'read', modelValue: CDMX, popupText: 'Casa, Av. Reforma #123' })
      expect(fake.last().getPopupText()).toBe('Casa, Av. Reforma #123')
    })

    it('renders no map at all when modelValue is null (REQ-AMP-002)', async () => {
      const { picker } = await mountPicker({ mode: 'read', modelValue: null })

      expect(picker.find(CANVAS).exists()).toBe(false)
      expect(fake.handles).toHaveLength(0)
    })

    it('ignores taps on the map (S5)', async () => {
      const { picker } = await mountPicker({ mode: 'read', modelValue: CDMX })

      fake.last().simulateMapClick({ lat: 19.5, lng: -99.2 })
      await settle()

      expect(picker.emitted('update:modelValue')).toBeUndefined()
      expect(fake.last().getMarker()).toEqual(CDMX)
      expect(picker.find(HINT).exists()).toBe(false)
    })

    it('keeps the map and shows a short notice when tiles fail (S6)', async () => {
      const { picker } = await mountPicker({ mode: 'read', modelValue: CDMX })

      fake.last().simulateTileError()
      await settle()

      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(fake.last().destroyed).toBe(false)
      expect(picker.find(TILE_NOTICE).text()).toBe('Parte del mapa no cargó.')
    })
  })

  it('destroys the map handle when the canvas is torn down (no leaked instances)', async () => {
    const { picker, model } = await mountPicker({ mode: 'read', modelValue: CDMX })
    const handle = fake.last()
    expect(handle.destroyed).toBe(false)

    // Dropping the coords removes the canvas, which must destroy the handle.
    model.value = null
    await settle()

    expect(picker.find(CANVAS).exists()).toBe(false)
    expect(handle.destroyed).toBe(true)
  })

  it('never imports leaflet directly — the port is the only seam (REQ-AMP-001)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/core/shared/components/AddressMapPicker.vue'),
      'utf8',
    )
    expect(source).not.toMatch(/from\s+['"]leaflet['"]/)
    expect(source).not.toMatch(/import\s+['"]leaflet/)
    expect(source).toContain('@/core/shared/maps/map-provider')
  })
})

describe('pinToGeoPoint', () => {
  it('maps a numeric latitude/longitude pair to a GeoPoint', () => {
    expect(pinToGeoPoint({ latitude: 19.43, longitude: -99.13 })).toEqual(CDMX)
  })

  it('returns null when latitude is null', () => {
    expect(pinToGeoPoint({ latitude: null, longitude: -99.13 })).toBeNull()
  })

  it('returns null when longitude is null', () => {
    expect(pinToGeoPoint({ latitude: 19.43, longitude: null })).toBeNull()
  })

  it('returns null when both are undefined', () => {
    expect(pinToGeoPoint({})).toBeNull()
  })

  it('returns null for non-finite coordinates', () => {
    expect(pinToGeoPoint({ latitude: Number.NaN, longitude: -99.13 })).toBeNull()
  })

  it('accepts zero coordinates as a valid pin', () => {
    expect(pinToGeoPoint({ latitude: 0, longitude: 0 })).toEqual({ lat: 0, lng: 0 })
  })
})
