/**
 * EmployeeDetailView — the four S10 states of a non-table page.
 *
 * The detail composable, the auth store and the panels are replaced; the
 * header, the tabs, the skeleton and the shared EmptyState are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { computed, ref } from 'vue'
import EmployeeDetailView from '../EmployeeDetailView.vue'
import DetailPageFrame from '@/core/shared/components/DetailPageFrame.vue'
import { isBelowBreakpoint } from '../../__tests__/helpers/employeesServerTable'
import { EMPLOYEE_DETAIL_TABS } from '../../composables/useEmployeeDetail'
import type { Employee } from '../../interfaces/employee.types'

vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('../../__tests__/helpers/employeesServerTable')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const state = {
  employee: ref<Employee | undefined>(undefined),
  isLoading: ref(false),
  isError: ref(false),
  isNotFound: ref(false),
  refetch: vi.fn(),
  setTab: vi.fn(),
  rawTab: ref('resumen'),
}

vi.mock('../../composables/useEmployeeDetail', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../composables/useEmployeeDetail')>()
  return {
    ...actual,
    useEmployeeDetail: () => ({
      employee: state.employee,
      isLoading: state.isLoading,
      isError: state.isError,
      isNotFound: computed(() => state.isNotFound.value),
      refetch: state.refetch,
      activeTab: computed(() => state.rawTab.value),
      setTab: state.setTab,
      tabs: actual.EMPLOYEE_DETAIL_TABS,
      canUpdate: computed(() => grants.has('update:Employee')),
      canReadSalary: computed(() => grants.has('read:EmployeeSalary')),
    }),
  }
})

vi.mock('../../composables/useManagerResolution', () => ({
  useManagerResolution: () => ({
    managerMap: ref(new Map()),
    resolveManagerName: () => '—',
  }),
}))

const grants = new Set<string>()
const authMock = {
  userCan: vi.fn((action: string, subject: string) => grants.has(`${action}:${subject}`)),
  currentTenantId: 'tenant-1',
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush }),
  useRoute: () => ({ params: { id: 'emp-1' }, query: {} }),
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
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

const panelStubs = Object.fromEntries(
  [
    'ResumenPanel',
    'PersonalPanel',
    'LaboralPanel',
    'CompensacionPanel',
    'OrganigramaPanel',
    'CvPanel',
    'DocumentosPanel',
    'AusenciasPanel',
    'EmergencyContactsPanel',
    'EmployeeEditSlideover',
    'TerminateEmployeeDialog',
    'ReactivateEmployeeDialog',
  ].map((name) => [name, true]),
)

const mounted: Array<ReturnType<typeof mount>> = []
function mountView() {
  const wrapper = mount(EmployeeDetailView, {
    attachTo: document.body,
    global: { stubs: panelStubs },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

beforeEach(() => {
  state.employee.value = undefined
  state.isLoading.value = false
  state.isError.value = false
  state.isNotFound.value = false
  isBelowBreakpoint.value = false
  state.rawTab.value = 'resumen'
  state.refetch.mockReset()
  state.setTab.mockReset()
  routerPush.mockReset()
  grants.clear()
  grants.add('update:Employee')
  grants.add('read:EmployeeSalary')
  grants.add('read:EmployeeDocument')
  grants.add('read:EmployeeTimeOff')
})

describe('EmployeeDetailView states — loading', () => {
  it('renders a skeleton shaped like the header, tabs and panel', () => {
    state.isLoading.value = true
    const wrapper = mountView()
    const skeleton = wrapper.get('[data-testid="employee-detail-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.text()).toContain('Cargando')
    expect(skeleton.findAll('[data-testid="employee-detail-skeleton-tab"]').length).toBeGreaterThanOrEqual(4)
    expect(skeleton.findAll('[data-testid="employee-detail-skeleton-card"]')).toHaveLength(3)
    expect(wrapper.find('[data-testid="employee-detail-header"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})

describe('EmployeeDetailView states — error', () => {
  it('shows the shared error state with Reintentar that refetches, and a way back', async () => {
    state.isError.value = true
    const wrapper = mountView()
    const error = wrapper.get('.hf-empty-state')
    expect(error.attributes('data-kind')).toBe('error')
    expect(error.attributes('role')).toBe('alert')
    expect(error.get('.hf-empty-state__title').text()).toBe('No se pudo cargar el colaborador')
    expect(error.text()).not.toMatch(/conexi[oó]n/i)
    expect(wrapper.text()).not.toContain('ID')
    await wrapper.get('[data-testid="employee-detail-retry"]').trigger('click')
    expect(state.refetch).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-testid="employee-detail-error-back"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin-employees-list' })
  })
})

describe('EmployeeDetailView states — not found', () => {
  it('shows an empty state with a way back, never the connection error or a retry', async () => {
    state.isError.value = true
    state.isNotFound.value = true
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.attributes('role')).toBe('status')
    expect(empty.get('.hf-empty-state__title').text()).toBe('No encontramos al colaborador')
    expect(wrapper.text()).not.toContain('conexión')
    expect(wrapper.text()).not.toContain('Reintentar')
    await wrapper.get('[data-testid="employee-detail-not-found-back"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin-employees-list' })
  })
})

describe('EmployeeDetailView states — mobile', () => {
  it('moves the one primary into the sticky bottom bar and keeps it out of the header', () => {
    isBelowBreakpoint.value = true
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    const bar = wrapper.get('[data-slot="footer"] [data-testid="employee-detail-action-bar"]')
    expect(bar.find('[data-testid="employee-detail-edit"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="employee-detail-header"]').find('[data-testid="employee-detail-edit"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="employee-detail-edit"]')).toHaveLength(1)
  })

  it('opens the edit slideover from the bar', async () => {
    isBelowBreakpoint.value = true
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    await wrapper.get('[data-testid="employee-detail-action-bar"] [data-testid="employee-detail-edit"]').trigger('click')
    expect(wrapper.findComponent({ name: 'EmployeeEditSlideover' }).props('open')).toBe(true)
  })

  it('shows no bar without update permission and none on desktop', () => {
    grants.delete('update:Employee')
    isBelowBreakpoint.value = true
    state.employee.value = makeEmployee()
    expect(mountView().find('[data-testid="employee-detail-action-bar"]').exists()).toBe(false)
    grants.add('update:Employee')
    isBelowBreakpoint.value = false
    expect(mountView().find('[data-testid="employee-detail-action-bar"]').exists()).toBe(false)
  })

  it('keeps the ⋮ menu in the header', () => {
    isBelowBreakpoint.value = true
    state.employee.value = makeEmployee()
    expect(mountView().get('[data-testid="employee-detail-header"]').find('[aria-label="Más acciones del colaborador"]').exists()).toBe(true)
  })
})

describe('EmployeeDetailView states — data', () => {
  it('shows the name as the title, the status badge and the job line, with no state chrome', () => {
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    const header = wrapper.get('[data-testid="employee-detail-header"]')
    expect(header.get('h1').text()).toBe('Ana García')
    expect(header.get('.hf-status-badge').text()).toBe('Activo')
    expect(header.get('.hf-status-badge').attributes('data-tone')).toBe('success')
    expect(header.text()).toContain('Gerente de tienda · Operaciones')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="employee-detail-skeleton"]').exists()).toBe(false)
  })

  // detail-page-frame S3: the header stays pinned above the full-width scroller.
  it('renders the shared detail frame with the header pinned and the tabs in the scroll area', () => {
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    expect(wrapper.findComponent(DetailPageFrame).exists()).toBe(true)
    expect(wrapper.find('[data-slot="header"] [data-testid="employee-detail-header"]').exists()).toBe(true)
    expect(wrapper.find('[data-slot="scroll"] [role="tablist"]').exists()).toBe(true)
    expect(wrapper.find('[data-slot="scroll"] [data-testid="employee-detail-header"]').exists()).toBe(false)
  })

  it('keeps one primary action and moves the rest into the ⋮ menu', () => {
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    expect(wrapper.findAll('[data-testid="employee-detail-edit"]')).toHaveLength(1)
    expect(wrapper.find('[aria-label="Más acciones del colaborador"]').exists()).toBe(true)
  })

  it('shows neither the primary nor the menu without update permission', () => {
    grants.delete('update:Employee')
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="employee-detail-edit"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Más acciones del colaborador"]').exists()).toBe(false)
  })

  it('opens the edit slideover from the primary action', async () => {
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    await wrapper.get('[data-testid="employee-detail-edit"]').trigger('click')
    expect(wrapper.findComponent({ name: 'EmployeeEditSlideover' }).props('open')).toBe(true)
  })

  it('goes back to the list from the back button', async () => {
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    await wrapper.get('[data-testid="employee-detail-back"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'admin-employees-list' })
  })

  it('renders the visible tabs as a tablist, with the active one selected', () => {
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(EMPLOYEE_DETAIL_TABS.map((tab) => tab.label))
    expect(tabs.filter((tab) => tab.attributes('aria-selected') === 'true').map((tab) => tab.text())).toEqual([
      'Resumen',
    ])
    expect(wrapper.get('[role="tabpanel"]').attributes('aria-label')).toBe('Resumen')
  })

  it('hides the tabs the role cannot read and switches tab on click', async () => {
    grants.delete('read:EmployeeSalary')
    state.employee.value = makeEmployee()
    const wrapper = mountView()
    const labels = wrapper.findAll('[role="tab"]').map((tab) => tab.text())
    expect(labels).not.toContain('Compensación')
    await wrapper.findAll('[role="tab"]')[1]!.trigger('click')
    expect(state.setTab).toHaveBeenCalledWith('personal')
  })

  it('shows a terminated collaborator as neutral with Reactivar… in the menu, never danger', async () => {
    state.employee.value = makeEmployee({ status: 'TERMINATED' })
    const wrapper = mountView()
    expect(wrapper.get('.hf-status-badge').attributes('data-tone')).toBe('neutral')
    await wrapper.get('[aria-label="Más acciones del colaborador"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) =>
      item.textContent?.trim(),
    )
    expect(items).toEqual(['Reactivar…'])
  })
})
