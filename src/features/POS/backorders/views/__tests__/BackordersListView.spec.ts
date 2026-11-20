import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { countsFixture, makeBackorder, makeWaitingBackorder } from '../../interfaces/__tests__/backorder.fixture'
import type { BackorderCounts, BackorderListParams, BackorderStaff } from '../../interfaces/backorder.types'

const list = vi.hoisted(() => ({
  items: null as unknown as Ref<BackorderStaff[]>,
  counts: null as unknown as Ref<BackorderCounts | null>,
  loading: null as unknown as Ref<boolean>,
  error: null as unknown as Ref<boolean>,
  refetch: vi.fn(),
  lastParams: null as null | (() => BackorderListParams),
}))

vi.mock('../../composables/useBackorderList', async () => {
  const { computed } = await vi.importActual<typeof import('vue')>('vue')
  return {
    useBackorderList: (params: () => BackorderListParams) => {
      list.lastParams = params
      return {
        items: list.items,
        total: computed(() => list.items.value.length),
        counts: list.counts,
        isLoading: list.loading,
        isFetching: computed(() => false),
        isError: list.error,
        refetch: list.refetch,
      }
    },
  }
})

const auth = vi.hoisted(() => ({ grants: new Set<string>(['read:Backorder']) }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (action: string, subject: string) => auth.grants.has(`${action}:${subject}`),
  }),
}))

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    props: [
      'data', 'loading', 'error', 'errorMessage', 'emptyState', 'filtered', 'rowOpen', 'columns', 'sorting',
      'pagination', 'globalFilter', 'totalCount', 'pageCount', 'activeFilterCount', 'columnOrder',
      'columnPinning', 'columnSizing', 'columnVisibility', 'density',
    ],
    emits: [
      'refresh', 'clear-filters', 'reset-columns', 'update:sorting', 'update:pagination', 'update:globalFilter',
      'update:columnOrder', 'update:columnPinning', 'update:columnSizing', 'update:columnVisibility', 'update:density',
    ],
    template: `
      <div data-testid="table" :data-sort="JSON.stringify(sorting)" :data-page="JSON.stringify(pagination)" :data-total="totalCount" :data-filters="activeFilterCount">
        <span v-for="c in columns" :key="c.id" data-testid="column-header" :data-column="c.id" :data-sortable="c.enableSorting === false ? 'no' : 'yes'">{{ c.header }}</span>
        <input data-testid="search" :value="globalFilter" @input="$emit('update:globalFilter', $event.target.value)" />
        <slot name="filters" />
        <div v-if="loading" data-testid="table-skeleton" />
        <div v-else-if="error" data-testid="table-error-state" role="alert">{{ errorMessage }}<button data-testid="retry" @click="$emit('refresh')">Reintentar</button></div>
        <div v-else-if="data.length === 0" data-testid="table-empty">{{ filtered ? 'no-match' : emptyState && emptyState.title }}<button data-testid="clear-filters" @click="$emit('clear-filters')">Quitar</button></div>
        <div v-for="row in data" v-else :key="row.id" data-testid="row" @click="rowOpen && rowOpen(row)">
          <slot name="folio-cell" :row="{ original: row }" />
          <slot name="customer-cell" :row="{ original: row }" />
          <slot name="product-cell" :row="{ original: row }" />
          <slot name="quantity-cell" :row="{ original: row }" />
          <slot name="price-cell" :row="{ original: row }" />
          <slot name="scheduledAt-cell" :row="{ original: row }" />
          <slot name="eta-cell" :row="{ original: row }" />
          <slot name="info-cell" :row="{ original: row }" />
          <slot name="actions-cell" :row="{ original: row }" />
          <slot name="mobile-card" :row="row" />
        </div>
        <button data-testid="sort-reserved" @click="$emit('update:sorting', [{ id: 'info', desc: true }])" />
        <button data-testid="sort-clear" @click="$emit('update:sorting', [])" />
        <button data-testid="page-3" @click="$emit('update:pagination', { pageIndex: 2, pageSize: 20 })" />
        <button data-testid="size-50" @click="$emit('update:pagination', { pageIndex: 2, pageSize: 50 })" />
      </div>`,
  },
}))

