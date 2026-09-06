// DriverCockpitHeader.spec.ts — STRICT-TDD tests for the sticky cockpit header
// (driver-route-cockpit-redesign S4 + header refinement, specs/driver-cockpit-shell
// REQ-DCS-002, REQ-DCS-007 emit + disabled, REQ-DRC-111 header touch/focus).
//
// Contract (header refinement): compact rounded CARD matching the cockpit
// (semantic bg-default / border-default / rounded-xl / restrained shadow /
// p-3 mobile + p-4 desktop / intentional sticky offset), three columns
// [back | flexible route content | ONE ghost overflow trigger].
//   - "Ruta de entrega" is the primary title; NO driver identity line (the
//     header is driver-only and the line collided with the title).
//   - NO completed/total progress fraction (the summary card owns progress).
//   - Status, compact uppercase 8-char route id (full id via native title),
//     truthful lifecycle timestamp are KEPT.
//   - The separate visible history + refresh buttons are REMOVED; one
//     UDropdownMenu holds "Ver historial" then "Actualizar ruta" (existing
//     copy.ts keys). History selection emits open-history EXACTLY ONCE with
//     the trigger element for focus restoration; refresh emits EXACTLY ONCE
//     while idle and its item is disabled + guarded while isFetching.
//
// DropdownMenu interaction follows the established project pattern (see
// CustomerCard.spec.ts): the Nuxt UI component is mocked at its auto-import
// path so we assert the PUBLIC `items` prop and invoke `onSelect` directly —
// never Reka UI internals or closed-dropdown text.

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DriverCockpitHeader from '../DriverCockpitHeader.vue'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
} from '../../../interfaces/delivery-route.types'
import { formatTimelineTimestamp } from '../../DeliveryRouteTimeline.vue'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

// Public UDropdownMenu item shape we assert on (label/icon/disabled/onSelect).
interface HeaderMenuItem {
  label: string
  icon?: string
  disabled?: boolean
  onSelect?: (e?: Event) => void
}

vi.mock('@nuxt/ui/components/DropdownMenu.vue', () => ({
  default: {
    name: 'UDropdownMenu',
    template: '<div data-testid="cockpit-header-menu-stub"><slot /></div>',
    props: ['items', 'content'],
    emits: ['select'],
  },
}))

const StatusDotBadgeStub = defineComponent({
  name: 'StatusDotBadge',
  props: ['tone', 'label', 'ariaLabel'],
  template:
    '<span data-testid="status-dot-badge-stub" :data-tone="tone" :data-label="label">{{ label }}</span>',
})

