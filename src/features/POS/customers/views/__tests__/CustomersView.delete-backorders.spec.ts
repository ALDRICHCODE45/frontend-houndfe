import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { Customer } from '../../interfaces/customer.types'

// ODD restock-backorder S10 / backend L11: deleting a customer with a WAITING or RESERVED backorder.
const api = vi.hoisted(() => ({ remove: vi.fn() }))
const invalidate = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('../../api/customer.api', () => ({ customerApi: api }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-test', userCan: () => true }),
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

// The view's `useToast` is auto-imported from Nuxt UI, so the runtime composable is what to mock.
const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => toast }))

const customer: Customer = {
  id: 'cust-1',
  fullName: 'Rosa Pérez',
  firstName: 'Rosa',
  lastName: 'Pérez',
  phoneCountryCode: null,
  phone: null,
  email: null,
  globalPriceListId: null,
  globalPriceListName: null,
  comments: null,
  createdAt: '',
  updatedAt: '',
}

const httpError = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })

type ViewActions = { handleDelete: (customer: Customer) => Promise<void>; handleConfirm: () => void }

async function confirmDelete() {
  const wrapper = mount(CustomersView, { shallow: true })
  const view = wrapper.vm as unknown as ViewActions
  await view.handleDelete(customer)
  view.handleConfirm()
  await vi.waitFor(() => expect(api.remove).toHaveBeenCalledWith('cust-1'))
  await new Promise((done) => setTimeout(done, 0))
  return wrapper
}

describe('CustomersView — delete a customer with active backorders (S10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('409 CUSTOMER_HAS_ACTIVE_BACKORDERS shows the clear message, not the generic error, and keeps the list', async () => {
    api.remove.mockRejectedValue(
      httpError(409, {
        statusCode: 409,
        error: 'CUSTOMER_HAS_ACTIVE_BACKORDERS',
        message: 'Customer has active backorders',
        timestamp: '2026-11-20T18:00:00.000Z',
      }),
    )
    const wrapper = await confirmDelete()

    expect(toast.add).toHaveBeenCalledTimes(1)
    const notice = toast.add.mock.calls[0]![0]
    expect(notice.description).toBe(
      'No se puede eliminar: este cliente tiene un pedido por reposición en espera o apartado. Cancélalo primero en Pedidos por reposición.',
    )
    expect(notice.title).not.toBe('Error al eliminar cliente')
    expect(notice.color).toBe('warning')
    // The customer stays: no success toast, no list refresh.
    expect(JSON.stringify(toast.add.mock.calls)).not.toContain('Cliente eliminado')
    expect(invalidate).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('any other error keeps the generic «Error al eliminar cliente» toast with the server message', async () => {
    api.remove.mockRejectedValue(httpError(500, { statusCode: 500, message: 'Boom' }))
    const wrapper = await confirmDelete()

    expect(toast.add).toHaveBeenCalledWith({ title: 'Error al eliminar cliente', description: 'Boom', color: 'error' })
    wrapper.unmount()
  })

  it('a 409 with another code is not mistaken for the backorder guard', async () => {
    api.remove.mockRejectedValue(httpError(409, { statusCode: 409, error: 'Conflict', message: 'Otro conflicto' }))
    const wrapper = await confirmDelete()

    expect(toast.add).toHaveBeenCalledWith({
      title: 'Error al eliminar cliente',
      description: 'Otro conflicto',
      color: 'error',
    })
    wrapper.unmount()
  })

  it('a successful delete is unchanged', async () => {
    api.remove.mockResolvedValue(undefined)
    const wrapper = await confirmDelete()

    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cliente eliminado', color: 'success' }))
    expect(invalidate).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
