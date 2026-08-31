// DriverRouteSpine.spec.ts — STRICT-TDD S6 (REQ-DCS-005, REQ-DRC-111 spine a11y).
// Presentational only; typed props { nodes }, typed emit 'select-stop' [StopTrigger].
// Backend order preserved verbatim; real <button> per node with textual status,
// aria-label "Parada N: Estado — Cliente", focus ring, 44×44, connector, no
// disabled on any node incl SKIPPED/non-current PENDING; Enter/Space emits once.

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DriverRouteSpine from '../DriverRouteSpine.vue'
import {
  DELIVERY_ROUTE_STOP_STATUS_LABELS,
  type DeliveryRouteStop,
} from '../../../interfaces/delivery-route.types'
import type { CockpitSpineNode, StopTrigger } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- node builtin
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
function mkNode(id: string, sortOrder: number, status: DeliveryRouteStop['status'], name: string,
  nodeState: CockpitSpineNode['nodeState'], isCurrent: boolean): CockpitSpineNode {
  return { stop: mkStop(id, sortOrder, status, name), nodeState, isCurrent, isSelectable: true }
}
function mountSpine(p: { nodes: CockpitSpineNode[] } = { nodes: [] }) {
  return mount(DriverRouteSpine, { props: p })
}

const FIVE = [
  mkNode('s0', 0, 'COMPLETED', 'Ana', 'completed', false),
  mkNode('s1', 1, 'COMPLETED', 'Bea', 'completed', false),
  mkNode('s2', 2, 'PENDING', 'Carlos', 'current', true),
  mkNode('s3', 3, 'PENDING', 'Dario', 'upcoming', false),
  mkNode('s4', 4, 'SKIPPED', 'Eli', 'skipped', false),
] as const

describe('DriverRouteSpine — ordered sequence + textual status (REQ-DCS-005)', () => {
  it('renders a real <ol> with one <button> per node in identical backend order', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-spine-root"]').element.tagName.toLowerCase()).toBe('ol')
    const items = w.findAll('[data-testid^="cockpit-spine-node-"]')
    expect(items).toHaveLength(FIVE.length)
    expect(items.map((i) => i.attributes('data-stop-id'))).toEqual(['s0', 's1', 's2', 's3', 's4'])
  })

  it('every node renders the textual stop-status label from the shared map', async () => {
    const labels = mountSpine({ nodes: [...FIVE] }).findAll('[data-testid="cockpit-spine-status-label"]')
    expect(labels.map((l) => l.text())).toEqual([
      DELIVERY_ROUTE_STOP_STATUS_LABELS.COMPLETED,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.COMPLETED,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.PENDING,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.PENDING,
      DELIVERY_ROUTE_STOP_STATUS_LABELS.SKIPPED,
    ])
  })

  it('renders a connector between nodes', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    expect(w.findAll('[data-testid="cockpit-spine-connector"]')).toHaveLength(FIVE.length - 1)
  })

  it('empty nodes array renders "Sin paradas" central copy and no <ol>', async () => {
    const w = mountSpine({ nodes: [] })
    expect(w.text()).toContain('Sin paradas')
    expect(w.find('[data-testid="cockpit-spine-root"]').exists()).toBe(false)
    expect(w.findAll('[data-testid^="cockpit-spine-node-"]')).toHaveLength(0)
  })
})

