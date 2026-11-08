import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
import type { PendingRefundListRow } from '../../composables/usePendingRefundsList'

const list = vi.hoisted(() => ({
  rows: null as unknown as import('vue').Ref<PendingRefundListRow[]>,
  loading: null as unknown as import('vue').Ref<boolean>,
  error: null as unknown as import('vue').Ref<boolean>,
  refetch: vi.fn(),
  lastOptions: null as null | { enabled: () => boolean; search: { value: string } },
}))

vi.mock('../../composables/usePendingRefundsList', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return {
    usePendingRefundsList: (options: never) => {
      list.lastOptions = options
      return {
        rows: list.rows,
        visibleRows: list.rows,
        total: computed(() => list.rows.value.length),
        totalPages: computed(() => 1),
        outstandingOnPage: computed(() => list.rows.value.reduce((s, r) => s + r.outstandingCents, 0)),
        isInitialLoading: list.loading,
        isFetching: computed(() => false),
        isError: list.error,
        refetch: list.refetch,
      }
    },
  }
})

const auth = vi.hoisted(() => ({ grants: new Set<string>() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => auth.grants.has(`${action}:${subject}`),
  }),
}))

const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerPush }) }))

const toastAdd = vi.hoisted(() => vi.fn())
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

vi.mock('../../components/SettleRefundSlideover.vue', () => ({
  default: {
    name: 'SettleRefundSlideover',
    props: ['open', 'refund'],
    template: '<div v-if="open" data-testid="settle-panel">{{ refund && refund.folioLabel }}</div>',
  },
}))

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    props: [
      'data',
      'loading',
      'error',
      'errorMessage',
      'emptyState',
      'filtered',
      'rowOpen',
      'columns',
      'totalCount',
      'columnOrder',
      'columnPinning',
      'columnSizing',
      'columnVisibility',
      'density',
      'persistLayout',
    ],
    emits: [
      'refresh',
      'clear-filters',
      'reset-columns',
      'update:columnOrder',
      'update:columnPinning',
      'update:columnSizing',
      'update:columnVisibility',
      'update:density',
    ],
    template: `
      <div data-testid="table">
        <span v-for="c in columns" :key="c.id" data-testid="column-header" :data-column="c.id">{{ c.header }}</span>
        <slot name="actions" />
        <div v-if="loading" data-testid="table-skeleton" />
        <div v-else-if="error" data-testid="table-error-state" role="alert">{{ errorMessage }}<button data-testid="retry" @click="$emit('refresh')">Reintentar</button></div>
        <div v-else-if="data.length === 0" data-testid="table-empty">{{ emptyState && emptyState.title }}</div>
        <div v-for="row in data" v-else :key="row.id" data-testid="row">
          <slot name="sale-cell" :row="{ original: row }" />
          <slot name="reason-cell" :row="{ original: row }" />
          <slot name="outstandingCents-cell" :row="{ original: row }" />
          <slot name="actions-cell" :row="{ original: row }" />
        </div>
      </div>`,
  },
}))

vi.mock('@/core/shared/components/RowActionsMenu.vue', () => ({
  default: {
    name: 'RowActionsMenu',
    props: ['actions', 'rowLabel'],
    emits: ['select'],
    template: `<div data-testid="row-actions"><button v-for="a in actions" :key="a.key" :data-action="a.key" @click="$emit('select', a.key)">{{ a.label }}</button></div>`,
  },
}))

import PendingRefundsView from '../PendingRefundsView.vue'

function row(id: string, patch: Partial<PendingRefundListRow> = {}): PendingRefundListRow {
  return {
    id,
    saleId: `s-${id}`,
    method: 'cash',
    amountCents: 6555,
    settledCents: 2000,
    outstandingCents: 4555,
    reason: 'CUSTOMER_REQUEST',
    status: 'PENDING',
    createdAt: '2026-10-21T20:42:00.000Z',
    folioLabel: `A-${id}`,
    customerLabel: 'María López',
    saleFound: true,
    ...patch,
  }
}

function mountView() {
  return mount(PendingRefundsView, { attachTo: document.body })
}

