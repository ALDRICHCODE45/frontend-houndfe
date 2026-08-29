// DriverCockpitFooter.spec.ts — STRICT-TDD S7 of `driver-route-cockpit-redesign`
// (design.md §3, §9.2-§9.3; specs/driver-cockpit-shell REQ-DCS-006/008/009;
// REQ-DRC-111 footer 44px + safe-area bottom padding).
//
// CONTRACT — exactly one of four mutually exclusive modes per render:
//   1. current-action : non-terminal + current PENDING + canCheckIn. Central ≥44px
//        primary delivery action (enabled while !checkInPending; handler early-
//        returns so disabled clicks emit nothing). Emits 'request-confirm' { stopId, trigger }.
//   2. in-progress    : current IN_PROGRESS. One disabled indicator. NO button, NO emit.
//   3. terminal       : COMPLETED or CANCELLED. Summary copy + history action. Emits
//        'open-history' { trigger }. NO delivery action.
//   4. empty          : null current / non-actionable current / !hasStops.
//
// Typed props: { routeStatus, currentStop, progress, hasStops, canCheckIn, checkInPending }.
// Typed emits: 'request-confirm': [StopTrigger]; 'open-history': [{ trigger }].
//
// Source invariants (static source scan, JSDoc stripped): no vue-router, useQuery,
// useMutation, useQueryClient, axios, fetch(; no useCheckInStop / invalidate /
// refetch / mutateAsync; no inline Spanish literals; no duplicated <button> markup;
// footer root carries pb-[env(safe-area-inset-bottom)] in every mode.

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DriverCockpitFooter from '../DriverCockpitFooter.vue'
import type {
  DeliveryRouteStatus,
  DeliveryRouteStop,
} from '../../../interfaces/delivery-route.types'
import type {
  CockpitProgress,
  StopTrigger,
} from '../../../composables/cockpit/useDriverRouteCockpit'

// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const ADDR = {
  id: 'a', street: 'Reforma', exteriorNumber: '1', interiorNumber: null,
  zipCode: '06600', neighborhood: 'C', municipality: 'C', city: 'CDMX',
  state: 'CMX', label: null, latitude: null, longitude: null,
}

function mkStop(id: string, sortOrder: number, status: DeliveryRouteStop['status']): DeliveryRouteStop {
  return {
    id, saleId: `s-${id}`, saleFolio: `F-${sortOrder + 1}`, sortOrder, status,
    checkedInAt: null, completedAt: null,
    customer: { id: `c-${id}`, name: 'Ana', email: 'a@x' },
    shippingAddress: { ...ADDR, id: `a-${id}` },
  }
}

interface FooterProps {
  routeStatus?: DeliveryRouteStatus
  currentStop?: DeliveryRouteStop | null
  progress?: CockpitProgress
  hasStops?: boolean
  canCheckIn?: boolean
  checkInPending?: boolean
}

function mountFooter(p: FooterProps = {}) {
  return mount(DriverCockpitFooter, {
    props: {
      routeStatus: 'ACTIVE',
      currentStop: mkStop('s0', 0, 'PENDING'),
      progress: { completed: 0, total: 5 } as CockpitProgress,
      hasStops: true, canCheckIn: true, checkInPending: false, ...p,
    },
  })
}

const SAFE_AREA_RE = /pb-\[env\(safe-area-inset-bottom\)\]/

describe('DriverCockpitFooter — current-action mode (REQ-DCS-006)', () => {
  it('PENDING + canCheckIn + not pending: enabled ≥44px central action + emits once', async () => {
    const w = mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'),
      canCheckIn: true, checkInPending: false,
    })
    await flushPromises()
    const btn = w.find('[data-testid="cockpit-footer-action"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Marcar entregada')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
    expect(btn.classes()).toContain('min-h-11')
    expect(btn.classes()).toContain('min-w-11')
    expect(btn.classes().join(' ')).toMatch(/focus-visible|coco-gold/)
    expect(w.find('[data-testid="cockpit-footer-in-progress"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-footer-history"]').exists()).toBe(false)
    await btn.trigger('click')
    const events = w.emitted('request-confirm')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as StopTrigger
    expect(payload.stopId).toBe('s2')
    expect(payload.trigger).toBe(btn.element)
  })

  it('checkInPending=true: button disabled; repeated clicks emit nothing (REQ-DCS-006)', async () => {
    const w = mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'),
      canCheckIn: true, checkInPending: true,
    })
    await flushPromises()
    const btn = w.find('[data-testid="cockpit-footer-action"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    await btn.trigger('click'); await btn.trigger('click'); await btn.trigger('click')
    expect(w.emitted('request-confirm') ?? []).toHaveLength(0)
  })

  it('PENDING + !canCheckIn: NO delivery action (read-only driver, empty mode)', async () => {
    const w = mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'),
      canCheckIn: false,
    })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-footer-action"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-footer-history"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Marcar entregada')
  })
})

