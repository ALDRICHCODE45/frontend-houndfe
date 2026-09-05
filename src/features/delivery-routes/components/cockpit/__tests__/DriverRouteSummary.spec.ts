// DriverRouteSummary.spec.ts — STRICT-TDD for the truthful route summary of the
// driver cockpit route-page evolution.
//
// Contract:
//   - Accessible delivered progress: role="progressbar" with aria-valuemin /
//     aria-valuemax / aria-valuenow + an aria-label interpolated from
//     copy.ts ("{completed} de {total} paradas entregadas").
//   - Truthful stop counts only: delivered, pending, total — skipped surfaced
//     only when > 0. NEVER package counts, ETA, duration, distance, or
//     "updated now" (nothing of the sort exists in the DTO).
//   - Zero stops: no progressbar (aria-valuemax=0 is invalid ARIA) — a dedicated
//     empty line renders instead.
//   - Presentational only: props { progress, counts }, no emits, no server state.

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DriverRouteSummary from '../DriverRouteSummary.vue'
import type { CockpitProgress, CockpitStopCounts } from '../../../composables/cockpit/useDriverRouteCockpit'
import { DELIVERY_ROUTE_COPY } from '../../../copy'

// eslint-disable-next-line @typescript-eslint/no-require-imports -- node builtin
const fs: typeof import('node:fs') = require('node:fs') as typeof import('node:fs')

const ZERO_COUNTS: CockpitStopCounts = { delivered: 0, pending: 0, inProgress: 0, skipped: 0, total: 0 }

function mountSummary(p: { progress?: CockpitProgress; counts?: CockpitStopCounts } = {}) {
  return mount(DriverRouteSummary, {
    props: {
      progress: p.progress ?? { completed: 0, total: 0 },
      counts: p.counts ?? ZERO_COUNTS,
    },
  })
}

describe('DriverRouteSummary — accessible delivered progress', () => {
  it('renders role="progressbar" with aria-valuenow/min/max + copy-interpolated aria-label', async () => {
    const w = mountSummary({ progress: { completed: 3, total: 5 }, counts: { ...ZERO_COUNTS, delivered: 3, pending: 2, total: 5 } })
    await flushPromises()
    const bar = w.find('[data-testid="driver-route-summary-progress"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('role')).toBe('progressbar')
    expect(bar.attributes('aria-valuenow')).toBe('3')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('5')
    expect(bar.attributes('aria-label')).toBe(
      DELIVERY_ROUTE_COPY.cockpit.summary.progressAriaLabel
        .replace('{completed}', '3')
        .replace('{total}', '5'),
    )
  })

  it('renders a visual fill whose width is the delivered percentage', async () => {
    const w = mountSummary({ progress: { completed: 1, total: 4 }, counts: { ...ZERO_COUNTS, delivered: 1, pending: 3, total: 4 } })
    const fill = w.find('[data-testid="driver-route-summary-progress-fill"]')
    expect(fill.exists()).toBe(true)
    expect(fill.attributes('style')).toContain('25%')
  })

  it('clamps nothing at 100% and shows 0% before the first delivery', async () => {
    const full = mountSummary({ progress: { completed: 5, total: 5 }, counts: { ...ZERO_COUNTS, delivered: 5, total: 5 } })
    expect(full.find('[data-testid="driver-route-summary-progress-fill"]').attributes('style')).toContain('100%')
    const none = mountSummary({ progress: { completed: 0, total: 5 }, counts: { ...ZERO_COUNTS, pending: 5, total: 5 } })
    expect(none.find('[data-testid="driver-route-summary-progress-fill"]').attributes('style')).toContain('0%')
  })
})

describe('DriverRouteSummary — truthful stop counts', () => {
  it('renders delivered / pending / total labels from copy.ts with real values', async () => {
    const w = mountSummary({
      progress: { completed: 2, total: 6 },
      counts: { delivered: 2, pending: 3, inProgress: 1, skipped: 0, total: 6 },
    })
    const counts = w.find('[data-testid="driver-route-summary-counts"]')
    expect(counts.exists()).toBe(true)
    expect(counts.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.summary.deliveredLabel)
    expect(counts.text()).toContain('2')
    expect(counts.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.summary.pendingLabel)
    expect(counts.text()).toContain('4') // pending + inProgress = still actionable
    expect(counts.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.summary.totalLabel)
    expect(counts.text()).toContain('6')
  })

  it('surfaces the skipped count only when skipped > 0', async () => {
    const withSkipped = mountSummary({
      progress: { completed: 1, total: 4 },
      counts: { delivered: 1, pending: 1, inProgress: 0, skipped: 2, total: 4 },
    })
    expect(withSkipped.text()).toContain(DELIVERY_ROUTE_COPY.cockpit.summary.skippedLabel)

    const withoutSkipped = mountSummary({
      progress: { completed: 1, total: 3 },
      counts: { delivered: 1, pending: 2, inProgress: 0, skipped: 0, total: 3 },
    })
    expect(withoutSkipped.text()).not.toContain(DELIVERY_ROUTE_COPY.cockpit.summary.skippedLabel)
  })

  it('NEVER renders fabricated metrics: no package counts, ETA, duration, distance, or updated-now', async () => {
    const w = mountSummary({ progress: { completed: 1, total: 3 }, counts: { delivered: 1, pending: 2, inProgress: 0, skipped: 0, total: 3 } })
    const text = w.text()
    expect(text).not.toMatch(/ETA|distancia|\bkm\b|\bmin\b|paquetes|actualizado/i)
  })
})

describe('DriverRouteSummary — zero-stop edge', () => {
  it('renders NO progressbar (aria-valuemax=0 is invalid) and shows the empty copy', async () => {
    const w = mountSummary({ progress: { completed: 0, total: 0 }, counts: ZERO_COUNTS })
    expect(w.find('[data-testid="driver-route-summary-progress"]').exists()).toBe(false)
    expect(w.find('[data-testid="driver-route-summary-empty"]').text())
      .toBe(DELIVERY_ROUTE_COPY.cockpit.summary.emptyLabel)
  })
})

describe('DriverRouteSummary — source-level invariants', () => {
  function body(): string {
    return fs.readFileSync((DriverRouteSummary as unknown as { __file: string }).__file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  }
  it.each([
    ['Entregadas'],
    ['Pendientes'],
    ['Total'],
    ['paradas entregadas'],
  ])('SFC implementation body never hardcodes "%s" (must bind from copy.ts)', (literal) => {
    expect(body(), `forbidden inline literal: ${literal}`).not.toContain(literal)
  })
  it('contains no emits, no server-state / router / HTTP imports', () => {
    const b = body()
    expect(b).not.toMatch(/defineEmits/)
    expect(b).not.toMatch(/from\s+['"]vue-router['"]/)
    expect(b).not.toMatch(/useQuery|useMutation|useQueryClient|@tanstack\/vue-query/)
    expect(b).not.toMatch(/axios|fetch\(['"]/)
  })
  it('uses semantic theme tokens (no raw hex values)', () => {
    expect(body()).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
