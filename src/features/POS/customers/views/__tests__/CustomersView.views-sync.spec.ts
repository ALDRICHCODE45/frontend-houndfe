/**
 * customers-module T8 (L14): a built-in saved view must stay applied and clean after it is clicked.
 *
 * Mounts the real wiring — a real router (memory history, real query updates), the real
 * `useServerTable`, the filters URL adapter, `useTableViews` and the views bar — so the URL writers
 * race exactly as in the browser. Only the request layer and the heavy table are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import CustomersView from '../CustomersView.vue'
import { startOfLocalMonthIso } from '../../composables/useCustomersViews'

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

vi.mock('../../api/customer.api', () => ({
  customerApi: { listCustomersListing: vi.fn(), listCustomerListingOptions: vi.fn(), getById: vi.fn() },
}))
vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

const authMock = { userCan: vi.fn((_a: string, _s: string) => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

vi.mock('../../components/CustomerPetsSlideover.vue', () => ({ default: { name: 'CustomerPetsSlideover', template: '<div />', props: ['open', 'customer'] } }))
vi.mock('../../components/CustomerUpsertSlideover.vue', () => ({
  default: { name: 'CustomerUpsertSlideover', template: '<div />', props: ['open', 'mode', 'loading', 'errors', 'customer', 'globalPriceLists', 'showPets'] },
}))
vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({ default: { name: 'ConfirmModal', template: '<div />', props: ['open'] } }))
vi.mock('@/core/shared/components/DataTable/AppDataTable.vue', () => ({
  default: {
    name: 'AppDataTable',
    props: ['sorting', 'columnVisibility'],
    template: '<div data-testid="app-data-table"><slot name="filters" /></div>',
  },
}))
vi.mock('@/core/shared/data-table-filters/components/DataTableFilters.vue', () => ({
  default: { name: 'DataTableFilters', props: ['state', 'schema', 'errors', 'embedded', 'portalClass'], template: '<div />' },
}))

const NOW = new Date(2026, 10, 26, 10, 0, 0)

let router: Router
let wrapper: VueWrapper | undefined

async function mountView() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pos/customers', name: 'pos-customers', component: { template: '<div />' } },
      { path: '/pos/customers/:id', name: 'pos-customer-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/pos/customers')
  await router.isReady()
  wrapper = mount(CustomersView, { global: { plugins: [router] } })
  await settle()
  return wrapper
}

/** Lets every debounced URL write (sort 100 ms, filters 250 ms) and the navigations land. */
async function settle() {
  await vi.advanceTimersByTimeAsync(1000)
  await flushPromises()
}

const tab = (id: string) => wrapper!.get(`[data-testid="table-views-tab-${id}"]`)
const isTabDirty = (id: string) => tab(id).find('.hf-views__dot').exists()
const unsavedShown = () => wrapper!.find('[data-testid="table-views-unsaved"]').exists()
const chips = () => wrapper!.findAll('[data-testid="customers-filter-chip"]')
const tableSorting = () => wrapper!.getComponent({ name: 'AppDataTable' }).props('sorting')
const urlQuery = () => router.currentRoute.value.query

async function select(id: string) {
  await tab(id).trigger('click')
  await settle()
}

const BUILT_INS: Array<{ id: string; filters: Record<string, string>; sorting: Array<{ id: string; desc: boolean }> }> = [
  { id: 'con-deuda-vencida', filters: { hasOverdue: 'true' }, sorting: [{ id: 'oldestOverdue', desc: false }] },
  { id: 'inactivos-90', filters: { noPurchaseMoreThanDays: '90' }, sorting: [{ id: 'name', desc: false }] },
  { id: 'mejores-clientes', filters: {}, sorting: [{ id: 'totalSold', desc: true }] },
  { id: 'nuevos-mes', filters: { createdFrom: startOfLocalMonthIso(NOW) }, sorting: [{ id: 'createdAt', desc: true }] },
]

function expectApplied(view: (typeof BUILT_INS)[number]) {
  expect(tab(view.id).attributes('aria-selected')).toBe('true')
  expect(tableSorting()).toEqual(view.sorting)
  expect(chips()).toHaveLength(Object.keys(view.filters).length)
  // The URL carries the view's filters, and no other filter param.
  const filterParams = new Set(BUILT_INS.flatMap((entry) => Object.keys(entry.filters)))
  const urlFilters = Object.fromEntries(Object.entries(urlQuery()).filter(([param]) => filterParams.has(param)))
  expect(urlFilters).toEqual(view.filters)
  expect(isTabDirty(view.id)).toBe(false)
  expect(unsavedShown()).toBe(false)
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false })
  vi.setSystemTime(NOW)
  localStorage.clear()
  authMock.userCan.mockImplementation(() => true)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('CustomersView — built-in saved views stay applied and clean (L14)', () => {
  it.each(BUILT_INS)('«$id» keeps its filters and sort, in the URL too, with no unsaved changes', async (view) => {
    await mountView()
    expect(unsavedShown()).toBe(false)

    await select(view.id)

    expectApplied(view)
  })

  it('switching between views back and forth stays clean', async () => {
    await mountView()

    for (const id of ['con-deuda-vencida', 'nuevos-mes', 'inactivos-90', 'con-deuda-vencida', 'mejores-clientes', 'nuevos-mes']) {
      await select(id)
      expectApplied(BUILT_INS.find((view) => view.id === id)!)
    }

    await select('todos')
    expect(chips()).toHaveLength(0)
    expect(tableSorting()).toEqual([{ id: 'name', desc: false }])
    expect(isTabDirty('todos')).toBe(false)
    expect(unsavedShown()).toBe(false)
    for (const view of BUILT_INS) expect(isTabDirty(view.id)).toBe(false)
  })

  it('a filter changed by the user marks the view dirty, and «Restablecer» brings the view back', async () => {
    await mountView()
    await select('con-deuda-vencida')

    await chips()[0]!.trigger('click')
    await settle()

    expect(chips()).toHaveLength(0)
    expect(urlQuery().hasOverdue).toBeUndefined()
    expect(isTabDirty('con-deuda-vencida')).toBe(true)
    expect(unsavedShown()).toBe(true)

    await wrapper!.get('[data-testid="table-views-reset"]').trigger('click')
    await settle()

    expectApplied(BUILT_INS[0]!)
  })
})
