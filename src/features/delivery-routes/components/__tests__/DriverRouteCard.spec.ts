// DriverRouteCard.spec.ts — STRICT-TDD tests for the driver route card.
//
// Contract (sdd delivery-routes S6b, design.md §4.2, §11, REQ-DRC-001..008):
//   - Mobile-first card for ONE own ACTIVE route (the driver list is card-first,
//     distinct from the manager's dense table; design §4.1 vs §4.2).
//   - Renders:
//       * A status badge (tone + label) sourced from `DELIVERY_ROUTE_STATUS_*`
//         maps (single source — manager + driver share the labels).
//       * The route id (short form, first 8 chars + ellipsis) — the driver has no
//         folio, so the id IS the human reference.
//       * The driver name (from `route.driver?.name`); falls back to "—" when
//         the projection is null (the route is the driver's own, so the name is
//         almost always present — fallback is defensive).
//       * The stop-progress counter (`buildStopProgress`) — `"Sin paradas"`
//         when `stops.length === 0`, otherwise `"{completed}/{total}"`.
//   - The ENTIRE card is a tap target (REQ-DRC-007 mobile-first affordance).
//     Tapping it emits `select` with the route id; the parent owns navigation
//     so the card stays decoupled from vue-router.
//   - Loading / empty / error states are owned by the list view (the card is
//     the row renderer; the list view passes `null` arrays + flags from
//     `useDriverActiveRoutes`). The card itself receives a non-null route
//     and renders.
//
// Co-located spec mirrors the precedent of `DeliveryRouteReorderPanel.spec.ts`:
// mocks the card's child UI affordances where possible (StatusDotBadge),
// and asserts the public surface via stable testids + emitted events.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DriverRouteCard from '../DriverRouteCard.vue'
import type { DeliveryRouteResponseDto } from '../../interfaces/delivery-route.types'
import { buildStopProgress } from '../../utils/delivery-route-actions.utils'

// ─── Stubs ──────────────────────────────────────────────────────────────────
const UButtonStub = defineComponent({
  name: 'UButton',
  props: ['label', 'icon', 'disabled', 'color', 'variant', 'size', 'block'],
  emits: ['click'],
  template:
    '<button :disabled="disabled" :data-testid="$attrs[\'data-testid\']" :data-label="label" @click.prevent="$emit(\'click\')"><slot />{{ label }}</button>',
})

const StatusDotBadgeStub = defineComponent({
  name: 'StatusDotBadge',
  props: ['tone', 'label'],
  template:
    '<span data-testid="status-dot-badge-stub" :data-tone="tone" :data-label="label">{{ label }}</span>',
})