function makeRoute(
  overrides: Partial<{
    status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    driver: { id: string; name: string; email: string } | null
  }> = {},
): DeliveryRouteResponseDto {
  return {
    id: 'r',
    status: overrides.status ?? 'ACTIVE',
    driver:
      overrides.driver !== undefined
        ? overrides.driver
        : { id: 'd', name: 'Ana', email: 'a@x' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [],
  }
}
function mountHeader(props: Record<string, unknown> = {}) {
  return mount(DriverCockpitHeader, {
    props: {
      route: makeRoute(),
      isFetching: false,
      ...props,
    },
    global: { stubs: { StatusDotBadge: StatusDotBadgeStub } },
  })
}
function getMenuItems(w: ReturnType<typeof mount>): HeaderMenuItem[] {
  const dropdown = w.findComponent({ name: 'UDropdownMenu' })
  return ((dropdown.props('items') as HeaderMenuItem[] | undefined) ?? []).flat()
}

describe('DriverCockpitHeader — refinement: identity + progress removed, title kept (REQ-DCS-002)', () => {
  it('renders "Ruta de entrega" from copy.ts as the primary title', () => {
    const title = mountHeader().find('[data-testid="cockpit-header-title"]')
    expect(title.exists()).toBe(true)
    expect(title.text()).toBe(DELIVERY_ROUTE_COPY.cockpit.header.title)
    expect(title.text()).toBe('Ruta de entrega')
  })
  it('renders NO driver identity line (driver-only header; no cockpit-header-identity)', () => {
    const w = mountHeader()
    expect(w.find('[data-testid="cockpit-header-identity"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Ana')
  })
  it('renders NO completed/total progress fraction (the summary card owns progress)', () => {
    const w = mountHeader({ route: makeRoute(), isFetching: false })
    expect(w.find('[data-testid="cockpit-header-progress"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/\d\/\d/)
  })
  it('renders NO ETA / distance / next-preview / map (scope pin: those live below the header)', () => {
    const text = mountHeader().text()
    expect(text).not.toMatch(/Siguiente|ETA|distancia|km|\bmin\b/i)
  })
})

describe('DriverCockpitHeader — back emit (REQ-DCS-002)', () => {
  it('back emits once with [] (parent owns nav; no router import)', async () => {
    const w = mountHeader()
    await flushPromises()
    await w.find('[data-testid="cockpit-header-back"]').trigger('click')
    expect(w.emitted('back')).toEqual([[]])
  })
  it('back aria-label comes from DELIVERY_ROUTE_COPY (no hardcoded Spanish string in SFC)', () => {
    const back = mountHeader().find('[data-testid="cockpit-header-back"]')
    expect(back.attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel)
  })
})

describe('DriverCockpitHeader — status badge tones (REQ-DCS-002, shared maps)', () => {
  it.each([
    ['DRAFT', 'neutral', 'Borrador'],
    ['ACTIVE', 'warning', 'Activa'],
    ['COMPLETED', 'success', 'Completada'],
    ['CANCELLED', 'error', 'Cancelada'],
  ] as const)('renders %s badge with tone=%s label=%s', async (status, tone, label) => {
    const w = mountHeader({ route: makeRoute({ status }) })
    await flushPromises()
    const badge = w.find('[data-testid="status-dot-badge-stub"]')
    expect(badge.attributes('data-tone')).toBe(DELIVERY_ROUTE_STATUS_TONES[tone === 'neutral' ? 'DRAFT' : status])
    expect(badge.attributes('data-label')).toBe(DELIVERY_ROUTE_STATUS_LABELS[status])
    expect(w.text()).toContain(label)
  })
})

describe('DriverCockpitHeader — refinement: single overflow menu (REQ-DCS-007 + header refinement)', () => {
  it('renders NO separate visible history / refresh buttons (replaced by the menu)', () => {
    const w = mountHeader()
    expect(w.find('[data-testid="cockpit-header-history"]').exists()).toBe(false)
    expect(w.find('[data-testid="cockpit-header-refresh"]').exists()).toBe(false)
  })

  it('exactly ONE UDropdownMenu with two keyboard-accessible items in order: "Ver historial" then "Actualizar ruta" (existing copy.ts keys + icons)', () => {
    const w = mountHeader()
    expect(w.findAllComponents({ name: 'UDropdownMenu' })).toHaveLength(1)
    const items = getMenuItems(w)
    expect(items.map((i) => i.label)).toEqual([
      DELIVERY_ROUTE_COPY.cockpit.footer.viewHistory,
      DELIVERY_ROUTE_COPY.cockpit.header.refreshAriaLabel,
    ])
    expect(items.map((i) => i.icon)).toEqual(['i-lucide-history', 'i-lucide-refresh-cw'])
  })

  it('history onSelect emits open-history EXACTLY ONCE with the trigger element (focus restoration payload)', async () => {
    const w = mountHeader()
    await flushPromises()
    const trigger = w.find('[data-testid="cockpit-header-actions"]').element as HTMLElement
    const history = getMenuItems(w)[0]
    expect(history?.onSelect).toBeDefined()
    history!.onSelect!()
    await nextTick()
    const events = w.emitted('open-history')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as { trigger: HTMLElement }
    expect(payload.trigger).toBe(trigger)
  })

  it('refresh onSelect while idle emits refresh EXACTLY ONCE per selection; item enabled', async () => {
    const w = mountHeader({ isFetching: false })
    await flushPromises()
    const refresh = getMenuItems(w)[1]
    expect(refresh?.disabled).toBeFalsy()
    refresh!.onSelect!()
    await nextTick()
    // Exactly one emit for the single selection.
    expect(w.emitted('refresh')).toEqual([[]])
    // A second selection emits exactly once more (no batching, no duplication).
    refresh!.onSelect!()
    await nextTick()
    expect(w.emitted('refresh')).toEqual([[], []])
  })

  it('refresh item is disabled + emits NOTHING while isFetching=true; re-enables on true→false', async () => {
    const w = mountHeader({ isFetching: true })
    await flushPromises()
    const refresh = getMenuItems(w)[1]
    expect(refresh?.disabled).toBe(true)
    refresh!.onSelect!()
    await nextTick()
    expect(w.emitted('refresh') ?? []).toHaveLength(0)

    await w.setProps({ isFetching: false })
    await flushPromises()
    const reEnabled = getMenuItems(w)[1]
    expect(reEnabled?.disabled).toBeFalsy()
    reEnabled!.onSelect!()
    await nextTick()
    expect(w.emitted('refresh')).toEqual([[]])
  })

  it('trigger uses a ghost ellipsis icon with a copy-sourced accessible label "Acciones de la ruta"', () => {
    const trigger = mountHeader().find('[data-testid="cockpit-header-actions"]')
    expect(trigger.attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.cockpit.header.actionsLabel)
    expect(trigger.attributes('aria-label')).toBe('Acciones de la ruta')
    // Ghost treatment: no border, no filled background class of its own.
    const cls = trigger.classes().join(' ')
    expect(cls).not.toMatch(/\bborder\b/)
    expect(cls).toMatch(/rounded-md/)
  })

  it('trigger and back are ≥44×44 with visible focus (REQ-DRC-111)', () => {
    const w = mountHeader()
    for (const tid of ['cockpit-header-back', 'cockpit-header-actions']) {
      const c = w.find(`[data-testid="${tid}"]`)
      expect(c.classes()).toContain('min-h-11')
      expect(c.classes()).toContain('min-w-11')
      expect(c.classes().join(' ')).toMatch(/focus-visible/)
    }
  })
})

describe('DriverCockpitHeader — refinement: compact rounded card composition (320px safe)', () => {
  it('root is a sticky card: rounded-xl, border-default, bg-default, restrained shadow, p-3 / sm:p-4', () => {
    const root = mountHeader().find('[data-testid="cockpit-header-root"]')
    const cls = root.classes().join(' ')
    expect(cls).toMatch(/sticky/)
    expect(cls).toMatch(/rounded-xl/)
    expect(cls).toMatch(/border-default/)
    expect(cls).toMatch(/bg-default/)
    expect(cls).toMatch(/shadow/)
    expect(cls).toMatch(/\bp-3\b/)
    expect(cls).toMatch(/sm:p-4/)
    expect(cls).toMatch(/min-w-0/)
  })

  it('sticky offset is intentional (top-3), not a flush top-0 strip', () => {
    const cls = mountHeader().find('[data-testid="cockpit-header-root"]').classes().join(' ')
    expect(cls).toMatch(/\btop-3\b/)
    expect(cls).not.toMatch(/\btop-0\b/)
  })

  it('narrow-width triangulation: back + flexible summary + trigger, all truncating (no 320px overlap)', () => {
    const w = mountHeader({
      route: makeRoute({ driver: { id: 'd-x', name: 'Concepción Hernández del Río Montejo y Sánchez', email: 'x@x' } }),
    })
    // The route id is the longest fixed metadata atom; it must truncate.
    const long = makeRoute()
    long.id = 'route-abc12345xyz'
    const wLong = mountHeader({ route: long })
    const idEl = wLong.find('[data-testid="cockpit-header-route-id"]')
    expect(idEl.classes().join(' ')).toMatch(/\btruncate\b/)
    expect(idEl.text()).toBe('ROUTE-AB')
    expect(idEl.attributes('title')).toBe('route-abc12345xyz')
    // The flexible middle column clamps (min-w-0) and the title truncates.
    const summary = w.find('[data-testid="cockpit-header-summary"]')
    expect(summary.classes().join(' ')).toMatch(/\bmin-w-0\b/)
    const title = w.find('[data-testid="cockpit-header-title"]')
    expect(title.classes().join(' ')).toMatch(/\btruncate\b/)
    // Lifecycle line (when present) truncates too.
    const route = makeRoute()
    route.startedAt = '2025-01-01T09:00:00Z'
    const lc = mountHeader({ route }).find('[data-testid="cockpit-header-lifecycle"]')
    expect(lc.exists()).toBe(true)
    expect(lc.text()).toBe(
      DELIVERY_ROUTE_COPY.cockpit.lifecycle.started.replace('{date}', formatTimelineTimestamp('2025-01-01T09:00:00Z')),
    )
    expect(lc.classes().join(' ')).toMatch(/truncate/)
    expect(lc.classes().join(' ')).toMatch(/text-muted/)
  })

  it('COMPLETED/CANCELLED lifecycle precedence + truthful absence are preserved (regression pin)', () => {
    const completed = makeRoute({ status: 'COMPLETED' })
    completed.startedAt = '2025-01-01T09:00:00Z'
    completed.completedAt = '2025-01-01T11:00:00Z'
    expect(mountHeader({ route: completed }).find('[data-testid="cockpit-header-lifecycle"]').text())
      .toBe(DELIVERY_ROUTE_COPY.cockpit.lifecycle.completed.replace('{date}', formatTimelineTimestamp('2025-01-01T11:00:00Z')))

    const noTs = makeRoute({ status: 'CANCELLED' })
    expect(mountHeader({ route: noTs }).find('[data-testid="cockpit-header-lifecycle"]').exists()).toBe(false)

    const unparseable = makeRoute()
    unparseable.startedAt = 'sin-fecha'
    expect(mountHeader({ route: unparseable }).find('[data-testid="cockpit-header-lifecycle"]').text())
      .toBe(DELIVERY_ROUTE_COPY.cockpit.lifecycle.started.replace('{date}', DELIVERY_ROUTE_COPY.timeline.timestampFallback))
  })
})

describe('DriverCockpitHeader — source-level invariant (REQ-DCS-002, design §6)', () => {
  it('the SFC source contains no vue-router / useQuery / useMutation / fetch( import', () => {
    const path = (DriverCockpitHeader as unknown as { __file: string }).__file
    const source = fs.readFileSync(path, 'utf8')
    // Strip the leading JSDoc header — it intentionally names the forbidden
    // identifiers to document the invariant; only the import/script body is
    // authoritative. REQ-DCS-002 + design §6: no runtime coupling.
    const body = source.replace(/\/\*\*[\s\S]*?\*\//, '')
    expect(body).not.toMatch(/from\s+['"]vue-router['"]/)
    expect(body).not.toMatch(/useRouter|useRoute\b/)
    expect(body).not.toMatch(/useQuery|useMutation|useQueryClient|@tanstack\/vue-query/)
    expect(body).not.toMatch(/axios|fetch\(['"]/)
  })
  it('the SFC source never hardcodes the back aria-label literal (must bind from copy.ts)', () => {
    const path = (DriverCockpitHeader as unknown as { __file: string }).__file
    const source = fs.readFileSync(path, 'utf8')
    const body = source.replace(/\/\*\*[\s\S]*?\*\//, '')
    expect(body).not.toMatch(/aria-label=["']Volver["']/)
    expect(body).not.toMatch(/aria-label=["']Volver\s*a\s*la\s*lista["']/)
  })
  it('the SFC source never hardcodes the header menu literals (items bind from copy.ts)', () => {
    const path = (DriverCockpitHeader as unknown as { __file: string }).__file
    const source = fs.readFileSync(path, 'utf8')
    const body = source.replace(/\/\*\*[\s\S]*?\*\//, '')
    expect(body).not.toContain("'Ver historial'")
    expect(body).not.toContain("'Actualizar ruta'")
    expect(body).not.toContain("'Acciones de la ruta'")
  })
})