describe('DriverCockpitFooter — IN_PROGRESS + terminal + empty modes', () => {
  it('IN_PROGRESS renders one disabled indicator element (no button, no emit)', async () => {
    const w = mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s3', 3, 'IN_PROGRESS'),
      canCheckIn: true,
    })
    await flushPromises()
    const ip = w.find('[data-testid="cockpit-footer-in-progress"]')
    expect(ip.exists()).toBe(true)
    expect(ip.element.tagName.toLowerCase()).not.toBe('button')
    expect(w.find('[data-testid="cockpit-footer-action"]').exists()).toBe(false)
    expect(w.emitted('request-confirm') ?? []).toHaveLength(0)
    expect(w.emitted('open-history') ?? []).toHaveLength(0)
  })

  it.each([
    ['COMPLETED', 'Ruta completada', 'Entregaste 5 de 5 paradas.'],
    ['CANCELLED', 'Ruta cancelada', 'Esta ruta fue cancelada.'],
  ] as const)('terminal %s renders summary + history action + emits open-history with trigger', async (status, title, summary) => {
    const w = mountFooter({
      routeStatus: status, currentStop: mkStop('s0', 0, 'COMPLETED'),
      progress: { completed: 5, total: 5 } as CockpitProgress, canCheckIn: true,
    })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-footer-action"]').exists()).toBe(false)
    expect(w.text()).toContain(title)
    expect(w.text()).toContain(summary)
    const history = w.find('[data-testid="cockpit-footer-history"]')
    expect(history.exists()).toBe(true)
    expect(history.text()).toContain('Ver historial')
    await history.trigger('click')
    const events = w.emitted('open-history')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as { trigger: HTMLElement }
    expect(payload.trigger).toBe(history.element)
  })

  it.each([
    ['null current', { currentStop: null, hasStops: true }],
    ['SKIPPED current', { currentStop: mkStop('s1', 1, 'SKIPPED'), hasStops: true }],
    ['zero stops', { currentStop: null, hasStops: false }],
  ] as const)('empty mode (%s) renders NO controls', async (_l, overrides) => {
    const w = mountFooter({ routeStatus: 'ACTIVE', canCheckIn: true, ...overrides })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-footer-action"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-footer-history"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-footer-in-progress"]').exists()).toBe(false)
  })
})

describe('DriverCockpitFooter — mutual exclusivity + no duplicated button markup', () => {
  it.each([
    ['current-action', { routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), canCheckIn: true, checkInPending: false }, 1],
    ['disabled action', { routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), canCheckIn: true, checkInPending: true }, 1],
    ['in-progress', { routeStatus: 'ACTIVE', currentStop: mkStop('s3', 3, 'IN_PROGRESS'), canCheckIn: true }, 0],
    ['COMPLETED', { routeStatus: 'COMPLETED', currentStop: mkStop('s0', 0, 'COMPLETED'), progress: { completed: 5, total: 5 } as CockpitProgress, canCheckIn: true }, 1],
    ['CANCELLED', { routeStatus: 'CANCELLED', currentStop: mkStop('s0', 0, 'COMPLETED'), canCheckIn: true }, 1],
    ['null current', { routeStatus: 'ACTIVE', currentStop: null, hasStops: true, canCheckIn: true }, 0],
    ['SKIPPED current', { routeStatus: 'ACTIVE', currentStop: mkStop('s1', 1, 'SKIPPED'), hasStops: true, canCheckIn: true }, 0],
    ['PENDING + !canCheckIn', { routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), hasStops: true, canCheckIn: false }, 0],
    ['zero stops', { routeStatus: 'ACTIVE', currentStop: null, hasStops: false, canCheckIn: true }, 0],
  ] as const)('%s renders exactly %i <button>s (at most one per mode)', async (_l, props, buttons) => {
    const w = mountFooter(props)
    await flushPromises()
    const action = w.find('[data-testid="cockpit-footer-action"]').exists()
    const ip = w.find('[data-testid="cockpit-footer-in-progress"]').exists()
    const history = w.find('[data-testid="cockpit-footer-history"]').exists()
    const rendered = (action ? 1 : 0) + (ip ? 1 : 0) + (history ? 1 : 0)
    expect(rendered).toBeLessThanOrEqual(1)
    expect(w.findAll('button')).toHaveLength(buttons)
  })
})

