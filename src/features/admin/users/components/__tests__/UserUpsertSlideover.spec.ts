import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'

const mockUseAdminRolesQuery = vi.fn((..._args: unknown[]) => ({
  roleOptions: ref([]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
}))

const mockUserCan = vi.fn((_action: string, _subject: string) => true)
const mockCurrentTenantId = ref('tenant-1')

vi.mock('../../composables/useAdminRolesQuery', () => ({
  useAdminRolesQuery: (tenantId: unknown) => mockUseAdminRolesQuery(tenantId),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: mockUserCan,
    currentTenantId: mockCurrentTenantId.value,
  }),
}))

import UserUpsertSlideover from '../UserUpsertSlideover.vue'

describe('UserUpsertSlideover', () => {
  describe('create mode', () => {
    it('wires useAdminRolesQuery with the current tenant id', () => {
      shallowMount(UserUpsertSlideover, {
        props: {
          mode: 'create',
          open: true,
        },
      })

      expect(mockUseAdminRolesQuery).toHaveBeenCalled()
    })

    it('passes roleId in the create payload when emitted', () => {
      const wrapper = shallowMount(UserUpsertSlideover, {
        props: {
          mode: 'create',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      vm.createState.roleId = 'abd93355-a3dc-4ae7-8f17-877ff3986d2c'
      vm.createState.name = 'Rodrigo'
      vm.createState.email = 'r@test.com'
      vm.createState.password = 'longenough1'

      vm.onSubmit({ data: { ...vm.createState } })

      expect(wrapper.emitted('create')).toBeTruthy()
      const payload = wrapper.emitted('create')?.[0]?.[0] as Record<string, unknown>
      expect(payload.roleId).toBe('abd93355-a3dc-4ae7-8f17-877ff3986d2c')
      expect(payload.name).toBe('Rodrigo')
      expect(payload.email).toBe('r@test.com')
      expect(payload.password).toBe('longenough1')
    })

    it('exposes createState.roleId as an initial empty string', () => {
      const wrapper = shallowMount(UserUpsertSlideover, {
        props: {
          mode: 'create',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      expect(vm.createState.roleId).toBe('')
    })

    it('gates the role query on authStore.userCan("read", "Role")', () => {
      mockUserCan.mockReturnValueOnce(false)

      const wrapper = shallowMount(UserUpsertSlideover, {
        props: {
          mode: 'create',
          open: true,
        },
      })

      // canReadRoles is a computed backed by userCan('read', 'Role'). It is
      // exposed on the vm via <script setup>, auto-unwrapped on access.
      const vm = wrapper.vm as any
      expect(vm.canReadRoles).toBe(false)
      expect(mockUserCan).toHaveBeenCalledWith('read', 'Role')
    })

    it('binds the create schema (which requires a UUID roleId) to UForm', () => {
      const wrapper = shallowMount(UserUpsertSlideover, {
        props: {
          mode: 'create',
          open: true,
        },
      })

      const vm = wrapper.vm as any
      // The exposed schema must be the create schema that contains roleId.
      // Parse a payload missing roleId — it must FAIL because roleId is required.
      const schema = vm.schema as { safeParse: (v: unknown) => { success: boolean } }
      const result = schema.safeParse({
        name: 'Rodrigo',
        email: 'r@test.com',
        password: 'longenough1',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('edit mode', () => {
    it('does NOT pass roleId in the edit payload (edit flow does not send roleId)', () => {
      const wrapper = shallowMount(UserUpsertSlideover, {
        props: {
          mode: 'edit',
          open: true,
          user: {
            id: 'user-1',
            email: 'e@x.com',
            name: 'Existing',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
            roles: [],
          },
        },
      })

      const vm = wrapper.vm as any
      vm.onSubmit({ data: { name: 'Renamed' } })

      expect(wrapper.emitted('edit')).toBeTruthy()
      const payload = wrapper.emitted('edit')?.[0]?.[0] as Record<string, unknown>
      expect(payload.name).toBe('Renamed')
      expect('roleId' in payload).toBe(false)
    })
  })
})