// DriverCockpitHeader.spec.ts — STRICT-TDD tests for the sticky cockpit header
// (sdd delivery-routes driver-route-cockpit-redesign S4, design.md §3/§6/§9.3,
// specs/driver-cockpit-shell REQ-DCS-002, REQ-DCS-007 emit + disabled part,
// REQ-DRC-111 header touch/focus).
//
// Contract: presentational only; typed props { route, progress, isFetching };
// typed emits { back, refresh, 'open-history': [{ trigger: HTMLElement }] }.
// All interactive controls ≥44×44px + focus-visible; refresh disabled while
// isFetching AND its handler early-returns; no vue-router / query / HTTP imports.
// History emit carries the originating HTMLElement (REQ-DCK-008).

import { describe, it, expect, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import DriverCockpitHeader from '../DriverCockpitHeader.vue'
import {
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  type DeliveryRouteResponseDto,
} from '../../../interfaces/delivery-route.types'
import type { CockpitProgress } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

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
      progress: { completed: 2, total: 5 } as CockpitProgress,
      isFetching: false,
      ...props,
    },
    global: { stubs: { StatusDotBadge: StatusDotBadgeStub } },
  })
}

beforeEach(() => {})

describe('DriverCockpitHeader — identity, progress, scope pin (REQ-DCS-002)', () => {
  it('renders the driver name verbatim', async () => {
    expect(mountHeader().text()).toContain('Ana')
  })
  it('falls back to "Ruta" when the driver projection is null (no empty line)', async () => {
    const text = mountHeader({ route: makeRoute({ driver: null }) }).text()
    expect(text).toContain('Ruta')
    expect(text).not.toMatch(/—|\n\s*\n/)
  })
  it('renders "2/5" for {completed:2,total:5}; "0/0" for empty; "{x}/{y}" verbatim', async () => {
    const w1 = mountHeader({ progress: { completed: 2, total: 5 } }).text()
    const w2 = mountHeader({ progress: { completed: 0, total: 0 } }).text()
    const w3 = mountHeader({ progress: { completed: 3, total: 7 } }).text()
    expect(w1).toContain('2/5')
    expect(w2).toContain('0/0')
    expect(w3).toContain('3/7')
  })
  it('renders NO ETA / distance / next-preview / map (scope pin: those are S5 + S8)', async () => {
    const text = mountHeader().text()
    expect(text).not.toMatch(/Siguiente|ETA|distancia|km|\bmin\b/i)
    expect(mountHeader().find('[data-testid="address-map-picker-stub"]').exists()).toBe(false)
  })
})

