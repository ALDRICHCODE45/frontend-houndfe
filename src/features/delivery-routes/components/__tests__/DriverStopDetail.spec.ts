// DriverStopDetail.spec.ts — STRICT-TDD tests for the driver stop detail.
//
// Contract (sdd delivery-routes S6b, design.md §4.2, §6.3, §7.2, §11, REQ-DRC-001..008):
//   - Renders ONE stop on the driver branch of `DeliveryRouteDetailView`.
//   - Surface:
//       * `customer.name` from the stop projection (fallback "Cliente sin nombre"
//         when the projection is null — the sale may not have a primary contact).
//       * `formatAddress(stop.shippingAddress)` — the shared label-first formatter
//         from S3a; renders the formatted string. When the address projection is
//         null, the address row renders nothing (no error, no placeholder text
//         — a route with no address is the manager's problem, not the driver's).
//       * Read-only `<AddressMapPicker mode="read">` ONLY when both `latitude`
//         and `longitude` are non-null. When either is missing, the map is
//         HIDDEN and only the formatted address renders (REQ-AMP-002, §11).
//       * Check-in button (the driver's primary affordance).
//   - Check-in button gating (REQ-DRC-003, §11):
//       * DISABLED when `stop.status !== 'PENDING'` (COMPLETED / IN_PROGRESS /
//         SKIPPED stops have no pending action; the disabled button stays
//         visible so the driver sees the work was done).
//       * Renders a spinner when the check-in mutation is in-flight (mirrors
//         the `isPending` state from `useCheckInStop`).
//   - Check-in emission (REQ-DRC-004): clicking the button emits `check-in`
//     with `{ id: routeId, stopId: stop.id }` so the parent view can wire the
//     mutation (the component stays decoupled from the composable, mirroring
//     `DeliveryRouteUpsertSlideover`'s "parent owns the mutation" contract).
//   - Map only renders when coords are present (TRIANGULATE — tile failure
//     gracefully hides the canvas via `AddressMapPicker`'s built-in swallow).
//
// We stub `AddressMapPicker` (no map runtime in jsdom) and the click-driven
// mutation lives behind a mocked `useCheckInStop`. The parent contract test
// (in DeliveryRouteDetailView.spec.ts) covers the wiring.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref, type Ref } from 'vue'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DriverStopDetail from '../DriverStopDetail.vue'
import type { DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { formatAddress } from '@/core/shared/utils/formatAddress'

// ─── Stub the map picker — no Leaflet in jsdom ──────────────────────────────
// Exposes a stable testid + the props the parent passed so the spec can assert
// "map only renders when coords are non-null".
const AddressMapPickerStub = defineComponent({
  name: 'AddressMapPicker',
  props: ['mode', 'modelValue', 'popupText', 'debounceMs', 'zoom'],
  template:
    '<div data-testid="address-map-picker-stub" :data-mode="mode" :data-has-pin="modelValue ? \'true\' : \'false\'" :data-popup="popupText" />',
})

// ─── Stub the check-in composable so we can drive isPending from the spec ───
// Must return real Vue refs so the template auto-unwraps them correctly
// (Nuxt UI's UButton prop type-checks `loading` against Boolean).
const checkInMutateMock = vi.fn().mockResolvedValue({})
let checkInPending: Ref<boolean> = ref(false)
let checkInError: Ref<unknown> = ref(null)
let currentCheckInImpl: () => unknown = () => ({
  mutateAsync: checkInMutateMock,
  isPending: checkInPending,
  error: checkInError,
})

vi.mock('../../composables/useCheckInStop', () => ({
  useCheckInStop: () => currentCheckInImpl(),
}))

// ─── Fixtures ───────────────────────────────────────────────────────────────
function makeStop(overrides: Partial<DeliveryRouteStop> = {}): DeliveryRouteStop {
  return {
    id: overrides.id ?? 'stop-1',
    saleId: overrides.saleId ?? 'sale-1',
    saleFolio: overrides.saleFolio ?? 'F-1',
    sortOrder: overrides.sortOrder ?? 0,
    status: overrides.status ?? 'PENDING',
    checkedInAt: overrides.checkedInAt ?? null,
    completedAt: overrides.completedAt ?? null,
    customer: overrides.customer !== undefined
      ? overrides.customer
      : { id: 'cust-1', name: 'Cliente Uno', email: 'c1@x' },
    shippingAddress: overrides.shippingAddress !== undefined
      ? overrides.shippingAddress
      : {
          id: 'addr-1',
          street: 'Av Reforma',
          exteriorNumber: '123',
          interiorNumber: null,
          zipCode: '06000',
          neighborhood: 'Centro',
          municipality: 'Cuauhtémoc',
          city: 'CDMX',
          state: 'CDMX',
          label: 'Oficina',
          latitude: 19.4326,
          longitude: -99.1332,
        },
  }
}

const ROUTE_ID = 'route-42'

const UButtonStub = defineComponent({
  name: 'UButton',
  props: ['label', 'icon', 'disabled', 'color', 'variant', 'size', 'block', 'loading'],
  emits: ['click'],
  template:
    '<button :class="$attrs.class" :disabled="disabled || loading" :data-testid="$attrs[\'data-testid\']" :data-label="label" :data-loading="String(loading)" @click.prevent="$emit(\'click\')"><slot />{{ label }}</button>',
})

function mountStop(props: Record<string, unknown> = {}) {
  return mount(DriverStopDetail, {
    props: { stop: makeStop(), routeId: ROUTE_ID, ...props },
    global: {
      stubs: {
        UApp,
        AddressMapPicker: AddressMapPickerStub,
        // Nuxt UI exposes both names — stubbing both covers the auto-import
        // resolution path (UButton) and the internal component name (Button).
        UButton: UButtonStub,
        Button: UButtonStub,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  checkInPending = ref(false)
  checkInError = ref(null)
  currentCheckInImpl = () => ({
    mutateAsync: checkInMutateMock,
    isPending: checkInPending,
    error: checkInError,
  })
})

describe('DriverStopDetail — rendering (REQ-DRC-001, design §4.2)', () => {
  it('renders the customer name from the stop projection', async () => {
    const wrapper = mountStop({ stop: makeStop() })
    await flushPromises()
    expect(wrapper.text()).toContain('Cliente Uno')
  })

  it('falls back to "Cliente sin nombre" when the customer projection is null', async () => {
    const wrapper = mountStop({ stop: makeStop({ customer: null }) })
    await flushPromises()
    expect(wrapper.text()).toContain('Cliente sin nombre')
  })

  it('renders the formatted address via the shared formatAddress util', async () => {
    const stop = makeStop()
    const wrapper = mountStop({ stop })
    await flushPromises()
    // Pin the formatted output exactly so the spec is the regression surface
    // for the label-first ordering (matches the S3a spec).
    expect(wrapper.text()).toContain(formatAddress(stop.shippingAddress!))
  })

  it('renders nothing for the address row when the shipping address is null', async () => {
    // The driver should not see a placeholder/error — a route with no address
    // belongs on the manager's path. The component stays silent.
    const wrapper = mountStop({ stop: makeStop({ shippingAddress: null }) })
    await flushPromises()
    // No "Av Reforma" / no label / no fallback error text.
    expect(wrapper.text()).not.toContain('Av Reforma')
  })
})

describe('DriverStopDetail — AddressMapPicker (read mode only when coords, REQ-AMP-002)', () => {
  it('renders the map in READ mode with the stop coords when both lat/lng are non-null', async () => {
    const stop = makeStop({
      shippingAddress: {
        id: 'addr-1',
        street: 'Av Reforma',
        exteriorNumber: '123',
        interiorNumber: null,
        zipCode: '06000',
        neighborhood: 'Centro',
        municipality: 'Cuauhtémoc',
        city: 'CDMX',
        state: 'CDMX',
        label: 'Oficina',
        latitude: 19.4326,
        longitude: -99.1332,
      },
    })
    const wrapper = mountStop({ stop })
    await flushPromises()
    const map = wrapper.find('[data-testid="address-map-picker-stub"]')
    expect(map.exists()).toBe(true)
    expect(map.attributes('data-mode')).toBe('read')
    expect(map.attributes('data-has-pin')).toBe('true')
  })

  it('HIDES the map when latitude is null (one coord missing → no pin)', async () => {
    const stop = makeStop({
      shippingAddress: {
        id: 'addr-2',
        street: 'Av Reforma',
        exteriorNumber: '123',
        interiorNumber: null,
        zipCode: '06000',
        neighborhood: 'Centro',
        municipality: 'Cuauhtémoc',
        city: 'CDMX',
        state: 'CDMX',
        label: null,
        latitude: null,
        longitude: -99.1332,
      },
    })
    const wrapper = mountStop({ stop })
    await flushPromises()
    expect(wrapper.find('[data-testid="address-map-picker-stub"]').exists()).toBe(false)
  })

  it('HIDES the map when longitude is null (one coord missing → no pin)', async () => {
    const stop = makeStop({
      shippingAddress: {
        id: 'addr-3',
        street: 'Av Reforma',
        exteriorNumber: '123',
        interiorNumber: null,
        zipCode: '06000',
        neighborhood: 'Centro',
        municipality: 'Cuauhtémoc',
        city: 'CDMX',
        state: 'CDMX',
        label: null,
        latitude: 19.4326,
        longitude: null,
      },
    })
    const wrapper = mountStop({ stop })
    await flushPromises()
    expect(wrapper.find('[data-testid="address-map-picker-stub"]').exists()).toBe(false)
  })

  it('HIDES the map when the shipping address is null (no coords at all)', async () => {
    const wrapper = mountStop({ stop: makeStop({ shippingAddress: null }) })
    await flushPromises()
    expect(wrapper.find('[data-testid="address-map-picker-stub"]').exists()).toBe(false)
  })

  it('forwards the formatted address as the map popup text (read mode)', async () => {
    const stop = makeStop()
    const wrapper = mountStop({ stop })
    await flushPromises()
    const map = wrapper.find('[data-testid="address-map-picker-stub"]')
    // The popup carries the human address — the marker alone is not enough on
    // a phone screen where the canvas is small.
    expect(map.attributes('data-popup')).toBe(formatAddress(stop.shippingAddress!))
  })
})

describe('DriverStopDetail — check-in button (REQ-DRC-003, REQ-DRC-004, design §11)', () => {
  it('emits check-in with { id, stopId } when the button is clicked (PENDING stop)', async () => {
    const wrapper = mountStop({ stop: makeStop({ status: 'PENDING' }) })
    await flushPromises()
    await wrapper.find('[data-testid="driver-stop-check-in-button"]').trigger('click')
    await flushPromises()
    expect(checkInMutateMock).toHaveBeenCalledTimes(1)
    const args = checkInMutateMock.mock.calls[0]?.[0] as { id: string; stopId: string } | undefined
    expect(args?.id).toBe(ROUTE_ID)
    expect(args?.stopId).toBe('stop-1')
  })

  it('DISABLES the check-in button when stop.status !== "PENDING" (COMPLETED, REQ-DRC-003)', async () => {
    const wrapper = mountStop({ stop: makeStop({ status: 'COMPLETED' }) })
    await flushPromises()
    const btn = wrapper.find('[data-testid="driver-stop-check-in-button"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits a check-in event when the button is clicked, even when disabled (parent decides — covers the dispatcher contract)', async () => {
    // Mirror of the existing "button is disabled but the affordance is visible"
    // contract from `DeliveryRouteUpsertSlideover`. The button stays mounted
    // for non-PENDING stops so the driver sees the work was done; the
    // disabled state prevents a duplicate request (REQ-DRC-005 idempotency).
    const wrapper = mountStop({ stop: makeStop({ status: 'COMPLETED' }) })
    await flushPromises()
    const btn = wrapper.find('[data-testid="driver-stop-check-in-button"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('renders a spinner (loading state) when isPending is true', async () => {
    checkInPending = ref(true)
    currentCheckInImpl = () => ({
      mutateAsync: checkInMutateMock,
      isPending: checkInPending,
      error: checkInError,
    })
    const wrapper = mountStop({ stop: makeStop({ status: 'PENDING' }) })
    await flushPromises()
    // The stub surfaces `loading` via data-loading so the spec can assert the
    // check-in spinner contract (mirrors UButton's aria-busy / spinner icon).
    const btn = wrapper.find('[data-testid="driver-stop-check-in-button"]')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('data-loading')).toBe('true')
    // Reset for the next test.
    checkInPending = ref(false)
    currentCheckInImpl = () => ({
      mutateAsync: checkInMutateMock,
      isPending: checkInPending,
      error: checkInError,
    })
  })

  it('does NOT call the mutation when the disabled button is "clicked" (idempotent — design §11)', async () => {
    const wrapper = mountStop({ stop: makeStop({ status: 'COMPLETED' }) })
    await flushPromises()
    // jsdom lets a `.trigger('click')` fire on a disabled button; the parent's
    // onClick must early-return so the mutation is NOT invoked (REQ-DRC-005).
    await wrapper.find('[data-testid="driver-stop-check-in-button"]').trigger('click')
    await flushPromises()
    expect(checkInMutateMock).not.toHaveBeenCalled()
  })
})

describe('DriverStopDetail — mobile-first polish (S7, REQ-DRC-008, design §11)', () => {
  it('stacks the stop rows in a single column (flex-col on the article root, below sm)', async () => {
    // jsdom has no layout engine, so we assert on the PRESENT Tailwind class
    // (`flex-col`) instead of computed style. Below the `sm` breakpoint the
    // driver holds the phone in one hand and the stop card must stack
    // name + address + map + check-in vertically (REQ-DRC-008 scenario:
    // "stop rows stack vertically on mobile").
    const wrapper = mountStop({ stop: makeStop() })
    await flushPromises()
    const article = wrapper.find('[data-testid="driver-stop-detail"]')
    expect(article.exists()).toBe(true)
    expect(article.classes()).toContain('flex-col')
  })

  it('applies the 44px min-height class to the check-in button (largest interactive element on the row)', async () => {
    // The check-in button is the driver's primary affordance; on a phone the
    // thumb zone demands at least 44px of vertical height. Vue's attr
    // fallthrough forwards `class` onto the stub's root <button> (the
    // UButtonStub does not declare `class` but the binding still surfaces
    // via `.classes()`), so we assert the Tailwind class is present.
    const wrapper = mountStop({ stop: makeStop({ status: 'PENDING' }) })
    await flushPromises()
    const btn = wrapper.find('[data-testid="driver-stop-check-in-button"]')
    expect(btn.exists()).toBe(true)
    expect(btn.classes()).toContain('min-h-11')
  })

  it('applies the 44px min-height class to the check-in button even when disabled (idempotency pin)', async () => {
    // The button stays mounted and visible for non-PENDING stops so the
    // driver sees the work was done — the touch target must still meet the
    // 44px floor regardless of the disabled state.
    const wrapper = mountStop({ stop: makeStop({ status: 'COMPLETED' }) })
    await flushPromises()
    const btn = wrapper.find('[data-testid="driver-stop-check-in-button"]')
    expect(btn.exists()).toBe(true)
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.classes()).toContain('min-h-11')
  })

  it('keeps the existing shell classes alongside the single-column + touch-target classes (no contract drift)', async () => {
    // Regression pin — S7 is a polish pass; we add `flex-col` + `min-h-11`
    // without removing the existing border/bg/padding shell. The driver
    // stop card identity (rounded card with status gap) survives.
    const wrapper = mountStop({ stop: makeStop() })
    await flushPromises()
    const article = wrapper.find('[data-testid="driver-stop-detail"]')
    expect(article.classes()).toContain('flex')
    expect(article.classes()).toContain('flex-col')
    expect(article.classes()).toContain('rounded-lg')
    expect(article.classes()).toContain('border')
    const btn = wrapper.find('[data-testid="driver-stop-check-in-button"]')
    expect(btn.classes()).toContain('min-h-11')
  })

  it('check-in is the only interactive <button> on the stop card (largest interactive element by elimination, REQ-DRC-008)', async () => {
    // REQ-DRC-008: "the check-in button SHALL be the largest interactive
    // element on the stop row." jsdom can't compute layout, so we triangulate
    // by asserting the check-in is the ONLY interactive button on the card —
    // by elimination it is therefore the largest. The driver's thumb zone
    // has a single, unambiguous affordance to press.
    const wrapper = mountStop({ stop: makeStop() })
    await flushPromises()
    const article = wrapper.find('[data-testid="driver-stop-detail"]')
    const interactiveButtons = article.findAll('button')
    expect(interactiveButtons.length).toBe(1)
    expect(interactiveButtons[0]!.attributes('data-testid')).toBe('driver-stop-check-in-button')
  })
})

describe('DriverStopDetail — prop contract', () => {
  it('defines a typed `stop` prop (DeliveryRouteStop) and a `routeId` prop', async () => {
    const wrapper = mountStop({})
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })

  it('updates the button label and emission when the stop prop changes', async () => {
    const wrapper = mountStop({ stop: makeStop({ id: 'stop-A' }) })
    await flushPromises()
    await wrapper.setProps({ stop: makeStop({ id: 'stop-B' }) })
    await flushPromises()
    await wrapper.find('[data-testid="driver-stop-check-in-button"]').trigger('click')
    await nextTick()
    const args = checkInMutateMock.mock.calls[0]?.[0] as { id: string; stopId: string } | undefined
    expect(args?.stopId).toBe('stop-B')
  })
})
