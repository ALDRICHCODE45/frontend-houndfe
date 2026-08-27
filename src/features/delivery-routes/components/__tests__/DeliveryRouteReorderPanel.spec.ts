// DeliveryRouteReorderPanel.spec.ts — STRICT-TDD tests for the reorder panel.
//
// Contract (sdd delivery-routes S5a, design.md §4.1, §10.2, REQ-DRM-009):
//   - Renders the DRAFT route's stops sorted by `sortOrder` ASC.
//   - Hidden entirely when `status !== 'DRAFT'` (DRM-009/010 gating).
//   - vuedraggable is STUBBED (real Sortable is not exercised in jsdom). The
//     panel exposes a `__testOrderedStopIds` ref for the spec to drive the
//     same local ordered copy that vuedraggable would mutate.
//   - Each row also exposes ↑/↓ buttons that swap adjacent stops in the SAME
//     local ordered copy (accessibility/touch fallback). Both DnD and ↑/↓
//     converge on the same ordered array.
//   - "Guardar orden" button (NEVER drag-end autosave) builds
//     `orderedStopIds = orderedStops.map(s => s.id)` and calls
//     `useReorderStops().mutateAsync`.
//   - Before sending, the panel calls
//     `assertReorderCoversStops(orderedStopIds, existingStopIds)`; on a
//     non-null guard message, the panel surfaces it inline and BLOCKS the
//     mutation (no PUT fires).
//   - The guard message is "El orden debe incluir todas las paradas una sola vez"
//     (matches the spec/delivery-route-management REQ-DRM-009 wording).
//
// We mock `useReorderStops` so the panel spec owns the mutation surface and
// can assert "no autosave on drag-end" + "guard blocks the request" without a
// real QueryClient. The `useReorderStops` composable itself has its own strict
// spec that covers URL/method/payload/invalidations.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, ref, type Ref } from 'vue'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DeliveryRouteReorderPanel from '../DeliveryRouteReorderPanel.vue'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../interfaces/delivery-route.types'

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../../composables/useReorderStops', () => ({
  useReorderStops: vi.fn(),
}))

import { useReorderStops } from '../../composables/useReorderStops'

// ─── Fixture helpers ────────────────────────────────────────────────────────
function makeStop(
  id: string,
  sortOrder: number,
  overrides: Partial<DeliveryRouteStop> = {},
): DeliveryRouteStop {
  return {
    id,
    saleId: `sale-${id}`,
    saleFolio: `F-${id}`,
    sortOrder,
    status: 'PENDING',
    checkedInAt: null,
    completedAt: null,
    customer: { id: `cust-${id}`, name: `Cliente ${id}`, email: null },
    shippingAddress: null,
    ...overrides,
  }
}