describe('DriverRouteSpine — descriptive aria-label (REQ-DCS-005)', () => {
  it('every aria-label carries "Parada N" 1-based + status + em-dash + customer', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    expect(w.findAll('[data-testid^="cockpit-spine-node-"]').map((i) => i.attributes('aria-label'))).toEqual([
      'Parada 1: Entregada — Ana',
      'Parada 2: Entregada — Bea',
      'Parada 3: Pendiente — Carlos',
      'Parada 4: Pendiente — Dario',
      'Parada 5: Omitida — Eli',
    ])
  })

  it('null customer falls back to "Cliente sin nombre" in the aria-label', async () => {
    const nodes: CockpitSpineNode[] = [mkNode('only', 0, 'PENDING', 'X', 'current', true)]
    nodes[0]!.stop.customer = null
    expect(mountSpine({ nodes }).find('[data-testid="cockpit-spine-node-only"]').attributes('aria-label'))
      .toBe('Parada 1: Pendiente — Cliente sin nombre')
  })

  // B2 shell review: per-node aria-label is built from the central
  // `cockpit.spine.nodeAriaLabel` template so the screen-reader narrative is
  // owned by `copy.ts`. The exact string the template produces MUST match the
  // existing spec-pinned strings (preserved verbatim above); this test only
  // pins that the renderer reads from copy.ts and never holds the literal.
  it('per-node aria-label interpolates cockpit.spine.nodeAriaLabel template + DELIVERY_ROUTE_STOP_STATUS_LABELS', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const labels = w.findAll('[data-testid^="cockpit-spine-node-"]').map((n) => n.attributes('aria-label') ?? '')
    const tpl = DELIVERY_ROUTE_COPY.cockpit.spine.nodeAriaLabel
    // Interpolation contract: 5 nodes in FIVE → 1..5; statuses in FIVE order
    // map onto the spec-pinned labels.
    const expected = FIVE.map((node, idx) =>
      tpl
        .replace('{N}', String(idx + 1))
        .replace('{status}', DELIVERY_ROUTE_STOP_STATUS_LABELS[node.stop.status])
        .replace('{customer}', node.stop.customer?.name ?? DELIVERY_ROUTE_COPY.cockpit.operational.customerFallback),
    )
    expect(labels).toEqual(expected)
  })

  it('spine root carries the central cockpit.spine.rootAriaLabel ("Recorrido de la ruta")', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const root = w.find('[data-testid="cockpit-spine-root"]')
    expect(root.exists()).toBe(true)
    expect(root.attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.cockpit.spine.rootAriaLabel)
    expect(root.attributes('aria-label')).toBe('Recorrido de la ruta')
  })

  it('every visible position span interpolates cockpit.operational.positionLabel verbatim', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const spans = w.findAll('[data-testid="cockpit-spine-position"]')
    const tpl = DELIVERY_ROUTE_COPY.cockpit.operational.positionLabel
    const texts = spans.map((s) => s.text())
    const expected = FIVE.map((node, idx) => tpl.replace('{N}', String(idx + 1)))
    expect(texts).toEqual(expected)
  })
})

describe('DriverRouteSpine — select-stop activation (REQ-DCS-005, REQ-DRC-111)', () => {
  it.each([
    ['completed', 's0'], ['current', 's2'], ['upcoming', 's3'], ['skipped', 's4'],
  ] as const)('Enter on %s node emits select-stop once with the originating element', async (_state, stopId) => {
    const w = mountSpine({ nodes: [...FIVE] })
    const btn = w.find(`[data-testid="cockpit-spine-node-${stopId}"]`)
    await btn.trigger('keydown', { key: 'Enter' })
    await btn.trigger('click')
    const events = w.emitted('select-stop')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as StopTrigger
    expect(payload.stopId).toBe(stopId)
    expect(payload.trigger).toBe(btn.element)
  })

  it('Space on a focused node emits select-stop once (native button keyboard semantics)', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const btn = w.find('[data-testid="cockpit-spine-node-s3"]')
    await btn.trigger('keydown', { key: ' ' })
    await btn.trigger('click')
    expect(w.emitted('select-stop')).toHaveLength(1)
  })

  it('SKIPPED and later (non-current) PENDING nodes carry NO disabled/locked attribute', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    for (const id of ['s3', 's4']) {
      const btn = w.find(`[data-testid="cockpit-spine-node-${id}"]`)
      expect(btn.attributes('disabled')).toBeUndefined()
      expect(btn.attributes('aria-disabled')).toBeUndefined()
      expect(btn.attributes('aria-readonly')).toBeUndefined()
      expect(btn.classes().join(' ')).not.toMatch(/opacity-40|cursor-not-allowed/)
    }
  })

  it('click on SKIPPED and later PENDING nodes emits select-stop', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    for (const stopId of ['s3', 's4']) {
      await w.find(`[data-testid="cockpit-spine-node-${stopId}"]`).trigger('click')
    }
    const ids = (w.emitted('select-stop') ?? []).map((e) => (e[0] as StopTrigger).stopId)
    expect(ids).toEqual(['s3', 's4'])
  })
})

