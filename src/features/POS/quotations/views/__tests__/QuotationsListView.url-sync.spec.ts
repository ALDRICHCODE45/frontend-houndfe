/**
 * owner-ideas-batch T1 (S6): the quotations list keeps page, sort and search in the URL next to
 * the filters, so a shared link opens the table exactly so.
 *
 * Mounts the real wiring — a real router (memory history, real query updates), the real
 * `useQuotationsListTable` / `useServerTable` and the filters URL adapter — so the URL writers race
 * exactly as in the browser. Only the request layer and the heavy table are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import QuotationsListView from '../QuotationsListView.vue'

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
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => ref(false) }) }
})

vi.mock('../../api/quotation.api', () => ({ quotationApi: { list: vi.fn(), remove: vi.fn(), delete: vi.fn() } }))
vi.mock('@/features/POS/customers/api/customer.api', () => ({ customerApi: { getPaginated: vi.fn() } }))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: () => true, currentTenantId: 'tenant-1' }),
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

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
vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({ default: { name: 'ConfirmModal', template: '<div />', props: ['open'] } }))
vi.mock('../../components/QuotationConvertDialog.vue', () => ({ default: { name: 'QuotationConvertDialog', template: '<div />' } }))

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(url = '/pos/cotizaciones') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/cotizaciones', name: 'pos-quotations', component: { template: '<div />' } },
      { path: '/pos/cotizaciones/:id', name: 'pos-quotation-detail', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  wrapper = mount(QuotationsListView, { global: { plugins: [router] } })
  await settle()
  return wrapper
}

/** Lets every debounced write (URL 100 ms, search 300 ms, filters 250 ms) and the navigations land. */
async function settle() {
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
}

const table = () => wrapper!.getComponent({ name: 'AppDataTable' })
const filters = () => wrapper!.getComponent({ name: 'DataTableFilters' })
const urlQuery = () => router.currentRoute.value.query

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  localStorage.clear()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('QuotationsListView — table state in the URL (owner-ideas-batch S6)', () => {
  it('a shared link with search, sort, page and filters opens the table exactly so', async () => {
    await mountAt('/pos/cotizaciones?q=ada&sort=totalCents:asc&page=3&minTotalCents=1000')

    expect(table().props('globalFilter')).toBe('ada')
    expect(table().props('sorting')).toEqual([{ id: 'totalCents', desc: false }])
    expect(table().props('pagination')).toMatchObject({ pageIndex: 2 })
    expect(urlQuery()).toMatchObject({ q: 'ada', sort: 'totalCents:asc', page: '3', minTotalCents: '1000' })
  })

  it('sorting, searching and paging write the URL and keep the filters', async () => {
    await mountAt('/pos/cotizaciones?minTotalCents=1000')

    table().vm.$emit('update:sorting', [{ id: 'expiresAt', desc: false }])
    await settle()
    table().vm.$emit('update:globalFilter', 'ada')
    await settle()
    table().vm.$emit('update:pagination', { ...table().props('pagination'), pageIndex: 1 })
    await settle()

    expect(urlQuery()).toMatchObject({ minTotalCents: '1000', sort: 'expiresAt:asc', q: 'ada', page: '2' })
  })

  it('a filter change keeps sort and search in the URL and goes back to page 1', async () => {
    await mountAt('/pos/cotizaciones?sort=totalCents:asc&q=ada&page=3')

    const state = filters().props('state') as Record<string, unknown>
    filters().vm.$emit('update:state', { ...state, totalCents: { min: 1000 } })
    await settle()

    expect(urlQuery()).toMatchObject({ sort: 'totalCents:asc', q: 'ada', minTotalCents: '1000' })
    expect(urlQuery().page).toBeUndefined()
    expect(table().props('pagination')).toMatchObject({ pageIndex: 0 })
  })

  it('the stored page size applies without pageSize in the URL; the URL wins when present', async () => {
    localStorage.setItem('table-page-size-pos-quotations-list', '25')
    await mountAt('/pos/cotizaciones?page=2')
    expect(table().props('pagination')).toEqual({ pageIndex: 1, pageSize: 25 })
    wrapper!.unmount()

    await mountAt('/pos/cotizaciones?pageSize=5')
    expect(table().props('pagination')).toMatchObject({ pageSize: 5 })
    expect(localStorage.getItem('table-page-size-pos-quotations-list')).toBe('25')
  })
})
