// DriverRouteSpine.spec.ts — STRICT-TDD route-page evolution (REQ-DCS-005,
// REQ-DRC-111). The spine is the ordered rich stop-card list of the route page:
// one DriverStopCard per node in IDENTICAL backend order (never re-sorted),
// inside the same accessible <ol> ("Recorrido de la ruta") with the same
// "Sin paradas" empty state. Presentational only; typed props { nodes,
// showCheckInStopId, checkInPending }; typed emits 'open-details' + 'check-in'
// [StopTrigger] forwarded from the cards. The single direct "Marcar entregada"
// CTA renders only on the stop whose id equals `showCheckInStopId` — every
// other stop stays inspectable via "Ver detalles" WITHOUT a primary CTA.

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DriverRouteSpine from '../DriverRouteSpine.vue'
import DriverStopCard from '../DriverStopCard.vue'
import {
  DELIVERY_ROUTE_STOP_STATUS_LABELS,
  type DeliveryRouteStop,
} from '../../../interfaces/delivery-route.types'
import type { CockpitSpineNode, StopTrigger } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const ADDR = {
  id: 'a', street: 'Reforma', exteriorNumber: '1', interiorNumber: null,
  zipCode: '06600', neighborhood: 'C', municipality: 'C', city: 'CDMX',
  state: 'CMX', label: null, latitude: null, longitude: null,
}

function mkStop(id: string, sortOrder: number, status: DeliveryRouteStop['status'], name: string): DeliveryRouteStop {
  return {
    id, saleId: `s-${id}`, saleFolio: `F-${sortOrder + 1}`, sortOrder, status,
    checkedInAt: null, completedAt: null,
    customer: { id: `c-${id}`, name, email: null },
    shippingAddress: { ...ADDR, id: `a-${id}` },
  }
}
function mkNode(
  id: string, sortOrder: number, status: DeliveryRouteStop['status'], name: string,
  nodeState: CockpitSpineNode['nodeState'], isCurrent: boolean, isNext = false,
): CockpitSpineNode {
  return { stop: mkStop(id, sortOrder, status, name), nodeState, isCurrent, isNext, isSelectable: true }
}
function mountSpine(p: {
  nodes?: CockpitSpineNode[]
  showCheckInStopId?: string | null
  checkInPending?: boolean
} = {}) {
  return mount(DriverRouteSpine, {
    props: {
      nodes: p.nodes ?? [],
      showCheckInStopId: p.showCheckInStopId ?? null,
      checkInPending: p.checkInPending ?? false,
    },
  })
}

const FIVE = [
  mkNode('s0', 0, 'COMPLETED', 'Ana', 'completed', false),
  mkNode('s1', 1, 'COMPLETED', 'Bea', 'completed', false),
  mkNode('s2', 2, 'PENDING', 'Carlos', 'current', true),
  mkNode('s3', 3, 'PENDING', 'Dario', 'upcoming', false, true),
  mkNode('s4', 4, 'SKIPPED', 'Eli', 'skipped', false),
] as const

