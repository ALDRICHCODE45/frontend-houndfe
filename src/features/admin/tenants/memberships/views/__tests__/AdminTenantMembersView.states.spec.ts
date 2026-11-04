/**
 * AdminTenantMembersView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the route, the auth store, vue-query,
 * the overlays and the toolbar/pagination chrome are replaced: empty, loading,
 * data and error (plus no-match and forbidden) are asserted through what the
 * view renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminTenantMembersView from '../AdminTenantMembersView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  tableState,
} from '@/features/admin/__tests__/helpers/serverTableMock'
import type { MembershipTableRow } from '../../interfaces/membership.types'

vi.mock('@/core/shared/composables/useServerTable', async () =>
  (await import('@/features/admin/__tests__/helpers/serverTableMock')).serverTableModule,
)
vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('@/features/admin/__tests__/helpers/serverTableMock')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const push = vi.fn()
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRoute: () => ({ params: { tenantId: 'tenant-123' } }),
  useRouter: () => ({ push }),
}))

const summary = { tenantName: ref('Sucursal Centro'), isLoadingTenantName: ref(false) }
vi.mock('@/features/admin/tenants/composables/useTenantSummary', () => ({
  useTenantSummary: () => summary,
}))

const grants = new Set<string>()
const authMock = { userCan: vi.fn((action: string) => grants.has(action)) }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeMember(overrides: Partial<MembershipTableRow> = {}): MembershipTableRow {
  return {
    id: 'm-1',
    userId: 'u-1',
    tenantId: 'tenant-123',
    roleId: 'r-1',
    createdAt: '2024-01-15T10:00:00.000Z',
    userName: 'María Pérez',
    userEmail: 'maria@example.com',
    roleName: 'Cajero',
    userIsActive: true,
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(AdminTenantMembersView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        MembershipUpsertSlideover: true,
        ConfirmModal: true,
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

const allow = (...actions: string[]) => {
  grants.clear()
  actions.forEach((action) => grants.add(action))
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
})

beforeEach(() => {
  resetTableState()
  push.mockReset()
  summary.isLoadingTenantName.value = false
  allow('read', 'create', 'update', 'delete')
})

describe('AdminTenantMembersView states — empty', () => {
  it('shows "Aún no hay miembros" with the add action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay miembros')
    expect(empty.get('button').text()).toContain('Agregar miembro')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'MembershipUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the add action without permission', () => {
    allow('read')
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay miembros')
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

  it('shows the forbidden state and no table when read is denied', () => {
    allow()
    const wrapper = mountView()
    const forbidden = wrapper.get('.hf-empty-state')
    expect(forbidden.attributes('data-kind')).toBe('forbidden')
    expect(forbidden.get('.hf-empty-state__title').text()).toBe('No tienes acceso a los miembros')
    expect(forbidden.find('button').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
    expect(wrapper.find('table').exists()).toBe(false)
  })
})

describe('AdminTenantMembersView states — loading', () => {
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

  it('shows a skeleton in the subtitle while the branch name loads', () => {
    summary.isLoadingTenantName.value = true
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="tenant-members-subtitle-loading"]').exists()).toBe(true)
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
  })
})

describe('AdminTenantMembersView states — data', () => {
  it('renders rows with the person first, status, role and the ⋮ menu, with no state chrome', () => {
    tableState.data.value = [makeMember(), makeMember({ id: 'm-2', userName: 'Luis Soto', userEmail: 'luis@example.com', userIsActive: false })]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('María Pérez')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('maria@example.com')
    expect(rows.map((row) => row.get('.hf-status-badge').text())).toEqual(['Activo', 'Inactivo'])
    expect(rows[0]!.text()).toContain('Cajero')
    expect(wrapper.findAll('[aria-label="Acciones de María Pérez"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('m-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('draws no status badge when the user state is unknown', () => {
    tableState.data.value = [makeMember({ userIsActive: undefined })]
    const wrapper = mountView()
    expect(wrapper.find('tbody .hf-status-badge').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeMember()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="member-card"]')
    expect(card.find('[aria-label="Acciones de María Pérez"]').exists()).toBe(true)
    expect(card.get('.hf-status-badge').text()).toBe('Activo')
    expect(card.text()).toContain('Cajero')
  })

  it('omits the status badge in the card when the user state is unknown', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeMember({ userIsActive: undefined })]
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="member-card"] .hf-status-badge').exists()).toBe(false)
  })

  it('opens the role editor on a row click with update permission, never navigating', async () => {
    tableState.data.value = [makeMember()]
    const wrapper = mountView()
    const edit = () =>
      wrapper
        .findAllComponents({ name: 'MembershipUpsertSlideover' })
        .find((slideover) => slideover.props('mode') === 'edit')!
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('[aria-label="Acciones de María Pérez"]').trigger('click')
    expect(edit().props('open')).toBe(false)
    await wrapper.get('tbody tr').trigger('click')
    expect(edit().props('open')).toBe(true)
    expect(edit().props('membership')).toMatchObject({ id: 'm-1' })
    expect(push).not.toHaveBeenCalled()
  })

  it('does not open the editor nor show a clickable row without update permission', async () => {
    allow('read', 'delete')
    tableState.data.value = [makeMember()]
    const wrapper = mountView()
    const edit = wrapper
      .findAllComponents({ name: 'MembershipUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'edit')!
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
    await wrapper.get('tbody tr').trigger('click')
    expect(edit.props('open')).toBe(false)
  })
})

describe('AdminTenantMembersView states — row menu', () => {
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get('[aria-label="Acciones de María Pérez"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())
  }

  it('lists Editar rol and Eliminar miembro… last when both are allowed', async () => {
    tableState.data.value = [makeMember()]
    expect(await openMenu(mountView())).toEqual(['Editar rol', 'Eliminar miembro…'])
  })

  it('shows no ⋮ when update is the only permission (it would only repeat the row click)', () => {
    allow('read', 'update')
    tableState.data.value = [makeMember()]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Acciones de María Pérez"]').exists()).toBe(false)
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })

  it('shows no ⋮ when both update and delete are denied', () => {
    allow('read')
    tableState.data.value = [makeMember()]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Acciones de María Pérez"]').exists()).toBe(false)
  })
})

describe('AdminTenantMembersView states — error', () => {
  it('renders the table error state with the backend message and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: ['Sin conexión', 'otro'] } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('Sin conexión')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('falls back to the Spanish message when nothing else is available', () => {
    tableState.isError.value = true
    tableState.error.value = {}
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los miembros. Reintenta.',
    )
  })
})

describe('AdminTenantMembersView states — page header', () => {
  it('shows the title with the branch name as the only subtitle, outside the table surface', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Miembros')
    expect(wrapper.get('.hf-page-subtitle').text()).toBe('Sucursal Centro')
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })
})
