/**
 * Employee detail panels — the S10 states of the non-table sections.
 *
 * Every panel that loads data renders, through the real shared EmptyState and
 * StatusBadge: a skeleton while loading, an error with Reintentar, the "empty"
 * state and the data. Only the query hooks of the feature composables are
 * replaced; the pure helpers stay real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import type {
  EmergencyContact,
  Employee,
  EmployeeDocument,
  PositionChange,
  SalaryChange,
  TimeOffRequest,
} from '../../interfaces/employee.types'

type QueryState<T> = {
  data: Ref<T | undefined>
  isLoading: Ref<boolean>
  isError: Ref<boolean>
  refetch: ReturnType<typeof vi.fn>
}

const { queries, mutation } = vi.hoisted(() => {
  const make = () => ({
    data: { value: undefined as unknown },
    isLoading: { value: false },
    isError: { value: false },
    refetch: undefined as unknown,
  })
  return {
    queries: {} as Record<string, ReturnType<typeof make>>,
    mutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: { value: false } }),
  }
})

function query<T>(name: string, initial?: T): QueryState<T> {
  const state: QueryState<T> = {
    data: ref(initial) as Ref<T | undefined>,
    isLoading: ref(false),
    isError: ref(false),
    refetch: vi.fn(),
  }
  queries[name] = state as never
  return state
}

const q = {
  salary: query<SalaryChange[]>('salary', []),
  positions: query<PositionChange[]>('positions', []),
  chain: query<Employee[]>('chain', []),
  subs: query<Employee[]>('subs', []),
  documents: query<{ data: EmployeeDocument[] }>('documents', { data: [] }),
  timeOff: query<{ data: TimeOffRequest[] }>('timeOff', { data: [] }),
  balance: query<{ year: number; entitlement: number; used: number; pending: number; remaining: number }>(
    'balance',
    undefined,
  ),
  contacts: query<EmergencyContact[]>('contacts', []),
}

vi.mock('../../composables/useCompensacion', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useEmployeeSalaryHistory: () => q.salary,
  useEmployeePositionHistory: () => q.positions,
  useAddSalaryChange: () => mutation(),
  useAddPositionChange: () => mutation(),
}))
vi.mock('../../composables/useOrganigrama', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useEmployeeManagerChain: () => q.chain,
  useEmployeeSubordinates: () => q.subs,
}))
vi.mock('../../composables/useDocumentos', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useEmployeeDocuments: () => q.documents,
  useUploadDocument: () => mutation(),
  useDeleteDocument: () => mutation(),
}))
vi.mock('../../composables/useAusencias', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useEmployeeTimeOff: () => q.timeOff,
  useVacationBalance: () => q.balance,
  useCreateTimeOff: () => mutation(),
  useCancelTimeOff: () => mutation(),
}))
vi.mock('../../composables/useReviewTimeOff', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useReviewTimeOff: () => mutation(),
}))
vi.mock('../../composables/useEmergencyContacts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useEmergencyContacts: () => q.contacts,
  useCreateEmergencyContact: () => mutation(),
  useUpdateEmergencyContact: () => mutation(),
  useDeleteEmergencyContact: () => mutation(),
}))
vi.mock('@/core/shared/api/multipart', () => ({
  downloadFile: vi.fn(),
  uploadMultipart: vi.fn(),
}))

import CompensacionPanel from '../CompensacionPanel.vue'
import OrganigramaPanel from '../OrganigramaPanel.vue'
import DocumentosPanel from '../DocumentosPanel.vue'
import AusenciasPanel from '../AusenciasPanel.vue'
import EmergencyContactsPanel from '../EmergencyContactsPanel.vue'
import CvPanel from '../CvPanel.vue'

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
function mountPanel(component: object, props: Record<string, unknown>) {
  const wrapper = mount(component, { props, attachTo: document.body })
  mounted.push(wrapper)
  return wrapper
}

const employee = makeEmployee()

beforeEach(() => {
  for (const state of Object.values(q)) {
    state.isLoading.value = false
    state.isError.value = false
    state.refetch.mockReset()
  }
  q.salary.data.value = []
  q.positions.data.value = []
  q.chain.data.value = []
  q.subs.data.value = []
  q.documents.data.value = { data: [] }
  q.timeOff.data.value = { data: [] }
  q.balance.data.value = undefined
  q.contacts.data.value = []
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

const SALARY_PROPS = { employee, canReadSalary: true, canCreateSalary: true, canUpdate: true }

describe('CompensacionPanel states', () => {
  it('shows a skeleton per history while loading', () => {
    q.salary.isLoading.value = true
    q.positions.isLoading.value = true
    const wrapper = mountPanel(CompensacionPanel, SALARY_PROPS)
    expect(wrapper.get('[data-testid="salary-history-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="position-history-skeleton"]').exists()).toBe(true)
  })

  it('shows the error state with Reintentar that refetches each history', async () => {
    q.salary.isError.value = true
    q.positions.isError.value = true
    const wrapper = mountPanel(CompensacionPanel, SALARY_PROPS)
    expect(wrapper.get('[data-testid="salary-history-error"] .hf-empty-state').attributes('role')).toBe('alert')
    await wrapper.get('[data-testid="salary-history-retry"]').trigger('click')
    await wrapper.get('[data-testid="position-history-retry"]').trigger('click')
    expect(q.salary.refetch).toHaveBeenCalledTimes(1)
    expect(q.positions.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the shared empty state per history', () => {
    const wrapper = mountPanel(CompensacionPanel, SALARY_PROPS)
    expect(wrapper.get('[data-testid="salary-history-empty"] .hf-empty-state').attributes('data-kind')).toBe('empty')
    expect(wrapper.get('[data-testid="position-history-empty"]').text()).toContain('Sin historial de posiciones')
  })

  it('shows the entries, neutral, with no state chrome', () => {
    q.salary.data.value = [
      { id: 's1', employeeId: 'e', amountCents: 4500000, currency: 'MXN', effectiveFrom: '2026-01-01', reason: 'Aumento', createdAt: '2026-01-01' },
    ]
    q.positions.data.value = [
      { id: 'p1', employeeId: 'e', position: 'Gerente', department: 'Finanzas', effectiveFrom: '2026-01-01', reason: null, createdAt: '2026-01-01' },
    ]
    const wrapper = mountPanel(CompensacionPanel, SALARY_PROPS)
    expect(wrapper.text()).toContain('$45,000.00')
    expect(wrapper.text()).toContain('Finanzas')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.html()).not.toMatch(/text-primary|bg-primary|font-bold/)
  })

  it('shows the forbidden state instead of the salary without permission', () => {
    const wrapper = mountPanel(CompensacionPanel, { ...SALARY_PROPS, canReadSalary: false })
    expect(wrapper.find('.hf-empty-state[data-kind="forbidden"]').exists()).toBe(true)
  })
})

describe('OrganigramaPanel states', () => {
  it('shows skeletons while loading', () => {
    q.chain.isLoading.value = true
    q.subs.isLoading.value = true
    const wrapper = mountPanel(OrganigramaPanel, { employee })
    expect(wrapper.get('[data-testid="organigrama-chain-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="organigrama-subs-skeleton"]').exists()).toBe(true)
  })

  it('shows errors with Reintentar', async () => {
    q.chain.isError.value = true
    q.subs.isError.value = true
    const wrapper = mountPanel(OrganigramaPanel, { employee })
    await wrapper.get('[data-testid="organigrama-chain-retry"]').trigger('click')
    await wrapper.get('[data-testid="organigrama-subs-retry"]').trigger('click')
    expect(q.chain.refetch).toHaveBeenCalledTimes(1)
    expect(q.subs.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty states', () => {
    const wrapper = mountPanel(OrganigramaPanel, { employee })
    const titles = wrapper.findAll('.hf-empty-state__title').map((title) => title.text())
    expect(titles).toEqual(['Sin jefes registrados', 'Sin reportes directos'])
  })

  it('shows the chain, the focal employee and the direct reports with a neutral avatar', () => {
    q.chain.data.value = [makeEmployee({ id: 'boss', fullName: 'Luis Mora', currentPosition: 'Director', currentDepartment: null })]
    q.subs.data.value = [makeEmployee({ id: 'sub', fullName: 'Carla Soto' })]
    const wrapper = mountPanel(OrganigramaPanel, { employee })
    expect(wrapper.text()).toContain('Luis Mora')
    expect(wrapper.text()).toContain('Ana García')
    expect(wrapper.text()).toContain('Carla Soto')
    expect(wrapper.find('[data-testid="entity-avatar"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Árbol completo')
  })
})

describe('DocumentosPanel states', () => {
  const props = { employee, canCreate: true, canDelete: true }
  const doc = (overrides: Partial<EmployeeDocument> = {}): EmployeeDocument => ({
    id: 'd1',
    employeeId: 'e',
    fileId: 'f1',
    category: 'CONTRACT',
    notes: 'Contrato 2026',
    expiresAt: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  })

  it('shows skeletons while loading', () => {
    q.documents.isLoading.value = true
    const wrapper = mountPanel(DocumentosPanel, props)
    expect(wrapper.get('[data-testid="documents-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="expirations-skeleton"]').exists()).toBe(true)
  })

  it('shows the error with Reintentar', async () => {
    q.documents.isError.value = true
    const wrapper = mountPanel(DocumentosPanel, props)
    await wrapper.get('[data-testid="documents-retry"]').trigger('click')
    expect(q.documents.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows "Aún no hay documentos" and no expirations', () => {
    const wrapper = mountPanel(DocumentosPanel, props)
    expect(wrapper.get('[data-testid="documents-empty"] .hf-empty-state__title').text()).toBe('Aún no hay documentos')
    expect(wrapper.find('[data-testid="expirations-empty"]').exists()).toBe(true)
  })

  it('lists documents with title and category line, and the ⋮ menu only with delete permission', () => {
    q.documents.data.value = { data: [doc()] }
    const withDelete = mountPanel(DocumentosPanel, props)
    const row = withDelete.get('[data-testid="document-row"]')
    expect(row.get('.hf-row-primary').text()).toBe('Contrato 2026')
    expect(row.get('.hf-row-secondary').text()).toContain('Contrato')
    expect(row.find('[aria-label="Acciones de Contrato 2026"]').exists()).toBe(true)
    const readOnly = mountPanel(DocumentosPanel, { ...props, canDelete: false })
    expect(readOnly.find('[aria-label="Acciones de Contrato 2026"]').exists()).toBe(false)
  })

  it('marks an expiring document as a pending warning badge', () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString()
    q.documents.data.value = { data: [doc({ expiresAt: soon })] }
    const wrapper = mountPanel(DocumentosPanel, props)
    const badge = wrapper.get('[data-testid="expiring-row"] .hf-status-badge')
    expect(badge.attributes('data-tone')).toBe('warning')
    expect(badge.text()).toContain('Vence el')
  })
})

describe('AusenciasPanel states', () => {
  const props = { employee, canCreate: true, canUpdate: true }
  const request = (overrides: Partial<TimeOffRequest> = {}): TimeOffRequest => ({
    id: 't1',
    employeeId: 'e',
    type: 'VACATION',
    startDate: '2099-05-27',
    endDate: '2099-05-29',
    reason: 'Descanso',
    status: 'PENDING',
    createdAt: '2026-05-01T00:00:00.000Z',
    requestedByUserId: null,
    reviewerUserId: null,
    reviewedAt: null,
    reviewerNotes: null,
    tenantId: 't',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  })

  it('shows a skeleton while loading', () => {
    q.timeOff.isLoading.value = true
    expect(mountPanel(AusenciasPanel, props).get('[data-testid="time-off-skeleton"]').attributes('aria-busy')).toBe('true')
  })

  it('shows the error with Reintentar', async () => {
    q.timeOff.isError.value = true
    const wrapper = mountPanel(AusenciasPanel, props)
    await wrapper.get('[data-testid="time-off-retry"]').trigger('click')
    expect(q.timeOff.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state naming the year', () => {
    const year = new Date().getFullYear()
    expect(mountPanel(AusenciasPanel, props).get('[data-testid="time-off-empty"] .hf-empty-state__title').text()).toBe(
      `Sin ausencias en ${year}`,
    )
  })

  it('shows a StatusBadge per request: pending is warning, approved success, rejected and cancelled neutral', () => {
    q.timeOff.data.value = {
      data: [
        request({ id: 'a', status: 'PENDING' }),
        request({ id: 'b', status: 'APPROVED' }),
        request({ id: 'c', status: 'REJECTED' }),
        request({ id: 'd', status: 'CANCELLED' }),
      ],
    }
    const wrapper = mountPanel(AusenciasPanel, props)
    const tones = wrapper.findAll('[data-testid="time-off-row"] .hf-status-badge').map((badge) => badge.attributes('data-tone'))
    expect(tones).toEqual(['warning', 'success', 'neutral', 'neutral'])
    expect(wrapper.html()).not.toContain('text-success')
  })

  it('keeps Revisar… and Cancelar solicitud in the ⋮ menu, destructive last', async () => {
    q.timeOff.data.value = { data: [request()] }
    const wrapper = mountPanel(AusenciasPanel, props)
    await wrapper.get('[data-testid="time-off-row"] [aria-label^="Acciones de la ausencia"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())
    expect(items).toEqual(['Revisar…', 'Cancelar solicitud'])
  })

  it('shows no ⋮ without update permission', () => {
    q.timeOff.data.value = { data: [request()] }
    const wrapper = mountPanel(AusenciasPanel, { ...props, canUpdate: false })
    expect(wrapper.find('[aria-label^="Acciones de la ausencia"]').exists()).toBe(false)
  })
})

describe('EmergencyContactsPanel states', () => {
  const props = { employee, canCreate: true, canUpdate: true, canDelete: true }
  const contact = (overrides: Partial<EmergencyContact> = {}): EmergencyContact => ({
    id: 'c1',
    employeeId: 'e',
    name: 'María García',
    relationship: 'Esposa',
    phone: '+5215598765432',
    email: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  })

  it('shows a skeleton while loading', () => {
    q.contacts.isLoading.value = true
    expect(mountPanel(EmergencyContactsPanel, props).get('[data-testid="contacts-skeleton"]').attributes('aria-busy')).toBe('true')
  })

  it('shows the error with Reintentar', async () => {
    q.contacts.isError.value = true
    const wrapper = mountPanel(EmergencyContactsPanel, props)
    await wrapper.get('[data-testid="contacts-retry"]').trigger('click')
    expect(q.contacts.refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state', () => {
    expect(mountPanel(EmergencyContactsPanel, props).get('[data-testid="contacts-empty"] .hf-empty-state__title').text()).toBe(
      'Sin contactos de emergencia',
    )
  })

  it('lists contacts with the principal marked in text and the ⋮ menu named after the contact', () => {
    q.contacts.data.value = [contact(), contact({ id: 'c2', name: 'Pedro Ruiz', createdAt: '2026-02-01T00:00:00.000Z' })]
    const wrapper = mountPanel(EmergencyContactsPanel, props)
    const rows = wrapper.findAll('[data-testid="contact-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Esposa · Principal')
    expect(rows[1]!.text()).not.toContain('Principal')
    expect(wrapper.find('[aria-label="Acciones de María García"]').exists()).toBe(true)
  })

  it('shows no ⋮ when the role can neither edit nor delete', () => {
    q.contacts.data.value = [contact()]
    const wrapper = mountPanel(EmergencyContactsPanel, { ...props, canUpdate: false, canDelete: false })
    expect(wrapper.find('[aria-label="Acciones de María García"]').exists()).toBe(false)
  })
})

describe('CvPanel states', () => {
  it('shows the empty state with the upload action when the role can update', () => {
    const wrapper = mountPanel(CvPanel, { employee, canUpdate: true })
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Sin CV registrado')
    expect(empty.get('[data-testid="cv-upload"]').text()).toContain('Subir CV')
  })

  it('drops the upload action for a read-only role', () => {
    const wrapper = mountPanel(CvPanel, { employee, canUpdate: false })
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Sin CV registrado')
    expect(wrapper.find('[data-testid="cv-upload"]').exists()).toBe(false)
  })

  it('shows Descargar and Reemplazar when a CV exists', () => {
    const wrapper = mountPanel(CvPanel, { employee: makeEmployee({ cvFileId: 'cv-1' }), canUpdate: true })
    expect(wrapper.text()).toContain('Descargar')
    expect(wrapper.text()).toContain('Reemplazar')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})
