import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import type {
  CreateUserFormValues,
  EditUserFormValues,
  useUserForm,
} from '../../composables/useUserForm'

type FormVm = {
  createState: CreateUserFormValues
  editState: EditUserFormValues
  activeState: CreateUserFormValues | EditUserFormValues
  schema: ReturnType<typeof useUserForm>['schema']
  selectedRoleIds: string[]
  canReadRoles: boolean
  canEditRoles: boolean
  onSubmit: (event: { data: CreateUserFormValues | EditUserFormValues }) => void
  updateRoles: (ids: string[]) => void
  handleClose: () => void
}

const roleA = 'abd93355-a3dc-4ae7-8f17-877ff3986d2c'
const roleB = 'bdbaea96-4b0b-4c6e-ae92-b1306f7e369d'
const catalog = {
  roleOptions: ref([
    { value: roleA, label: 'Admin' },
    { value: roleB, label: 'Operator' },
  ]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref(null),
}
const mockUseAdminRolesQuery = vi.fn((..._args: unknown[]) => catalog)

const mockUserCan = vi.fn((_action: string, _subject: string) => true)
const mockCurrentTenantId = ref('tenant-1')

vi.mock('../../composables/useAdminRolesQuery', () => ({
  useAdminRolesQuery: (tenantId: unknown) => mockUseAdminRolesQuery(tenantId),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: mockUserCan,
    get currentTenantId() {
      return mockCurrentTenantId.value
    },
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

      const vm = wrapper.vm as unknown as FormVm
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

      const vm = wrapper.vm as unknown as FormVm
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
      const vm = wrapper.vm as unknown as FormVm
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

      const vm = wrapper.vm as unknown as FormVm
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
})

const user = {
  id: 'user-1',
  email: 'old@test.com',
  name: 'List name',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  roles: [{ id: 'foreign-role', name: 'Foreign' }],
}
const detail = { user: { ...user, name: 'Detail name' }, roles: [{ id: roleA, name: 'Admin' }] }
const wrappers: ReturnType<typeof shallowMount>[] = []
function mountEditor(loaded = true) {
  const wrapper = shallowMount(UserUpsertSlideover, {
    props: { mode: 'edit', open: true, user, detail: loaded ? detail : null, session: 1 },
  })
  wrappers.push(wrapper)
  return wrapper
}
beforeEach(() => {
  mockUserCan.mockReset().mockReturnValue(true)
  mockCurrentTenantId.value = 'tenant-1'
  catalog.roleOptions.value = [
    { value: roleA, label: 'Admin' },
    { value: roleB, label: 'Operator' },
  ]
  catalog.isError.value = false
  catalog.isLoading.value = false
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('detail-backed edit form', () => {
  it('hydrates name/email/current-tenant roles from detail, never list roles', () => {
    const vm = mountEditor().vm as unknown as FormVm
    expect(vm.editState.name).toBe('Detail name')
    expect(vm.editState.email).toBe('old@test.com')
    expect(vm.selectedRoleIds).toEqual([roleA])
  })

  it('blocks submit while detail is missing, including a mismatched user response', async () => {
    const wrapper = mountEditor(false)
    const vm = wrapper.vm as unknown as FormVm
    vm.onSubmit({ data: { name: 'Edited' } })
    expect(wrapper.emitted('edit')).toBeUndefined()
    await wrapper.setProps({ detail: { ...detail, user: { ...user, id: 'other' } } })
    vm.onSubmit({ data: { name: 'Edited' } })
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('emits changed email and an intentional multi-role replacement, never singular roleId', () => {
    const wrapper = mountEditor()
    const vm = wrapper.vm as unknown as FormVm
    vm.editState.name = 'Edited'
    vm.editState.email = 'new@test.com'
    vm.updateRoles([roleA, roleB])
    vm.onSubmit({ data: vm.activeState })
    expect(wrapper.emitted('edit')?.[0]).toEqual([
      { name: 'Edited', email: 'new@test.com', roleIds: [roleA, roleB] },
      1,
    ])
  })

  it('omits roles and email when unchanged, including reordered/reverted selection', async () => {
    const wrapper = mountEditor(false)
    await wrapper.setProps({
      detail: {
        ...detail,
        roles: [
          { id: roleA, name: 'Admin' },
          { id: roleB, name: 'Operator' },
        ],
      },
    })
    const vm = wrapper.vm as unknown as FormVm
    vm.updateRoles([roleB, roleA])
    vm.onSubmit({ data: vm.activeState })
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual({ name: 'Detail name' })
  })

  it('preserves dirty input and original role baseline across same-user detail refetch', async () => {
    const wrapper = mountEditor()
    const vm = wrapper.vm as unknown as FormVm
    vm.editState.name = 'Dirty'
    vm.editState.email = 'dirty@test.com'
    vm.updateRoles([roleA, roleB])
    await wrapper.setProps({
      detail: { user: { ...user, name: 'Refetched' }, roles: [{ id: roleB, name: 'Operator' }] },
    })
    expect(vm.editState.name).toBe('Dirty')
    expect(vm.editState.email).toBe('dirty@test.com')
    vm.onSubmit({ data: vm.activeState })
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual({
      name: 'Dirty',
      email: 'dirty@test.com',
      roleIds: [roleA, roleB],
    })
  })

  it.each(['permission', 'read', 'error', 'loading', 'missing-role', 'empty'])(
    'allows profile editing without truncating roles when catalog is unavailable: %s',
    (reason) => {
      if (reason === 'permission')
        mockUserCan.mockImplementation((_action, subject) => subject !== 'TenantMembership')
      if (reason === 'read')
        mockUserCan.mockImplementation((_action, subject) => subject !== 'Role')
      if (reason === 'error') catalog.isError.value = true
      if (reason === 'loading') catalog.isLoading.value = true
      if (reason === 'missing-role')
        catalog.roleOptions.value = [{ value: roleB, label: 'Operator' }]
      if (reason === 'empty') catalog.roleOptions.value = []
      const wrapper = mountEditor()
      const vm = wrapper.vm as unknown as FormVm
      expect(vm.canEditRoles).toBe(false)
      vm.onSubmit({ data: vm.activeState })
      expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual({ name: 'Detail name' })
      expect(vm.selectedRoleIds).toEqual([roleA])
    },
  )

  it('does not let a later catalog failure block profile submission with a dirty empty role selection', async () => {
    const wrapper = mountEditor()
    const vm = wrapper.vm as unknown as FormVm
    vm.updateRoles([])
    expect(vm.schema.safeParse(vm.activeState).success).toBe(false)
    catalog.isError.value = true
    await wrapper.vm.$nextTick()
    expect(vm.schema.safeParse(vm.activeState).success).toBe(true)
    vm.onSubmit({ data: vm.activeState })
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual({ name: 'Detail name' })
  })

  it('blocks profile submission without update:User', () => {
    mockUserCan.mockImplementation((_action, subject) => subject !== 'User')
    const wrapper = mountEditor()
    const vm = wrapper.vm as unknown as FormVm
    vm.onSubmit({ data: { name: 'Edited' } })
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('resets on cancel and waits for fresh detail on reopen', async () => {
    const wrapper = mountEditor()
    const vm = wrapper.vm as unknown as FormVm
    vm.editState.email = 'dirty@test.com'
    vm.handleClose()
    await wrapper.setProps({ open: false, detail: null })
    await wrapper.setProps({ open: true, session: 2 })
    vm.onSubmit({ data: { name: 'Edited' } })
    expect(wrapper.emitted('edit')).toBeUndefined()
    await wrapper.setProps({ detail })
    expect(vm.editState.email).toBe('old@test.com')
  })
})

describe('edit controls and retained input', () => {
  it('renders editable email and a multiple-role control with the authoritative selection', () => {
    const wrapper = shallowMount(UserUpsertSlideover, {
      props: { mode: 'edit', open: true, user, detail, session: 1 },
      global: {
        renderStubDefaultSlot: true,
        stubs: { Slideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' } },
      },
    })
    wrappers.push(wrapper)
    const email = wrapper
      .findAllComponents({ name: 'Input' })
      .find((input) => input.props('type') === 'email')
    expect(email?.props('modelValue')).toBe('old@test.com')
    const roles = wrapper.findComponent({ name: 'SelectMenu' })
    expect(roles.props('multiple')).toBe(true)
    expect(roles.props('modelValue')).toEqual([roleA])
    expect(roles.props('disabled')).toBe(false)
  })

  it('retains dirty fields when the server reports a validation/conflict error', async () => {
    const wrapper = mountEditor()
    const vm = wrapper.vm as unknown as FormVm
    vm.editState.email = 'dirty@test.com'
    vm.updateRoles([roleB])
    await wrapper.setProps({ errorMessage: 'Email already exists', loading: false })
    expect(vm.editState.email).toBe('dirty@test.com')
    expect(vm.selectedRoleIds).toEqual([roleB])
  })

  it('allows profile editing for an existing empty role set without sending an empty replacement', async () => {
    const wrapper = mountEditor(false)
    await wrapper.setProps({ detail: { ...detail, roles: [] } })
    const vm = wrapper.vm as unknown as FormVm
    vm.onSubmit({ data: vm.activeState })
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual({ name: 'Detail name' })
  })
})
