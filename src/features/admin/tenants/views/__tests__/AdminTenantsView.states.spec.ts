/**
 * AdminTenantsView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the router,
 * the overlays and the toolbar/pagination chrome are replaced: empty, loading,
 * data and error (plus no-match) are asserted through what the shared table renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminTenantsView from '../AdminTenantsView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  tableState,
} from '@/features/admin/__tests__/helpers/serverTableMock'
import type { TenantTableRow } from '../../interfaces/tenant.types'

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
  useRouter: () => ({ push }),
}))

const authMock = { isSuperAdmin: true, currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeTenant(overrides: Partial<TenantTableRow> = {}): TenantTableRow {
  return {
    id: 'tenant-1',
    name: 'Sucursal Centro',
    slug: 'centro',
    address: 'Av. Principal 123',
    phone: '5512345678',
    isActive: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(AdminTenantsView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: {
          template: '<div data-testid="toolbar"><slot name="filters" /></div>',
        },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        TenantUpsertSlideover: true,
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
  push.mockReset()
  authMock.isSuperAdmin = true
})

describe('AdminTenantsView states — empty', () => {
  it('shows "Aún no hay sucursales" with the create action for a super-admin', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay sucursales')
    expect(empty.get('button').text()).toContain('Crear sucursal')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'TenantUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the create action for non super-admins', () => {
    authMock.isSuperAdmin = false
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay sucursales')
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

describe('AdminTenantsView states — loading', () => {
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

describe('AdminTenantsView states — data', () => {
  it('renders rows with the name and slug, a StatusBadge and the ⋮ menu, with no state chrome', () => {
    tableState.data.value = [makeTenant(), makeTenant({ id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte', isActive: false })]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('Sucursal Centro')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('centro')
    const badges = wrapper.findAll('tbody .hf-status-badge')
    expect(badges.map((badge) => badge.text())).toEqual(['Activa', 'Inactiva'])
    expect(badges.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'neutral'])
    expect(badges[1]!.attributes('aria-label')).toBe('Estado: Inactiva')
    expect(wrapper.findAll('[aria-label="Acciones de Sucursal Centro"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('tenant-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the badge and the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeTenant()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="tenant-card"]')
    expect(card.find('[aria-label="Acciones de Sucursal Centro"]').exists()).toBe(true)
    expect(card.get('.hf-status-badge').text()).toBe('Activa')
  })

  it('opens the edit slideover on a row click and not from the ⋮ menu', async () => {
    tableState.data.value = [makeTenant()]
    const wrapper = mountView()
    const edit = () =>
      wrapper
        .findAllComponents({ name: 'TenantUpsertSlideover' })
        .find((slideover) => slideover.props('mode') === 'edit')!
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('[aria-label="Acciones de Sucursal Centro"]').trigger('click')
    expect(edit().props('open')).toBe(false)
    await wrapper.get('tbody tr').trigger('click')
    expect(edit().props('open')).toBe(true)
    expect(edit().props('tenant')).toMatchObject({ id: 'tenant-1' })
  })

  it('shows no ⋮ and no clickable row for non super-admins', () => {
    authMock.isSuperAdmin = false
    tableState.data.value = [makeTenant()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
    expect(wrapper.find('[aria-label="Acciones de Sucursal Centro"]').exists()).toBe(false)
  })

  it('lists Editar, Gestionar miembros and Desactivar… last, and navigates to the members', async () => {
    tableState.data.value = [makeTenant()]
    const wrapper = mountView()
    await wrapper.get('[aria-label="Acciones de Sucursal Centro"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Editar',
      'Gestionar miembros',
      'Desactivar…',
    ])
    items[1]!.click()
    expect(push).toHaveBeenCalledWith('/admin/tenants/tenant-1/members')
  })
})

describe('AdminTenantsView states — filter', () => {
  it('offers the status filter as a named select inside the toolbar', () => {
    const wrapper = mountView()
    const select = wrapper.get('[data-testid="tenant-status-filter"]')
    expect(select.attributes('aria-label')).toBe('Estado')
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)
  })
})

describe('AdminTenantsView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: 'No se pudo conectar al servidor' } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar las sucursales')
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
      'No se pudieron cargar las sucursales',
    )
  })
})

describe('AdminTenantsView states — page header', () => {
  it('shows the title outside the table surface and no subtitle', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Sucursales')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })
})