describe('DriverRouteSpine — current marker without color-only (REQ-DCS-005)', () => {
  it('current carries a visible marker + non-color emphasis; non-current do not', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const cur = w.find('[data-testid="cockpit-spine-node-s2"]')
    const marker = cur.find('[data-testid="cockpit-spine-current-marker"]')
    expect(marker.exists()).toBe(true)
    expect(marker.element.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    expect(cur.text()).toContain(DELIVERY_ROUTE_STOP_STATUS_LABELS.PENDING)
    expect(w.find('[data-testid="cockpit-spine-node-s0"]').find('[data-testid="cockpit-spine-current-marker"]').exists()).toBe(false)
  })
})

describe('DriverRouteSpine — triangulation (adjacent inputs)', () => {
  it('IN_PROGRESS renders "En curso" label and aria-label verbatim', async () => {
    const nodes: CockpitSpineNode[] = [mkNode('ip', 0, 'IN_PROGRESS', 'Fer', 'current', true)]
    const w = mountSpine({ nodes })
    expect(w.text()).toContain('En curso')
    expect(w.find('[data-testid="cockpit-spine-node-ip"]').attributes('aria-label')).toBe('Parada 1: En curso — Fer')
  })

  it('all-COMPLETED spine renders NO current marker AND preserves order', async () => {
    const nodes: CockpitSpineNode[] = [
      mkNode('a', 0, 'COMPLETED', 'A', 'completed', false),
      mkNode('b', 1, 'COMPLETED', 'B', 'completed', false),
    ]
    const w = mountSpine({ nodes })
    expect(w.findAll('[data-testid="cockpit-spine-current-marker"]')).toHaveLength(0)
    expect(w.findAll('[data-testid^="cockpit-spine-node-"]').map((i) => i.attributes('data-stop-id')))
      .toEqual(['a', 'b'])
  })

  it('reactive prop update: replacing nodes re-renders in the new backend order', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const swapped: CockpitSpineNode[] = [
      mkNode('s4', 4, 'SKIPPED', 'Eli', 'upcoming', false),
      mkNode('s3', 3, 'PENDING', 'Dario', 'current', true),
    ]
    await w.setProps({ nodes: swapped })
    const ids = w.findAll('[data-testid^="cockpit-spine-node-"]').map((i) => i.attributes('data-stop-id'))
    expect(ids).toEqual(['s4', 's3'])
    expect(w.find('[data-testid="cockpit-spine-current-marker"]').exists()).toBe(true)
  })
})

