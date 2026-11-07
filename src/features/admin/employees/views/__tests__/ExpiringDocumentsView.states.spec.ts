/**
 * ExpiringDocumentsView — the four S10 states against the REAL AppDataTable.
 *
 * `useExpiringDocuments` runs for real on top of a mocked `useServerTable`, so
 * the rows go through the same mapping the screen uses; only the data source,
 * the viewport breakpoint and the toolbar/pagination chrome are replaced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import ExpiringDocumentsView from '../ExpiringDocumentsView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  tableState,
} from '../../__tests__/helpers/employeesServerTable'

vi.mock('@/core/shared/composables/useServerTable', async () =>
  (await import('../../__tests__/helpers/employeesServerTable')).serverTableModule,
)
vi.mock('@vueuse/core', async (importOriginal) =>
  (await import('../../__tests__/helpers/employeesServerTable')).withBreakpointMock(
    await importOriginal<object>(),
  ),
)

const authMock = { userCan: vi.fn(() => true), currentTenantId: 'tenant-1' }
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useQuery: () => ({ data: ref([]), isLoading: ref(false) }),
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock('../../api/employees.api', () => ({
  employeesApi: { getExpiringDocumentsPaginated: vi.fn() },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {}, name: 'admin-expiring-documents' }),
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>' },
}))

const DAY = 86_400_000
const todayStart = () => Date.now() - (Date.now() % DAY)
const inDays = (days: number) => new Date(todayStart() + days * DAY).toISOString()

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-uuid-1',
    employeeId: 'emp-uuid-1',
    fileId: 'file-uuid-1',
    category: 'CONTRACT',
    notes: 'Contrato 2026',
    expiresAt: inDays(5),
    createdAt: '2026-01-15T10:00:00.000Z',
    fullName: 'Ana García',
    employeeNumber: 'EMP-001',
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []
function mountView() {
  const wrapper = mount(ExpiringDocumentsView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar"><slot name="filters" /></div>' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
      },
    },
  })
  mounted.push(wrapper)
  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
})

beforeEach(() => {
  resetTableState()
})

describe('ExpiringDocumentsView states — empty', () => {
  it('says nothing is about to expire, names the window and offers no create action', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Sin documentos por vencer')
    expect(empty.get('.hf-empty-state__description').text()).toContain('30 días')
    expect(empty.find('button').exists()).toBe(false)
  })

  it('follows the selected window in the empty copy', async () => {
    const wrapper = mountView()
    wrapper.getComponent({ name: 'ToolbarSelectFilter' }).vm.$emit('update:modelValue', '90')
    await flushPromises()
    expect(wrapper.get('.hf-empty-state__description').text()).toContain('90 días')
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

  it('renders the empty state in cards mode on mobile', () => {
    isBelowBreakpoint.value = true
    expect(mountView().get('[data-testid="mobile-empty-state"]').attributes('data-kind')).toBe('empty')
  })
})

describe('ExpiringDocumentsView states — loading', () => {
  it('renders the table skeleton on desktop', () => {
    tableState.isLoading.value = true
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('renders the card skeletons on mobile', () => {
    isBelowBreakpoint.value = true
    tableState.isLoading.value = true
    expect(mountView().findAll('[data-testid="mobile-card-skeleton"]')).toHaveLength(3)
  })
})

describe('ExpiringDocumentsView states — data', () => {
  it('puts the document first, then the time left as a badge, then who and when', () => {
    tableState.data.value = [
      makeItem(),
      makeItem({ id: 'd2', notes: null, category: 'MEDICAL', expiresAt: inDays(20), fullName: 'Beto Ruiz' }),
      makeItem({ id: 'd3', notes: 'Certificado', category: 'CERTIFICATE', expiresAt: inDays(60) }),
      makeItem({ id: 'd4', notes: 'Vencido ya', expiresAt: inDays(-3) }),
    ]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('Contrato 2026')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('Contrato')
    expect(rows[0]!.text()).toContain('Ana García')
    const badges = rows.map((row) => row.get('.hf-status-badge'))
    expect(badges.map((badge) => badge.text())).toEqual(['5 días', '20 días', '60 días', 'Vencido hace 3 días'])
    expect(badges.map((badge) => badge.attributes('data-tone'))).toEqual(['warning', 'warning', 'neutral', 'danger'])
    expect(badges.map((badge) => badge.attributes('data-urgent'))).toEqual(['true', undefined, undefined, 'true'])
    expect(wrapper.text()).not.toContain('doc-uuid-1')
    expect(wrapper.text()).not.toContain('emp-uuid-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('shows an expired document as danger and urgent, never as warning', () => {
    tableState.data.value = [makeItem({ expiresAt: inDays(-3) })]
    const badge = mountView().get('tbody tr .hf-status-badge')
    expect(badge.text()).toBe('Vencido hace 3 días')
    expect(badge.attributes('data-tone')).toBe('danger')
    expect(badge.attributes('data-urgent')).toBe('true')
  })

  it('shows the expiry date without the current year', () => {
    const year = new Date().getFullYear()
    tableState.data.value = [makeItem({ expiresAt: `${year}-06-05T00:00:00.000Z` })]
    const expiry = mountView().findAll('tbody tr td')[3]!.text()
    expect(expiry).toBe('5 jun')
  })

  it('has no per-row actions: it only reads, so there is no ⋮ column or clickable row', () => {
    tableState.data.value = [makeItem()]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label^="Acciones"]').exists()).toBe(false)
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
  })

  it('renders one card per row on mobile with the badge and the date', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeItem()]
    const card = mountView().get('[data-testid="expiring-document-card"]')
    expect(card.get('[data-testid="admin-card-name"]').text()).toBe('Contrato 2026')
    expect(card.text()).toContain('Ana García')
    expect(card.get('.hf-status-badge').text()).toBe('5 días')
    expect(card.find('[aria-label^="Acciones"]').exists()).toBe(false)
  })

  it('measures an expired document on the mobile card too', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeItem({ expiresAt: inDays(-142) })]
    const card = mountView().get('[data-testid="expiring-document-card"]')
    expect(card.get('.hf-status-badge').text()).toBe('Vencido hace 142 días')
  })

  it('keeps the sortable headers and the document anchor column', async () => {
    tableState.data.value = [makeItem()]
    const wrapper = mountView()
    // SortableHeader registers with the table once mounted; let the headers re-render.
    await flushPromises()
    const headers = wrapper.findAll('thead th').map((th) => th.text())
    expect(headers).toEqual(['Documento', 'Tiempo restante', 'Colaborador', 'Fecha de vencimiento', 'Categoría'])
    // The header target sorts on activation when it carries no ⋯ menu popup (DataTableHeaderCell).
    const sortable = wrapper
      .findAll('thead th [data-hf-header]:not([aria-haspopup])')
      .map((target) => target.attributes('data-column-id'))
    expect(sortable).toEqual(['restante', 'colaborador', 'vencimiento', 'categoria'])
  })
})

describe('ExpiringDocumentsView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: ['Falla del servidor', 'otra'] } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar los documentos')
    expect(error.text()).not.toContain('Falla del servidor')
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the same human title with an error.message or no detail', () => {
    tableState.isError.value = true
    tableState.error.value = { message: 'Network Error' }
    const withMessage = mountView().get('[data-testid="table-error-state"]').text()
    expect(withMessage).toContain('No se pudieron cargar los documentos')
    expect(withMessage).not.toContain('Network Error')
    tableState.error.value = {}
    expect(mountView().get('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los documentos',
    )
  })
})

describe('ExpiringDocumentsView states — chrome', () => {
  it('shows the title outside the table surface, no subtitle, and the window as a named select', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Documentos por vencer')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    const select = wrapper.getComponent({ name: 'ToolbarSelectFilter' })
    expect(select.props('label')).toBe('Vencimiento')
    expect(select.props('modelValue')).toBe('30')
    expect(select.props('items')).toEqual([
      { label: '30 días', value: '30' },
      { label: '60 días', value: '60' },
      { label: '90 días', value: '90' },
    ])
  })
})

describe('ExpiringDocumentsView states — table wiring', () => {
  type ColumnLike = { id: string; enableHiding: boolean; enableSorting: boolean }
  const tableProps = () =>
    mountView().getComponent({ name: 'AppDataTable' }).props() as {
      columns: ColumnLike[]
      enableColumnVisibility: boolean
      showToolbar: boolean
    }

  it('enables column visibility and the toolbar, keeping the document column as the anchor', () => {
    const props = tableProps()
    expect(props.enableColumnVisibility).toBe(true)
    expect(props.showToolbar).toBe(true)
    expect(props.columns.map((column) => column.id)).toEqual([
      'documento',
      'restante',
      'colaborador',
      'vencimiento',
      'categoria',
    ])
    expect(props.columns.find((column) => column.id === 'documento')).toMatchObject({ enableHiding: false, enableSorting: false })
    expect(props.columns.filter((column) => column.enableHiding)).toHaveLength(4)
    expect(props.columns.filter((column) => column.enableSorting)).toHaveLength(4)
  })

  it('searches through the toolbar value and never runs a client-side name lookup', async () => {
    tableState.globalFilter.value = 'ana'
    tableState.data.value = [makeItem()]
    const wrapper = mountView()
    expect(wrapper.getComponent({ name: 'AppDataTable' }).props('globalFilter')).toBe('ana')
    expect(wrapper.get('tbody tr').text()).toContain('Ana García')
  })
})