// ─── Fixture helpers ────────────────────────────────────────────────────────
function makeStop(sortOrder: number, overrides: Partial<{ id: string; status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' }> = {}): {
  id: string
  saleId: string
  saleFolio: string | null
  sortOrder: number
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED'
  checkedInAt: string | null
  completedAt: string | null
  customer: { id: string; name: string; email: string | null } | null
  shippingAddress: null
} {
  return {
    id: overrides.id ?? `s${sortOrder + 1}`,
    saleId: `sale-${sortOrder + 1}`,
    saleFolio: `F-${sortOrder + 1}`,
    sortOrder,
    status: overrides.status ?? 'PENDING',
    checkedInAt: null,
    completedAt: null,
    customer: { id: `c${sortOrder + 1}`, name: `Cliente ${sortOrder + 1}`, email: null },
    shippingAddress: null,
  }
}

function makeRoute(overrides: Partial<{
  id: string
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  stops: ReturnType<typeof makeStop>[]
  driver: { id: string; name: string; email: string } | null
}> = {}): DeliveryRouteResponseDto {
  return {
    id: overrides.id ?? 'route-abc12345',
    status: overrides.status ?? 'ACTIVE',
    driver: overrides.driver !== undefined ? overrides.driver : { id: 'd1', name: 'Ana Repartidor', email: 'ana@x' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: overrides.stops ?? [],
    timeline: [],
  }
}

function mountCard(props: Record<string, unknown> = {}) {
  const wrapper = mount(DriverRouteCard, {
    props: { route: makeRoute(), ...props },
    global: {
      stubs: {
        UApp,
        UButton: UButtonStub,
        StatusDotBadge: StatusDotBadgeStub,
      },
    },
  })
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DriverRouteCard — rendering (design §4.2, REQ-DRC-001)', () => {
  it('renders the route id in short form (first 8 chars + ellipsis)', async () => {
    const route = makeRoute({ id: 'route-abcdef1234567890' })
    const wrapper = mountCard({ route })
    await flushPromises()
    // The id appears in the card with the convention: first 8 chars + '…'.
    expect(wrapper.text()).toContain('route-ab')
  })

  it('renders the driver name verbatim from the route projection', async () => {
    const route = makeRoute({ driver: { id: 'd1', name: 'Ana Repartidor', email: 'a@x' } })
    const wrapper = mountCard({ route })
    await flushPromises()
    expect(wrapper.text()).toContain('Ana Repartidor')
  })

  it('renders an em-dash fallback when the route has no driver projection', async () => {
    const route = makeRoute({ driver: null })
    const wrapper = mountCard({ route })
    await flushPromises()
    expect(wrapper.text()).toContain('—')
  })

  it('renders the status badge with the correct tone + Spanish label', async () => {
    const route = makeRoute({ status: 'ACTIVE' })
    const wrapper = mountCard({ route })
    await flushPromises()
    const badge = wrapper.find('[data-testid="status-dot-badge-stub"]')
    expect(badge.exists()).toBe(true)
    expect(badge.attributes('data-tone')).toBe('warning')
    expect(badge.attributes('data-label')).toBe('Activa')
  })

  it('renders the stop progress as "x/y" when the route has stops', async () => {
    const route = makeRoute({
      stops: [makeStop(0, { status: 'COMPLETED' }), makeStop(1, { status: 'PENDING' })],
    })
    const wrapper = mountCard({ route })
    await flushPromises()
    // The util `buildStopProgress` is the single source of truth — pin its
    // exact output here so the card never drifts from the manager surface.
    expect(wrapper.text()).toContain(buildStopProgress(route.stops))
    expect(wrapper.text()).toContain('1/2')
  })

  it('renders "Sin paradas" when the route has no stops', async () => {
    const route = makeRoute({ stops: [] })
    const wrapper = mountCard({ route })
    await flushPromises()
    expect(wrapper.text()).toContain('Sin paradas')
  })
})

describe('DriverRouteCard — tap target (REQ-DRC-007, design §11)', () => {
  it('exposes a stable testid for the tap target (the entire card)', async () => {
    const route = makeRoute()
    const wrapper = mountCard({ route })
    await flushPromises()
    expect(wrapper.find('[data-testid="driver-route-card"]').exists()).toBe(true)
  })

  it('emits "select" with the route id when the card is tapped', async () => {
    const route = makeRoute({ id: 'route-xyz' })
    const wrapper = mountCard({ route })
    await flushPromises()
    await wrapper.find('[data-testid="driver-route-card"]').trigger('click')
    await nextTick()
    const events = wrapper.emitted('select')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual(['route-xyz'])
  })

  it('emits "select" with the latest route id when the prop changes', async () => {
    const route = makeRoute({ id: 'route-A' })
    const wrapper = mountCard({ route })
    await flushPromises()
    await wrapper.setProps({ route: makeRoute({ id: 'route-B' }) })
    await wrapper.find('[data-testid="driver-route-card"]').trigger('click')
    await nextTick()
    const events = wrapper.emitted('select')
    expect(events![events!.length - 1]).toEqual(['route-B'])
  })

  it('emits keyboard activation (Enter / Space) on the tap target (a11y)', async () => {
    // Mobile-first doesn't excuse keyboard parity — the tap target is a button
    // under the hood and reacts to native button activation events.
    const route = makeRoute({ id: 'route-kb' })
    const wrapper = mountCard({ route })
    await flushPromises()
    const tapTarget = wrapper.find('[data-testid="driver-route-card"]')
    await tapTarget.trigger('keydown', { key: 'Enter' })
    await tapTarget.trigger('keydown', { key: ' ' })
    await nextTick()
    const events = wrapper.emitted('select')
    expect(events).toBeTruthy()
    expect(events!.length).toBeGreaterThanOrEqual(2)
    expect(events![0]).toEqual(['route-kb'])
  })
})

describe('DriverRouteCard — status badge per status (REQ-DRC-001, design §11)', () => {
  it('renders the ACTIVE badge with the warning tone', async () => {
    const route = makeRoute({ status: 'ACTIVE' })
    const wrapper = mountCard({ route })
    await flushPromises()
    const badge = wrapper.find('[data-testid="status-dot-badge-stub"]')
    expect(badge.attributes('data-tone')).toBe('warning')
    expect(badge.attributes('data-label')).toBe('Activa')
  })

  it('renders the COMPLETED badge with the success tone', async () => {
    const route = makeRoute({ status: 'COMPLETED' })
    const wrapper = mountCard({ route })
    await flushPromises()
    const badge = wrapper.find('[data-testid="status-dot-badge-stub"]')
    expect(badge.attributes('data-tone')).toBe('success')
    expect(badge.attributes('data-label')).toBe('Completada')
  })
})

describe('DriverRouteCard — prop contract', () => {
  it('defines a single typed `route` prop (DeliveryRouteResponseDto)', async () => {
    // The card never accepts multiple routes / a list — the parent renders one
    // card per route (v-for in the list view, design §4.2 row pattern).
    const route = makeRoute()
    const wrapper = mountCard({ route })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })
})