vi.mock('@/core/shared/components/RowActionsMenu.vue', () => ({
  default: {
    name: 'RowActionsMenu',
    props: ['actions', 'rowLabel'],
    emits: ['select'],
    template: `<div data-testid="row-actions"><button v-for="a in actions" :key="a.key" :data-action="a.key" @click.stop="$emit('select', a.key)">{{ a.label }}</button></div>`,
  },
}))

const dateField = {
  name: 'UInputDate',
  props: ['modelValue', 'id'],
  emits: ['update:modelValue'],
  template: `<button :data-testid="$attrs['data-testid']" @click="$emit('update:modelValue', { year: 2026, month: 11, day: 3 })">{{ modelValue ? 'set' : 'empty' }}</button>`,
}

import BackordersListView from '../BackordersListView.vue'

async function mountAt(url: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/pedidos-reposicion', component: { template: '<div />' } },
      { path: '/pos/pedidos-reposicion/:id', name: 'pos-backorder-detail', component: { template: '<div />' } },
      { path: '/pos/ventas/:id', component: { template: '<div />' } },
      { path: '/chatbot/solicitudes/:id', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(BackordersListView, {
    global: { plugins: [router], stubs: { UInputDate: dateField, InputDate: dateField, UIcon: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

const lastParams = () => list.lastParams!()

beforeEach(() => {
  vi.useRealTimers()
  auth.grants = new Set(['read:Backorder'])
  list.items = ref([makeBackorder()])
  list.counts = ref(countsFixture)
  list.loading = ref(false)
  list.error = ref(false)
  list.refetch.mockReset()
})

describe('BackordersListView — states and access', () => {
  it('without read:Backorder shows the forbidden state and no table', async () => {
    auth.grants = new Set()
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(wrapper.text()).toContain('No tienes permiso para ver los pedidos por reposición')
    expect(wrapper.find('[data-testid="table"]').exists()).toBe(false)
  })

  it('has one page title and no primary «create» action (no staff creation in v1)', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(wrapper.find('h1').text()).toBe('Pedidos por reposición')
    expect(wrapper.text()).not.toMatch(/Nuevo pedido|Agregar/)
  })

  it('passes loading, error (with retry) and the per-tab empty copy to the table', async () => {
    list.loading.value = true
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(true)

    list.loading.value = false
    list.error.value = true
    await flushPromises()
    expect(wrapper.find('[data-testid="table-error-state"]').text()).toContain('No se pudieron cargar los pedidos')
    await wrapper.find('[data-testid="retry"]').trigger('click')
    expect(list.refetch).toHaveBeenCalled()

    list.error.value = false
    list.items.value = []
    await flushPromises()
    expect(wrapper.find('[data-testid="table-empty"]').text()).toContain('No hay pedidos en espera')
  })
})

describe('BackordersListView — status tabs (S1)', () => {
  it('shows the five tabs with their counts and En espera selected by default', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    const tabs = wrapper.findAll('[data-testid="backorder-tab"]')
    expect(tabs.map((t) => t.text().replace(/\s+/g, ' '))).toEqual([
      'En espera 4',
      'Apartados 2',
      'Confirmados 7',
      'Vencidos 1',
      'Cancelados 3',
    ])
    expect(tabs.map((t) => t.attributes('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(lastParams()).toMatchObject({ status: ['WAITING'], sortBy: 'scheduledAt', sortOrder: 'asc', page: 1 })
  })

  it('a tab click writes ?status= to the URL, queries that status and starts at page 1', async () => {
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion?page=3')
    await wrapper.findAll('[data-testid="backorder-tab"]')[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'RESERVED' })
    expect(lastParams()).toMatchObject({ status: ['RESERVED'], sortBy: 'reservedUntil', sortOrder: 'asc', page: 1 })
    await wrapper.findAll('[data-testid="backorder-tab"]')[0]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('reads the tab from the URL and omits counts it does not have yet', async () => {
    list.counts.value = null
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?status=CANCELLED')
    const tabs = wrapper.findAll('[data-testid="backorder-tab"]')
    expect(tabs[4]!.attributes('aria-pressed')).toBe('true')
    expect(tabs[4]!.text()).toBe('Cancelados')
    expect(lastParams().status).toEqual(['CANCELLED'])
  })
})

describe('BackordersListView — filters, sort and paging in the URL', () => {
  it('search is debounced into ?q= and reaches the API trimmed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion')
    await wrapper.find('[data-testid="search"]').setValue('  Rosa ')
    expect(router.currentRoute.value.query.q).toBeUndefined()
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(router.currentRoute.value.query.q).toBe('Rosa')
    expect(lastParams().q).toBe('Rosa')
  })

  it('reads q, dates, sort and paging from the URL: local days become ISO with zone', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?q=Rosa&from=2026-11-01&to=2026-11-08&order=desc&page=2&limit=10')
    expect(wrapper.find('[data-testid="search"]').element).toHaveProperty('value', 'Rosa')
    expect(lastParams()).toMatchObject({
      q: 'Rosa',
      from: new Date(2026, 10, 1).toISOString(),
      to: new Date(2026, 10, 9).toISOString(),
      sortOrder: 'desc',
      page: 2,
      limit: 10,
    })
    expect(wrapper.find('[data-testid="table"]').attributes('data-filters')).toBe('2')
  })

  it('picking a date writes it to the URL and goes back to page 1', async () => {
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion?page=2')
    await wrapper.find('[data-testid="backorders-from"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ from: '2026-11-03' })
  })

  it('sorting: the table shows the tab default and clicks map to sortBy/order', async () => {
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion?status=RESERVED')
    expect(wrapper.find('[data-testid="table"]').attributes('data-sort')).toBe('[{"id":"info","desc":false}]')
    await wrapper.find('[data-testid="sort-reserved"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'RESERVED', order: 'desc' })
    await wrapper.find('[data-testid="sort-clear"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'RESERVED' })
  })

  it('only offers the sort on the columns the backend can order by', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    const sortable = (id: string) => wrapper.find(`[data-column="${id}"]`).attributes('data-sortable')
    expect(sortable('scheduledAt')).toBe('yes')
    expect(sortable('info')).toBe('no')
    expect(sortable('customer')).toBe('no')
    await wrapper.findAll('[data-testid="backorder-tab"]')[1]!.trigger('click')
    await flushPromises()
    expect(sortable('info')).toBe('yes')
  })

  it('paging writes page and limit; a new page size starts over', async () => {
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion')
    await wrapper.find('[data-testid="page-3"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ page: '3' })
    await wrapper.find('[data-testid="size-50"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ limit: '50' })
  })

  it('«Quitar filtros» clears search and dates, keeps the tab; no-match is told apart from empty', async () => {
    list.items.value = []
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion?status=EXPIRED&q=zzz&from=2026-11-01')
    expect(wrapper.find('[data-testid="table-empty"]').text()).toContain('no-match')
    await wrapper.find('[data-testid="clear-filters"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'EXPIRED' })
  })
})

describe('BackordersListView — cells per status (S1)', () => {
  const text = (wrapper: ReturnType<typeof mount>, id: string) =>
    wrapper.find(`[data-testid="${id}"]`).text().replace(/\s+/g, ' ')

  it('shows folio, customer (name + phone), product, quantity, price, dates and ETA', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?status=RESERVED')
    expect(text(wrapper, 'backorder-folio')).toBe('BO-000012')
    expect(text(wrapper, 'backorder-customer')).toContain('Rosa Elena Díaz')
    expect(text(wrapper, 'backorder-customer')).toContain('+525512345678')
    expect(text(wrapper, 'backorder-product')).toContain('Croquetas Adulto Raza Grande 18 kg')
    expect(text(wrapper, 'backorder-quantity')).toBe('2')
    expect(text(wrapper, 'backorder-price')).toContain('$1,099.00')
    expect(text(wrapper, 'backorder-price')).toContain('Al agendar $1,149.00')
    expect(wrapper.find('[data-testid="backorder-price"] .hf-figure').exists()).toBe(true)
    expect(text(wrapper, 'backorder-scheduled')).toMatch(/14 nov/)
    expect(text(wrapper, 'backorder-eta')).toMatch(/21 nov/)
    expect(wrapper.find('[data-testid="backorder-eta-overdue"]').exists()).toBe(false)
  })

  it('a WAITING order (null current/final price) shows the reference price, no $0.00 and no «Vigente»', async () => {
    list.items.value = [makeWaitingBackorder()]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(text(wrapper, 'backorder-price')).toBe('$1,149.00Precio al agendar')
    expect(wrapper.text()).not.toMatch(/\$0\.00|Vigente/)
    expect(wrapper.find('[data-testid="backorder-card"]').text()).toContain('$1,149.00')
    expect(wrapper.find('[data-testid="backorder-card"]').text()).not.toMatch(/\$0\.00|Vigente/)
  })

  it('without a phone the customer cell shows the name only', async () => {
    list.items.value = [makeBackorder({ customer: { id: 'c1', name: 'Rosa Elena Díaz', phone: null } })]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(text(wrapper, 'backorder-customer')).toBe('Rosa Elena Díaz')
    expect(wrapper.find('[data-testid="backorder-card"]').text()).toContain('Rosa Elena Díaz')
    expect(wrapper.find('[data-testid="backorder-card"]').text()).not.toContain('null')
  })

  it('an overdue ETA gets a warning word, never danger styling', async () => {
    list.items.value = [makeBackorder({ etaOverdue: true })]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    const overdue = wrapper.find('[data-testid="backorder-eta-overdue"]')
    expect(overdue.text()).toBe('Atrasado')
    expect(overdue.classes()).toContain('bo-warning')
    expect(overdue.classes().join(' ')).not.toMatch(/danger|red/)
  })

  it('WAITING → «#N en la fila» plus the passed-over warning', async () => {
    list.items.value = [makeBackorder({ status: 'WAITING', queuePosition: 2, passedOverCount: 3, reservedUntil: null })]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(text(wrapper, 'backorder-info')).toContain('#2 en la fila')
    expect(wrapper.find('[data-testid="backorder-info-warning"]').text()).toBe('Se lo saltaron 3 veces')
  })

  it('WAITING without passed-over has no warning', async () => {
    list.items.value = [makeBackorder({ status: 'WAITING', queuePosition: 1 })]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(wrapper.find('[data-testid="backorder-info-warning"]').exists()).toBe(false)
  })

  it('RESERVED → «Apartado hasta …»', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?status=RESERVED')
    expect(text(wrapper, 'backorder-info')).toMatch(/Apartado hasta 21 nov/)
  })

  it('CONFIRMED → «Ver venta» links to the sale', async () => {
    list.items.value = [makeBackorder({ status: 'CONFIRMED', saleId: 'sale-9', saleStatus: 'CONFIRMED' })]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?status=CONFIRMED')
    const link = wrapper.find('[data-testid="backorder-info"] a')
    expect(link.text()).toBe('Ver venta')
    expect(link.attributes('href')).toBe('/pos/ventas/sale-9')
  })

  it('CANCELLED → who and why', async () => {
    list.items.value = [
      makeBackorder({
        status: 'CANCELLED',
        cancelledByKind: 'STAFF',
        cancelledBy: { id: 'u1', name: 'Ana Gómez' },
        cancelReason: 'Proveedor descontinuó',
      }),
    ]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?status=CANCELLED')
    expect(text(wrapper, 'backorder-info')).toContain('Canceló Ana Gómez')
    expect(text(wrapper, 'backorder-info')).toContain('Proveedor descontinuó')
  })
})

describe('BackordersListView — column sizing (no truncation at 1440)', () => {
  type Col = { id: string; size?: number; minSize?: number; meta?: { class?: { td?: string } } }
  const columns = async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    return wrapper.findComponent({ name: 'AppDataTable' }).props('columns') as Col[]
  }

  it('folio and date columns have a no-wrap floor that fits «BO-000012» and «16 nov, 22:45»', async () => {
    const byId = Object.fromEntries((await columns()).map((c) => [c.id, c]))
    expect(byId.folio!.minSize).toBeGreaterThanOrEqual(112)
    expect(byId.scheduledAt!.minSize).toBeGreaterThanOrEqual(128)
    expect(byId.eta!.minSize).toBeGreaterThanOrEqual(128)
  })

  it('product and follow-up cells may wrap (2-line clamp, wrapping follow-up)', async () => {
    const byId = Object.fromEntries((await columns()).map((c) => [c.id, c]))
    expect(byId.info!.meta?.class?.td).toContain('bo-wrap')
    expect(byId.product!.meta?.class?.td).toContain('bo-wrap')
    expect(byId.product!.minSize).toBeGreaterThanOrEqual(192)
    expect(byId.info!.minSize).toBeGreaterThanOrEqual(176)
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    expect(wrapper.find('[data-testid="backorder-product"] .bo-clamp').exists()).toBe(true)
  })

  it('the tab row hides its scrollbar but keeps horizontal scroll', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/features/POS/backorders/styles/backorders.css'), 'utf8')
    const block = css.slice(css.indexOf('.bo-tabs {'), css.indexOf('}', css.indexOf('.bo-tabs {')))
    expect(block).toContain('overflow-x: auto')
    expect(block).toContain('scrollbar-width: none')
    expect(css).toContain('.bo-tabs::-webkit-scrollbar')
  })
})

describe('BackordersListView — opening and row actions', () => {
  it('a row opens the detail', async () => {
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion?status=RESERVED')
    await wrapper.find('[data-testid="row"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pos/pedidos-reposicion/3f6c1c52-5d0e-4b53-9d33-0d3f8c4a9a01')
  })

  it('the ⋮ menu offers Ver pedido and Ver solicitud del chatbot, plus Ver venta only with a sale; never Cancelar', async () => {
    const { wrapper, router } = await mountAt('/pos/pedidos-reposicion')
    // The stub renders the table cell and the card; the first menu is the table row's.
    const actions = () =>
      wrapper.findAll('[data-testid="row-actions"]')[0]!.findAll('button').map((b) => b.attributes('data-action'))
    expect(actions()).toEqual(['open', 'request'])
    await wrapper.find('[data-action="request"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/chatbot/solicitudes/bbbbbbbb-0000-4000-8000-000000000003')

    list.items.value = [makeBackorder({ status: 'CONFIRMED', saleId: 'sale-9' })]
    await flushPromises()
    expect(actions()).toEqual(['open', 'request', 'sale'])
  })

  it('an order without a chatbot request has no «Ver solicitud» action (never /chatbot/solicitudes/null)', async () => {
    list.items.value = [makeBackorder({ chatbotRequestId: null })]
    const { wrapper } = await mountAt('/pos/pedidos-reposicion')
    for (const menu of wrapper.findAll('[data-testid="row-actions"]')) {
      expect(menu.findAll('button').map((b) => b.attributes('data-action'))).toEqual(['open'])
    }
  })

  it('renders a card at 390 with the same data (folio, customer, product, status cell)', async () => {
    const { wrapper } = await mountAt('/pos/pedidos-reposicion?status=RESERVED')
    const card = wrapper.find('[data-testid="backorder-card"]')
    expect(card.text()).toContain('BO-000012')
    expect(card.text()).toContain('Rosa Elena Díaz')
    expect(card.text()).toContain('Croquetas Adulto Raza Grande 18 kg')
    expect(card.text()).toMatch(/Apartado hasta 21 nov/)
    expect(card.text()).toContain('$1,099.00')
  })
})
