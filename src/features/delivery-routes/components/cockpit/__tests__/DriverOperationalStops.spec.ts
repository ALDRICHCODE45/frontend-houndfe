// DriverOperationalStops.spec.ts — STRICT-TDD S5 (design §3-§4; REQ-DCS-003/004; REQ-DRC-112). Presentational only. Typed props/emits per design.md §3; typed StopTrigger payload reused from useDriverRouteCockpit.

import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DriverOperationalStops from '../DriverOperationalStops.vue'
import type { DeliveryRouteStop, DeliveryRouteShippingAddress } from '../../../interfaces/delivery-route.types'
// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const EntityAvatarStub = defineComponent({
  name: 'EntityAvatar',
  props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  template: '<span data-testid="entity-avatar-stub" :data-name="name" :data-seed="seed" :data-size="size" />',
})

function makeAddress(o: Partial<DeliveryRouteShippingAddress> = {}): DeliveryRouteShippingAddress {
  return { id: 'addr', street: 'Av. Reforma', exteriorNumber: '100', interiorNumber: null,
    zipCode: '06600', neighborhood: 'Juárez', municipality: 'Cuauhtémoc',
    city: 'CDMX', state: 'CDMX', label: null, latitude: 19.4326, longitude: -99.1332, ...o }
}

function makeStop(o: Partial<DeliveryRouteStop> & { sortOrder?: number } = {}): DeliveryRouteStop {
  const sortOrder = o.sortOrder ?? 0
  return {
    id: o.id ?? `stop-${sortOrder}`, saleId: `sale-${sortOrder}`,
    // !== undefined so an explicit null override survives the default.
    saleFolio: o.saleFolio !== undefined ? o.saleFolio : `F-${sortOrder}`,
    sortOrder, status: o.status ?? 'PENDING',
    checkedInAt: null, completedAt: null,
    customer: o.customer !== undefined ? o.customer : { id: `c-${sortOrder}`, name: 'Ana', email: 'a@x' },
    shippingAddress: o.shippingAddress !== undefined ? o.shippingAddress : makeAddress(),
  }
}

function mountStops(props: Record<string, unknown> = {}) {
  return mount(DriverOperationalStops, {
    props: {
      currentStop: null, nextStop: null, notes: null, hasStops: false, isTerminal: false, ...props,
    },
    global: { stubs: { EntityAvatar: EntityAvatarStub } },
  })
}