function makeRoute(
  overrides: Partial<DeliveryRouteResponseDto> = {},
): DeliveryRouteResponseDto {
  return {
    id: 'route-1',
    status: 'DRAFT',
    driver: { id: 'drv-1', name: 'Ana', email: 'ana@example.com' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
    ...overrides,
  }
}

// ─── vuedraggable stub ──────────────────────────────────────────────────────
//
// The real `vuedraggable` component wraps Sortable.js and is hard to exercise
// in jsdom. We stub the default export with a component that:
//   1. Forwards v-model `modelValue` to the parent's `orderedStops` ref via
//      `update:modelValue` (the documented vuedraggable contract — it mutates
//      the bound array in place; the production template re-assigns on @change).
//   2. Renders the `#item` scoped slot once per item, passing `{ element, index }`
//      so the panel's row template renders verbatim (data-testids preserved).
//   3. Exposes the raw list via `data-list` for spec-level assertions.
const draggableStub = defineComponent({
  name: 'draggable',
  props: ['modelValue', 'itemKey', 'tag', 'handle', 'animation', 'ghostClass', 'chosenClass', 'dragClass'],
  emits: ['update:modelValue', 'end', 'start', 'change'],
  template: `
    <ul data-testid="draggable-stub" :data-list="JSON.stringify(modelValue)">
      <li
        v-for="(stop, i) in modelValue"
        :key="stop.id"
        :data-testid="'reorder-row-' + stop.id"
        :data-index="i"
      >
        <slot name="item" :element="stop" :index="i" />
      </li>
    </ul>
  `,
})

const UButtonStub = defineComponent({
  name: 'UButton',
  props: ['label', 'icon', 'disabled', 'color', 'variant', 'size'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" :data-testid="$attrs[\'data-testid\']" :data-icon="$attrs[\'icon\']" @click.prevent="$emit(\'click\')"><slot />{{ label }}</button>',
})

const UIconStub = defineComponent({
  name: 'UIcon',
  template: '<span />',
})

const stubs = {
  UApp,
  draggable: draggableStub,
  UButton: UButtonStub,
  UIcon: UIconStub,
  Button: UButtonStub,
  Icon: UIconStub,
}

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

function mountPanel(
  props: Record<string, unknown> = {},
  options: { mockMutate?: ReturnType<typeof vi.fn> } = {},
) {
  const mockMutate = options.mockMutate ?? vi.fn().mockResolvedValue({})
  // Mirror the composable's public surface (only `mutateAsync` + `isPending`
  // + `error` are exercised by the panel spec). `isPending` is a `Ref<boolean>`
  // and `error` is `Ref<null>` (the composable's narrow type). We satisfy
  // those with `ref(false)` + `ref(null)` so vue-tsc accepts the mock.
  const isPendingRef: Ref<boolean> = ref(false)
  const errorRef: Ref<null> = ref(null)
  const mockUseReorder = vi.fn(() => ({
    mutateAsync: mockMutate as unknown as never,
    isPending: isPendingRef,
    error: errorRef,
  }))
  vi.mocked(useReorderStops).mockImplementation(mockUseReorder)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  // Mount the SFC directly (no UApp wrapper needed — the panel does not use
  // any Nuxt UI provider-injected components yet). The exposed accessor
  // objects (e.g. `__testOrderedStopIds`) are read via `wrapper.vm` on the
  // mounted SFC — same pattern as `DeliveryRouteUpsertSlideover.spec.ts`.
  const wrapper = mount(DeliveryRouteReorderPanel, {
    props: { route: makeRoute(), ...props },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs,
    },
  })

  function vmOf<T>(): T {
    return (wrapper.vm as unknown) as T
  }

  return {
    wrapper,
    mockMutate,
    vmOf,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DeliveryRouteReorderPanel — DRAFT rendering (REQ-DRM-009)', () => {
  it('renders the panel when status is DRAFT', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    expect(wrapper.find('[data-testid="delivery-route-reorder-panel"]').exists()).toBe(true)
  })

  it('is HIDDEN entirely when status !== "DRAFT" (DRM-009/010 gating)', async () => {
    const route = makeRoute({
      status: 'ACTIVE',
      stops: [makeStop('s1', 0), makeStop('s2', 1)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    expect(wrapper.find('[data-testid="delivery-route-reorder-panel"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delivery-route-reorder-panel-hidden"]').exists()).toBe(true)
  })
})

describe('DeliveryRouteReorderPanel — local ordered copy (REQ-DRM-009)', () => {
  it('initialises the local ordered copy from the route stops sorted by sortOrder ASC', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [
        makeStop('s1', 0),
        makeStop('s2', 1),
        makeStop('s3', 2),
      ],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    expect(vm.__testOrderedStopIds.value).toEqual(['s1', 's2', 's3'])
  })

  it('renders one row per stop with the per-row ↑/↓ buttons', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [
        makeStop('s1', 0),
        makeStop('s2', 1),
        makeStop('s3', 2),
      ],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    expect(wrapper.find('[data-testid="reorder-row-s1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reorder-row-s2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reorder-row-s3"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reorder-up-s1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reorder-down-s3"]').exists()).toBe(true)
  })
})

describe('DeliveryRouteReorderPanel — ↑/↓ fallback swaps adjacent stops (REQ-DRM-009)', () => {
  it('clicking ↑ on row 2 (index 1) swaps it with row 1 (index 0)', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    await wrapper.find('[data-testid="reorder-up-s2"]').trigger('click')
    await flushPromises()
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    expect(vm.__testOrderedStopIds.value).toEqual(['s2', 's1', 's3'])
  })

  it('clicking ↑ on row 1 (index 0) is a no-op (boundary)', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    const upFirst = wrapper.find('[data-testid="reorder-up-s1"]')
    // The button may be present-but-disabled to convey the boundary; clicking
    // does not change the local ordered copy either way.
    if (upFirst.exists()) {
      await upFirst.trigger('click')
      await flushPromises()
    }
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    expect(vm.__testOrderedStopIds.value).toEqual(['s1', 's2', 's3'])
  })

  it('clicking ↓ on row 2 (index 1) swaps it with row 3 (index 2)', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    await wrapper.find('[data-testid="reorder-down-s2"]').trigger('click')
    await flushPromises()
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    expect(vm.__testOrderedStopIds.value).toEqual(['s1', 's3', 's2'])
  })
})

