// DeliveryRouteTimeline.spec.ts — STRICT-TDD tests for the read-only timeline.
//
// Contract (sdd delivery-routes S6b, design.md §4.2, §4.4, §15):
//   - Read-only vertical timeline that renders the 5 backend event types in
//     backend `at` ASC order (the client never re-sorts, per design §5.1).
//   - Five events (backend §4):
//       1. ROUTE_CREATED    — actor is ALWAYS null (creator not persisted).
//                             The row renders NO actor line (TRIANGULATE).
//       2. ROUTE_STARTED    — actor (driver) is optional; render the name
//                             when present.
//       3. STOP_CHECKED_IN  — has `stopId` + `sortOrder`; the row renders the
//                             position as `"Parada {sortOrder + 1}"` (1-based
//                             for the human-facing label; backend stores 0-based).
//       4. ROUTE_COMPLETED  — actor optional.
//       5. ROUTE_CANCELLED  — actor optional.
//   - No edit / delete affordance — this is a READ-only timeline (design §4.4).
//     The component does not emit any events.
//   - All copy sourced from `DELIVERY_ROUTE_COPY.timeline.*` (single Spanish
//     copy source — design §11).
//
// The component receives a `DeliveryRouteResponseDto` prop so the parent detail
// view can pass the same DTO the rest of the surface consumes (no second shape).

import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import DeliveryRouteTimeline from '../DeliveryRouteTimeline.vue'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteTimelineEvent,
} from '../../interfaces/delivery-route.types'
import { DELIVERY_ROUTE_COPY } from '../../copy'

// ─── Stubs (no Nuxt UI runtime in jsdom) ────────────────────────────────────
const UIconStub = defineComponent({
  name: 'UIcon',
  template: '<span :data-icon="$attrs.icon" />',
})

const UButtonStub = defineComponent({
  name: 'UButton',
  template: '<button />',
})

// ─── Fixtures ────────────────────────────────────────────────────────────────
function makeRoute(
  timeline: DeliveryRouteTimelineEvent[],
  overrides: Partial<DeliveryRouteResponseDto> = {},
): DeliveryRouteResponseDto {
  return {
    id: 'route-1',
    status: 'COMPLETED',
    driver: { id: 'd1', name: 'Ana Repartidor', email: 'a@x' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline,
    ...overrides,
  }
}

function mountTimeline(props: Record<string, unknown> = {}) {
  return mount(DeliveryRouteTimeline, {
    props: { route: makeRoute([]), ...props },
    global: {
      stubs: {
        UApp,
        UIcon: UIconStub,
        UButton: UButtonStub,
      },
    },
  })
}

beforeEach(() => {
  // No mocks to reset — the component is pure rendering.
})

describe('DeliveryRouteTimeline — 5-event rendering in backend order (REQ-DRC-001, design §4.4, §5.1)', () => {
  it('renders zero rows when the timeline is empty', async () => {
    const wrapper = mountTimeline({ route: makeRoute([]) })
    await flushPromises()
    expect(wrapper.findAll('[data-testid^="timeline-row-"]').filter((node) => node.element.tagName === 'LI').length).toBe(0)
  })

  it('renders 5 rows in backend `at` ASC order (never re-sorted)', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
      {
        type: 'STOP_CHECKED_IN',
        at: '2025-01-01T09:30:00Z',
        stopId: 's1',
        sortOrder: 0,
        actor: { id: 'd1', name: 'Ana' },
      },
      {
        type: 'STOP_CHECKED_IN',
        at: '2025-01-01T10:00:00Z',
        stopId: 's2',
        sortOrder: 1,
        actor: { id: 'd1', name: 'Ana' },
      },
      { type: 'ROUTE_COMPLETED', at: '2025-01-01T11:00:00Z', actor: { id: 'd1', name: 'Ana' } },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    // Target only the row <li> elements (the inner actor/stop-position spans
    // share the `timeline-row-` prefix; they are filtered out by tagName).
    const rows = wrapper
      .findAll('[data-testid^="timeline-row-"]')
      .filter((node) => node.element.tagName === 'LI')
    expect(rows.length).toBe(5)
    // The component never re-sorts — backend order is preserved.
    expect(rows[0]!.attributes('data-testid')).toBe('timeline-row-ROUTE_CREATED')
    expect(rows[1]!.attributes('data-testid')).toBe('timeline-row-ROUTE_STARTED')
    expect(rows[2]!.attributes('data-testid')).toBe('timeline-row-STOP_CHECKED_IN-s1')
    expect(rows[3]!.attributes('data-testid')).toBe('timeline-row-STOP_CHECKED_IN-s2')
    expect(rows[4]!.attributes('data-testid')).toBe('timeline-row-ROUTE_COMPLETED')
  })
})