describe('DriverOperationalStops — current section (REQ-DCS-003)', () => {
  it.each([
    ['PENDING', /(#f6bb13|f6bb13|gold|cockpit-pending)/i],
    ['IN_PROGRESS', /(#173968|173968|navy|cockpit-in-progress)/i],
  ] as const)('%s current carries the matching emphasis class (other triangulation fields render too)', (status, marker) => {
    const stop = makeStop({
      sortOrder: 4, saleFolio: 'F-099', status,
      customer: { id: 'c-i', name: 'Maria', email: 'm@x' },
      shippingAddress: makeAddress({ street: 'Av. Insurgentes' }),
    })
    const w = mountStops({ currentStop: stop, hasStops: true, notes: 'Llamar antes de llegar' })
    const cls = w.find('[data-testid="cockpit-current-card"]').classes().join(' ')
    expect(cls).toMatch(marker)
    expect(w.text()).toContain('Parada 5')
    expect(w.text()).toContain('F-099')
    expect(w.text()).toContain('Maria')
    expect(w.find('[data-testid="cockpit-current-avatar"]').exists()).toBe(true)
    expect(w.find('[data-testid="cockpit-current-address"]').exists()).toBe(true)
    expect(w.find('[data-testid="cockpit-current-notes"]').exists()).toBe(true)
  })

  it('"other" current states are muted (no gold/navy hue)', () => {
    const cls = mountStops({ currentStop: makeStop({ status: 'COMPLETED' }) })
      .find('[data-testid="cockpit-current-card"]').classes().join(' ')
    expect(cls).not.toMatch(/(#f6bb13|f6bb13|gold|#173968|173968|navy)/i)
  })

  it('null current renders the fallback copy with NO customer/address/avatar/card decoration', () => {
    const w = mountStops({ currentStop: null, hasStops: false, isTerminal: false })
    expect(w.text()).toContain('Sin parada activa')
    expect(w.find('[data-testid="cockpit-current-card"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-current-customer"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-current-address"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-current-notes"]').exists()).toBe(false)
    expect(w.find('[data-testid="entity-avatar-stub"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/Sin parada activa[\s,·—]*\n/)
  })

  it('null customer uses the stop-id avatar seed + customer-fallback copy', () => {
    const w = mountStops({ currentStop: makeStop({ id: 's-42', customer: null }), hasStops: true })
    const avatar = w.find('[data-testid="cockpit-current-avatar"]')
    expect(avatar.attributes('data-seed')).toBe('s-42')
    expect(avatar.attributes('data-name')).toBe('Cliente sin nombre')
    expect(w.text()).toContain('Cliente sin nombre')
  })

  it('null address and null notes omit their rows; folio omitted when saleFolio null', () => {
    const w = mountStops({
      currentStop: makeStop({ shippingAddress: null, saleFolio: null }),
      hasStops: true, notes: null,
    })
    expect(w.find('[data-testid="cockpit-current-address"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-current-notes"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-current-folio"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/:\s*\n|:\s*$|—\s*\n/)
  })

  it('"Notas de la ruta" rendered only when notes is non-empty (null/whitespace omitted)', () => {
    const cases = [
      { notes: null, expect: false },
      { notes: '   ', expect: false },
      { notes: 'Tocar timbre 2 veces', expect: true },
    ] as const
    for (const c of cases) {
      const w = mountStops({ currentStop: makeStop(), hasStops: true, notes: c.notes })
      expect(w.find('[data-testid="cockpit-current-notes"]').exists()).toBe(c.expect)
    }
    const filled = mountStops({ currentStop: makeStop(), hasStops: true, notes: 'Tocar timbre 2 veces' })
    expect(filled.text()).toContain('Notas de la ruta')
  })
})

describe('DriverOperationalStops — next section (REQ-DCS-004)', () => {
  it('next preview shows position/customer/address and NO ETA / distance / map / avatar (low emphasis)', () => {
    const w = mountStops({
      currentStop: makeStop({ sortOrder: 0 }),
      nextStop: makeStop({ id: 'n-1', sortOrder: 1, saleFolio: null }),
      hasStops: true,
    })
    expect(w.text()).toContain('Siguiente · Parada 2')
    expect(w.text()).not.toContain('{N}')
    expect(w.find('[data-testid="cockpit-next-customer"]').exists()).toBe(true)
    expect(w.find('[data-testid="cockpit-next-address"]').exists()).toBe(true)
    expect(w.find('[data-testid="cockpit-next-map"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/ETA|distancia|\bkm\b|\bmin\b/i)
    expect(w.find('[data-testid="entity-avatar-stub"]').exists()).toBe(false)
  })

  it.each([
    ['Última parada (non-terminal)', makeStop({ status: 'PENDING', sortOrder: 0 }), null, false, true, 'cockpit-next-empty-last', 'Última parada'],
    ['No hay más pendientes (terminal)', null, null, true, true, 'cockpit-next-empty-no-more', 'No hay más pendientes'],
    ['empty route (no fabricated next)', null, null, false, false, '', ''],
    ['empty + terminal (still none)', null, null, true, false, '', ''],
  ] as const)('empty branches: %s', (_label, current, next, terminal, hasStops, testId, copy) => {
    const w = mountStops({ currentStop: current, nextStop: next, hasStops, isTerminal: terminal })
    if (testId === '') {
      expect(w.find('[data-testid="cockpit-next-section"]').exists()).toBe(false)
      expect(w.text()).not.toMatch(/Siguiente|Última|No hay más/)
    } else {
      expect(w.find(`[data-testid="${testId}"]`).exists()).toBe(true)
      expect(w.text()).toContain(copy)
    }
  })

  it('terminal beats non-terminal: terminal + null next + hasStops → no-more-pending (not last-stop)', () => {
    const w = mountStops({ currentStop: null, nextStop: null, hasStops: true, isTerminal: true })
    expect(w.find('[data-testid="cockpit-next-empty-no-more"]').exists()).toBe(true)
    expect(w.find('[data-testid="cockpit-next-empty-last"]').exists()).toBe(false)
  })

  it('null next customer uses fallback copy; null next address omits row without stray punctuation', () => {
    const w1 = mountStops({
      currentStop: makeStop({ sortOrder: 0 }),
      nextStop: makeStop({ id: 'n-9', sortOrder: 1, customer: null }),
      hasStops: true,
    })
    expect(w1.find('[data-testid="cockpit-next-customer"]').text()).toContain('Cliente sin nombre')

    const w2 = mountStops({
      currentStop: makeStop({ sortOrder: 0 }),
      nextStop: makeStop({ sortOrder: 1, shippingAddress: null }),
      hasStops: true,
    })
    expect(w2.find('[data-testid="cockpit-next-address"]').exists()).toBe(false)
    expect(w2.text()).not.toMatch(/:\s*\n|—\s*\n/)
  })
})

describe('DriverOperationalStops — open-stop emit + touch + a11y', () => {
  it.each([
    ['current', makeStop({ id: 'cur-1' }), 'cockpit-current-card', 'cur-1'],
    ['next', makeStop({ id: 'next-1', sortOrder: 1 }), 'cockpit-next-card', 'next-1'],
  ] as const)('%s card emits open-stop once with { stopId, trigger } from the originating element', async (which, stop, testId, expectedId) => {
    const props = which === 'current'
      ? { currentStop: stop, hasStops: true }
      : { currentStop: makeStop({ sortOrder: 0 }), nextStop: stop, hasStops: true }
    const w = mountStops(props)
    await flushPromises()
    const card = w.find(`[data-testid="${testId}"]`)
    await card.trigger('click')
    const events = w.emitted('open-stop')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as { stopId: string; trigger: HTMLElement | null }
    expect(payload.stopId).toBe(expectedId)
    expect(payload.trigger).toBe(card.element)
  })

  it('current + next cards carry ≥44px touch targets + focus-visible', () => {
    const w = mountStops({
      currentStop: makeStop(),
      nextStop: makeStop({ id: 'n-1', sortOrder: 1 }),
      hasStops: true,
    })
    for (const tid of ['cockpit-current-card', 'cockpit-next-card']) {
      const cls = w.find(`[data-testid="${tid}"]`).classes().join(' ')
      expect(cls).toMatch(/min-h-11/)
      expect(cls).toMatch(/focus-visible/)
    }
  })

  it('empty branches ("Última parada" / "No hay más pendientes") are NOT triggers', async () => {
    const w = mountStops({
      currentStop: makeStop({ status: 'PENDING' }),
      nextStop: null, hasStops: true, isTerminal: false,
    })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-next-empty-last"]').exists()).toBe(true)
    expect(w.emitted('open-stop') ?? []).toHaveLength(0)
  })
})

describe('DriverOperationalStops — source-level invariants', () => {
  function body(): string {
    const path = (DriverOperationalStops as unknown as { __file: string }).__file
    return fs.readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
  }

  it.each([
    ['Sin parada activa'], ['Cliente sin nombre'], ['Notas de la ruta'],
    ['Siguiente · Parada'], ['Última parada'], ['No hay más pendientes'],
  ])('SFC source never hardcodes "%s" (must bind from copy.ts)', (literal) => {
    expect(body(), `forbidden inline literal: ${literal}`).not.toContain(literal)
  })

  it('SFC source contains no vue-router / useQuery / useMutation / axios / fetch( import', () => {
    const b = body()
    expect(b).not.toMatch(/from\s+['"]vue-router['"]/)
    expect(b).not.toMatch(/useRouter|useRoute\b/)
    expect(b).not.toMatch(/useQuery|useMutation|useQueryClient|@tanstack\/vue-query/)
    expect(b).not.toMatch(/axios|fetch\(['"]/)
  })
})
