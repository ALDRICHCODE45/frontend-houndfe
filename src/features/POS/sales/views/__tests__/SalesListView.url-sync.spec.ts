/**
 * owner-ideas-batch T1 (S6): the sales list keeps page, sort and search in the URL next to the
 * filters, and its saved views stay applied and clean.
 *
 * Mounts the real wiring — a real router (memory history, real query updates), the real
 * `useConfirmedSales` / `useServerTable`, the filters URL adapter, `useTableViews` and the views
 * bar — so the URL writers race exactly as in the browser. Only the request layer and the heavy
 * table are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import SalesListView from '../SalesListView.vue'

vi.mock('@tanstack/vue-query', () => ({
  keepPreviousData: undefined,
  useQuery: () => ({
    data: ref(undefined),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => ref(false) }) }
})

vi.mock('../../api/sale.api', () => ({ saleApi: { listSales: vi.fn(), list: vi.fn() } }))
vi.mock('@/features/POS/customers/api/customer.api', () => ({ customerApi: { getPaginated: vi.fn() } }))
vi.mock('@/features/POS/users/api/user.api', () => ({ usersApi: { list: vi.fn() } }))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: () => true, currentTenantId: 'tenant-1' }),
}))

vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    props: ['sorting', 'pagination', 'globalFilter', 'columnVisibility'],
    template: '<div data-testid="app-data-table"><slot name="filters" /></div>',
  },
}))
vi.mock('@/core/shared/data-table-filters/components/DataTableFilters.vue', () => ({
  default: { name: 'DataTableFilters', props: ['state', 'schema', 'errors', 'embedded', 'portalClass'], template: '<div />' },
}))

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(url = '/pos/ventas') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/ventas', name: 'pos-sales', component: { template: '<div />' } },
      { path: '/pos/ventas/:id', name: 'pos-sale-detail', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(SalesListView, { global: { plugins: [router] } })
  await settle()
  return wrapper
}

/** Lets every debounced write (URL 100 ms, search 300 ms, filters 250 ms) and the navigations land. */
async function settle() {
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
}

const tab = (id: string) => wrapper!.get(`[data-testid="table-views-tab-${id}"]`)
const isTabDirty = (id: string) => tab(id).find('.hf-views__dot').exists()
const unsavedShown = () => wrapper!.find('[data-testid="table-views-unsaved"]').exists()
const table = () => wrapper!.getComponent({ name: 'AppDataTable' })
const filterState = () => wrapper!.getComponent({ name: 'DataTableFilters' }).props('state') as Record<string, unknown>
const urlQuery = () => router.currentRoute.value.query

async function select(id: string) {
  await tab(id).trigger('click')
  await settle()
}

const VIEWS = [
  { id: 'todas', sort: 'confirmedAt:desc', sorting: [{ id: 'confirmedAt', desc: true }] },
  { id: 'cobranza', sort: 'debtCents:desc', sorting: [{ id: 'debtCents', desc: true }] },
  { id: 'entregas', sort: 'confirmedAt:desc', sorting: [{ id: 'confirmedAt', desc: true }] },
]

function expectApplied(view: (typeof VIEWS)[number]) {
  expect(tab(view.id).attributes('aria-selected')).toBe('true')
  expect(table().props('sorting')).toEqual(view.sorting)
  expect(urlQuery().sort).toBe(view.sort)
  expect(isTabDirty(view.id)).toBe(false)
  expect(unsavedShown()).toBe(false)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  localStorage.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('SalesListView — table state in the URL (owner-ideas-batch S6)', () => {
  it.each(VIEWS.slice(1))('«$id» stays applied and clean, its sort in the URL and the filters kept', async (view) => {
    await mountAt('/pos/ventas?paymentMethod=CASH')

    await select(view.id)

    expectApplied(view)
    expect(urlQuery().paymentMethod).toBe('CASH')
    expect(filterState().paymentMethod).toEqual(['CASH'])
  })

  it('switching between views back and forth stays clean', async () => {
    await mountAt()
    for (const id of ['cobranza', 'entregas', 'cobranza', 'todas', 'entregas']) {
      await select(id)
      expectApplied(VIEWS.find((view) => view.id === id)!)
    }
  })

  it('a shared link with search, sort, page and filters opens the table exactly so', async () => {
    await mountAt('/pos/ventas?q=ada&sort=totalCents:asc&page=3&paymentMethod=CASH')

    expect(table().props('globalFilter')).toBe('ada')
    expect(table().props('sorting')).toEqual([{ id: 'totalCents', desc: false }])
    expect(table().props('pagination')).toMatchObject({ pageIndex: 2 })
    expect(filterState().paymentMethod).toEqual(['CASH'])
    expect(urlQuery()).toMatchObject({ q: 'ada', sort: 'totalCents:asc', page: '3', paymentMethod: 'CASH' })
  })

  it('a reload on a saved view keeps the page of the URL', async () => {
    await mountAt()
    await select('cobranza')
    wrapper!.unmount()

    await mountAt('/pos/ventas?sort=debtCents:desc&page=4')

    expectApplied(VIEWS[1]!)
    expect(table().props('pagination')).toMatchObject({ pageIndex: 3 })
    expect(urlQuery().page).toBe('4')
  })

  it('the stored page size applies without pageSize in the URL; the URL wins when present', async () => {
    localStorage.setItem('table-page-size-pos-sales-list', '35')
    await mountAt('/pos/ventas?page=2')
    expect(table().props('pagination')).toEqual({ pageIndex: 1, pageSize: 35 })
    wrapper!.unmount()

    await mountAt('/pos/ventas?pageSize=15')
    expect(table().props('pagination')).toMatchObject({ pageSize: 15 })
    expect(localStorage.getItem('table-page-size-pos-sales-list')).toBe('35')
  })
})
