import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HumanDecisionsListPanel from '../HumanDecisionsListPanel.vue'
import type { PaginationState } from '@/core/shared/types/table.types'
import type { HumanDecision, PendingHumanDecision } from '../../interfaces/human-decision.types'
import { EXPIRATION_UNAVAILABLE_LABEL } from '../../utils/humanDecisionPresentation'
import {
  pendingExpiration,
  provideExpiration,
  resolvedExpiration,
  unavailableExpiration,
} from '../../interfaces/__tests__/expirationDecision.fixture'

const PROVIDE_COPY = provideExpiration.expirationText

const AppDataTableStub = {
  name: 'AppDataTable',
  inheritAttrs: false,
  props: [
    'columns',
    'data',
    'loading',
    'fetching',
    'error',
    'errorMessage',
    'empty',
    'pageCount',
    'totalCount',
    'pageSizeOptions',
    'showingFrom',
    'showingTo',
    'emptyState',
    'filtered',
    'noMatchTitle',
    'rowOpen',
    'displayMode',
    'mobileRender',
    'mobileBreakpoint',
    'searchPlaceholder',
    'pagination',
    'globalFilter',
  ],
  emits: ['refresh', 'clear-filters', 'update:pagination', 'update:globalFilter'],
  template: `
    <div data-testid="table-stub">
      <slot name="filters" />
      <button data-testid="stub-clear" @click="$emit('clear-filters')">clear</button>
      <button data-testid="stub-refresh" @click="$emit('refresh')">refresh</button>
      <button
        data-testid="stub-models"
        @click="$emit('update:pagination', { pageIndex: 1, pageSize: 50 }); $emit('update:globalFilter', 'alimento')"
      >models</button>
      <slot name="product-cell" :row="{ original: data[0] }" />
      <slot name="status-cell" :row="{ original: data[0] }" />
      <slot name="response-cell" :row="{ original: data[0] }" />
      <slot name="branch-cell" :row="{ original: data[0] }" />
      <slot name="requestedQuantity-cell" :row="{ original: data[0] }" />
      <slot name="createdAt-cell" :row="{ original: data[0] }" />
      <slot name="actions-cell" :row="{ original: data[0] }" />
      <slot name="mobile-card" :row="data[0]" />
    </div>
  `,
}

const UButtonStub = { template: '<button type="button"><slot /></button>' }
const USelectStub = {
  name: 'USelect',
  props: ['modelValue', 'items'],
  emits: ['update:modelValue'],
  template: '<button role="combobox" />',
}

function decision(): PendingHumanDecision {
  return {
    id: 'decision-1',
    type: 'RESTOCK',
    title: '<b>Reposición</b>',
    sanitizedSummary: '<img src=x onerror=alert(1)>',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'PENDING',
    version: 1,
    resolution: null,
    allowedActions: [],
    snapshot: {
      branchId: 'branch-1',
      branchName: 'Sucursal Centro',
      productId: 'product-1',
      productName: 'Alimento 15 kg',
      variantId: null,
      sku: 'ALI-15',
      requestedQuantity: 2,
      observedStockAtRequest: null,
      stockObservedAt: null,
    },
  }
}

function mountPanel(
  options: {
    onPagination?: (value: PaginationState) => void
    onSearch?: (value: string) => void
    props?: Record<string, unknown>
  } = {},
) {
  return mount(HumanDecisionsListPanel, {
    props: {
      data: [decision()],
      loading: true,
      fetching: false,
      error: true,
      errorMessage: 'No se pudo cargar la bandeja.',
      pageCount: 3,
      totalCount: 41,
      pageSizeOptions: [20, 50],
      showingFrom: 1,
      showingTo: 20,
      pagination: { pageIndex: 0, pageSize: 20 },
      globalFilter: '',
      'onUpdate:pagination': options.onPagination,
      'onUpdate:globalFilter': options.onSearch,
      ...(options.props ?? {}),
    },
    global: {
      stubs: {
        AppDataTable: AppDataTableStub,
        USelect: USelectStub,
        Select: USelectStub,
        UButton: UButtonStub,
        Button: UButtonStub,
        UIcon: true,
        Icon: true,
        Card: { template: '<article><header><slot name="header" /></header><slot /></article>' },
      },
    },
  })
}

