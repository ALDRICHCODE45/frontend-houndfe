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
const CLEAR_PIN = '[data-testid="address-map-clear-pin"]'
const CANVAS = '[data-testid="address-map-canvas"]'

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
  const geocode = vi.fn<(query: string, signal?: AbortSignal) => Promise<GeoPoint | null>>(
    async () => ({ lat: 20, lng: -100 }),
  )

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
    geocode,
  }

  return { provider, handles, geocode, last: () => lastOf(handles)! }
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
    const Host = defineComponent({
      components: { AddressMapPicker },
      setup() {
        return { model, mode: props.mode, popupText: props.popupText ?? null }
      },
      template: `<AddressMapPicker v-model="model" :mode="mode" :popup-text="popupText" />`,
    })

    const host = mountWithUApp(Host)
    const picker = host.findComponent(AddressMapPicker)
    await settle()
    return { host, picker, model }
  }

  describe('write mode', () => {
    it('renders the geocode input and a draggable marker at the given coords (REQ-AMP-002)', async () => {
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

    it('debounces the geocode to exactly one request per typing burst (REQ-AMP-003)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      const input = picker.find(SEARCH)
      await input.setValue('Av')
      await input.setValue('Av. Ref')
      await input.setValue('Av. Reforma')
      await settle()

      expect(fake.geocode).toHaveBeenCalledTimes(1)
      expect(fake.geocode.mock.calls[0]?.[0]).toBe('Av. Reforma')
    })

    it('emits the first geocode result so the host moves the pin (REQ-AMP-003)', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await picker.find(SEARCH).setValue('Av. Reforma')
      await settle()

      expect(lastEmit(picker)).toEqual([{ lat: 20, lng: -100 }])
      // The host's v-model write-back moves the marker through the port.
      expect(fake.last().getMarker()).toEqual({ lat: 20, lng: -100 })
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

    it('does not emit and keeps the map interactive when geocode returns null (REQ-AMP-004)', async () => {
      fake.geocode.mockResolvedValueOnce(null)
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await picker.find(SEARCH).setValue('asdfqwerty')
      await settle()

      expect(picker.emitted('update:modelValue')).toBeUndefined()
      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(picker.find('[data-testid="address-map-error"]').exists()).toBe(false)
    })

    it('does not throw or render a blocking error when geocode rejects (REQ-AMP-004)', async () => {
      fake.geocode.mockRejectedValueOnce(new Error('network down'))
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await picker.find(SEARCH).setValue('Av. Reforma')
      await settle()

      expect(picker.emitted('update:modelValue')).toBeUndefined()
      expect(picker.find(CANVAS).exists()).toBe(true)
      expect(picker.find('[data-testid="address-map-error"]').exists()).toBe(false)
    })

    it('aborts a still-in-flight geocode when a newer burst settles', async () => {
      // Keep the first request pending so a second burst can cancel it.
      let releaseFirst: ((point: GeoPoint | null) => void) | undefined
      fake.geocode.mockImplementationOnce(
        () =>
          new Promise<GeoPoint | null>((res) => {
            releaseFirst = res
          }),
      )

      const { picker } = await mountPicker({ mode: 'write', modelValue: null })
      const input = picker.find(SEARCH)

      await input.setValue('Av. Reforma')
      await vi.advanceTimersByTimeAsync(500)
      const firstSignal = fake.geocode.mock.calls[0]?.[1]
      expect(firstSignal?.aborted).toBe(false)

      await input.setValue('Insurgentes Sur')
      await vi.advanceTimersByTimeAsync(500)

      expect(fake.geocode).toHaveBeenCalledTimes(2)
      expect(firstSignal?.aborted).toBe(true)
      expect(fake.geocode.mock.calls[1]?.[1]?.aborted).toBe(false)

      // A late resolution from the aborted request must not move the pin.
      releaseFirst?.({ lat: 1, lng: 1 })
      await settle()
      expect(lastEmit(picker)).toEqual([{ lat: 20, lng: -100 }])
    })

    it('skips the geocode request for a blank query', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: null })

      await picker.find(SEARCH).setValue('   ')
      await settle()

      expect(fake.geocode).not.toHaveBeenCalled()
    })
  })

  describe('read mode', () => {
    it('renders a static marker with no geocode input and no clear-pin (REQ-AMP-002)', async () => {
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

    it('hides the map on tile failure and never surfaces a blocking error (REQ-AMP-007)', async () => {
      const { picker } = await mountPicker({ mode: 'read', modelValue: CDMX })
      expect(picker.find(CANVAS).exists()).toBe(true)

      fake.last().simulateTileError()
      await settle()

      expect(picker.find(CANVAS).exists()).toBe(false)
      expect(picker.find('[data-testid="address-map-error"]').exists()).toBe(false)
    })

    it('hides the map on tile failure in write mode too, without an error surface', async () => {
      const { picker } = await mountPicker({ mode: 'write', modelValue: CDMX })

      fake.last().simulateTileError()
      await settle()

      expect(picker.find(CANVAS).exists()).toBe(false)
      expect(picker.find('[data-testid="address-map-error"]').exists()).toBe(false)
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