describe('DeliveryRouteReorderPanel — DnD + ↑/↓ converge to the same ordered array (REQ-DRM-009)', () => {
  it('driving the local ordered copy directly (the path vuedraggable takes) yields the same array as two ↑ clicks on the last row', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()

    // ── Path A: drive the local ordered copy directly (same ref vuedraggable mutates) ──
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    vm.__testOrderedStopIds.value = ['s3', 's1', 's2']
    await nextTick()
    const afterDnD = [...vm.__testOrderedStopIds.value]

    // ── Path B: two ↑ clicks on the last row from a fresh mount ──────────────
    const route2 = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const { wrapper: w2, vmOf: vmOf2 } = mountPanel({ route: route2 })
    await flushPromises()
    // ↑ on s3 → s2,s3,s1 (s3 swaps with s2).
    await w2.find('[data-testid="reorder-up-s3"]').trigger('click')
    await flushPromises()
    // ↑ on s3 again → s3,s1,s2.
    await w2.find('[data-testid="reorder-up-s3"]').trigger('click')
    await flushPromises()
    const vm2 = vmOf2<{
      __testOrderedStopIds: { value: string[] }
    }>()
    const afterButtons = [...vm2.__testOrderedStopIds.value]

    expect(afterDnD).toEqual(afterButtons)
    expect(afterDnD).toEqual(['s3', 's1', 's2'])
  })
})

describe('DeliveryRouteReorderPanel — Guardar orden button (REQ-DRM-009)', () => {
  it('fires PUT :id/stops/reorder via useReorderStops().mutateAsync with the local ordered copy', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const mockMutate = vi.fn().mockResolvedValue({})
    const { wrapper, vmOf } = mountPanel({ route: route }, { mockMutate })
    await flushPromises()
    // Drive the local ordered copy to the expected target.
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    vm.__testOrderedStopIds.value = ['s3', 's1', 's2']
    await nextTick()
    await wrapper.find('[data-testid="reorder-save-button"]').trigger('click')
    await flushPromises()
    expect(mockMutate).toHaveBeenCalledTimes(1)
    const args = mockMutate.mock.calls[0]?.[0] as
      | { id: string; payload: { orderedStopIds: string[] } }
      | undefined
    expect(args?.id).toBe('route-1')
    expect(args?.payload.orderedStopIds).toEqual(['s3', 's1', 's2'])
  })

  it('NEVER autosaves on drag-end (mutationFn is not called until the button is pressed)', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const mockMutate = vi.fn().mockResolvedValue({})
    const { wrapper, vmOf } = mountPanel({ route: route }, { mockMutate })
    await flushPromises()
    // Drive the local ordered copy (the same way vuedraggable would on drag-end).
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    vm.__testOrderedStopIds.value = ['s3', 's1', 's2']
    await nextTick()
    // No "Guardar orden" click yet → mutation MUST NOT be called.
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('exposes a Guardar orden button when status === "DRAFT"', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const { wrapper, vmOf } = mountPanel({ route: route })
    await flushPromises()
    expect(wrapper.find('[data-testid="reorder-save-button"]').exists()).toBe(true)
  })
})

