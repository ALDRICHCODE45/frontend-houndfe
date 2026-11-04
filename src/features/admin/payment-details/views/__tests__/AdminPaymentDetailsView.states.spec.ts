/**
 * AdminPaymentDetailsView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the
 * overlays and the toolbar/pagination chrome are replaced: empty, loading, data
 * and error (plus no-match) are asserted through what the shared table renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminPaymentDetailsView from '../AdminPaymentDetailsView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  tableState,
} from '@/features/admin/__tests__/helpers/serverTableMock'
import type { PaymentDetailTableRow } from '../../interfaces/payment-detail.types'

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
  userCan: vi.fn((action: string) => grants.has(action)),
  currentTenantId: 'tenant-1',
}
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => authMock }))

vi.mock('@tanstack/vue-query', () => ({
  useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: ref(false) }),
  useQueryClient: () => ({ invalidateQueries: vi.fn(), refetchQueries: vi.fn() }),
}))

Object.assign(globalThis, { useToast: () => ({ add: vi.fn() }) })

function makeRow(overrides: Partial<PaymentDetailTableRow> = {}): PaymentDetailTableRow {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'AFIRME',
    beneficiary: 'Comercializadora Acme SA',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-05-15T10:00:00.000Z',
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(AdminPaymentDetailsView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        PaymentDetailUpsertSlideover: true,
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
  allow('create', 'update', 'delete')
})

describe('AdminPaymentDetailsView states — empty', () => {
  it('shows "Aún no hay cuentas bancarias" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay cuentas bancarias')
    expect(empty.get('button').text()).toContain('Crear cuenta')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'PaymentDetailUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the create action without permission', () => {
    allow('update')
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay cuentas bancarias')
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

describe('AdminPaymentDetailsView states — loading', () => {
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

describe('AdminPaymentDetailsView states — data', () => {
  it('renders rows with the bank and beneficiary, a StatusBadge, the account figures and the ⋮ menu', () => {
    tableState.data.value = [makeRow(), makeRow({ id: 'pd-2', bankName: 'BBVA', isActive: false })]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('AFIRME')
    expect(rows[0]!.find('.hf-row-secondary').exists()).toBe(false)
    const badges = rows.map((row) => row.get('.hf-status-badge'))
    expect(badges.map((badge) => badge.text())).toEqual(['Activa', 'Inactiva'])
    expect(badges.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'neutral'])
    expect(rows[0]!.findAll('.hf-figure').map((cell) => cell.text())).toEqual([
      '012180001234567890',
      '1234567890',
    ])
    expect(wrapper.findAll('[aria-label="Acciones de AFIRME"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('pd-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the badge and the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="payment-detail-card"]')
    expect(card.find('[aria-label="Acciones de AFIRME"]').exists()).toBe(true)
    expect(card.get('.hf-status-badge').text()).toBe('Activa')
  })

  it('labels the CLABE on the mobile card and masks all but its last four digits', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeRow()]
    const footer = mountView().get('[data-testid="payment-detail-card"] .admin-card-footer')
    expect(footer.text()).toContain('CLABE ···· 7890')
    expect(footer.text()).not.toContain('012180001234567890')
  })

  it('shows the legal name once when every account shares it, and per account when they differ', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeRow(), makeRow({ id: 'pd-2', bankName: 'BBVA' })]
    const same = mountView()
    expect(same.findAll('[data-testid="payment-detail-card"] .hf-row-secondary')).toHaveLength(0)
    expect(same.text()).not.toContain('Comercializadora Acme SA')
    tableState.data.value = [makeRow(), makeRow({ id: 'pd-2', bankName: 'BBVA', beneficiary: 'Otra Razón SA' })]
    const differ = mountView()
    expect(
      differ.findAll('[data-testid="payment-detail-card"] .hf-row-secondary').map((el) => el.text()),
    ).toEqual(['Comercializadora Acme SA', 'Otra Razón SA'])
  })

  it('opens the edit slideover on a row click and not from the ⋮ menu', async () => {
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    const edit = () =>
      wrapper
        .findAllComponents({ name: 'PaymentDetailUpsertSlideover' })
        .find((slideover) => slideover.props('mode') === 'edit')!
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('[aria-label="Acciones de AFIRME"]').trigger('click')
    expect(edit().props('open')).toBe(false)
    await wrapper.get('tbody tr').trigger('click')
    expect(edit().props('open')).toBe(true)
    expect(edit().props('paymentDetail')).toMatchObject({ id: 'pd-1' })
  })

  it('makes rows non-clickable without update permission', () => {
    allow('delete')
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
  })
})

describe('AdminPaymentDetailsView states — row menu', () => {
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get('[aria-label="Acciones de AFIRME"]').trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent?.trim())
  }

  it('lists Editar and Desactivar… last when both are allowed', async () => {
    tableState.data.value = [makeRow()]
    expect(await openMenu(mountView())).toEqual(['Editar', 'Desactivar…'])
  })

  it('lists only Desactivar… when update is denied', async () => {
    allow('delete')
    tableState.data.value = [makeRow()]
    expect(await openMenu(mountView())).toEqual(['Desactivar…'])
  })

  it('shows no ⋮ when update is the only permission (it would only repeat the row click)', () => {
    allow('update')
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    expect(wrapper.find('[aria-label="Acciones de AFIRME"]').exists()).toBe(false)
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })
})

describe('AdminPaymentDetailsView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: 'No se pudo conectar al servidor' } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar las cuentas bancarias')
    expect(error.text()).not.toContain('No se pudo conectar al servidor')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('does not show the "Sin cuenta activa" notice while the list failed to load', () => {
    tableState.isError.value = true
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="no-active-account-banner"]').exists()).toBe(false)
  })
})

describe('AdminPaymentDetailsView states — page header', () => {
  it('shows the title outside the table surface and no subtitle', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Datos bancarios')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })
})
