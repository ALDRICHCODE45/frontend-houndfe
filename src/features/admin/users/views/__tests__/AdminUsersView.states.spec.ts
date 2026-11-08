/**
 * AdminUsersView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the
 * overlays and the toolbar/pagination chrome are replaced: empty, loading, data
 * and error (plus no-match) are asserted through what the shared table renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminUsersView from '../AdminUsersView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  serverTableConfig,
  tableState,
} from '@/features/admin/__tests__/helpers/serverTableMock'
import { expectLayoutBound } from '@/features/admin/__tests__/helpers/layoutBinding'
import type { UserTableRow } from '../../interfaces/user.types'

vi.mock('@/core/shared/composables/useServerTable', async () =>
  (await import('@/features/admin/__tests__/helpers/serverTableMock')).serverTableModule,
)
vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('@/features/admin/__tests__/helpers/serverTableMock')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const grants = new Set<string>()
const authMock = {
  userCan: vi.fn((action: string, subject: string) => grants.has(`${action}:${subject}`)),
  currentTenantId: 'tenant-1',
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}))

vi.mock('../../api/users.api', () => ({
  usersApi: { getPaginated: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeUser(overrides: Partial<UserTableRow> = {}): UserTableRow {
  return {
    id: 'user-1',
    email: 'juan@test.com',
    name: 'Juan Pérez',
    isActive: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    roles: [{ id: 'r1', name: 'Admin' }],
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(AdminUsersView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        UserUpsertSlideover: true,
        SellerSalesReportDrawer: true,
        ConfirmModal: true,
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

/** Grants as `action:Subject`; the report needs read on User, Sale and Analytics. */
const allow = (...permissions: string[]) => {
  grants.clear()
  permissions.forEach((permission) => grants.add(permission))
}
const ALL = [
  'create:User',
  'update:User',
  'delete:User',
  'read:User',
  'read:Sale',
  'read:Analytics',
]

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

beforeEach(() => {
  resetTableState()
  allow(...ALL)
})

describe('AdminUsersView states — empty', () => {
  it('shows "Aún no hay usuarios" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay usuarios')
    expect(empty.get('button').text()).toContain('Crear usuario')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'UserUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the create action without permission', () => {
    allow('read:User')
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay usuarios')
    expect(wrapper.get('.hf-empty-state').find('button').exists()).toBe(false)
  })

  it('shows no-match with Limpiar filtros when a search matched nothing', async () => {
    tableState.globalFilter.value = 'zzz'
    const wrapper = mountView()
    const noMatch = wrapper.get('.hf-empty-state')
    expect(noMatch.attributes('data-kind')).toBe('no-match')
    expect(noMatch.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «zzz»')
    await noMatch.get('button').trigger('click')
    expect(tableState.globalFilter.value).toBe('')
  })
})

describe('AdminUsersView states — loading', () => {
  it('renders the table skeleton and no empty state on desktop', () => {
    tableState.isLoading.value = true
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('renders the card skeletons on mobile', () => {
    isBelowBreakpoint.value = true
    tableState.isLoading.value = true
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })
})

describe('AdminUsersView states — data', () => {
  it('renders rows with the person first, status, roles and the ⋮ menu, with no state chrome', () => {
    tableState.data.value = [
      makeUser(),
      makeUser({ id: 'user-2', name: 'Ana Gómez', email: 'ana@test.com', isActive: false, roles: [] }),
    ]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('Juan Pérez')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('juan@test.com')
    const badges = rows.map((row) => row.get('.hf-status-badge'))
    expect(badges.map((badge) => badge.text())).toEqual(['Activo', 'Inactivo'])
    expect(badges.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'neutral'])
    expect(rows[0]!.text()).toContain('Admin')
    expect(rows[1]!.text()).toContain('Sin roles')
    expect(wrapper.findAll('[aria-label="Acciones de Juan Pérez"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('user-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('joins several roles into one quiet line instead of a badge per role', () => {
    tableState.data.value = [makeUser({ roles: [{ id: 'r1', name: 'Admin' }, { id: 'r2', name: 'Cajero' }] })]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').text()).toContain('Admin, Cajero')
  })

  it('uses the neutral person avatar without an activity dot', () => {
    tableState.data.value = [makeUser()]
    const wrapper = mountView()
    expect(wrapper.find('tbody tr [data-slot="avatar"], tbody tr .bg-emerald-500').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the badge and the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeUser()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="user-card"]')
    expect(card.find('[aria-label="Acciones de Juan Pérez"]').exists()).toBe(true)
    expect(card.get('.hf-status-badge').text()).toBe('Activo')
    expect(card.text()).toContain('Admin')
  })

  it('opens the edit slideover on a row click and not from the ⋮ menu', async () => {
    tableState.data.value = [makeUser()]
    const wrapper = mountView()
    const edit = () =>
      wrapper
        .findAllComponents({ name: 'UserUpsertSlideover' })
        .find((slideover) => slideover.props('mode') === 'edit')!
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('[aria-label="Acciones de Juan Pérez"]').trigger('click')
    expect(edit().props('open')).toBe(false)
    await wrapper.get('tbody tr').trigger('click')
    expect(edit().props('open')).toBe(true)
    expect(edit().props('user')).toMatchObject({ id: 'user-1' })
  })

  it('makes rows non-clickable without update permission', () => {
    allow('read:User', 'delete:User')
    tableState.data.value = [makeUser()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
  })
})

describe('AdminUsersView states — row menu', () => {
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get('[aria-label="Acciones de Juan Pérez"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())
  }

  it('lists Editar, Ver reporte de ventas and Eliminar… last', async () => {
    tableState.data.value = [makeUser()]
    expect(await openMenu(mountView())).toEqual(['Editar', 'Ver reporte de ventas', 'Eliminar…'])
  })

  it('shows no ⋮ when update is the only permission (it would only repeat the row click)', () => {
    allow('update:User')
    tableState.data.value = [makeUser()]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Acciones de Juan Pérez"]').exists()).toBe(false)
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })

  it('lists the report alone for a reader who cannot update or delete', async () => {
    allow('read:User', 'read:Sale', 'read:Analytics')
    tableState.data.value = [makeUser()]
    expect(await openMenu(mountView())).toEqual(['Ver reporte de ventas'])
  })

  it('shows no ⋮ when every permission is missing', () => {
    allow()
    tableState.data.value = [makeUser()]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Acciones de Juan Pérez"]').exists()).toBe(false)
  })
})

describe('AdminUsersView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: 'No se pudo conectar al servidor' } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar los usuarios')
    expect(error.text()).not.toContain('No se pudo conectar al servidor')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the human title when nothing else is available', () => {
    tableState.isError.value = true
    tableState.error.value = {}
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los usuarios',
    )
  })
})

describe('AdminUsersView states — page header', () => {
  it('shows the title outside the table surface and no subtitle', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Usuarios')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })
})

describe('AdminUsersView — premium table layout', () => {
  it('persists the layout under a stable key and binds it to the table', async () => {
    const wrapper = mountView()
    const config = serverTableConfig.mock.lastCall![0] as { persistKey: string }
    expect(config.persistKey).toBe('admin-users')
    await expectLayoutBound(wrapper, { ...tableState, reset: tableState.resetLayout })
  })
})
