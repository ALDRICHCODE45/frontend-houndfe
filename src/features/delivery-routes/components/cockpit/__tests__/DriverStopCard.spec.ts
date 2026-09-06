// DriverStopCard.spec.ts — STRICT-TDD for the rich single-stop card of the
// driver cockpit route-page evolution.
//
// Contract:
//   - One <article> per stop: sequence number, semantic status label, optional
//     folio, customer fallback, formatted address, current/next emphasis.
//   - Separate native controls, NEVER nested buttons: "Ver detalles" always;
//     "Marcar entregada" only when `showCheckIn` (the cockpit derives the single
//     current PENDING stop on an ACTIVE route with permission). Disabled while
//     checkInPending; handler early-returns so disabled clicks emit nothing.
//   - Typed emits: 'open-details' [StopTrigger], 'check-in' [StopTrigger].
//   - Long customer/address/folio strings truncate intentionally (no horizontal
//     overflow); action rows stack on narrow widths; ≥44px targets.
//   - All user-visible literals bind from copy.ts (no inline Spanish literals).

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DriverStopCard from '../DriverStopCard.vue'
import type { DeliveryRouteStop } from '../../../interfaces/delivery-route.types'
import type { CockpitNodeState, StopTrigger } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const ADDR = {
  id: 'a', street: 'Reforma', exteriorNumber: '1', interiorNumber: null,
  zipCode: '06600', neighborhood: 'Centro', municipality: 'Cuauhtémoc',
  city: 'CDMX', state: 'CMX', label: null, latitude: null, longitude: null,
}

function mkStop(id: string, sortOrder: number, status: DeliveryRouteStop['status'], overrides: Partial<DeliveryRouteStop> = {}): DeliveryRouteStop {
  return {
    id, saleId: `s-${id}`, saleFolio: `F-${sortOrder + 1}`, sortOrder, status,
    checkedInAt: null, completedAt: null,
    customer: { id: `c-${id}`, name: `Cliente ${sortOrder + 1}`, email: null },
    shippingAddress: { ...ADDR, id: `a-${id}` },
    ...overrides,
  }
}

interface CardProps {
  stop?: DeliveryRouteStop
  nodeState?: CockpitNodeState
  isCurrent?: boolean
  isNext?: boolean
  showCheckIn?: boolean
  checkInPending?: boolean
}

function mountCard(p: CardProps = {}) {
  return mount(DriverStopCard, {
    props: {
      stop: p.stop ?? mkStop('s0', 0, 'PENDING'),
      nodeState: p.nodeState ?? 'upcoming',
      isCurrent: p.isCurrent ?? false,
      isNext: p.isNext ?? false,
      showCheckIn: p.showCheckIn ?? false,
      checkInPending: p.checkInPending ?? false,
    },
  })
}