describe('PendingRefundsView', () => {
  beforeEach(() => {
    list.rows = ref([row('1'), row('2', { settledCents: 0, outstandingCents: 6555 })])
    list.loading = ref(false)
    list.error = ref(false)
    list.refetch.mockReset()
    toastAdd.mockReset()
    routerPush.mockReset()
    auth.grants = new Set(['read:SaleRefund', 'update:SaleRefund'])
  })

  it('titles the page with the pending count and what is still owed', () => {
    const wrapper = mountView()
    expect(wrapper.get('h1').text()).toBe('Reembolsos pendientes')
    expect(wrapper.get('[data-testid="refunds-count"]').text()).toBe('2 pendientes')
    expect(wrapper.get('[data-testid="refunds-owed"]').text()).toBe('Por devolver: $111.10')
  })

  it('marks a partially returned refund «Parcial» and shows what is pending', () => {
    const wrapper = mountView()
    const rows = wrapper.findAll('[data-testid="row"]')
    expect(rows[0]!.text()).toContain('A-1')
    expect(rows[0]!.text()).toContain('Parcial')
    expect(rows[1]!.text()).not.toContain('Parcial')
    expect(rows[1]!.text()).toContain('$65.55')
  })

  it('loading shows the skeleton', () => {
    list.loading.value = true
    expect(mountView().find('[data-testid="table-skeleton"]').exists()).toBe(true)
  })

  it('empty says there is nothing pending', () => {
    list.rows.value = []
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-empty"]').text()).toBe('No hay reembolsos pendientes')
    expect(wrapper.find('[data-testid="refunds-count"]').exists()).toBe(false)
  })

  it('error offers Reintentar, which refetches', async () => {
    list.error.value = true
    const wrapper = mountView()
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron cargar los reembolsos')
    await wrapper.get('[data-testid="retry"]').trigger('click')
    expect(list.refetch).toHaveBeenCalled()
  })

  it('forbidden without SaleRefund read, and no request', () => {
    auth.grants = new Set()
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="table"]').exists()).toBe(false)
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('forbidden')
    expect(list.lastOptions!.enabled()).toBe(false)
  })

  it('«Liquidar…» opens the settle panel for the row', async () => {
    const wrapper = mountView()
    await wrapper.findAll('[data-action="settle"]')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="settle-panel"]').text()).toBe('A-1')
  })

  it('without SaleRefund update there is no «Liquidar…» and rows do not open', () => {
    auth.grants = new Set(['read:SaleRefund'])
    const wrapper = mountView()
    expect(wrapper.find('[data-action="settle"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="sale"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'AppDataTable' }).props('rowOpen')).toBeUndefined()
  })

  it('«Ver venta» opens the detail of the cancelled sale, with no toast', async () => {
    const wrapper = mountView()
    await wrapper.findAll('[data-action="sale"]')[0]!.trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/s-1')
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('shows the whole reason (it wraps, never truncates) and how long ago the sale was cancelled', () => {
    vi.useFakeTimers({ now: new Date('2026-11-05T17:05:00.000Z'), toFake: ['Date'] })
    list.rows.value = [row('1', { reason: 'ORDER_ERROR', createdAt: '2026-10-25T20:42:00.000Z' })]
    const wrapper = mountView()
    vi.useRealTimers()
    const reason = wrapper.get('.refund-reason')
    expect(reason.text()).toBe('Error en el pedido')
    expect(reason.classes()).not.toContain('truncate')
    const when = wrapper.get('.refund-reason-when')
    expect(when.text()).toBe('Cancelada hace 10 días')
    expect(when.attributes('title')).toBe('Cancelada el 25 oct')
  })

  it('fits seven columns at 1440: the age rides under Motivo, the method header is short', () => {
    const headers = mountView().findAll('[data-testid="column-header"]')
    const byId = Object.fromEntries(headers.map((h) => [h.attributes('data-column'), h.text()]))
    expect(Object.keys(byId)).toEqual([
      'sale',
      'reason',
      'method',
      'amountCents',
      'settledCents',
      'outstandingCents',
      'actions',
    ])
    expect(byId.method).toBe('Pagó con')
    expect(byId.amountCents).toBe('Total')
    expect(byId.settledCents).toBe('Devuelto')
    expect(byId.outstandingCents).toBe('Pendiente')
  })

  it('searches over the loaded page through the list composable', async () => {
    const wrapper = mountView()
    expect(list.lastOptions!.search.value).toBe('')
    wrapper.findComponent({ name: 'AppDataTable' }).vm.$emit('clear-filters')
    expect(list.lastOptions!.search.value).toBe('')
  })

  // Premium tables T7 (S5): the totals row counts the refunds and adds up Total, Devuelto and
  // Pendiente in cents with the same formatter as their cells.
  describe('totals row', () => {
    type Total = { kind: string; label?: (n: number) => string; value?: (r: PendingRefundListRow) => number; format?: (n: number) => string }
    const totalOf = (wrapper: ReturnType<typeof mountView>, id: string) =>
      (wrapper.findComponent({ name: 'AppDataTable' }).props('columns') as Array<{ id: string; meta?: { total?: Total } }>)
        .find(column => column.id === id)?.meta?.total
    const sum = (total: Total, rows: PendingRefundListRow[]) => total.format!(rows.reduce((acc, r) => acc + total.value!(r), 0))
    const rows = [row('1'), row('2', { amountCents: 100_000, settledCents: 0, outstandingCents: 100_000 })]

    it('counts the refunds in the label', () => {
      const count = totalOf(mountView(), 'sale')!
      expect(count.kind).toBe('count')
      expect(count.label!(1)).toBe('1 reembolso')
      expect(count.label!(3)).toBe('3 reembolsos')
    })

    it('sums Total, Devuelto and Pendiente from their cents fields', () => {
      const wrapper = mountView()
      expect(sum(totalOf(wrapper, 'amountCents')!, rows)).toBe('$1,065.55')
      expect(sum(totalOf(wrapper, 'settledCents')!, rows)).toBe('$20.00')
      expect(sum(totalOf(wrapper, 'outstandingCents')!, rows)).toBe('$1,045.55')
    })

    it('adds nothing up in the other columns', () => {
      const wrapper = mountView()
      for (const id of ['reason', 'method', 'actions']) expect(totalOf(wrapper, id)).toBeUndefined()
    })
  })
})

describe('PendingRefundsView — column layout (premium tables T9)', () => {
  const STORAGE_KEY = 'table-preferences-pos-pending-refunds'
  beforeEach(() => {
    localStorage.clear()
    list.rows = ref([row('1')])
    list.loading = ref(false)
    list.error = ref(false)
    auth.grants = new Set(['read:SaleRefund', 'update:SaleRefund'])
  })
  afterEach(() => localStorage.clear())

  it('persists order, pins, widths, visibility and density under pos-pending-refunds', async () => {
    const wrapper = mountView()
    const table = wrapper.getComponent({ name: 'AppDataTable' })
    expect(table.props('persistLayout')).toBe(true)

    table.vm.$emit('update:columnOrder', ['sale', 'amountCents', 'reason', 'method', 'settledCents', 'outstandingCents', 'actions'])
    table.vm.$emit('update:columnPinning', { left: ['sale'], right: ['actions'] })
    table.vm.$emit('update:columnSizing', { reason: 200 })
    table.vm.$emit('update:columnVisibility', { method: false })
    table.vm.$emit('update:density', 'normal')
    await nextTick()

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({
      pinning: { left: ['sale'], right: ['actions'] },
      sizing: { reason: 200 },
      visibility: { method: false },
      density: 'normal',
    })
    expect(table.props('columnVisibility')).toEqual({ method: false })

    table.vm.$emit('reset-columns')
    await nextTick()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(table.props('columnVisibility')).toEqual({})
    wrapper.unmount()
  })

  it('names every column for the «Columnas» panel, never with its id', () => {
    const table = mountView().getComponent({ name: 'AppDataTable' })
    const labels = (table.props('columns') as Parameters<typeof columnLabel>[0][]).map(columnLabel)
    expect(labels).toEqual(['Venta', 'Motivo', 'Pagó con', 'Total', 'Devuelto', 'Pendiente', 'Acciones'])
  })
})
