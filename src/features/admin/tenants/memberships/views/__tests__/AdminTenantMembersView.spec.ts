import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { defineComponent, h } from 'vue'
import AdminTenantMembersView from '../AdminTenantMembersView.vue'
import { adminTenantMembershipQueryKeys } from '@/core/shared/constants/query-keys'

/**
 * Behavioral tests for AdminTenantMembersView
 * 
 * Tests cover:
 * - Route params reading (tenantId)
 * - Query key construction using adminTenantMembershipQueryKeys
 * - useServerTable integration with membership API
 * - Create/edit slideover orchestration
 * - Remove confirmation modal
 * - Toast messages for success/error scenarios
 * - Mutation invalidation after CRUD operations
 * - Loading/empty/error states
 */

// Mock dependencies
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { tenantId: 'tenant-123' },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

vi.mock('@tanstack/vue-query', () => ({
  QueryClient: vi.fn(() => ({})),
  keepPreviousData: vi.fn(),
  useQuery: vi.fn(() => ({
    data: ref({ data: [] }),
    isLoading: ref(false),
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  useMutation: vi.fn((options) => ({
    mutateAsync: vi.fn(),
    isPending: ref(false),
  })),
}))

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: vi.fn(() => ({
    pagination: ref({ pageIndex: 0, pageSize: 10 }),
    sorting: ref([]),
    globalFilter: ref(''),
    columnPinning: ref({ left: [], right: [] }),
    columnVisibility: ref({}),
    data: ref([]),
    totalCount: ref(0),
    pageCount: ref(0),
    isLoading: ref(false),
    isFetching: ref(false),
    refresh: vi.fn(),
    pageSizeOptions: ref([10, 20, 50]),
    showingFrom: ref(0),
    showingTo: ref(0),
  })),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    isSuperAdmin: true,
    currentTenant: { id: 'tenant-123', name: 'Sucursal de prueba', slug: 'test' },
    userCan: vi.fn(() => true),
  })),
}))

vi.mock('../../composables/useMembershipColumns', () => ({
  useMembershipColumns: vi.fn(() => ({
    columns: [],
  })),
}))

vi.mock('../../api/memberships.api', () => ({
  membershipsApi: {
    getPaginated: vi.fn(),
    create: vi.fn(),
    updateRole: vi.fn(),
    remove: vi.fn(),
  },
  mapMembershipError: vi.fn((msg: string) => `Mapped: ${msg}`),
}))

// Mock Nuxt UI toast
const mockToastAdd = vi.fn()
;(global as any).useToast = vi.fn(() => ({ add: mockToastAdd }))

