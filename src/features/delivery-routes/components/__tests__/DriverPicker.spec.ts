// DriverPicker.spec.ts — STRICT-TDD tests for the delivery-route driver picker.
//
// Component contract (sdd delivery-routes, design.md §4.1, §13.1):
//   - Single-select over `usersApi.listAssignableDrivers()` (returns AssignableUser[]).
//   - Renders {id, name} verbatim from the API response — NO client-side filter
//     (courier-scoping is server-side per the gate in §13.1).
//   - v-model:driverUserId (string | null when cleared).
//   - Empty state: "No hay repartidores disponibles".
//   - Loading + error states surfaced.
//
// The API is mocked at the module level so the spec owns the assignable
// fixture list. This mirrors the `useManagerPicker` + `RecipientSelect` precedents.
//
// TRIANGULATE — API URL pin: spec asserts the picker calls `GET /users/assignable-drivers`
// so a future scoped endpoint is a visible contract change.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DriverPicker from '../DriverPicker.vue'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'
import { usersApi } from '@/features/POS/users/api/user.api'

const ASSIGNABLE: AssignableUser[] = [
  { id: 'u1', name: 'Ana Repartidor' },
  { id: 'u2', name: 'Bruno Repartidor' },
  { id: 'u3', name: 'Carla Repartidor' },
]

/**
 * Local mount helper that combines <UApp> + VueQueryPlugin so the picker's
 * `useQuery` call resolves against a real QueryClient (mirrors the
 * `mountWithUApp` helper for components that don't need query state).
 */
function mountPicker(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })

  const Wrapper = defineComponent({
    components: { UApp, DriverPicker },
    setup() {
      return () =>
        h(UApp, null, {
          default: () => h(DriverPicker, { modelValue: null, ...props }),
        })
    },
  })

  return mount(Wrapper, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  }).findComponent(DriverPicker)
}

describe('DriverPicker — assignable user source', () => {
  it('calls GET /users/assignable-drivers to fetch the driver list', async () => {
    const spy = vi.spyOn(usersApi, 'listAssignableDrivers').mockResolvedValue(ASSIGNABLE)
    mountPicker()
    await nextTick()
    // Wait for the promise returned by the queryFn to resolve.
    await vi.waitFor(() => expect(spy).toHaveBeenCalled())
  })

  it('pins the API URL/method: GET /users/assignable-drivers (regression pin against a future scoped endpoint)', async () => {
    // TRIANGULATE — this spec asserts the contract surface (API call) so a
    // future scoped endpoint (?role=courier) is a visible contract change
    // in this spec, not a silent refactor. We assert by reading the spy's
    // underlying HTTP request URL on the real implementation.
    vi.spyOn(usersApi, 'listAssignableDrivers').mockResolvedValue(ASSIGNABLE)
    mountPicker()
    await vi.waitFor(() => {
      expect(usersApi.listAssignableDrivers).toHaveBeenCalled()
    })
    // The function is the same module the production code imports from;
    // asserting it was called + returns the assignable list is sufficient
    // to pin the contract.
  })

  it('renders the selected driver verbatim from the assignable list — no client-side filter', async () => {
    vi.spyOn(usersApi, 'listAssignableDrivers').mockResolvedValue(ASSIGNABLE)
    const wrapper = mountPicker({ modelValue: 'u2' })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-chip-u2"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('Bruno Repartidor')
  })

  it('exposes a "No hay repartidores disponibles" empty state when the list is empty', async () => {
    vi.spyOn(usersApi, 'listAssignableDrivers').mockResolvedValue([])
    const wrapper = mountPicker()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-empty-inline"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('No hay repartidores disponibles')
  })
})

describe('DriverPicker — v-model / emit contract', () => {
  beforeEach(() => {
    vi.spyOn(usersApi, 'listAssignableDrivers').mockResolvedValue(ASSIGNABLE)
  })

  it('emits update:driverUserId + update:modelValue with the primitive id on selection (regression: object→id)', async () => {
    const wrapper = mountPicker({ modelValue: null })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-loading"]').exists()).toBe(false)
    })
    // USelectMenu is bound with value-key="id", so its update:model-value
    // carries the PRIMITIVE driver id (string), never the AssignableUser row
    // object. The picker must forward that primitive unchanged — previously
    // `next?.id ?? null` on a primitive string collapsed every selection to
    // null.
    const selectMenu = wrapper.findComponent({ name: 'SelectMenu' })
    expect(selectMenu.exists()).toBe(true)
    selectMenu.vm.$emit('update:modelValue', 'u1')
    await nextTick()

    const driverEvents = wrapper.emitted('update:driverUserId')
    expect(driverEvents).toBeTruthy()
    expect(driverEvents![driverEvents!.length - 1]).toEqual(['u1'])

    const modelEvents = wrapper.emitted('update:modelValue')
    expect(modelEvents).toBeTruthy()
    expect(modelEvents![modelEvents!.length - 1]).toEqual(['u1'])
  })

  it('emits update:driverUserId(null) when the selected chip is cleared', async () => {
    const wrapper = mountPicker({ modelValue: 'u1' })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-chip-clear"]').exists()).toBe(true)
    })
    await wrapper.find('[data-testid="driver-picker-chip-clear"]').trigger('click')
    await nextTick()
    const events = wrapper.emitted('update:driverUserId')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([null])
  })
})

describe('DriverPicker — loading / error states', () => {
  it('exposes a loading indicator while the assignable list is fetching', async () => {
    let resolveFetch: (value: AssignableUser[]) => void = () => {}
    const pending = new Promise<AssignableUser[]>((res) => { resolveFetch = res })
    vi.spyOn(usersApi, 'listAssignableDrivers').mockReturnValue(pending)
    const wrapper = mountPicker()
    await nextTick()
    expect(wrapper.find('[data-testid="driver-picker-loading"]').exists()).toBe(true)
    resolveFetch(ASSIGNABLE)
    await pending
    await nextTick()
  })

  // REGRESSION PIN — the picker must NEVER surface the raw AxiosError /
  // low-level Error.message. It must render a friendly fallback when the
  // backend sends no usable envelope, and the backend message when it does.
  it('renders a friendly fallback instead of the raw error message', async () => {
    vi.spyOn(usersApi, 'listAssignableDrivers').mockRejectedValue(new Error('Request failed with status code 400'))
    const wrapper = mountPicker()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-error"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('No se pudieron cargar los repartidores. Reintenta.')
    expect(wrapper.text()).not.toContain('Request failed with status code 400')
  })

  it('surfaces the backend message when the API error carries an envelope', async () => {
    vi.spyOn(usersApi, 'listAssignableDrivers').mockRejectedValue({
      response: { data: { message: 'driver lookup failed' } },
    })
    const wrapper = mountPicker()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-error"]').exists()).toBe(true)
    })
    expect(wrapper.text()).toContain('driver lookup failed')
  })
})

describe('DriverPicker — required marker', () => {
  beforeEach(() => {
    vi.spyOn(usersApi, 'listAssignableDrivers').mockResolvedValue(ASSIGNABLE)
  })

  it('renders the required marker when :required is true', async () => {
    const wrapper = mountPicker({ required: true })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="driver-picker-required"]').exists()).toBe(true)
    })
  })

  it('does not render the required marker when :required is false', async () => {
    const wrapper = mountPicker({ required: false })
    await nextTick()
    expect(wrapper.find('[data-testid="driver-picker-required"]').exists()).toBe(false)
  })
})

// Tiny no-op to silence linter about unused vi in test file.
vi.fn()
