// DashboardOperationalPanel.spec.ts — accessible independent state shell for
// recent sales, debt and pending-refund dashboard modules (OI-5B2 S2).

import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import DashboardOperationalPanel from '../DashboardOperationalPanel.vue'

interface PanelOverrides {
  hasItems?: boolean
  isInitialLoading?: boolean
  isRefetching?: boolean
  isError?: boolean
}

function mountPanel(overrides: PanelOverrides = {}) {
  return mountWithUApp(DashboardOperationalPanel, {
    props: {
      id: 'recent-sales',
      title: 'Ventas recientes',
      description: 'Últimas ventas confirmadas',
      icon: 'i-lucide-receipt-text',
      hasItems: false,
      isInitialLoading: false,
      isRefetching: false,
      isError: false,
      loadingMessage: 'Cargando ventas recientes',
      emptyMessage: 'No hay ventas confirmadas.',
      errorMessage: 'No pudimos cargar las ventas recientes.',
      ...overrides,
    },
    slots: {
      default: () => [
        h('li', { 'data-testid': 'row-a' }, 'Venta A'),
        h('li', { 'data-testid': 'row-b' }, 'Venta B'),
      ],
    },
  })
}

describe('DashboardOperationalPanel — structure and independent states', () => {
  it('labels the panel from its heading and renders the supplied description', () => {
    const w = mountPanel()
    const panel = w.find('[data-testid="dashboard-operational-panel"]')
    const heading = w.find('h2')

    expect(heading.attributes('id')).toBe('recent-sales-heading')
    expect(heading.text()).toBe('Ventas recientes')
    expect(panel.attributes('aria-labelledby')).toBe('recent-sales-heading')
    expect(w.text()).toContain('Últimas ventas confirmadas')
    expect(w.find('svg[aria-hidden="true"]').exists()).toBe(true)
  })

  it('renders one accessible loading state and no rows, empty state or error', () => {
    const w = mountPanel({ isInitialLoading: true })
    const loading = w.find('[data-testid="dashboard-operational-loading"]')

    expect(loading.exists()).toBe(true)
    expect(loading.attributes('role')).toBe('status')
    expect(loading.attributes('aria-live')).toBe('polite')
    expect(loading.text()).toContain('Cargando ventas recientes')
    expect(w.find('[data-testid="dashboard-operational-list"]').exists()).toBe(false)
    expect(w.find('[data-testid="dashboard-operational-empty"]').exists()).toBe(false)
    expect(w.find('[data-testid="dashboard-operational-error"]').exists()).toBe(false)
  })

  it('renders an explicit successful empty state only when idle and empty', () => {
    const w = mountPanel()
    const empty = w.find('[data-testid="dashboard-operational-empty"]')

    expect(empty.exists()).toBe(true)
    expect(empty.attributes('role')).toBe('status')
    expect(empty.text()).toContain('No hay ventas confirmadas.')
    expect(w.find('[data-testid="dashboard-operational-list"]').exists()).toBe(false)
  })

  it('renders an error-without-data alert with exactly one retry control', async () => {
    const w = mountPanel({ isError: true })
    const alert = w.find('[data-testid="dashboard-operational-error"]')
    const buttons = w.findAll('button').filter((button) => /reintentar/i.test(button.text()))

    expect(alert.exists()).toBe(true)
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('No pudimos cargar las ventas recientes.')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('min-h-11')
    expect(buttons[0]!.classes().some((token) => /focus-visible:ring-/.test(token))).toBe(true)
    expect(w.find('[data-testid="dashboard-operational-empty"]').exists()).toBe(false)
    expect(w.find('[data-testid="dashboard-operational-list"]').exists()).toBe(false)

    await buttons[0]!.trigger('click')
    expect(w.emitted('retry')).toEqual([[]])
  })

  it('keeps real rows visible during a stale-data error and exposes one retry', () => {
    const w = mountPanel({ hasItems: true, isError: true })

    expect(w.find('[data-testid="dashboard-operational-refresh-error"]').attributes('role')).toBe(
      'alert',
    )
    expect(w.find('[data-testid="dashboard-operational-error"]').exists()).toBe(false)
    expect(w.findAll('[data-testid^="row-"]')).toHaveLength(2)
    expect(w.findAll('button').filter((button) => /reintentar/i.test(button.text()))).toHaveLength(
      1,
    )
  })

  it('announces a background refresh politely without replacing loaded rows', () => {
    const w = mountPanel({ hasItems: true, isRefetching: true })
    const refreshing = w.find('[data-testid="dashboard-operational-refreshing"]')

    expect(refreshing.attributes('role')).toBe('status')
    expect(refreshing.attributes('aria-live')).toBe('polite')
    expect(refreshing.text()).toContain('Actualizando')
    expect(w.findAll('[data-testid^="row-"]')).toHaveLength(2)
  })

  it('marks only active loading work as busy and preserves a semantic list', () => {
    const idle = mountPanel({ hasItems: true })
    const loading = mountPanel({ isInitialLoading: true })
    const refreshing = mountPanel({ hasItems: true, isRefetching: true })

    expect(idle.find('article').attributes('aria-busy')).toBe('false')
    expect(loading.find('article').attributes('aria-busy')).toBe('true')
    expect(refreshing.find('article').attributes('aria-busy')).toBe('true')
    expect(idle.find('ul').attributes('aria-label')).toBe('Ventas recientes')
    expect(idle.find('ul').classes()).toContain('min-w-0')
  })
})

describe('DashboardOperationalPanel — layout and claim discipline', () => {
  it('is overflow-safe and uses semantic Coco surfaces without fixed widths', () => {
    const w = mountPanel({ hasItems: true })
    const root = w.find('[data-testid="dashboard-operational-panel"]')

    expect(root.classes()).toEqual(expect.arrayContaining(['min-w-0', 'border-default']))
    expect(root.html()).not.toMatch(/min-w-\[|w-\[/)
    expect(root.html()).not.toContain('whitespace-nowrap')
  })

  it('does not invent totals, ranking, trends, targets or navigation', () => {
    const w = mountPanel({ hasItems: true })

    expect(w.text()).not.toMatch(/total|ranking|tendencia|meta|proyecci|comparaci|anterior|%/i)
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('[role="progressbar"]').exists()).toBe(false)
    expect(w.find('canvas').exists()).toBe(false)
  })
})
