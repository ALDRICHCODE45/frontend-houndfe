import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CustomersView from '../CustomersView.vue'
import type { Customer, CustomerDetail } from '../../interfaces/customer.types'

const mutationSettled = vi.hoisted(() => vi.fn())
const api = vi.hoisted(() => ({
  getById: vi.fn(),
  create: vi.fn(),
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  removeAddress: vi.fn(),
  update: vi.fn(),
}))
vi.mock('../../api/customer.api', () => ({ customerApi: api }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-test', userCan: () => false }),
}))
vi.mock('../composables/useCustomerViewMode', () => ({
  isCustomerViewMode: () => true,
  useCustomerViewMode: () => ({
    viewMode: ref('table'),
    setMode: vi.fn(),
    displayMode: ref('table'),
  }),
}))
vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: ref({ pageIndex: 0 }),
    sorting: ref([]),
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
  useQueryClient: () => ({
    invalidateQueries: async () => undefined,
    refetchQueries: async () => undefined,
  }),
  useQuery: () => ({ data: ref([]) }),
  useMutation: (options: {
    mutationFn: (variables: unknown) => Promise<unknown>
    onSuccess?: (data: unknown, variables: unknown, context: unknown) => Promise<void>
    onError?: (error: unknown, variables: unknown, context: unknown) => void
  }) => {
    const isPending = ref(false)
    const mutateAsync = async (variables: unknown) => {
      isPending.value = true
      try {
        const data = await options.mutationFn(variables)
        await options.onSuccess?.(data, variables, undefined)
        return data
      } catch (error) {
        options.onError?.(error, variables, undefined)
        throw error
      } finally {
        isPending.value = false
        mutationSettled()
      }
    }
    return {
      isPending,
      mutateAsync,
      mutate: (variables: unknown) => {
        void mutateAsync(variables).catch(() => undefined)
      },
    }
  },
}))

const toast = { add: vi.fn() }
Object.assign(globalThis, { useToast: () => toast })
const customer = (id: string): Customer => ({
  id,
  fullName: id,
  firstName: id,
  lastName: null,
  phoneCountryCode: null,
  phone: null,
  email: null,
  globalPriceListId: null,
  globalPriceListName: null,
  comments: null,
  createdAt: '',
  updatedAt: '',
})
const detail = (id: string): CustomerDetail => ({
  ...customer(id),
  addresses: [],
  businessName: null,
  fiscalZipCode: null,
  rfc: null,
  fiscalRegime: null,
  billingStreet: null,
  billingExteriorNumber: null,
  billingInteriorNumber: null,
  billingZipCode: null,
  billingNeighborhood: null,
  billingMunicipality: null,
  billingCity: null,
  billingState: null,
})
const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

type ViewActions = {
  selectedCustomer: CustomerDetail | null
  selectedCustomerId: string | null
  isEditOpen: boolean
  isSubmitting: boolean
  handleCreateAddress: (
    customerId: string,
    payload: { street: string },
    acknowledge: (saved: boolean) => void,
  ) => Promise<void>
  handleOpenEdit: (customer: Customer) => Promise<void>
  handleUpdateAddress: (
    customerId: string,
    addressId: string,
    payload: { street: string },
    acknowledge: (saved: boolean) => void,
  ) => Promise<void>
  handleEditSubmit: (payload: { firstName: string }) => void
  handleAdd: () => void
  handleSlideoverClose: () => void
  handleCreateSubmit: (payload: { firstName: string }) => void
}
function mountView() {
  return mount(CustomersView, { shallow: true })
}

