import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import MembershipUpsertSlideover from '../MembershipUpsertSlideover.vue'
import { createMembershipSchema, updateMembershipSchema } from '../../interfaces/membership.types'

const mockUseEligibleUsersQuery = vi.fn((..._args: any[]) => ({
  users: ref<any[]>([]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
}))

const mockUseTenantRolesQuery = vi.fn((..._args: any[]) => ({
  roles: ref<any[]>([]),
  isLoading: ref(false),
  isError: ref(false),
}))

const mockToastAdd = vi.fn()
const mockUseToast = vi.fn(() => ({ add: mockToastAdd }))

vi.mock('../../composables/useEligibleUsersQuery', () => ({
  useEligibleUsersQuery: (tenantId: unknown, search: unknown) =>
    mockUseEligibleUsersQuery(tenantId, search),
}))

vi.mock('../../composables/useTenantRolesQuery', () => ({
  useTenantRolesQuery: (tenantId: unknown) => mockUseTenantRolesQuery(tenantId),
}))

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...actual,
    refDebounced: (source: unknown) => source,
  }
})

vi.mock('../../api/memberships.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/memberships.api')>()
  return {
    ...actual,
    mapEligibleUsersError: vi.fn((code: string) =>
      code === 'SEARCH_QUERY_TOO_SHORT'
        ? 'Escribí al menos 2 caracteres para buscar.'
        : 'Ocurrió un error inesperado',
    ),
  }
})

vi.stubGlobal('useToast', mockUseToast)

describe('MembershipUpsertSlideover', () => {
  describe('create mode', () => {
    it('should use createMembershipSchema for create mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      expect(vm.schema).toBe(createMembershipSchema)
    })

    it('should emit create event when onSubmit is called with create mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      const payload = { userId: 'user-123', roleId: 'role-456' }
      vm.onSubmit({ data: payload })

      expect(wrapper.emitted('create')).toBeTruthy()
      expect(wrapper.emitted('create')?.[0]).toEqual([payload])
    })

    it('should have createState available in create mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      expect(vm.createState).toBeDefined()
      expect(vm.createState.userId).toBeDefined()
      expect(vm.createState.roleId).toBeDefined()
    })

    it('shows helper state when search has exactly 1 character', async () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      vm.userSearchTerm = 'm'
      await wrapper.vm.$nextTick()

      expect(vm.isSingleCharSearch).toBe(true)
    })

    it('maps eligible users into dropdown options when search has 3 chars', () => {
      mockUseEligibleUsersQuery.mockReturnValueOnce({
        users: ref([{ id: 'u-1', name: 'Maria', email: 'maria@test.com', isActive: true }]),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      })

      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      vm.userSearchTerm = 'mar'

      expect(mockUseEligibleUsersQuery).toHaveBeenCalled()
      expect(vm.userOptions).toEqual([
        {
          value: 'u-1',
          label: 'Maria',
          email: 'maria@test.com',
          avatar: { alt: 'Maria' },
        },
      ])
    })

    it('fires warning toast on SEARCH_QUERY_TOO_SHORT backend error', async () => {
      mockUseEligibleUsersQuery.mockReturnValueOnce({
        users: ref([]),
        isLoading: ref(false),
        isError: ref(false),
        error: ref(null),
      })

      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      vm.notifyEligibleUsersSearchError({
        response: {
          status: 400,
          data: { code: 'SEARCH_QUERY_TOO_SHORT' },
        },
        message: 'SEARCH_QUERY_TOO_SHORT',
      })

      const { mapEligibleUsersError } = await import('../../api/memberships.api')
      expect(mapEligibleUsersError).toHaveBeenCalledWith('SEARCH_QUERY_TOO_SHORT')
    })
  })

  describe('edit mode', () => {
    it('should use updateMembershipSchema for edit mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'role-1',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'John Doe',
            userEmail: 'john@test.com',
            roleName: 'Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      expect(vm.schema).toBe(updateMembershipSchema)
    })

    it('should emit edit event when onSubmit is called with edit mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'role-1',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'John Doe',
            userEmail: 'john@test.com',
            roleName: 'Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      const payload = { roleId: 'role-789' }
      vm.onSubmit({ data: payload })

      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')?.[0]).toEqual([payload])
    })

    it('should have editState available in edit mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'role-1',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'John Doe',
            userEmail: 'john@test.com',
            roleName: 'Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      expect(vm.editState).toBeDefined()
      expect(vm.editState.roleId).toBeDefined()
    })
  })

  describe('computed properties', () => {
    it('should compute correct title for create mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      expect(vm.title).toBe('Agregar miembro')
    })

    it('should compute correct title for edit mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'role-1',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'John Doe',
            userEmail: 'john@test.com',
            roleName: 'Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      expect(vm.title).toBe('Editar rol del miembro')
    })

    it('should compute correct formId for create mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'create',
          tenantId: 'tenant-1',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      expect(vm.formId).toBe('create-membership-form')
    })

    it('should compute correct formId for edit mode', () => {
      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'role-1',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'John Doe',
            userEmail: 'john@test.com',
            roleName: 'Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      expect(vm.formId).toBe('edit-membership-form')
    })

    it('seeds roleOptions with the current membership role when tenant roles are not yet loaded', () => {
      // RED: simulate the slideover opening BEFORE useTenantRolesQuery resolves
      mockUseTenantRolesQuery.mockReturnValueOnce({
        roles: ref([]),
        isLoading: ref(true),
        isError: ref(false),
      })

      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'abd93355-a3dc-4ae7-8f17-877ff3986d2c',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'Super Admin',
            userEmail: 'admin@houndfe.com',
            roleName: 'Super Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      // The role from the current membership MUST be present in roleOptions
      // even when the tenant roles query has not resolved yet,
      // so USelectMenu can render its label instead of the raw UUID.
      const matchingOption = vm.roleOptions.find(
        (opt: { value: string; label: string }) =>
          opt.value === 'abd93355-a3dc-4ae7-8f17-877ff3986d2c',
      )
      expect(matchingOption).toBeDefined()
      expect(matchingOption.label).toBe('Super Admin')
    })

    it('does not duplicate the membership role when it is also present in tenant roles', () => {
      mockUseTenantRolesQuery.mockReturnValueOnce({
        roles: ref([
          { id: 'role-1', name: 'Admin' },
          { id: 'role-2', name: 'Cashier' },
        ]),
        isLoading: ref(false),
        isError: ref(false),
      })

      const wrapper = shallowMount(MembershipUpsertSlideover, {
        props: {
          mode: 'edit',
          tenantId: 'tenant-1',
          open: true,
          membership: {
            id: 'membership-1',
            userId: 'user-1',
            tenantId: 'tenant-1',
            roleId: 'role-1',
            createdAt: '2026-05-26T20:24:00.000Z',
            userName: 'John',
            userEmail: 'john@test.com',
            roleName: 'Admin',
          },
        },
      })

      const vm = wrapper.vm as any
      const adminMatches = vm.roleOptions.filter(
        (opt: { value: string }) => opt.value === 'role-1',
      )
      expect(adminMatches).toHaveLength(1)
      expect(vm.roleOptions).toHaveLength(2)
    })
  })
})
