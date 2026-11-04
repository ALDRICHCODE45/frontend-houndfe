/**
 * AdminRolesView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the
 * overlays and the toolbar/pagination chrome are replaced: empty, loading, data
 * and error (plus no-match) are asserted through what the shared table renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminRolesView from '../AdminRolesView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  tableState,
} from '@/features/admin/__tests__/helpers/serverTableMock'
import type { RoleTableRow } from '../../interfaces/role.types'

vi.mock('@/core/shared/composables/useServerTable', async () =>
  (await import('@/features/admin/__tests__/helpers/serverTableMock')).serverTableModule,
)
vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('@/features/admin/__tests__/helpers/serverTableMock')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const authMock = {
  userCan: vi.fn((..._args: string[]) => true),
  currentTenantId: 'tenant-1',
  currentTenant: { name: 'Acme' },
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

function makeRole(overrides: Partial<RoleTableRow> = {}): RoleTableRow {
  return {
    id: 'role-1',
    name: 'Gerente',
    description: 'Administra la sucursal',
    isSystem: false,
    permissionCount: 12,
    userCount: 3,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(AdminRolesView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        RoleUpsertSlideover: true,
        RolePermissionsSlideover: true,
        ConfirmModal: true,
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

beforeEach(() => {
  resetTableState()
  authMock.userCan.mockReset()
  authMock.userCan.mockReturnValue(true)
})

describe('AdminRolesView states — empty', () => {
  it('shows "Aún no hay roles" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay roles')
    expect(empty.get('button').text()).toContain('Crear rol')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'RoleUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the create action without permission', () => {
    authMock.userCan.mockReturnValue(false)
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay roles')
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

describe('AdminRolesView states — loading', () => {
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

describe('AdminRolesView states — data', () => {
  it('renders rows with the name first, a StatusBadge and the ⋮ menu, with no state chrome', () => {
    tableState.data.value = [makeRole(), makeRole({ id: 'role-2', name: 'Cajero', isSystem: true })]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('Gerente')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('Administra la sucursal')
    expect(rows[0]!.get('.hf-status-badge').text()).toBe('Personalizado')
    expect(rows[1]!.get('.hf-status-badge').text()).toBe('Sistema')
    expect(wrapper.findAll('[aria-label="Acciones de Gerente"]')).toHaveLength(1)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('never renders ids and keeps counts as tabular figures', () => {
    tableState.data.value = [makeRole()]
    const wrapper = mountView()
    expect(wrapper.text()).not.toContain('role-1')
    expect(wrapper.findAll('tbody .hf-figure').map((cell) => cell.text())).toEqual(['12', '3'])
  })

  it('renders one card per row on mobile, with the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeRole()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="role-card"]')
    expect(card.find('[aria-label="Acciones de Gerente"]').exists()).toBe(true)
    expect(card.find('.hf-status-badge').exists()).toBe(true)
  })

  it('makes rows clickable for roles that can update', () => {
    tableState.data.value = [makeRole()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })

  it('opens the edit slideover on a row click and not from the ⋮ menu', async () => {
    tableState.data.value = [makeRole()]
    const wrapper = mountView()
    const edit = () =>
      wrapper
        .findAllComponents({ name: 'RoleUpsertSlideover' })
        .find((slideover) => slideover.props('mode') === 'edit')!
    await wrapper.get('[aria-label="Acciones de Gerente"]').trigger('click')
    expect(edit().props('open')).toBe(false)
    await wrapper.get('tbody tr').trigger('click')
    expect(edit().props('open')).toBe(true)
    expect(edit().props('role')).toMatchObject({ id: 'role-1' })
  })

  it('shows no ⋮ and no clickable row for read-only roles', () => {
    authMock.userCan.mockReturnValue(false)
    tableState.data.value = [makeRole()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
    expect(wrapper.find('[aria-label="Acciones de Gerente"]').exists()).toBe(false)
  })
})

describe('AdminRolesView states — row menu', () => {
  const allow = (...grants: Array<[string, string]>) =>
    authMock.userCan.mockImplementation((action: string, subject: string) =>
      grants.some(([a, s]) => a === action && s === subject),
    )
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get('[aria-label="Acciones de Gerente"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())
  }

  it('lists Editar and Permisos, then Eliminar… last for a custom role', async () => {
    allow(['update', 'Role'], ['delete', 'Role'])
    tableState.data.value = [makeRole()]
    expect(await openMenu(mountView())).toEqual(['Editar', 'Permisos', 'Eliminar…'])
  })

  it('hides Eliminar… for system roles', async () => {
    allow(['update', 'Role'], ['delete', 'Role'])
    tableState.data.value = [makeRole({ isSystem: true })]
    expect(await openMenu(mountView())).toEqual(['Editar', 'Permisos'])
  })

  it('shows no ⋮ when the only action would be a forbidden delete of a system role', () => {
    allow(['delete', 'Role'])
    tableState.data.value = [makeRole({ isSystem: true })]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Acciones de Gerente"]').exists()).toBe(false)
  })
})

describe('AdminRolesView states — error', () => {
  it('renders the table error state with the backend message and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: 'No se pudo conectar al servidor' } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudo conectar al servidor')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('falls back to the Spanish message when nothing else is available', () => {
    tableState.isError.value = true
    tableState.error.value = {}
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los roles. Reintenta.',
    )
  })
})

describe('AdminRolesView states — page header', () => {
  it('shows the title outside the table surface and no subtitle', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Roles')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })
})