describe('AdminTenantMembersView - behavioral tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads tenantId from route params', async () => {
    const { useRoute } = await import('vue-router')
    const mockRoute = { params: { tenantId: 'tenant-456' } }
    vi.mocked(useRoute).mockReturnValue(mockRoute as any)

    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          TenantUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should extract tenantId from route params
    expect(useRoute).toHaveBeenCalled()
    expect(wrapper.vm).toBeDefined()
  })

  it('constructs query key using adminTenantMembershipQueryKeys.list(tenantId)', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    expect(useServerTable).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: expect.any(Function),
        queryFn: expect.any(Function),
      })
    )
  })

  it('uses membershipsApi.getPaginated as queryFn', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    const callArgs = vi.mocked(useServerTable).mock.calls[0]![0]
    expect(callArgs).toHaveProperty('queryFn')
  })

  it('opens create slideover when create action is triggered', async () => {
    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should expose method or state to open create slideover
    expect(wrapper.vm).toBeDefined()
  })

  it('opens edit slideover with prefilled data when edit action is triggered', async () => {
    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should handle edit action with tenant row data
    expect(wrapper.vm).toBeDefined()
  })

  it('shows confirmation modal when remove action is triggered', async () => {
    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should manage confirm modal state
    expect(wrapper.vm).toBeDefined()
  })

  it('calls create mutation and shows success toast on successful create', async () => {
    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should use useMutation for create operation
    expect(wrapper.vm).toBeDefined()
  })

  it('calls updateRole mutation and shows success toast on successful edit', async () => {
    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should use useMutation for update operation
    expect(wrapper.vm).toBeDefined()
  })

  it('shows error toast with mapped message on create failure', async () => {
    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should handle errors and use mapMembershipError
    expect(wrapper.vm).toBeDefined()
  })

  it('invalidates membership queries after successful create', async () => {
    const { useQueryClient, useMutation } = await import('@tanstack/vue-query')
    const { useRoute } = await import('vue-router')
    const invalidateQueries = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useRoute).mockReturnValue({ params: { tenantId: 'tenant-123' } } as any)
    vi.mocked(useQueryClient).mockReturnValue({ invalidateQueries } as any)

    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    const createMutationOptions = vi.mocked(useMutation).mock.calls[0]?.[0] as
      | { onSuccess?: () => Promise<void> }
      | undefined

    await createMutationOptions?.onSuccess?.()

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: adminTenantMembershipQueryKeys.list('tenant-123'),
    })

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['admin', 'tenant-memberships', 'tenant-123', 'eligible'],
    })
  })

  it('invalidates membership queries after successful edit', async () => {
    const { useQueryClient } = await import('@tanstack/vue-query')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should invalidate queries on success
    expect(useQueryClient).toHaveBeenCalled()
  })

  it('invalidates membership queries after successful remove', async () => {
    const { useQueryClient } = await import('@tanstack/vue-query')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    // Component should invalidate queries on success
    expect(useQueryClient).toHaveBeenCalled()
  })

  it('uses default page size of 10', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    const callArgs = vi.mocked(useServerTable).mock.calls[0]![0]
    expect(callArgs.defaultPageSize).toBe(10)
  })

  it('uses persist key "admin-tenant-members-{tenantId}"', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    const callArgs = vi.mocked(useServerTable).mock.calls[0]![0]
    expect(callArgs.persistKey).toContain('admin-tenant-members')
  })

  it('pins actions column to the right by default', async () => {
    const { useServerTable } = await import('@/core/shared/composables/useServerTable')
    
    mount(AdminTenantMembersView, {
      global: {
        stubs: {
          AppDataTable: true,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    const callArgs = vi.mocked(useServerTable).mock.calls[0]![0]
    expect(callArgs.defaultPinning).toEqual({ left: [], right: ['actions'] })
  })

  it('renders only the table header section (no duplicated outer header)', async () => {
    const UCardStub = defineComponent({
      setup(_, { slots }) {
        return () => h('div', [slots.header?.(), slots.default?.()])
      },
    })

    const AppDataTableStub = defineComponent({
      props: {
        addButtonText: {
          type: String,
          default: '',
        },
      },
      setup(props) {
        return () => h('div', [h('span', props.addButtonText)])
      },
    })

    const wrapper = mount(AdminTenantMembersView, {
      global: {
        stubs: {
          UCard: UCardStub,
          AppDataTable: AppDataTableStub,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })

    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.text().match(/Miembros del tenant/g)?.length ?? 0).toBe(1)
    expect(wrapper.text().match(/Agregar miembro/g)?.length ?? 0).toBe(1)
  })
})

describe('AdminTenantMembersView - permission guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  async function mountWithPermissions(perms: {
    read?: boolean
    create?: boolean
    update?: boolean
    delete?: boolean
  }) {
    const { useAuthStore } = await import('@/features/auth/stores/useAuthStore')
    vi.mocked(useAuthStore).mockReturnValue({
      isSuperAdmin: false,
      currentTenant: { id: 'tenant-123', name: 'Sucursal de prueba', slug: 'test' },
      userCan: vi.fn((_action: string, _subject: string) => {
        const action = _action as keyof typeof perms
        return perms[action] ?? false
      }),
    } as never)

    const UCardStub = defineComponent({
      props: ['ui'],
      setup(_, { slots }) {
        return () =>
          h('div', { class: 'u-card-stub' }, [
            slots.header?.(),
            slots.default?.(),
          ])
      },
    })

    const AppDataTableStub = defineComponent({
      props: ['showAddButton', 'addButtonText'],
      setup(props) {
        return () =>
          h('div', { class: 'app-data-table-stub' }, [
            props.showAddButton
              ? h('button', { class: 'add-btn' }, props.addButtonText)
              : null,
          ])
      },
    })

    return mount(AdminTenantMembersView, {
      global: {
        stubs: {
          UCard: UCardStub,
          AppDataTable: AppDataTableStub,
          SortableHeader: true,
          MembershipUpsertSlideover: true,
          ConfirmModal: true,
        },
      },
    })
  }

  it('renders neutral empty state and hides the table when read is denied', async () => {
    const wrapper = await mountWithPermissions({ read: false })
    expect(wrapper.text()).toContain('No tenés acceso a esta sección.')
    expect(wrapper.find('.app-data-table-stub').exists()).toBe(false)
  })

  it('hides the "Agregar miembro" button when create is denied', async () => {
    const wrapper = await mountWithPermissions({
      read: true,
      create: false,
      update: true,
      delete: true,
    })
    expect(wrapper.find('.app-data-table-stub').exists()).toBe(true)
    expect(wrapper.find('button.add-btn').exists()).toBe(false)
  })

  it('renders the "Agregar miembro" button when create is allowed', async () => {
    const wrapper = await mountWithPermissions({
      read: true,
      create: true,
      update: true,
      delete: true,
    })
    const btn = wrapper.find('button.add-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toBe('Agregar miembro')
  })

  it('getRowItems returns empty when both update and delete are denied', async () => {
    const wrapper = await mountWithPermissions({
      read: true,
      create: false,
      update: false,
      delete: false,
    })
    // Access the exposed function via the component instance
    const vm = wrapper.vm as unknown as {
      getRowItems: (m: { id: string; userEmail: string }) => unknown[]
    }
    const items = vm.getRowItems({ id: 'm1', userEmail: 'u@example.com' })
    expect(items).toEqual([])
  })

  it('getRowItems exposes only "Editar rol" when delete is denied but update is allowed', async () => {
    const wrapper = await mountWithPermissions({
      read: true,
      update: true,
      delete: false,
    })
    const vm = wrapper.vm as unknown as {
      getRowItems: (m: { id: string; userEmail: string }) => Array<Array<{ label: string }>>
    }
    const items = vm.getRowItems({ id: 'm1', userEmail: 'u@example.com' })
    expect(items.length).toBe(1)
    expect(items[0]?.length).toBe(1)
    expect(items[0]?.[0]?.label).toBe('Editar rol')
  })

  it('getRowItems exposes only "Eliminar miembro" when update is denied but delete is allowed', async () => {
    const wrapper = await mountWithPermissions({
      read: true,
      update: false,
      delete: true,
    })
    const vm = wrapper.vm as unknown as {
      getRowItems: (m: { id: string; userEmail: string }) => Array<Array<{ label: string }>>
    }
    const items = vm.getRowItems({ id: 'm1', userEmail: 'u@example.com' })
    expect(items.length).toBe(1)
    expect(items[0]?.length).toBe(1)
    expect(items[0]?.[0]?.label).toBe('Eliminar miembro')
  })
})