describe('DriverCockpitHeader — back / refresh / history emits (REQ-DCS-002/007)', () => {
  it('back emits once with [] (parent owns nav; no router import)', async () => {
    const w = mountHeader()
    await flushPromises()
    await w.find('[data-testid="cockpit-header-back"]').trigger('click')
    expect(w.emitted('back')).toEqual([[]])
  })
  it('back aria-label comes from DELIVERY_ROUTE_COPY (no hardcoded Spanish string in SFC)', async () => {
    const back = mountHeader().find('[data-testid="cockpit-header-back"]')
    expect(back.attributes('aria-label')).toBe(DELIVERY_ROUTE_COPY.confirm.cancel.cancelLabel)
  })
  it('refresh carries aria-label "Actualizar ruta" from copy.ts', async () => {
    const r = mountHeader().find('[data-testid="cockpit-header-refresh"]')
    expect(r.attributes('aria-label')).toBe('Actualizar ruta')
  })
  it('refresh emits once when idle; isDisabled+emitsNothing while isFetching=true', async () => {
    const idle = mountHeader({ isFetching: false })
    await flushPromises()
    await idle.find('[data-testid="cockpit-header-refresh"]').trigger('click')
    expect(idle.emitted('refresh')).toEqual([[]])

    const busy = mountHeader({ isFetching: true })
    await flushPromises()
    const busyBtn = busy.find('[data-testid="cockpit-header-refresh"]')
    expect((busyBtn.element as HTMLButtonElement).disabled).toBe(true)
    await busyBtn.trigger('click')
    expect(busy.emitted('refresh') ?? []).toHaveLength(0)
  })
  it('refresh re-enables when isFetching flips true→false (reactivity)', async () => {
    const w = mountHeader({ isFetching: true })
    await flushPromises()
    await w.setProps({ isFetching: false })
    await flushPromises()
    expect((w.find('[data-testid="cockpit-header-refresh"]').element as HTMLButtonElement).disabled).toBe(false)
  })
  it('history emits open-history with the originating HTMLElement + aria-label = drawer title', async () => {
    const w = mountHeader()
    await flushPromises()
    const history = w.find('[data-testid="cockpit-header-history"]')
    expect(history.attributes('aria-label')).toBe('Historial de la ruta')
    await history.trigger('click')
    const events = w.emitted('open-history')
    expect(events).toHaveLength(1)
    const payload = events![0]?.[0] as { trigger: HTMLElement }
    expect(payload.trigger).toBe(history.element)
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

describe('DriverCockpitHeader — touch + a11y + sticky layout (REQ-DRC-111, design §2)', () => {
  it('every interactive control is ≥44×44 with focus-visible', async () => {
    const w = mountHeader()
    for (const tid of ['cockpit-header-back', 'cockpit-header-history', 'cockpit-header-refresh']) {
      const c = w.find(`[data-testid="${tid}"]`)
      expect(c.classes()).toContain('min-h-11')
      expect(c.classes()).toContain('min-w-11')
      expect(c.classes().join(' ')).toMatch(/focus-visible/)
    }
  })
  it('header root is sticky, top-0, uses semantic tokens, min-w-0 (320px safe)', async () => {
    const root = mountHeader().find('[data-testid="cockpit-header-root"]')
    const cls = root.classes().join(' ')
    expect(cls).toContain('sticky')
    expect(cls).toContain('top-0')
    expect(cls).toMatch(/bg-(default|elevated)/)
    expect(cls).toMatch(/border-default/)
    expect(cls).toMatch(/min-w-0/)
  })
})

        describe('DriverCockpitHeader — S4 grid layout (exact SFC plan, orchestrator \u00a71\u2013\u00a75)', () => {
      // Compact toolbar: three-column grid [back | summary | actions].
      // Root: grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3.
      // No flex-wrap, no root px-*, no pl-14, no basis-full, no ml-auto.

      it('root uses grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3', () => {
        const root = mountHeader().find('[data-testid="cockpit-header-root"]')
        const cls = root.classes().join(' ')
        expect(cls).toMatch(/grid/)                       ; expect(cls).toMatch(/grid-cols-\[2\.75rem_minmax\(0,1fr\)_auto\]/)
        expect(cls).toMatch(/items-center/)                ; expect(cls).toMatch(/\bgap-3\b/)
        expect(cls).not.toMatch(/flex-wrap/)               ; expect(cls).not.toMatch(/flex-col/)
        expect(cls).not.toMatch(/\bpx-/)
      })

      it('cockpit-header-summary exists with min-w-0 (identity col safe at 320px)', () => {
        const w = mountHeader()
        const summary = w.find('[data-testid="cockpit-header-summary"]')
        expect(summary.exists()).toBe(true)
        expect(summary.classes().join(' ')).toMatch(/\bmin-w-0\b/)
      })

      it('identity span: truncate text-sm font-medium text-default; full text renders verbatim', () => {
        const w = mountHeader({ route: makeRoute({ driver: { id: 'd-x', name: 'Concepci\u00f3n Hern\u00e1ndez del R\u00edo Montejo y S\u00e1nchez', email: 'x@x' } }) })
        const identity = w.find('[data-testid="cockpit-header-identity"]')
        const cls = identity.classes().join(' ')
        expect(cls).toMatch(/\btruncate\b/)              ; expect(cls).toMatch(/\btext-sm\b/)
        expect(cls).toMatch(/\bfont-medium\b/)            ; expect(cls).toMatch(/\btext-default\b/)
        expect(identity.text()).toBe('Concepci\u00f3n Hern\u00e1ndez del R\u00edo Montejo y S\u00e1nchez')
      })

      it('cockpit-header-meta: mt-1 flex items-center gap-2; contains status badge then progress', () => {
        const w = mountHeader()
        const meta = w.find('[data-testid="cockpit-header-meta"]')
        expect(meta.exists()).toBe(true)
        const cls = meta.classes().join(' ')
        expect(cls).toMatch(/\bmt-1\b/)                 ; expect(cls).toMatch(/\bflex\b/)
        expect(cls).toMatch(/\bitems-center\b/)          ; expect(cls).toMatch(/\bgap-2\b/)
        const children = Array.from(meta.element.children) as HTMLElement[]
        expect(children.length).toBeGreaterThanOrEqual(2)
        expect(children[0]!.getAttribute('data-testid')).toMatch(/status-dot|badge/)
        expect(children[1]!.getAttribute('data-testid')).toBe('cockpit-header-progress')
      })

      it('progress in metadata row: font-mono text-xs text-muted; no ml-auto / basis / pl offset', () => {
        const w = mountHeader()
        const meta = w.find('[data-testid="cockpit-header-meta"]')
        const progress = meta.find('[data-testid="cockpit-header-progress"]')
        const cls = progress.classes().join(' ')
        expect(cls).toMatch(/\bfont-mono\b/)              ; expect(cls).toMatch(/\btext-xs\b/)
        expect(cls).toMatch(/\btext-muted\b/)
        expect(cls).not.toMatch(/\bml-auto\b/)            ; expect(cls).not.toMatch(/\bbasis-/)
        expect(cls).not.toMatch(/\bpl-/)
      })

      it('cockpit-header-actions: flex items-center gap-2; contains ONLY history + refresh (no progress)', () => {
        const w = mountHeader()
        const actions = w.find('[data-testid="cockpit-header-actions"]')
        expect(actions.exists()).toBe(true)
        const cls = actions.classes().join(' ')
        expect(cls).toMatch(/\bflex\b/)                  ; expect(cls).toMatch(/\bitems-center\b/)
        expect(cls).toMatch(/\bgap-2\b/)
        expect(actions.find('[data-testid="cockpit-header-progress"]').exists()).toBe(false)
        expect(actions.find('[data-testid="cockpit-header-history"]').exists()).toBe(true)
        expect(actions.find('[data-testid="cockpit-header-refresh"]').exists()).toBe(true)
      })

      it('history and refresh both have border border-default (matching treatment)', () => {
        const w = mountHeader()
        for (const tid of ['cockpit-header-history', 'cockpit-header-refresh']) {
          const cls = w.find(`[data-testid="${tid}"]`).classes().join(' ')
          expect(cls).toMatch(/\bborder\b/)             ; expect(cls).toMatch(/\bborder-default\b/)
        }
      })

      it('back button unchanged in column 1; >=44x44 with focus-visible', () => {
        const w = mountHeader()
        const back = w.find('[data-testid="cockpit-header-back"]')
        const cls = back.classes().join(' ')
        expect(cls).toMatch(/\bmin-h-11\b/)            ; expect(cls).toMatch(/\bmin-w-11\b/)
        expect(cls).toMatch(/focus-visible/)
      })

      it('root has no px-* and no horizontal overflow classes', () => {
        const root = mountHeader().find('[data-testid="cockpit-header-root"]')
        const cls = root.classes().join(' ')
        expect(cls).not.toMatch(/\bpx-4\b/)             ; expect(cls).not.toMatch(/\bpx-2\b/)
        expect(cls).not.toMatch(/\bpx-3\b/)             ; expect(cls).not.toMatch(/\boverflow-x/)
      })

      it('source: root grid classes; no basis-full/pl-14/ml-auto flex-wrapping; all three testids present', () => {
        const p = (DriverCockpitHeader as unknown as { __file: string }).__file
        const src = fs.readFileSync(p, 'utf8').replace(/\/\*\*[\s\S]*?\*\//, '')
        expect(src).toMatch(/grid-cols-\[2\.75rem_minmax\(0,1fr\)_auto\]/)
        expect(src).not.toMatch(/basis-full/)
        expect(src).not.toMatch(/\bpl-14\b/)
        expect(src).not.toMatch(/\bml-auto\b/)
        expect(src).not.toMatch(/flex-wrap/)
        expect(src).toMatch(/cockpit-header-summary/)
        expect(src).toMatch(/cockpit-header-meta/)
        expect(src).toMatch(/cockpit-header-actions/)
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
    // Anti-regression pin (S4 review correction): the back control's accessible
    // name must come from DELIVERY_ROUTE_COPY, never from an inline Spanish
    // literal. The JSDoc header is the only place where the word may appear
    // in prose; any template-side `aria-label="Volver"` (bound or static) is
    // forbidden so future edits cannot silently re-introduce the drift.
    const path = (DriverCockpitHeader as unknown as { __file: string }).__file
    const source = fs.readFileSync(path, 'utf8')
    const body = source.replace(/\/\*\*[\s\S]*?\*\//, '')
    expect(body).not.toMatch(/aria-label=["']Volver["']/)
    expect(body).not.toMatch(/aria-label=["']Volver\s*a\s*la\s*lista["']/)
  })
})
