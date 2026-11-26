import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { Customer } from '../../interfaces/customer.types'

// The add/edit/delete handlers repeat the Customer permission checks the buttons already apply.
const api = vi.hoisted(() => ({ remove: vi.fn(), getById: vi.fn() }))
const grants = vi.hoisted(() => ({ value: new Set<string>() }))
const invalidate = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('../../api/customer.api', () => ({ customerApi: api }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-test', userCan: (action: string, subject: string) => grants.value.has(`${action}:${subject}`) }),
}))
// customers-module T6: the filters are URL-synced (useFiltersUrlAdapter reads the route).
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ path: '/pos/customers', query: {} }),
}))

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: ref({ pageIndex: 0 }),
    sorting: ref([]),
    response: ref(undefined),
    columnOrder: ref([]),
    columnSizing: ref({}),
    density: ref('comfortable'),
    resetLayout: vi.fn(),
    globalFilter: ref(''),
    rowSelection: ref({}),
    columnPinning: ref({}),
    columnVisibility: ref({}),
    data: ref([]),
    totalCount: ref(0),
    pageCount: ref(0),
    isLoading: ref(false),
    isFetching: ref(false),
    isError: ref(false),
    error: ref(null),
    refresh: vi.fn(),
    pageSizeOptions: [],
    showingFrom: ref(0),
    showingTo: ref(0),
  }),
}))
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidate, refetchQueries: async () => undefined }),
  useQuery: () => ({ data: ref([]) }),
  useMutation: (options: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (data: unknown, variables: unknown) => Promise<void>
    onError?: (error: unknown, variables: unknown) => void
  }) => {
    const isPending = ref(false)
    const mutateAsync = async (variables: unknown) => {
      isPending.value = true
      try {
        const data = await options.mutationFn(variables)
        await options.onSuccess?.(data, variables)
        return data
      } catch (error) {
        options.onError?.(error, variables)
        throw error
      } finally {
        isPending.value = false
      }
    }
    return { isPending, mutateAsync, mutate: (variables: unknown) => void mutateAsync(variables).catch(() => undefined) }
  },
}))

vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => ({ add: vi.fn() }) }))

const customer = { id: 'cust-1', fullName: 'Rosa Pérez' } as Customer

type ViewState = {
  handleAdd: () => void
  handleOpenEdit: (customer: Customer) => Promise<void>
  handleDelete: (customer: Customer) => Promise<void>
  isCreateOpen: boolean
  confirmState: { open: boolean }
}

function mountView(...codes: string[]) {
  grants.value = new Set(codes)
  return mount(CustomersView, { shallow: true }).vm as unknown as ViewState
}

describe('CustomersView — handlers repeat the Customer permission checks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getById.mockResolvedValue(customer)
  })

  it('handleAdd opens the create form only with create:Customer', () => {
    const denied = mountView('read:Customer')
    denied.handleAdd()
    expect(denied.isCreateOpen).toBe(false)

    const allowed = mountView('read:Customer', 'create:Customer')
    allowed.handleAdd()
    expect(allowed.isCreateOpen).toBe(true)
  })

  it('handleOpenEdit loads the customer only with update:Customer', async () => {
    await mountView('read:Customer').handleOpenEdit(customer)
    expect(api.getById).not.toHaveBeenCalled()

    await mountView('read:Customer', 'update:Customer').handleOpenEdit(customer)
    expect(api.getById).toHaveBeenCalledWith('cust-1')
  })

  it('handleDelete asks for confirmation only with delete:Customer', async () => {
    const denied = mountView('read:Customer')
    await denied.handleDelete(customer)
    expect(denied.confirmState.open).toBe(false)

    const allowed = mountView('read:Customer', 'delete:Customer')
    await allowed.handleDelete(customer)
    expect(allowed.confirmState.open).toBe(true)
  })
})