describe('DriverRouteSpine — touch + a11y + mobile-first (REQ-DRC-111)', () => {
  it('every node button carries ≥44×44 classes and a visible focus ring', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    for (const id of ['s0', 's1', 's2', 's3', 's4']) {
      const cls = w.find(`[data-testid="cockpit-spine-node-${id}"]`).classes().join(' ')
      expect(cls).toMatch(/min-h-11/)
      expect(cls).toMatch(/min-w-11/)
      expect(cls).toMatch(/focus-visible/)
    }
  })

  it('spine root uses semantic tokens, min-w-0, and no fixed width (320px safe)', async () => {
    const cls = mountSpine({ nodes: [...FIVE] }).find('[data-testid="cockpit-spine-root"]').classes().join(' ')
    expect(cls).toContain('min-w-0')
    expect(cls).toMatch(/border-default|bg-(default|elevated)/)
    expect(cls).not.toMatch(/w-\[|min-w-\[/)
  })
})

// S4 viewport polish (REQ-DCS-011/012): real-app evidence at 360×780 CSS px
// with 110% browser zoom (~327px effective) showed the CURRENT row truncating
// "Cliente Centro" to "Cliente Ce..." because the fixed chrome (marker,
// position, status) consumed the row before the customer got its share. The
// compaction below is mobile-only (`max-sm:*`): the overflow-safety
// `min-w-0 flex-1 truncate` on the customer span is preserved VERBATIM so
// `truncate` fires only at REAL overflow, and desktop classes stay untouched.
describe('DriverRouteSpine — S4 viewport polish: row chrome yields to customer width (REQ-DCS-011/012)', () => {
  it('customer span keeps min-w-0 flex-1 truncate (overflow-safety preserved under compaction)', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const cls = w.find('[data-testid="cockpit-spine-customer"]').classes().join(' ')
    expect(cls).toMatch(/\bmin-w-0\b/)
    expect(cls).toMatch(/\bflex-1\b/)
    expect(cls).toMatch(/\btruncate\b/)
  })

  it('node button carries max-sm compaction (gap-1.5, px-2.5) while keeping desktop gap-2/px-3', async () => {
    const btn = mountSpine({ nodes: [...FIVE] }).find('[data-testid="cockpit-spine-node-s2"]')
    const cls = btn.classes().join(' ')
    expect(cls).toMatch(/\bgap-2\b/) // desktop baseline unchanged
    expect(cls).toMatch(/max-sm:gap-1\.5/) // mobile compaction
    expect(cls).toMatch(/\bpx-3\b/) // desktop baseline unchanged
    expect(cls).toMatch(/max-sm:px-2\.5/) // mobile compaction
  })

  it('current-row marker and secondary labels compact under max-sm without losing desktop size', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const marker = w.find('[data-testid="cockpit-spine-current-marker"]')
    expect(marker.classes().join(' ')).toMatch(/\bh-5\b/)
    expect(marker.classes().join(' ')).toMatch(/max-sm:h-4/)
    expect(marker.classes().join(' ')).toMatch(/max-sm:w-4/)
    expect(w.find('[data-testid="cockpit-spine-position"]').classes().join(' ')).toMatch(/max-sm:text-\[11px\]/)
    expect(w.find('[data-testid="cockpit-spine-status-label"]').classes().join(' ')).toMatch(/max-sm:text-\[11px\]/)
  })

  it('spine list item indents max-sm:pl-5 (timeline indent yields 4px to the row)', async () => {
    const w = mountSpine({ nodes: [...FIVE] })
    const li = w.find('[data-testid="cockpit-spine-node-s2"]').element.parentElement
    expect(li).not.toBeNull()
    expect(li!.className).toMatch(/max-sm:pl-5/)
  })
})

describe('DriverRouteSpine — source-level invariants (REQ-DCS-005, design §6)', () => {
  function body(): string {
    // Strip all top-of-file block comments + line comments so the source
    // invariant never false-positives on JSDoc / inline notes. The strip is
    // intentionally aggressive: hardcoded user-visible literals belong in
    // copy.ts, not in the implementation body.
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
  // B2 shell review: every user-visible literal pinned by the spec must be
  // sourced from `copy.ts`. Hardcoding any of these in the implementation
  // body fails this assertion so future drift regresses immediately.
  it.each([
    ['Sin paradas'],
    ['Recorrido de la ruta'],
    ['Cliente sin nombre'],
  ])('SFC implementation body never hardcodes "%s" (must bind from copy.ts)', (literal) => {
    expect(body(), `forbidden inline literal: ${literal}`).not.toContain(literal)
  })
  // B2 shell review: the visible "Parada N" position text and the per-node
  // aria-label must come from the central templates. The implementation body
  // must never interpolate "Parada " directly — that literal lives in copy.ts.
  it('SFC implementation body never hardcodes "Parada " (must bind from copy.ts templates)', () => {
    const b = body()
    expect(b, 'visible "Parada " literal leaked into implementation body').not.toContain('Parada ')
  })
})