describe('DeliveryRouteReorderPanel — exactly-once guard (REQ-DRM-009)', () => {
  it('blocks the request and surfaces an inline Spanish error when the local ordered copy drops a stop', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const mockMutate = vi.fn().mockResolvedValue({})
    const { wrapper, vmOf } = mountPanel({ route: route }, { mockMutate })
    await flushPromises()
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    // Drop s2.
    vm.__testOrderedStopIds.value = ['s1', 's3']
    await nextTick()
    await wrapper.find('[data-testid="reorder-save-button"]').trigger('click')
    await flushPromises()
    // No PUT fires when the guard rejects the payload.
    expect(mockMutate).not.toHaveBeenCalled()
    // Inline guard message is rendered.
    expect(wrapper.text()).toMatch(/incluir todas las paradas una sola vez/i)
  })

  it('blocks the request when the local ordered copy contains a duplicate id', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const mockMutate = vi.fn().mockResolvedValue({})
    const { wrapper, vmOf } = mountPanel({ route: route }, { mockMutate })
    await flushPromises()
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    vm.__testOrderedStopIds.value = ['s1', 's2', 's2']
    await nextTick()
    await wrapper.find('[data-testid="reorder-save-button"]').trigger('click')
    await flushPromises()
    expect(mockMutate).not.toHaveBeenCalled()
    expect(wrapper.text()).toMatch(/incluir todas las paradas una sola vez/i)
  })

  it('blocks the request when an unknown id is in the ordered list', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1), makeStop('s3', 2)],
    })
    const mockMutate = vi.fn().mockResolvedValue({})
    const { wrapper, vmOf } = mountPanel({ route: route }, { mockMutate })
    await flushPromises()
    const vm = vmOf<{
      __testOrderedStopIds: { value: string[] }
    }>()
    vm.__testOrderedStopIds.value = ['s1', 's2', 'unknown']
    await nextTick()
    await wrapper.find('[data-testid="reorder-save-button"]').trigger('click')
    await flushPromises()
    expect(mockMutate).not.toHaveBeenCalled()
    expect(wrapper.text()).toMatch(/incluir todas las paradas una sola vez/i)
  })
})

describe('DeliveryRouteReorderPanel — payload whitelist (TRIANGULATE)', () => {
  it('the PUT payload contains exactly { id, orderedStopIds } — no stops array, no status, no tenantId', async () => {
    const route = makeRoute({
      status: 'DRAFT',
      stops: [makeStop('s1', 0), makeStop('s2', 1)],
    })
    const mockMutate = vi.fn().mockResolvedValue({})
    const { wrapper, vmOf } = mountPanel({ route: route }, { mockMutate })
    await flushPromises()
    await wrapper.find('[data-testid="reorder-save-button"]').trigger('click')
    await flushPromises()
    expect(mockMutate).toHaveBeenCalledTimes(1)
    const args = mockMutate.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(args).toBeTruthy()
    const keys = Object.keys(args!).sort()
    // The mutation input shape is `{ id, payload: { orderedStopIds } }`. The
    // composable spreads `payload` into the API; we assert the panel-built
    // payload keys (top-level: id + payload) and the payload's keys.
    expect(keys).toEqual(['id', 'payload'])
    const payload = args!['payload'] as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(['orderedStopIds'])
    expect(payload).not.toHaveProperty('stops')
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('tenantId')
  })
})
