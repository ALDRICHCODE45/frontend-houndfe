/**
 * PendingApprovalsView — the four S10 states against the REAL AppDataTable.
 *
 * The tenant-wide queue (`usePendingApprovals`), the name-resolution query, the
 * auth store, the viewport breakpoint and the toolbar/pagination chrome are
 * replaced; the table, the cards, the StatusBadge, the ⋮ menu and the review
 * dialog are the real ones.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import PendingApprovalsView from '../PendingApprovalsView.vue'
import { isBelowBreakpoint } from '../../__tests__/helpers/employeesServerTable'
import type { Employee, TimeOffRequest } from '../../interfaces/employee.types'

vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('../../__tests__/helpers/employeesServerTable')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const pending = {
  data: ref<TimeOffRequest[]>([]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}
const review = { mutateAsync: vi.fn(), isPending: ref(false) }

vi.mock('../../composables/useReviewTimeOff', () => ({
  usePendingApprovals: () => pending,
  useReviewTimeOff: () => review,
}))

const pickerEmployees = ref<Partial<Employee>[]>([])
vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: pickerEmployees }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

const grants = new Set<string>()
const authMock = {
  userCan: vi.fn((action: string, subject: string) => grants.has(`${action}:${subject}`)),
  currentTenantId: 'tenant-1',
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('../../api/employees.api', () => ({ employeesApi: { listForPicker: vi.fn() } }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {}, name: 'admin-pending-approvals' }),
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeRequest(overrides: Partial<TimeOffRequest> = {}): TimeOffRequest {
  return {
    id: 'to-uuid-1',
    employeeId: 'emp-uuid-1',
    type: 'VACATION',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    reason: 'Viaje familiar',
    status: 'PENDING',
    createdAt: '2026-07-01T10:00:00.000Z',
    requestedByUserId: null,
    reviewerUserId: null,
    reviewedAt: null,
    reviewerNotes: null,
    tenantId: 'tenant-1',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []
function mountView() {
  const wrapper = mount(PendingApprovalsView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
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
const MENU = '[aria-label^="Acciones de la solicitud de Ana García"]'

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

beforeEach(() => {
  isBelowBreakpoint.value = false
  pending.data.value = []
  pending.isLoading.value = false
  pending.isError.value = false
  pending.error.value = null
  pending.refetch.mockReset()
  review.mutateAsync.mockReset()
  pickerEmployees.value = [{ id: 'emp-uuid-1', fullName: 'Ana García', email: null, currentPosition: null, currentDepartment: null }]
  allow('read:EmployeeTimeOff', 'update:EmployeeTimeOff')
})

describe('PendingApprovalsView states — empty', () => {
  it('says there is nothing to validate, with no action', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Sin solicitudes pendientes')
    expect(empty.find('button').exists()).toBe(false)
  })

  it('renders the same empty state in cards mode', () => {
    isBelowBreakpoint.value = true
    expect(mountView().get('[data-testid="mobile-empty-state"]').attributes('data-kind')).toBe('empty')
  })
})

describe('PendingApprovalsView states — loading', () => {
  it('renders the table skeleton on desktop', () => {
    pending.isLoading.value = true
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('renders the card skeletons on mobile', () => {
    isBelowBreakpoint.value = true
    pending.isLoading.value = true
    expect(mountView().findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })
})

describe('PendingApprovalsView states — data', () => {
  it('puts the person first, then a warning badge, then dates, type, days, reason and request date', () => {
    pending.data.value = [makeRequest()]
    const wrapper = mountView()
    const row = wrapper.get('tbody tr')
    expect(row.get('.hf-row-primary').text()).toBe('Ana García')
    expect(row.find('.hf-status-badge').exists()).toBe(false)
    expect(row.text()).toContain('Vacaciones')
    expect(row.text()).toContain('10 días')
    expect(row.text()).toContain('Viaje familiar')
    expect(wrapper.findAll('thead th').map((th) => th.text())).toEqual([
      'Colaborador',
      'Fechas',
      'Tipo',
      'Días',
      'Motivo',
      'Solicitada',
      'Acciones',
    ])
    expect(wrapper.text()).not.toContain('emp-uuid-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('hides the Estado column while every request is pending, and brings it back when one is not', () => {
    pending.data.value = [makeRequest(), makeRequest({ id: 'to-2' })]
    expect(mountView().findAll('thead th').map((th) => th.text())).not.toContain('Estado')
    pending.data.value = [makeRequest(), makeRequest({ id: 'to-2', status: 'APPROVED' })]
    const wrapper = mountView()
    expect(wrapper.findAll('thead th').map((th) => th.text())).toContain('Estado')
    expect(wrapper.findAll('tbody .hf-status-badge').map((badge) => badge.text())).toEqual([
      'Pendiente',
      'Aprobada',
    ])
  })

  it('keeps "—" for the name until the picker resolves it and the sick-reason guard for SICK without reason', () => {
    pickerEmployees.value = []
    pending.data.value = [makeRequest({ type: 'SICK', reason: null })]
    const row = mountView().get('tbody tr')
    expect(row.get('.hf-row-primary').text()).toBe('—')
    expect(row.text()).toContain('Motivo médico reservado')
  })

  it('renders one card per request on mobile with the badge and the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    pending.data.value = [makeRequest()]
    const card = mountView().get('[data-testid="pending-approval-card"]')
    expect(card.get('[data-testid="admin-card-name"]').text()).toBe('Ana García')
    expect(card.find('.hf-status-badge').exists()).toBe(false)
    expect(card.text()).toContain('Vacaciones')
    expect(card.find('[aria-label="Acciones de Ana García"]').exists()).toBe(true)
  })

  it('labels when the request was made in the mobile footer, so two dates never sit unnamed side by side', () => {
    isBelowBreakpoint.value = true
    const year = new Date().getFullYear()
    pending.data.value = [
      makeRequest({
        startDate: `${year}-06-05`,
        endDate: `${year}-06-05`,
        createdAt: `${year}-10-09T13:16:00.000Z`,
      }),
    ]
    const footer = mountView().get('[data-testid="pending-approval-card"] .admin-card-footer')
    expect(footer.text()).toContain('5 jun · 1 día')
    expect(footer.text()).toMatch(/Solicitada\s+9 oct/)
  })

  it('searches by the resolved name and shows no-match with Limpiar filtros', async () => {
    pending.data.value = [makeRequest()]
    const wrapper = mountView()
    wrapper.getComponent({ name: 'AppDataTable' }).vm.$emit('update:global-filter', 'zzz')
    await flushPromises()
    const noMatch = wrapper.get('.hf-empty-state')
    expect(noMatch.attributes('data-kind')).toBe('no-match')
    expect(noMatch.get('.hf-empty-state__title').text()).toBe('Ningún resultado para «zzz»')
    await noMatch.get('button').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })
})

describe('PendingApprovalsView states — row menu and review', () => {
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get(MENU).trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Array.from(document.querySelectorAll('[role="menuitem"]'))
  }

  it('lists Aprobar… and Rechazar… for a reviewer', async () => {
    pending.data.value = [makeRequest()]
    const items = await openMenu(mountView())
    expect(items.map((item) => item.textContent?.trim())).toEqual(['Aprobar…', 'Rechazar…'])
  })

  it('shows no ⋮ and no inline buttons for a read-only role', () => {
    allow('read:EmployeeTimeOff')
    pending.data.value = [makeRequest()]
    const wrapper = mountView()
    expect(wrapper.find(MENU).exists()).toBe(false)
    expect(wrapper.find('[data-testid="pending-approvals-row-approve"], [data-testid="pending-approvals-row-reject"]').exists()).toBe(false)
  })

  it('opens the review dialog with approve copy from the menu', async () => {
    pending.data.value = [makeRequest()]
    const wrapper = mountView()
    const [approve] = await openMenu(wrapper)
    ;(approve as HTMLElement).click()
    await flushPromises()
    expect(document.body.innerHTML).toContain('Aprobar solicitud de ausencia')
    expect(document.body.innerHTML).toContain('Ana García')
  })

  it('opens the review dialog with reject copy and the rejection placeholder', async () => {
    pending.data.value = [makeRequest()]
    const wrapper = mountView()
    const items = await openMenu(wrapper)
    ;(items[1] as HTMLElement).click()
    await flushPromises()
    expect(document.body.innerHTML).toContain('Rechazar solicitud de ausencia')
    expect(document.body.innerHTML).toContain('Motivo del rechazo')
  })
})

describe('PendingApprovalsView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    pending.isError.value = true
    pending.error.value = { response: { data: { message: 'Falla específica' } }, message: 'Axios' }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar las solicitudes pendientes')
    expect(error.text()).not.toContain('Falla específica')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(pending.refetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the same human title whatever the array message or error.message says', () => {
    pending.isError.value = true
    for (const [error, raw] of [
      [{ response: { data: { message: ['Primero', 'Segundo'] } } }, 'Primero'],
      [{ message: 'Network Error' }, 'Network Error'],
      [null, 'sin detalle'],
    ] as const) {
      pending.error.value = error
      const text = mountView().get('[data-testid="table-error-state"]').text()
      expect(text).toContain('No se pudieron cargar las solicitudes pendientes')
      expect(text).not.toContain(raw)
    }
  })
})

describe('PendingApprovalsView states — toolbar and dates', () => {
  it('keeps the toolbar in the empty, loading and error states so the screen does not jump', () => {
    expect(mountView().find('[data-testid="toolbar"]').exists()).toBe(true)
    pending.isLoading.value = true
    expect(mountView().find('[data-testid="toolbar"]').exists()).toBe(true)
    pending.isLoading.value = false
    pending.isError.value = true
    expect(mountView().find('[data-testid="toolbar"]').exists()).toBe(true)
  })

  it('sizes the loading skeleton to the visible columns', () => {
    pending.isLoading.value = true
    const firstRow = mountView().get('[data-testid="table-skeleton-row"]')
    expect(firstRow.element.children).toHaveLength(7)
  })

  it('shows a same-day range once, without the current year or a padded day', () => {
    const year = new Date().getFullYear()
    pending.data.value = [makeRequest({ startDate: `${year}-06-05`, endDate: `${year}-06-05` })]
    const text = mountView().get('tbody tr').text()
    expect(text).toContain('5 jun')
    expect(text).not.toMatch(/5 jun\s*–\s*5 jun/)
    expect(text).not.toContain('05 jun')
    expect(text).not.toContain(String(year))
  })

  it('shows when it was requested as a short date and time, without the current year', () => {
    pending.data.value = [makeRequest({ createdAt: new Date().toISOString() })]
    const cells = mountView().findAll('tbody tr td')
    const requested = cells[cells.length - 2]!.text()
    expect(requested).toMatch(/^\d{1,2} [a-zé]{3,4}, \d{2}:\d{2}$/)
  })
})

describe('PendingApprovalsView states — chrome', () => {
  it('shows the title outside the table surface and no subtitle, summary or view toggle', () => {
    pending.data.value = [makeRequest()]
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Validaciones pendientes')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('[data-testid="pending-approvals-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="view-toggle"]').exists()).toBe(false)
  })
})