describe('HumanDecisionsListPanel', () => {
  it('puts the canonical heading outside the card that encloses the toolbar, with no subtitle or view toggle', () => {
    const wrapper = mountPanel()
    expect(wrapper.get('.hf-page-title').text()).toBe('Solicitudes')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('article .hf-page-title').exists()).toBe(false)
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false)
  })

  it('offers a controlled Estado filter with ALL default, named inside the control', async () => {
    const wrapper = mountPanel()
    const filter = wrapper.getComponent({ name: 'ToolbarSelectFilter' })
    expect(filter.props('modelValue')).toBe('ALL')
    expect(filter.props('label')).toBe('Estado')
    expect(filter.props('items')).toEqual([
      { label: 'Todas', value: 'ALL' },
      { label: 'Pendientes', value: 'PENDING' },
      { label: 'Respondidas recientemente', value: 'RESOLVED' },
    ])
    for (const status of ['ALL', 'PENDING', 'RESOLVED'] as const) {
      filter.vm.$emit('update:modelValue', status)
      expect(filter.props('modelValue')).toBe('ALL')
    }
    expect(wrapper.emitted('update:statusFilter')).toEqual([['ALL'], ['PENDING'], ['RESOLVED']])
    await wrapper.setProps({ statusFilter: 'RESOLVED' })
    expect(filter.props('modelValue')).toBe('RESOLVED')
    expect(wrapper.text()).toContain('Pendiente')
    expect(wrapper.get('[data-testid="human-decision-response"]').text()).toBe('—')
  })

  it('rejects invalid system-select payloads', () => {
    const wrapper = mountPanel()
    const filter = wrapper.getComponent({ name: 'ToolbarSelectFilter' })
    for (const value of [null, undefined, '', 'INVALID', 1, { value: 'ALL' }, ['ALL']]) {
      filter.vm.$emit('update:modelValue', value)
    }
    expect(wrapper.emitted('update:statusFilter')).toBeUndefined()
  })

  it('renders resolved response, reviewer, time and badge with the existing resolved card', async () => {
    const wrapper = mountPanel()
    const resolved = {
      ...decision(),
      status: 'RESOLVED' as const,
      version: 2 as const,
      allowedActions: [] as [],
      resolution: {
        action: 'PROVIDE_RESTOCK_ESTIMATE' as const,
        restockDays: 3,
        resolvedAt: '2026-01-02T00:00:00Z',
        resolvedBy: { id: 'reviewer', displayName: 'Ana' },
      },
    }
    await wrapper.setProps({ data: [resolved] })
    expect(wrapper.text()).toContain('Respondida')
    expect(wrapper.get('[data-testid="human-decision-response"]').text()).toContain(
      'Reposición estimada en 3 días naturales.',
    )
    expect(wrapper.get('[data-testid="human-decision-response"]').text()).toContain('Ana')
    expect(wrapper.get('[data-testid="human-decision-response"] time').attributes('datetime')).toBe(
      resolved.resolution.resolvedAt,
    )
    expect(wrapper.find('[data-testid="human-decision-open-detail"]').exists()).toBe(false)
    await wrapper.get('[data-testid="resolved-human-decision-open-detail"]').trigger('click')
    expect(wrapper.emitted('openDetail')).toContainEqual([{ id: resolved.id, status: 'RESOLVED' }])
  })

  it('uses one layout: the table on desktop and cards on mobile, opening the row on click', async () => {
    const wrapper = mountPanel()
    const table = wrapper.getComponent(AppDataTableStub)
    expect(table.props()).toMatchObject({
      displayMode: 'auto',
      mobileRender: 'cards',
      mobileBreakpoint: 'md',
      searchPlaceholder: 'Buscar por producto...',
      loading: true,
      error: true,
      errorMessage: 'No se pudo cargar la bandeja.',
      pageCount: 3,
      totalCount: 41,
      pageSizeOptions: [20, 50],
    })
    expect(table.vm.$slots.cards).toBeUndefined()
    table.props('rowOpen')(decision())
    expect(wrapper.emitted('openDetail')).toContainEqual([{ id: 'decision-1', status: 'PENDING' }])
  })

  it('names the empty state, the no-match title and the clear action', async () => {
    const wrapper = mountPanel()
    const table = wrapper.getComponent(AppDataTableStub)
    expect(table.props('emptyState')).toMatchObject({ title: 'Aún no hay solicitudes' })
    expect(table.props('emptyState').actionLabel).toBeUndefined()
    expect(table.props('filtered')).toBe(false)

    await wrapper.setProps({ globalFilter: 'perro', statusFilter: 'PENDING' })
    expect(table.props('filtered')).toBe(true)
    expect(table.props('noMatchTitle')).toBe('Ningún resultado para «perro»')

    await wrapper.setProps({ globalFilter: '' })
    expect(table.props('filtered')).toBe(true)
    expect(table.props('noMatchTitle')).toBe('Ningún resultado')
  })

  it('clears the search and the status filter from the no-match action', async () => {
    const onSearch = vi.fn<(value: string) => void>()
    const onPagination = vi.fn<(value: PaginationState) => void>()
    const wrapper = mountPanel({ onSearch, onPagination, props: { globalFilter: 'perro', statusFilter: 'PENDING', pagination: { pageIndex: 2, pageSize: 20 } } })
    await wrapper.get('[data-testid="stub-clear"]').trigger('click')
    expect(onSearch).toHaveBeenCalledWith('')
    expect(onPagination).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 20 })
    expect(wrapper.emitted('update:statusFilter')).toEqual([['ALL']])
  })

  it('forwards refresh and both controlled table models', async () => {
    const onPagination = vi.fn<(value: PaginationState) => void>()
    const onSearch = vi.fn<(value: string) => void>()
    const wrapper = mountPanel({ onPagination, onSearch })
    await wrapper.get('[data-testid="stub-refresh"]').trigger('click')
    await wrapper.get('[data-testid="stub-models"]').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(onPagination).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 50 })
    expect(onSearch).toHaveBeenCalledWith('alimento')
  })

  it('renders the title and product as literal text, never ids, and emits the detail id', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>Reposición</b>')
    expect(wrapper.text()).not.toContain('decision-1')
    const buttons = wrapper.findAll('[data-testid="human-decision-table-open"]')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('hf-row-primary')
    expect(wrapper.get('.hf-row-secondary').text()).toContain('Alimento 15 kg')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('openDetail')).toContainEqual([{ id: 'decision-1', status: 'PENDING' }])
  })

  it('uses the shared StatusBadge tone per status and one ⋮ menu that names the row', async () => {
    const wrapper = mountPanel()
    const badges = wrapper.findAll('.hf-status-badge')
    expect(badges[0]!.attributes('data-tone')).toBe('warning')
    const menu = wrapper.getComponent({ name: 'RowActionsMenu' })
    expect(menu.props('rowLabel')).toBe('<b>Reposición</b>, pendiente')
    expect((menu.props('actions') as Array<{ label: string }>).map((a) => a.label)).toEqual(['Ver detalle'])
    menu.vm.$emit('select', 'open')
    expect(wrapper.emitted('openDetail')).toContainEqual([{ id: 'decision-1', status: 'PENDING' }])
    expect(wrapper.get('[data-testid="human-decision-quantity"]').classes()).toContain('hf-figure')
  })

  it('shows a short date in the list', () => {
    const wrapper = mountPanel()
    const time = wrapper.get('time')
    expect(time.attributes('datetime')).toBe('2026-01-01T00:00:00.000Z')
    expect(time.text()).toMatch(/^\d{1,2} \w+( \d{4})?, \d{2}:\d{2}$/)
  })

  it('reuses the mobile card and forwards its detail event', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="human-decision-open-detail"]').trigger('click')
    expect(wrapper.emitted('openDetail')).toContainEqual([{ id: 'decision-1', status: 'PENDING' }])
  })

  it.each([
    [pendingExpiration, 'Pendiente', ['—']],
    [resolvedExpiration(provideExpiration), 'Respondida', [PROVIDE_COPY, 'Ana']],
    [
      resolvedExpiration(unavailableExpiration),
      'Respondida',
      [EXPIRATION_UNAVAILABLE_LABEL, 'Ana'],
    ],
  ] as [HumanDecision, string, string[]][])(
    'renders EXPIRATION metadata, response and detail access',
    async (row, status, responseParts) => {
      const wrapper = mountPanel()
      await wrapper.setProps({ data: [row] })
      const text = wrapper.text()
      expect(text).toContain('Alimento húmedo')
      expect(text).toContain('kg · Presentación (Tamaño: Grande)')
      expect(text).toContain(status)
      expect(text).not.toContain('Sin SKU')
      expect(text).not.toContain('Cantidad no especificada')
      expect(wrapper.get('[data-testid="human-decision-quantity"]').text()).toBe('—')
      const responseCell = wrapper.get('[data-testid="human-decision-response"]').text()
      for (const part of responseParts) expect(responseCell).toContain(part)
      const openTestId =
        row.status === 'PENDING'
          ? 'human-decision-open-detail'
          : 'resolved-human-decision-open-detail'
      await wrapper.get(`[data-testid="${openTestId}"]`).trigger('click')
      expect(wrapper.emitted('openDetail')).toContainEqual([{ id: 'exp-1', status: row.status }])
    },
  )
})
