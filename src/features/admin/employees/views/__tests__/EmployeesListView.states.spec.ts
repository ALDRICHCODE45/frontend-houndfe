/**
 * EmployeesListView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the
 * router, the overlays and the toolbar/pagination chrome are replaced: empty,
 * loading, data and error (plus no-match) are asserted through what the shared
 * table renders, in table mode and in cards mode.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import EmployeesListView from '../EmployeesListView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  serverTableConfig,
  tableState,
} from '../../__tests__/helpers/employeesServerTable'
import type { Employee } from '../../interfaces/employee.types'

vi.mock('@/core/shared/composables/useServerTable', async () =>
  (await import('../../__tests__/helpers/employeesServerTable')).serverTableModule,
)
vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('../../__tests__/helpers/employeesServerTable')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const grants = new Set<string>()
const authMock = {
  userCan: vi.fn((action: string, subject: string) => grants.has(`${action}:${subject}`)),
  currentTenantId: 'tenant-1',
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

const managerQueries = ref<Array<{ data?: Partial<Employee>; isLoading: boolean }>>([])
vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useQueries: () => managerQueries,
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
  useRoute: () => ({ params: {}, query: {}, name: 'admin-employees' }),
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}))

vi.mock('../../api/employees.api', () => ({
  employeesApi: { list: vi.fn(), getById: vi.fn() },
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-uuid-1',
    employeeNumber: 'EMP-001',
    fullName: 'Ana García',
    email: 'ana@test.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'REMOTE',
    currentPosition: 'Gerente de tienda',
    currentDepartment: 'Operaciones',
    managerId: null,
    hireDate: '2023-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(EmployeesListView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        CreateEmployeeSlideover: true,
        EmployeeEditSlideover: true,
        TerminateEmployeeDialog: true,
        ReactivateEmployeeDialog: true,
        BatchTerminateModal: true,
        ConfirmModal: true,
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

const allow = (...permissions: string[]) => {
  grants.clear()
  permissions.forEach((permission) => grants.add(permission))
}
const ALL = ['create:Employee', 'update:Employee', 'batch_delete:Employee']
const ANA_MENU = '[aria-label="Acciones de Ana García"]'

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

beforeEach(() => {
  resetTableState()
  routerPush.mockReset()
  managerQueries.value = []
  allow(...ALL)
})

describe('EmployeesListView states — empty', () => {
  it('shows "Aún no hay colaboradores" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay colaboradores')
    expect(empty.get('button').text()).toContain('Nuevo colaborador')
  })

  it('opens the create slideover from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    expect(wrapper.findComponent({ name: 'CreateEmployeeSlideover' }).props('open')).toBe(true)
  })

  it('drops the create action without permission', () => {
    allow('update:Employee')
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay colaboradores')
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

  it('treats the status filter as a filter: no-match, and Limpiar filtros resets it to Todos', async () => {
    const wrapper = mountView()
    const select = wrapper.getComponent({ name: 'ToolbarSelectFilter' })
    select.vm.$emit('update:modelValue', 'terminated')
    await flushPromises()
    const noMatch = wrapper.get('.hf-empty-state')
    expect(noMatch.attributes('data-kind')).toBe('no-match')
    expect(noMatch.get('.hf-empty-state__title').text()).toBe('Ningún resultado')
    await noMatch.get('button').trigger('click')
    expect(wrapper.getComponent({ name: 'ToolbarSelectFilter' }).props('modelValue')).toBe('all')
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('empty')
  })

  it('renders the empty state in cards mode on mobile', () => {
    isBelowBreakpoint.value = true
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="mobile-empty-state"]').attributes('data-kind')).toBe('empty')
  })
})

describe('EmployeesListView states — loading', () => {
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

describe('EmployeesListView states — data', () => {
  it('renders the person first, then the status badge, with the ⋮ menu and no state chrome', () => {
    managerQueries.value = [{ data: { id: 'boss-1', fullName: 'Luis Mora', email: null, currentPosition: null, currentDepartment: null }, isLoading: false }]
    tableState.data.value = [
      makeEmployee({ managerId: 'boss-1' }),
      makeEmployee({ id: 'emp-uuid-2', fullName: 'Beto Ruiz', email: null, status: 'TERMINATED', currentDepartment: null }),
      makeEmployee({ id: 'emp-uuid-3', fullName: 'Carla Soto', status: 'ON_LEAVE' }),
    ]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('Ana García')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('ana@test.com')
    expect(rows[0]!.text()).toContain('Luis Mora')
    expect(rows[0]!.text()).toContain('Gerente de tienda')
    const badges = rows.map((row) => row.get('.hf-status-badge'))
    expect(badges.map((badge) => badge.text())).toEqual(['Activo', 'Baja', 'Licencia'])
    expect(badges.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'neutral', 'info'])
    expect(wrapper.findAll(ANA_MENU)).toHaveLength(1)
    expect(wrapper.text()).not.toContain('emp-uuid-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('uses the plain neutral avatar with no activity dot and no card-grid leftovers', () => {
    tableState.data.value = [makeEmployee()]
    const wrapper = mountView()
    expect(wrapper.find('tbody tr [aria-label="Activo"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="view-toggle"], [aria-label="Seleccionar vista de empleados"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="employee-card-grid"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the badge and the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeEmployee()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="employee-card"]')
    expect(card.get('[data-testid="admin-card-name"]').text()).toBe('Ana García')
    expect(card.find(ANA_MENU).exists()).toBe(true)
    expect(card.get('.hf-status-badge').text()).toBe('Activo')
    expect(card.text()).toContain('Gerente de tienda')
  })

  it('opens the detail on a row click and not from the ⋮ menu', async () => {
    tableState.data.value = [makeEmployee()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get(ANA_MENU).trigger('click')
    expect(routerPush).not.toHaveBeenCalled()
    await wrapper.get('tbody tr').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({
      name: 'admin-employee-detail',
      params: { id: 'emp-uuid-1' },
    })
  })

  it('keeps rows openable for a read-only role', async () => {
    allow()
    tableState.data.value = [makeEmployee()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('tbody tr').trigger('click')
    expect(routerPush).toHaveBeenCalledTimes(1)
  })

  it('adds the selection column only when a batch action is allowed', () => {
    tableState.data.value = [makeEmployee()]
    expect(mountView().findAll('thead th').length).toBeGreaterThan(8)
    allow('create:Employee')
    expect(mountView().find('thead [role="checkbox"], thead input[type="checkbox"]').exists()).toBe(false)
  })
})

describe('EmployeesListView states — row menu', () => {
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get(ANA_MENU).trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())
  }

  it('lists Editar and Dar de baja… last for an active collaborator', async () => {
    tableState.data.value = [makeEmployee()]
    expect(await openMenu(mountView())).toEqual(['Editar', 'Dar de baja…'])
  })

  it('lists Editar and Reactivar… for a terminated collaborator', async () => {
    tableState.data.value = [makeEmployee({ status: 'TERMINATED' })]
    expect(await openMenu(mountView())).toEqual(['Editar', 'Reactivar…'])
  })

  it('shows no ⋮ without update permission', () => {
    allow('create:Employee')
    tableState.data.value = [makeEmployee()]
    expect(mountView().find(ANA_MENU).exists()).toBe(false)
  })

  it('opens the lifecycle dialogs from the menu', async () => {
    tableState.data.value = [makeEmployee()]
    const wrapper = mountView()
    await openMenu(wrapper)
    const terminate = Array.from(document.querySelectorAll('[role="menuitem"]')).find((item) =>
      item.textContent?.includes('Dar de baja'),
    ) as HTMLElement
    terminate.click()
    await flushPromises()
    const dialog = wrapper.findComponent({ name: 'TerminateEmployeeDialog' })
    expect(dialog.props('open')).toBe(true)
    expect(dialog.props('employee')).toMatchObject({ id: 'emp-uuid-1' })
  })
})

describe('EmployeesListView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: 'Falla específica del backend' } }, message: 'Axios' }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar los colaboradores')
    expect(error.text()).not.toContain('Falla específica del backend')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the same human title whatever the backend array message or error.message says', () => {
    tableState.isError.value = true
    for (const [error, raw] of [
      [{ response: { data: { message: ['Mensaje 0', 'Mensaje 1'] } }, message: 'Axios' }, 'Mensaje 0'],
      [{ response: { data: {} }, message: 'Network Error' }, 'Network Error'],
      [{}, 'sin detalle'],
    ] as const) {
      tableState.error.value = error
      const text = mountView().get('[data-testid="table-error-state"]').text()
      expect(text).toContain('No se pudieron cargar los colaboradores')
      expect(text).not.toContain(raw)
    }
  })
})

describe('EmployeesListView states — wiring', () => {
  it('keeps the persisted table preferences and the pinned actions column', () => {
    mountView()
    const config = serverTableConfig.mock.calls[serverTableConfig.mock.calls.length - 1]![0] as {
      persistKey: string
      urlSync: boolean
      pageSizeOptions: number[]
      defaultPinning: { left: string[]; right: string[] }
    }
    expect(config.persistKey).toBe('admin-employees')
    expect(config.urlSync).toBe(false)
    expect(config.pageSizeOptions).toEqual([10, 20, 50])
    expect(config.defaultPinning).toEqual({ left: [], right: ['actions'] })
  })

  it('shows the title outside the table surface and no subtitle', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Colaboradores')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })

  it('offers the status filter as a named select, Todos by default', () => {
    const wrapper = mountView()
    const select = wrapper.getComponent({ name: 'ToolbarSelectFilter' })
    expect(select.props('label')).toBe('Estado')
    expect(select.props('modelValue')).toBe('all')
    expect(select.props('items')).toEqual([
      { label: 'Todos', value: 'all' },
      { label: 'Activos', value: 'active' },
      { label: 'Bajas', value: 'terminated' },
    ])
  })

  it('creates a collaborator from the toolbar action only with permission', () => {
    expect(mountView().findComponent({ name: 'CreateEmployeeSlideover' }).exists()).toBe(true)
    allow('update:Employee')
    expect(mountView().findComponent({ name: 'CreateEmployeeSlideover' }).exists()).toBe(false)
  })
})

describe('EmployeesListView states — mobile density containment (S4)', () => {
  it('drops the duplicate mobile gutter on the route root and contains the table surface', () => {
    const wrapper = mountView()
    const root = wrapper.get('.employees-visual')
    expect(Array.from(root.element.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'py-3', 'md:px-6', 'lg:px-8']),
    )
    expect(root.classes()).not.toContain('px-4')
    expect(Array.from(wrapper.get('.hf-table-surface').element.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full', 'overflow-hidden']),
    )
    expect(Array.from(wrapper.get('.hf-table-content').element.classList)).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'px-3', 'py-3', 'sm:px-4', 'sm:py-4']),
    )
  })
})