describe('CustomersView address editor ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('acknowledges CREATE-address POST success despite GET failure without offering an unsaved retry', async () => {
    const refreshing = deferred<CustomerDetail>()
    api.getById.mockResolvedValueOnce(detail('A')).mockReturnValue(refreshing.promise)
    api.createAddress.mockResolvedValue({ id: 'created-address' })
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    const acknowledge = vi.fn()
    const saving = view.handleCreateAddress('A', { street: 'Synthetic street' }, acknowledge)
    expect(view.isSubmitting).toBe(true)
    await vi.waitFor(() => expect(api.getById).toHaveBeenCalledTimes(2))
    refreshing.reject(new Error('refresh failed'))
    await saving
    expect(view.isSubmitting).toBe(false)
    expect(api.createAddress).toHaveBeenCalledTimes(1)
    expect(acknowledge.mock.calls).toEqual([[true]])
    wrapper.unmount()
  })

  it('ignores an old A refresh after A to B to A starts a new editor session', async () => {
    const oldRefresh = deferred<CustomerDetail>()
    api.getById
      .mockResolvedValueOnce(detail('A'))
      .mockReturnValueOnce(oldRefresh.promise)
      .mockResolvedValueOnce(detail('B'))
      .mockResolvedValueOnce({ ...detail('A'), firstName: 'New session' })
    api.updateAddress.mockResolvedValue({ id: 'address-A' })
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    const saving = view.handleUpdateAddress('A', 'address-A', { street: 'Synthetic' }, vi.fn())
    await vi.waitFor(() => expect(api.getById).toHaveBeenCalledTimes(2))
    await view.handleOpenEdit(customer('B'))
    await view.handleOpenEdit(customer('A'))
    oldRefresh.resolve({ ...detail('A'), firstName: 'Old session' })
    await saving
    expect(view.selectedCustomer?.firstName).toBe('New session')
    expect(view.isEditOpen).toBe(true)
    wrapper.unmount()
  })

  it('does not let a late A detail open replace selected B', async () => {
    const a = deferred<CustomerDetail>()
    api.getById.mockImplementation((id: string) =>
      id === 'A' ? a.promise : Promise.resolve(detail('B')),
    )
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    const openingA = view.handleOpenEdit(customer('A'))
    await view.handleOpenEdit(customer('B'))
    a.resolve(detail('A'))
    await openingA
    expect(view.selectedCustomerId).toBe('B')
    expect(view.selectedCustomer?.id).toBe('B')
    wrapper.unmount()
  })

  it('fences the previous editor while a different customer detail is loading', async () => {
    const loadingB = deferred<CustomerDetail>()
    api.getById.mockImplementation((id: string) =>
      id === 'B' ? loadingB.promise : Promise.resolve(detail('A')),
    )
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    const openingB = view.handleOpenEdit(customer('B'))
    expect(view.isEditOpen).toBe(false)
    expect(view.selectedCustomerId).toBeNull()
    expect(view.selectedCustomer).toBeNull()
    view.handleSlideoverClose() // previous slideover's delayed close event
    loadingB.resolve(detail('B'))
    await openingB
    expect(view.selectedCustomerId).toBe('B')
    wrapper.unmount()
  })

  it('acknowledges the write when the detail refresh fails without retrying the POST', async () => {
    const refreshA = deferred<CustomerDetail>()
    api.getById.mockImplementation((id: string) =>
      id === 'A' ? Promise.resolve(detail('A')) : Promise.resolve(detail('B')),
    )
    api.updateAddress.mockResolvedValue({ id: 'addr-A' })
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    api.getById.mockImplementation((id: string) =>
      id === 'A' ? refreshA.promise : Promise.resolve(detail('B')),
    )
    const acknowledge = vi.fn()
    const saving = view.handleUpdateAddress(
      'A',
      'addr-A',
      { street: 'Synthetic street' },
      acknowledge,
    )
    await vi.waitFor(() => expect(api.getById).toHaveBeenCalledTimes(2))
    refreshA.reject(new Error('detail refresh unavailable'))
    await saving
    expect(api.updateAddress).toHaveBeenCalledTimes(1)
    expect(acknowledge).toHaveBeenCalledWith(true)
    expect(view.selectedCustomerId).toBe('A')
    expect(view.selectedCustomer?.id).toBe('A')
    wrapper.unmount()
  })

  it('reports a failed write as unsaved without refreshing the detail', async () => {
    api.getById.mockResolvedValue(detail('A'))
    api.updateAddress.mockRejectedValue(new Error('write unavailable'))
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    const acknowledge = vi.fn()
    await view.handleUpdateAddress('A', 'addr-A', { street: 'Synthetic street' }, acknowledge)
    expect(acknowledge).toHaveBeenCalledWith(false)
    expect(api.getById).toHaveBeenCalledTimes(1)
    expect(view.selectedCustomer?.id).toBe('A')
    wrapper.unmount()
  })

  it('does not close a newly selected B when an earlier customer update completes', async () => {
    const updatingA = deferred<CustomerDetail>()
    api.getById.mockImplementation((id: string) => Promise.resolve(detail(id)))
    api.update.mockReturnValue(updatingA.promise)
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    view.handleEditSubmit({ firstName: 'Synthetic' })
    expect(api.update).toHaveBeenCalledTimes(1)
    await view.handleOpenEdit(customer('B'))
    updatingA.resolve(detail('A'))
    await vi.waitFor(() => expect(mutationSettled).toHaveBeenCalledTimes(1))
    expect(view.isEditOpen).toBe(true)
    expect(view.selectedCustomerId).toBe('B')
    expect(view.selectedCustomer?.id).toBe('B')
    wrapper.unmount()
  })

  it('does not close edit B after a previous create request completes', async () => {
    const creating = deferred<Customer>()
    api.create.mockReturnValue(creating.promise)
    api.getById.mockResolvedValue(detail('B'))
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    view.handleAdd()
    view.handleCreateSubmit({ firstName: 'Synthetic' })
    await view.handleOpenEdit(customer('B'))
    creating.resolve(customer('A'))
    await vi.waitFor(() => expect(mutationSettled).toHaveBeenCalledTimes(1))
    expect(view.isEditOpen).toBe(true)
    expect(view.selectedCustomer?.id).toBe('B')
    wrapper.unmount()
  })

  it('does not replace B with a late A refresh after an acknowledged write', async () => {
    const refreshA = deferred<CustomerDetail>()
    api.getById
      .mockResolvedValueOnce(detail('A'))
      .mockImplementation((id: string) =>
        id === 'A' ? refreshA.promise : Promise.resolve(detail('B')),
      )
    api.updateAddress.mockResolvedValue({ id: 'addr-A' })
    const wrapper = mountView()
    const view = wrapper.vm as unknown as ViewActions
    await view.handleOpenEdit(customer('A'))
    const saving = view.handleUpdateAddress('A', 'addr-A', { street: 'Synthetic street' }, vi.fn())
    await vi.waitFor(() => expect(api.getById).toHaveBeenCalledTimes(2))
    await view.handleOpenEdit(customer('B'))
    refreshA.resolve(detail('A'))
    await saving
    expect(view.selectedCustomerId).toBe('B')
    expect(view.selectedCustomer?.id).toBe('B')
    wrapper.unmount()
  })
})
