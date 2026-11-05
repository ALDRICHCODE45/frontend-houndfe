import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
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
    props: ['data', 'loading', 'error', 'errorMessage', 'emptyState', 'filtered', 'rowOpen', 'columns', 'totalCount'],
    emits: ['refresh', 'clear-filters'],
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
    expect(wrapper.get('[data-testid="table-empty"]').text()).toBe('No hay reembolsos pendientes.')
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

  it('shows the whole reason (it wraps, never truncates) and the cancellation day under it', () => {
    list.rows.value = [row('1', { reason: 'ORDER_ERROR', createdAt: '2026-10-25T20:42:00.000Z' })]
    const wrapper = mountView()
    const reason = wrapper.get('.refund-reason')
    expect(reason.text()).toBe('Error en el pedido')
    expect(reason.classes()).not.toContain('truncate')
    expect(wrapper.get('.refund-reason-when').text()).toBe('Cancelada el 25 oct')
  })

  it('heads the amount column «Total», next to Devuelto and Pendiente', () => {
    const headers = mountView().findAll('[data-testid="column-header"]')
    const byId = Object.fromEntries(headers.map((h) => [h.attributes('data-column'), h.text()]))
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
})