describe('DriverRouteSpine — ordered rich stop-card sequence (REQ-DCS-005)', () => {
  it('renders a real <ol> with exactly one stop card per node in identical backend order', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-spine-root"]').element.tagName.toLowerCase()).toBe('ol')
    const cards = w.findAll('article[data-testid^="driver-stop-card-"]')
    expect(cards).toHaveLength(FIVE.length)
    expect(cards.map((c) => c.attributes('data-stop-id'))).toEqual(['s0', 's1', 's2', 's3', 's4'])
  })

  it('each node renders through DriverStopCard (rich card: status, folio, customer, address)', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    await flushPromises()
    const cards = w.findAllComponents(DriverStopCard)
    expect(cards).toHaveLength(FIVE.length)
    // Status label from the shared map, per card, in backend order.
    expect(cards.map((c) => c.find('[data-testid="driver-stop-card-status"]').text())).toEqual([
      DELIVERY_ROUTE_STOP_STATUS_LABELS.COMPLETED,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.COMPLETED,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.PENDING,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.PENDING,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.SKIPPED,
    ])
    // Rich content flows through (folio + customer are card-owned renderings).
    expect(w.text()).toContain('F-1')
    expect(w.text()).toContain('Carlos')
  })

  it('spine root carries the central cockpit.spine.rootAriaLabel ("Recorrido de la ruta")', () => {
    const root = mountSpine({ nodes: [...FIVE] }).find('[data-testid="cockpit-spine-root"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.cockpit.spine.rootAriaLabel)
    expect(root.attributes('aria-label')).toBe('Recorrido de la ruta')
  })

  it('empty nodes array renders "Sin paradas" central copy and no <ol>', () => {
    const w = mountSpine({ nodes: [] })
    expect(w.text()).toContain('Sin paradas')
    expect(w.find('[data-testid="cockpit-spine-root"]').exists()).toBe(false)
    expect(w.findAllComponents(DriverStopCard)).toHaveLength(0)
  })

  it('current/next emphasis flows from the node derivation into the cards', () => {
    const w = mountSpine({ nodes: [...FIVE] })
    expect(w.find('[data-testid="driver-stop-card-s2"]').attributes('data-current')).toBe('true')
    expect(w.find('[data-testid="driver-stop-card-s0"]').attributes('data-current')).toBe('false')
    expect(w.find('[data-testid="driver-stop-card-s3"]').find('[data-testid="driver-stop-card-next-badge"]').exists()).toBe(true)
    expect(w.find('[data-testid="driver-stop-card-s2"]').find('[data-testid="driver-stop-card-next-badge"]').exists()).toBe(false)
  })
})

describe('DriverRouteSpine — single direct check-in CTA (route-page evolution)', () => {
  it('renders "Marcar entregada" ONLY on the card whose id equals showCheckInStopId', () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: 's2' })
    const withCta = w.findAll('[data-testid="driver-stop-card-check-in"]')
    expect(withCta).toHaveLength(1)
    expect(w.find('[data-testid="driver-stop-card-s2"]').find('[data-testid="driver-stop-card-check-in"]').exists()).toBe(true)
    // Every other stop stays inspectable WITHOUT a repeated primary CTA…
    for (const id of ['s0', 's1', 's3', 's4']) {
      expect(w.find(`[data-testid="driver-stop-card-${id}"]`).find('[data-testid="driver-stop-card-check-in"]').exists()).toBe(false)
    }
    // …but always keeps its "Ver detalles" control.
    for (const id of ['s0', 's1', 's2', 's3', 's4']) {
      expect(w.find(`[data-testid="driver-stop-card-${id}"]`).find('[data-testid="driver-stop-card-details"]').exists()).toBe(true)
    }
  })

  it('showCheckInStopId=null renders NO check-in button anywhere (e.g. terminal / no permission)', () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: null })
    expect(w.findAll('[data-testid="driver-stop-card-check-in"]')).toHaveLength(0)
  })

  it('check-in CTA is disabled while checkInPending (exactly-once discipline)', () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: 's2', checkInPending: true })
    const btn = w.find('[data-testid="driver-stop-card-check-in"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('DriverRouteSpine — forwarded emits (REQ-DRC-111 focus-origin contract)', () => {
  it('details activation forwards open-details once with { stopId, trigger = originating element }', async () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: 's2' })
    const btn = w.find('[data-testid="driver-stop-card-s3"]').find('[data-testid="driver-stop-card-details"]')
    await btn.trigger('click')
    const events = w.emitted('open-details')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as StopTrigger
    expect(payload.stopId).toBe('s3')
    expect(payload.trigger).toBe(btn.element)
  })

  it('check-in activation forwards check-in once with { stopId, trigger }', async () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: 's2' })
    const btn = w.find('[data-testid="driver-stop-card-s2"]').find('[data-testid="driver-stop-card-check-in"]')
    await btn.trigger('click')
    const events = w.emitted('check-in')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as StopTrigger
    expect(payload.stopId).toBe('s2')
    expect(payload.trigger).toBe(btn.element)
  })

  it('details activation works on EVERY node state (completed/upcoming/skipped remain inspectable)', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    for (const stopId of ['s0', 's1', 's3', 's4']) {
      await w.find(`[data-testid="driver-stop-card-${stopId}"]`).find('[data-testid="driver-stop-card-details"]').trigger('click')
    }
    const ids = (w.emitted('open-details') ?? []).map((e) => (e[0] as StopTrigger).stopId)
    expect(ids).toEqual(['s0', 's1', 's3', 's4'])
  })

  it('no nested interactive controls inside a card (separate native buttons only)', () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: 's2' })
    expect(w.find('button button').exists()).toBe(false)
    expect(w.find('a button').exists()).toBe(false)
    expect(w.find('button a').exists()).toBe(false)
  })
})

