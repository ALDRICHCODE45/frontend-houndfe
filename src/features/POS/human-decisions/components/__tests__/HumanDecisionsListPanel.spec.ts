import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { useBreakpoints } from '@vueuse/core'

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useBreakpoints: vi.fn(),
}))

const isMobile = shallowRef(false)
const storageKey = 'human-decisions-view-mode'
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
      <slot name="actions" />
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
  beforeEach(() => {
    localStorage.clear()
    isMobile.value = false
    vi.mocked(useBreakpoints).mockReturnValue({ smaller: () => isMobile } as never)
  })

  it('encloses the shared heading and toolbar in a card', () => {
    const wrapper = mountPanel()
    expect(wrapper.get('article header').text()).toContain('Solicitudes')
    expect(wrapper.get('article header').text()).toContain('información operativa disponible')
    expect(wrapper.get('article [role="tablist"]').attributes('aria-label')).toBe(
      'Seleccionar vista',
    )
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual(['Tabla', 'Tarjetas'])
  })

  it('offers a controlled Estado filter with ALL default and accessible targets', async () => {
    const wrapper = mountPanel()
    const filter = wrapper.getComponent(USelectStub)
    expect(filter.props('modelValue')).toBe('ALL')
    expect(filter.classes()).toEqual(expect.arrayContaining(['min-h-11', 'max-w-full']))
    expect(filter.attributes('aria-label')).toBe('Estado')
    expect(filter.attributes('id')).toBe('human-decisions-status')
    expect(wrapper.get('label[for="human-decisions-status"]').text()).toContain('Estado')
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
    const filter = wrapper.getComponent(USelectStub)
    for (const value of [null, undefined, '', 'INVALID', 1, { value: 'ALL' }, ['ALL']]) {
      filter.vm.$emit('update:modelValue', value)
    }
    expect(wrapper.emitted('update:statusFilter')).toBeUndefined()
  })

  it('contains only this toggle in a local intrinsic-width wrapper', () => {
    const wrapper = mountPanel()
    const tablist = wrapper.get('[role="tablist"]')
    const container = tablist.element.parentElement!
    expect([...container.classList]).toEqual(['w-max', 'max-w-full', 'flex-none'])
    expect(container.children).toHaveLength(1)
    expect(tablist.classes()).toContain('w-full')
    for (const tab of wrapper.findAll('[role="tab"]')) {
      expect(tab.classes()).toContain('min-h-11')
    }
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

  it.each([false, true])('defaults and switches both ways (mobile: %s)', async (mobile) => {
    isMobile.value = mobile
    const wrapper = mountPanel()
    const table = wrapper.getComponent(AppDataTableStub)
    const tabs = wrapper.findAll('[role="tab"]')
    expect(table.props('displayMode')).toBe(mobile ? 'cards' : 'table')
    expect(tabs[mobile ? 1 : 0]!.attributes('aria-selected')).toBe('true')
    for (const index of mobile ? [0, 1] : [1, 0]) {
      await tabs[index]!.trigger('click')
      expect(table.props('displayMode')).toBe(index ? 'cards' : 'table')
      expect(tabs[index]!.attributes('aria-selected')).toBe('true')
      expect(tabs[index]!.classes()).toContain('min-h-11')
      expect(table.props()).toMatchObject({
        loading: true,
        error: true,
        empty: 'No hay solicitudes para este filtro.',
        pageCount: 3,
        totalCount: 41,
      })
    }
    isMobile.value = !mobile
    await wrapper.vm.$nextTick()
    expect(table.props('displayMode')).toBe(mobile ? 'cards' : 'table')
    expect(table.vm.$slots.cards).toBeUndefined()
    wrapper.unmount()
  })

  it.each(['table', 'card'] as const)(
    'preserves manual %s selection across remount and size',
    async (mode) => {
      isMobile.value = mode === 'table'
      const wrapper = mountPanel()
      await wrapper.findAll('[role="tab"]')[mode === 'table' ? 0 : 1]!.trigger('click')
      expect(localStorage.getItem(storageKey)).toBe(mode)
      wrapper.unmount()
      for (const mobile of [false, true]) {
        isMobile.value = mobile
        const remounted = mountPanel()
        expect(remounted.getComponent(AppDataTableStub).props('displayMode')).toBe(
          mode === 'card' ? 'cards' : 'table',
        )
        remounted.unmount()
      }
    },
  )

  it.each([false, true])('rejects invalid stored modes (mobile: %s)', (mobile) => {
    localStorage.setItem(storageKey, 'invalid')
    isMobile.value = mobile
    const wrapper = mountPanel()
    expect(wrapper.getComponent(AppDataTableStub).props('displayMode')).toBe(
      mobile ? 'cards' : 'table',
    )
    wrapper.unmount()
  })

  it('passes responsive server-table states and honest copy', () => {
    const table = mountPanel().getComponent(AppDataTableStub)
    expect(table.props()).toMatchObject({
      loading: true,
      fetching: false,
      error: true,
      errorMessage: 'No se pudo cargar la bandeja.',
      empty: 'No hay solicitudes para este filtro.',
      pageCount: 3,
      totalCount: 41,
      pageSizeOptions: [20, 50],
      displayMode: 'table',
      mobileRender: 'cards',
      mobileBreakpoint: 'md',
      searchPlaceholder: 'Buscar por producto...',
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
    expect(wrapper.emitted('openDetail')).toContainEqual([{ id: 'decision-1', status: 'PENDING' }])
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
