import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import MembershipUpsertSlideover from '../MembershipUpsertSlideover.vue'
import { createMembershipSchema, updateMembershipSchema } from '../../interfaces/membership.types'

vi.mock('../../composables/useMembershipOptions', () => ({
  useMembershipOptions: () => ({
    userOptions: [],
    roleOptions: [],
    isLoadingOptions: false,
  }),
}))

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
  })
})