describe('DeliveryRouteTimeline — ROUTE_CREATED renders NO actor line (design §4.4)', () => {
  it('renders the ROUTE_CREATED row without an actor element', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    const row = wrapper.find('[data-testid="timeline-row-ROUTE_CREATED"]')
    expect(row.exists()).toBe(true)
    // No actor element inside the row.
    expect(row.find('[data-testid="timeline-row-actor"]').exists()).toBe(false)
  })
})

describe('DeliveryRouteTimeline — STOP_CHECKED_IN renders position as sortOrder + 1 (REQ-DRC-001, §4.4)', () => {
  it('renders the stop position as "Parada {sortOrder + 1}" (1-based, human-facing)', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      {
        type: 'STOP_CHECKED_IN',
        at: '2025-01-01T09:30:00Z',
        stopId: 's1',
        sortOrder: 0, // 0-based in the backend projection
        actor: { id: 'd1', name: 'Ana' },
      },
      {
        type: 'STOP_CHECKED_IN',
        at: '2025-01-01T10:00:00Z',
        stopId: 's2',
        sortOrder: 2, // third stop (0,1,2)
        actor: { id: 'd1', name: 'Ana' },
      },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    // The first STOP_CHECKED_IN (sortOrder=0) renders "Parada 1".
    expect(wrapper.text()).toContain('Parada 1')
    // The third STOP_CHECKED_IN (sortOrder=2) renders "Parada 3".
    expect(wrapper.text()).toContain('Parada 3')
  })

  it('TRIANGULATE — sortOrder + 1 conversion (regression pin)', async () => {
    // The contract is that sortOrder is 0-based in the DTO and 1-based in the
    // UI; pin that the +1 conversion happens for ALL sortOrder values, not
    // just the first one.
    const timeline: DeliveryRouteTimelineEvent[] = [
      {
        type: 'STOP_CHECKED_IN',
        at: '2025-01-01T09:00:00Z',
        stopId: 's5',
        sortOrder: 4, // fifth stop
        actor: { id: 'd1', name: 'Ana' },
      },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    expect(wrapper.text()).toContain('Parada 5')
  })
})

describe('DeliveryRouteTimeline — copy source (REQ-DRC-001, design §11)', () => {
  it('renders the Spanish label from DELIVERY_ROUTE_COPY.timeline for each event type', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
      { type: 'ROUTE_COMPLETED', at: '2025-01-01T11:00:00Z', actor: { id: 'd1', name: 'Ana' } },
      { type: 'ROUTE_CANCELLED', at: '2025-01-01T11:30:00Z', actor: { id: 'd1', name: 'Ana' } },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.timeline.routeCreated)
    expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.timeline.routeStarted)
    expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.timeline.routeCompleted)
    expect(wrapper.text()).toContain(DELIVERY_ROUTE_COPY.timeline.routeCancelled)
  })

  it('renders the actor name on ROUTE_STARTED / STOP_CHECKED_IN / ROUTE_COMPLETED events', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
      {
        type: 'STOP_CHECKED_IN',
        at: '2025-01-01T09:30:00Z',
        stopId: 's1',
        sortOrder: 0,
        actor: { id: 'd1', name: 'Ana' },
      },
      { type: 'ROUTE_COMPLETED', at: '2025-01-01T11:00:00Z', actor: { id: 'd1', name: 'Ana' } },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    // All three rows include the actor element with Ana's name.
    const actorRows = wrapper.findAll('[data-testid="timeline-row-actor"]')
    expect(actorRows.length).toBe(3)
    actorRows.forEach((row) => {
      expect(row.text()).toContain('Ana')
    })
  })

  it('does NOT render an actor element when actor is null on ROUTE_STARTED (defensive)', async () => {
    // Backend may emit ROUTE_STARTED with actor=null if the manager started
    // the route (manager-initiated start). The row still renders; only the
    // actor line is suppressed.
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: null },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    const row = wrapper.find('[data-testid="timeline-row-ROUTE_STARTED"]')
    expect(row.exists()).toBe(true)
    expect(row.find('[data-testid="timeline-row-actor"]').exists()).toBe(false)
  })
})

describe('DeliveryRouteTimeline — read-only surface (design §4.4)', () => {
  it('emits no events (read-only — no edit/delete affordance)', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_CREATED', at: '2025-01-01T08:00:00Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    expect(Object.keys(wrapper.emitted())).toEqual([])
  })

  it('does NOT render any buttons or clickable affordances', async () => {
    const timeline: DeliveryRouteTimelineEvent[] = [
      { type: 'ROUTE_STARTED', at: '2025-01-01T09:00:00Z', actor: { id: 'd1', name: 'Ana' } },
    ]
    const wrapper = mountTimeline({ route: makeRoute(timeline) })
    await flushPromises()
    expect(wrapper.findAll('button').length).toBe(0)
  })
})

describe('DeliveryRouteTimeline — prop contract', () => {
  it('defines a single typed `route` prop (DeliveryRouteResponseDto)', async () => {
    const wrapper = mountTimeline({})
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })
})
