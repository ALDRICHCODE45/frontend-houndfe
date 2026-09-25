import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import HumanDecisionsListPanel from '../HumanDecisionsListPanel.vue'
import type { PaginationState } from '@/core/shared/types/table.types'
import type { PendingHumanDecision } from '../../interfaces/human-decision.types'

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
    'displayMode',
    'mobileRender',
    'mobileBreakpoint',
    'searchPlaceholder',
    'pagination',
    'globalFilter',
  ],
  emits: ['refresh', 'update:pagination', 'update:globalFilter'],
  template: `
    <div data-testid="table-stub">
      <button data-testid="stub-refresh" @click="$emit('refresh')">refresh</button>
      <button
        data-testid="stub-models"
        @click="$emit('update:pagination', { pageIndex: 1, pageSize: 50 }); $emit('update:globalFilter', 'alimento')"
      >models</button>
      <slot name="product-cell" :row="{ original: data[0] }" />
      <slot name="branch-cell" :row="{ original: data[0] }" />
      <slot name="requestedQuantity-cell" :row="{ original: data[0] }" />
      <slot name="createdAt-cell" :row="{ original: data[0] }" />
      <slot name="actions-cell" :row="{ original: data[0] }" />
      <slot name="mobile-card" :row="data[0]" />
    </div>
  `,
}

const UButtonStub = { template: '<button type="button"><slot /></button>' }

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
    },
    global: { stubs: { AppDataTable: AppDataTableStub, UButton: UButtonStub } },
  })
}

describe('HumanDecisionsListPanel', () => {
  it('passes responsive server-table states and honest copy', () => {
    const table = mountPanel().getComponent(AppDataTableStub)
    expect(table.props()).toMatchObject({
      loading: true,
      fetching: false,
      error: true,
      errorMessage: 'No se pudo cargar la bandeja.',
      empty: 'No hay decisiones pendientes.',
      pageCount: 3,
      totalCount: 41,
      pageSizeOptions: [20, 50],
      displayMode: 'auto',
      mobileRender: 'cards',
      mobileBreakpoint: 'md',
      searchPlaceholder: 'Buscar por producto o sucursal...',
    })
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

  it('renders desktop title and summary as literal text and emits the detail id', async () => {
    const wrapper = mountPanel()
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>Reposición</b>')
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
    const buttons = wrapper.findAll('[data-testid="human-decision-table-open"]')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.classes()).toContain('min-h-11')
    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('openDetail')).toContainEqual(['decision-1'])
  })

  it('reuses the mobile card and forwards its detail event', async () => {
    const wrapper = mountPanel()
    await wrapper.get('[data-testid="human-decision-open-detail"]').trigger('click')
    expect(wrapper.emitted('openDetail')).toContainEqual(['decision-1'])
  })
})