describe('DriverCockpitFooter — safe-area + a11y + mobile 320px + Coco tokens (REQ-DRC-111)', () => {
  it('every mode mounts the safe-area padding class', async () => {
    const variants: FooterProps[] = [
      { routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), canCheckIn: true, checkInPending: false },
      { routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), canCheckIn: true, checkInPending: true },
      { routeStatus: 'ACTIVE', currentStop: mkStop('s3', 3, 'IN_PROGRESS'), canCheckIn: true },
      { routeStatus: 'COMPLETED', currentStop: mkStop('s0', 0, 'COMPLETED'), canCheckIn: true },
      { routeStatus: 'CANCELLED', currentStop: mkStop('s0', 0, 'COMPLETED'), canCheckIn: true },
      { routeStatus: 'ACTIVE', currentStop: null, hasStops: true, canCheckIn: true },
      { routeStatus: 'ACTIVE', currentStop: null, hasStops: false, canCheckIn: true },
    ]
    for (const p of variants) {
      const cls = mountFooter(p).find('[data-testid="cockpit-footer-root"]').classes().join(' ')
      expect(cls).toMatch(SAFE_AREA_RE)
    }
  })

  it('footer uses semantic tokens + min-w-0 + sticky; never fixed/absolute or fixed widths (320px safe)', async () => {
    const cls = mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), canCheckIn: true,
    }).find('[data-testid="cockpit-footer-root"]').classes().join(' ')
    expect(cls).toMatch(/bg-(default|elevated)/)
    expect(cls).toMatch(/border-default/)
    expect(cls).toMatch(/min-w-0/)
    expect(cls).toMatch(/sticky/)
    expect(cls).not.toMatch(/\bw-\[|\bmin-w-\[/)
    expect(cls).not.toMatch(/\bfixed\b|\babsolute\b/)
  })

  it('current-action uses Coco gold accent; terminal history uses semantic muted token', async () => {
    expect(mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'), canCheckIn: true,
    }).find('[data-testid="cockpit-footer-action"]').classes().join(' ')).toMatch(/coco-gold/)
    const histCls = mountFooter({
      routeStatus: 'COMPLETED', currentStop: mkStop('s0', 0, 'COMPLETED'),
      progress: { completed: 5, total: 5 } as CockpitProgress, canCheckIn: true,
    }).find('[data-testid="cockpit-footer-history"]').classes().join(' ')
    expect(histCls).toMatch(/text-default|text-muted/)
    expect(histCls).not.toMatch(/coco-gold/)
  })
})

describe('DriverCockpitFooter — triangulation: reactive prop swaps + interpolation', () => {
  it('routeStatus ACTIVE → COMPLETED switches mode; checkInPending false → true toggles disabled', async () => {
    const w = mountFooter({
      routeStatus: 'ACTIVE', currentStop: mkStop('s2', 2, 'PENDING'),
      canCheckIn: true, checkInPending: false,
    })
    await flushPromises()
    expect((w.find('[data-testid="cockpit-footer-action"]').element as HTMLButtonElement).disabled).toBe(false)
    await w.setProps({ checkInPending: true })
    await flushPromises()
    expect((w.find('[data-testid="cockpit-footer-action"]').element as HTMLButtonElement).disabled).toBe(true)
    await w.setProps({ routeStatus: 'COMPLETED' })
    await flushPromises()
    expect(w.find('[data-testid="cockpit-footer-action"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-footer-history"]').exists()).toBe(true)
  })

  it('terminal summary interpolates {completed}/{total} for small and large progress', async () => {
    const small = mountFooter({
      routeStatus: 'COMPLETED', currentStop: mkStop('s0', 0, 'COMPLETED'),
      progress: { completed: 1, total: 3 } as CockpitProgress, canCheckIn: true,
    })
    expect(small.text()).toContain('Entregaste 1 de 3 paradas.')
    const big = mountFooter({
      routeStatus: 'COMPLETED', currentStop: mkStop('s0', 0, 'COMPLETED'),
      progress: { completed: 12, total: 24 } as CockpitProgress, canCheckIn: true,
    })
    expect(big.text()).toContain('Entregaste 12 de 24 paradas.')
  })
})

describe('DriverCockpitFooter — source-level invariants (REQ-DCS-006/008/009, design §6)', () => {
  function body(): string {
    return fs.readFileSync(
      (DriverCockpitFooter as unknown as { __file: string }).__file,
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//, '')
  }
  it('SFC has no server-state imports (vue-router/useQuery/useMutation/useQueryClient/axios/fetch)', () => {
    const b = body()
    expect(b).not.toMatch(/from\s+['"]vue-router['"]/)
    expect(b).not.toMatch(/useRouter|useRoute\b/)
    expect(b).not.toMatch(/useQuery|useMutation|useQueryClient|@tanstack\/vue-query/)
    expect(b).not.toMatch(/axios|fetch\(['"]/)
  })
  it('SFC has no mutation / invalidate / refetch surface (footer is presentational)', () => {
    expect(body()).not.toMatch(/useCheckInStop|invalidate|refetch|mutateAsync|mutate\(/)
  })
  it('SFC never hardcodes Spanish literals (all copy comes from DELIVERY_ROUTE_COPY)', () => {
    const b = body()
    expect(b).not.toMatch(/["']Marcar entregada["']/)
    expect(b).not.toMatch(/["']Ver historial["']/)
    expect(b).not.toMatch(/["']Ruta completada["']/)
    expect(b).not.toMatch(/["']Ruta cancelada["']/)
    expect(b).not.toMatch(/["']Esta ruta fue cancelada\.["']/)
    expect(b).not.toMatch(/Entregaste\b[^.]*paradas/)
    expect(b).not.toMatch(/["']En curso["']/)
  })
})