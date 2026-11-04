/**
 * UserUpsertSlideover — the edit form's own states (S10): a skeleton shaped
 * like the form while the detail loads, the shared error state with Reintentar
 * when it could not be loaded, and the plain form once it is ready.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import UserUpsertSlideover from '../UserUpsertSlideover.vue'
import type { UserWithRolesResponse } from '../../../shared/interfaces/rbac.types'

const roleA = 'abd93355-a3dc-4ae7-8f17-877ff3986d2c'

vi.mock('../../composables/useAdminRolesQuery', () => ({
  useAdminRolesQuery: () => ({
    roleOptions: ref([{ value: roleA, label: 'Admin' }]),
    isLoading: ref(false),
    isError: ref(false),
    error: ref(null),
  }),
}))

const grants = new Set<string>()
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: (action: string, subject: string) => grants.has(`${action}:${subject}`),
    currentTenantId: 'tenant-1',
  }),
}))

const user = { id: 'user-1', name: 'Juan Pérez', email: 'juan@test.com', isActive: true, createdAt: '', roles: [] }
const detail: UserWithRolesResponse = {
  user: { id: 'user-1', name: 'Juan Pérez', email: 'juan@test.com', isActive: true },
  roles: [{ id: roleA, name: 'Admin' }],
} as UserWithRolesResponse

const slideoverStub = {
  props: ['title', 'description'],
  template:
    '<section :data-title="title" :data-description="description"><slot name="body" /><slot name="footer" /></section>',
}
const formStub = { props: ['id'], template: '<form :id="id"><slot /></form>' }
const fieldStub = { props: ['label'], template: '<label><span>{{ label }}</span><slot /></label>' }
const passthrough = { template: '<div />' }

function mountEditor(props: Record<string, unknown> = {}) {
  return mount(UserUpsertSlideover, {
    props: { mode: 'edit', open: true, user, ...props },
    global: {
      stubs: {
        USlideover: slideoverStub,
        Slideover: slideoverStub,
        UForm: formStub,
        Form: formStub,
        UFormField: fieldStub,
        FormField: fieldStub,
        UInput: passthrough,
        Input: passthrough,
        USelectMenu: passthrough,
        SelectMenu: passthrough,
      },
    },
  })
}

beforeEach(() => {
  grants.clear()
  grants.add('update:User')
})

describe('UserUpsertSlideover states', () => {
  it('shows a skeleton shaped like the form while the detail loads, and hides the form', () => {
    const wrapper = mountEditor({ detailLoading: true })
    const skeleton = wrapper.get('[data-testid="user-detail-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.text()).toContain('Cargando usuario…')
    expect(skeleton.findAll('[data-slot="base"], .animate-pulse').length).toBe(3)
    expect(wrapper.get('form').attributes('style')).toContain('display: none')
  })

  it('shows the shared error state with Reintentar when the detail failed to load', async () => {
    const wrapper = mountEditor({ errorMessage: 'Forbidden detail' })
    const error = wrapper.get('[data-testid="user-detail-error"]')
    expect(error.attributes('data-kind')).toBe('error')
    expect(error.get('.hf-empty-state__description').text()).toBe('Forbidden detail')
    await error.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('keeps a save error inline, next to the form, once the detail is loaded', () => {
    const wrapper = mountEditor({ detail, errorMessage: 'Email already exists' })
    expect(wrapper.find('[data-testid="user-detail-error"]').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Email already exists')
    expect(wrapper.get('[role="alert"]').classes()).toContain('text-error')
    expect(wrapper.find('form').attributes('style') ?? '').not.toContain('display: none')
  })

  it('has no skeleton or error state in create mode', () => {
    const wrapper = mountEditor({ mode: 'create', user: null })
    expect(wrapper.find('[data-testid="user-detail-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-detail-error"]').exists()).toBe(false)
  })

  it('names the current roles only when the roles field is not offered', () => {
    const readOnly = mountEditor({ detail })
    expect(readOnly.text()).toContain('Roles actuales: Admin')

    grants.add('read:Role')
    grants.add('update:TenantMembership')
    const editable = mountEditor({ detail })
    expect(editable.text()).not.toContain('Roles actuales')
  })

  it('renders no help paragraph under the title', () => {
    const wrapper = mountEditor({ detail })
    expect(wrapper.get('section').attributes('data-description')).toBeUndefined()
  })
})