describe('DriverRouteSpine — triangulation (adjacent inputs)', () => {
  it('IN_PROGRESS current card renders "En curso" and stays inspectable', () => {
    const w = mountSpine({ nodes: [mkNode('ip', 0, 'IN_PROGRESS', 'Fer', 'current', true)] })
    expect(w.text()).toContain('En curso')
    expect(w.find('[data-testid="driver-stop-card-ip"]').find('[data-testid="driver-stop-card-details"]').exists()).toBe(true)
  })

  it('all-COMPLETED spine preserves order and renders no current emphasis', () => {
    const w = mountSpine({ nodes: [mkNode('a', 0, 'COMPLETED', 'A', 'completed', false), mkNode('b', 1, 'COMPLETED', 'B', 'completed', false)] })
    expect(w.findAll('article[data-testid^="driver-stop-card-"]').map((i) => i.attributes('data-stop-id'))).toEqual(['a', 'b'])
    expect(w.findAll('[data-current="true"]')).toHaveLength(0)
  })

  it('reactive prop update: replacing nodes re-renders in the new backend order', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const swapped: CockpitSpineNode[] = [
      mkNode('s4', 4, 'SKIPPED', 'Eli', 'upcoming', false),
      mkNode('s3', 3, 'PENDING', 'Dario', 'current', true),
    ]
    await w.setProps({ nodes: swapped })
    expect(w.findAll('article[data-testid^="driver-stop-card-"]').map((i) => i.attributes('data-stop-id'))).toEqual(['s4', 's3'])
    expect(w.find('[data-testid="driver-stop-card-s3"]').attributes('data-current')).toBe('true')
  })

  it('CTA moves when showCheckInStopId changes (derived single current stop)', async () => {
    const w = mountSpine({ nodes: [...FIVE], showCheckInStopId: 's2' })
    expect(w.findAll('[data-testid="driver-stop-card-check-in"]')).toHaveLength(1)
    await w.setProps({ showCheckInStopId: null })
    expect(w.findAll('[data-testid="driver-stop-card-check-in"]')).toHaveLength(0)
  })
})

describe('DriverRouteSpine — source-level invariants (REQ-DCS-005, design §6)', () => {
  function body(): string {
    // Strip all top-of-file block comments + line comments so the source
    // invariant never false-positives on JSDoc / inline notes. Hardcoded
    // user-visible literals belong in copy.ts, not in the implementation body.
    return fs.readFileSync((DriverRouteSpine as unknown as { __file: string }).__file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  }
  it('never re-sorts (no .sort() / .reverse()) and contains no server-state imports', () => {
    const b = body()
    expect(b).not.toMatch(/\.sort\(/)
    expect(b).not.toMatch(/\.reverse\(/)
    expect(b).not.toMatch(/from\s+['"]vue-router['"]/)
    expect(b).not.toMatch(/useRouter|useRoute\b/)
    expect(b).not.toMatch(/useQuery|useMutation|useQueryClient|@tanstack\/vue-query/)
    expect(b).not.toMatch(/axios|fetch\(['"]/)
  })
  it.each([
    ['Sin paradas'],
    ['Recorrido de la ruta'],
    ['Cliente sin nombre'],
    ['Ver detalles'],
    ['Marcar entregada'],
  ])('SFC implementation body never hardcodes "%s" (must bind from copy.ts / child cards)', (literal) => {
    expect(body(), `forbidden inline literal: ${literal}`).not.toContain(literal)
  })
  it('SFC implementation body never hardcodes "Parada " (must bind from copy.ts templates)', () => {
    const b = body()
    expect(b, 'visible "Parada " literal leaked into implementation body').not.toContain('Parada ')
  })
})