describe('DriverStopCard — rich content (sequence, status, folio, customer, address)', () => {
  it('renders the 1-based sequence position from sortOrder + 1', async () => {
    const w = mountCard({ stop: mkStop('s2', 2, 'PENDING') })
    await flushPromises()
    const pos = w.find('[data-testid="driver-stop-card-position"]')
    expect(pos.exists()).toBe(true)
    expect(pos.text()).toBe(DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel.replace('{N}', '3'))
  })

  it('renders the textual status label from the shared map for every node state', async () => {
    const cases: Array<[DeliveryRouteStop['status'], CockpitNodeState]> = [
      ['PENDING', 'upcoming'], ['PENDING', 'current'], ['IN_PROGRESS', 'current'],
      ['COMPLETED', 'completed'], ['SKIPPED', 'skipped'],
    ]
    for (const [status, nodeState] of cases) {
      const w = mountCard({ stop: mkStop('sx', 0, status), nodeState })
      expect(w.find('[data-testid="driver-stop-card-status"]').text())
        .toBe(({ PENDING: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Entregada', SKIPPED: 'Omitida' } as const)[status])
    }
  })

  it('renders the optional folio in mono when present; omits it entirely when null/blank', async () => {
    const withFolio = mountCard({ stop: mkStop('s0', 0, 'PENDING', { saleFolio: 'FOLIO-77' }) })
    expect(withFolio.find('[data-testid="driver-stop-card-folio"]').text()).toContain('FOLIO-77')

    for (const folio of [null, '', '   ']) {
      const w = mountCard({ stop: mkStop('s0', 0, 'PENDING', { saleFolio: folio }) })
      expect(w.find('[data-testid="driver-stop-card-folio"]').exists()).toBe(false)
    }
  })

  it('renders the customer name; null customer falls back to the copy.ts fallback', async () => {
    const named = mountCard({ stop: mkStop('s0', 0, 'PENDING', { customer: { id: 'c', name: 'María López', email: null } }) })
    expect(named.find('[data-testid="driver-stop-card-customer"]').text()).toBe('María López')

    const anon = mountCard({ stop: mkStop('s0', 0, 'PENDING', { customer: null }) })
    expect(anon.find('[data-testid="driver-stop-card-customer"]').text())
      .toBe(DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback)
  })

  it('renders the formatted address via formatAddress; hides it when the address is null', async () => {
    const w = mountCard()
    const address = w.find('[data-testid="driver-stop-card-address"]')
    expect(address.exists()).toBe(true)
    // formatAddress ordering: street #exterior → neighborhood, municipality, city, state → CP.
    expect(address.text()).toContain('Reforma')
    expect(address.text()).toContain('06600')

    const bare = mountCard({ stop: mkStop('s0', 0, 'PENDING', { shippingAddress: null }) })
    expect(bare.find('[data-testid="driver-stop-card-address"]').exists()).toBe(false)
  })
})

describe('DriverStopCard — current / next emphasis (single signature anchor)', () => {
  it('current card carries a non-color emphasis marker + data attribute; others do not', async () => {
    const current = mountCard({ nodeState: 'current', isCurrent: true })
    expect(current.find('[data-testid="driver-stop-card-s0"]').attributes('data-current')).toBe('true')

    const upcoming = mountCard({ nodeState: 'upcoming', isCurrent: false })
    expect(upcoming.find('[data-testid="driver-stop-card-s0"]').attributes('data-current')).toBe('false')
  })

  it('next card renders the "Siguiente" badge from copy; non-next cards do not', async () => {
    const next = mountCard({ isNext: true })
    expect(next.find('[data-testid="driver-stop-card-next-badge"]').text())
      .toBe(DELIVERY_ROUTE_COPY.cockpit.stops.nextBadge)
    expect(mountCard({ isNext: false }).find('[data-testid="driver-stop-card-next-badge"]').exists()).toBe(false)
  })
})

describe('DriverStopCard — separate native controls, never nested buttons', () => {
  it('"Ver detalles" is always rendered as a standalone native button', async () => {
    const w = mountCard()
    const details = w.find('[data-testid="driver-stop-card-details"]')
    expect(details.exists()).toBe(true)
    expect(details.element.tagName.toLowerCase()).toBe('button')
    expect(details.attributes('type')).toBe('button')
    expect(details.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.stops.detailsLabel)
  })

  it('no interactive control is nested inside another interactive control', async () => {
    const rich = mountCard({ showCheckIn: true, isCurrent: true })
    expect(rich.find('button button').exists()).toBe(false)
    expect(rich.find('a button').exists()).toBe(false)
    expect(rich.find('button a').exists()).toBe(false)
  })

  it('both action buttons meet the 44px touch target with a focus-visible ring', async () => {
    const w = mountCard({ showCheckIn: true })
    for (const tid of ['driver-stop-card-details', 'driver-stop-card-check-in']) {
      const cls = w.find(`[data-testid="${tid}"]`).classes().join(' ')
      expect(cls).toMatch(/min-h-11/)
      expect(cls).toMatch(/min-w-11/)
      expect(cls).toMatch(/focus-visible/)
    }
  })

  it('action row stacks controls on narrow widths (max-sm) without desktop changes', async () => {
    const row = mountCard({ showCheckIn: true }).find('[data-testid="driver-stop-card-actions"]')
    const cls = row.classes().join(' ')
    expect(cls).toMatch(/flex/)
    expect(cls).toMatch(/max-sm:flex-col|flex-col/)
  })
})

describe('DriverStopCard — typed emits + check-in gating', () => {
  it('details click emits open-details exactly once with { stopId, trigger }', async () => {
    const stop = mkStop('s5', 4, 'PENDING')
    const w = mountCard({ stop })
    await w.find('[data-testid="driver-stop-card-details"]').trigger('click')
    const events = w.emitted('open-details')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as StopTrigger
    expect(payload.stopId).toBe('s5')
    expect(payload.trigger).toBe(w.find('[data-testid="driver-stop-card-details"]').element)
  })

  it('check-in button renders ONLY when showCheckIn=true and emits check-in { stopId, trigger } with a hyphen-separated aria-label', async () => {
    expect(mountCard({ showCheckIn: false }).find('[data-testid="driver-stop-card-check-in"]').exists()).toBe(false)

    const stop = mkStop('s1', 0, 'PENDING')
    const w = mountCard({ stop, showCheckIn: true })
    const btn = w.find('[data-testid="driver-stop-card-check-in"]')
    expect(btn.text()).toContain(DELIVERY_ROUTE_COPY.actions.checkIn)
    // Route-page evolution: the visible/ARIA separator is a regular hyphen, never an em dash.
    expect(btn.attributes('aria-label')).toBe(`Cliente 1 - ${DELIVERY_ROUTE_COPY.actions.checkIn}`)
    await btn.trigger('click')
    const events = w.emitted('check-in')
    expect(events).toHaveLength(1)
    expect((events![0]?.[0] as StopTrigger).stopId).toBe('s1')
    expect((events![0]?.[0] as StopTrigger).trigger).toBe(btn.element)
  })

  it('check-in button is disabled while checkInPending and emits nothing on synthesized click', async () => {
    const w = mountCard({ showCheckIn: true, checkInPending: true })
    const btn = w.find('[data-testid="driver-stop-card-check-in"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('check-in') ?? []).toHaveLength(0)
  })
})

describe('DriverStopCard — long content behavior (320px safe)', () => {
  it('customer + folio truncate intentionally; the address wraps to a controlled two lines without horizontal overflow', async () => {
    const longStop = mkStop('s0', 0, 'PENDING', {
      customer: { id: 'c', name: 'Concepción Hernández del Río Montejo y Sánchez de la Vega Firmat', email: null },
      saleFolio: 'FOLIO-EXTREMADAMENTE-LARGO-0001-ABCD-EFGH',
    })
    const w = mountCard({ stop: longStop })
    expect(w.find('[data-testid="driver-stop-card-customer"]').classes().join(' ')).toMatch(/truncate/)
    const addressCls = w.find('[data-testid="driver-stop-card-address"]').classes().join(' ')
    // Two-line clamp + word wrapping instead of aggressive single-line truncation.
    expect(addressCls).toMatch(/line-clamp-2/)
    expect(addressCls).toMatch(/break-words/)
    expect(addressCls).not.toMatch(/\btruncate\b/)
    expect(w.find('[data-testid="driver-stop-card-folio"]').classes().join(' ')).toMatch(/truncate/)
    // Root can never force horizontal overflow.
    expect(w.find('[data-testid="driver-stop-card-s0"]').classes().join(' ')).toMatch(/min-w-0/)
  })
})

describe('DriverStopCard — source-level invariants', () => {
  function body(): string {
    return fs.readFileSync((DriverStopCard as unknown as { __file: string }).__file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  }
  it.each([
    ['Ver detalles'],
    ['Marcar entregada'],
    ['Cliente sin nombre'],
    ['Siguiente'],
    ['Parada '],
  ])('SFC implementation body never hardcodes "%s" (must bind from copy.ts)', (literal) => {
    expect(body(), `forbidden inline literal: ${literal}`).not.toContain(literal)
  })
  it('contains no server-state / router / HTTP imports', () => {
    const b = body()
    expect(b).not.toMatch(/from\s+['"]vue-router['"]/)
    expect(b).not.toMatch(/useQuery|useMutation|useQueryClient|@tanstack\/vue-query/)
    expect(b).not.toMatch(/axios|fetch\(['"]/)
  })
  it('source: no visible/ARIA em-dash separator remains in the card markup (regular hyphen only)', () => {
    // body() strips comment blocks, so this pins the rendered template + aria bindings.
    expect(body()).not.toMatch(/—/)
  })
})
