/**
 * AdminPaymentMethodsView — the four S10 states against the REAL AppDataTable.
 *
 * Only the data source (`useServerTable`), the auth store, vue-query, the
 * overlays and the toolbar/pagination chrome are replaced: empty, loading, data
 * and error (plus no-match) are asserted through what the shared table renders.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref } from 'vue'
import AdminPaymentMethodsView from '../AdminPaymentMethodsView.vue'
import {
  isBelowBreakpoint,
  resetTableState,
  serverTableConfig,
  tableState,
} from '@/features/admin/__tests__/helpers/serverTableMock'
import { expectLayoutBound } from '@/features/admin/__tests__/helpers/layoutBinding'
import type { PaymentMethodTableRow } from '../../interfaces/payment-method.types'

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

function makeRow(overrides: Partial<PaymentMethodTableRow> = {}): PaymentMethodTableRow {
  return {
    id: 'pm-1',
    tenantId: 'tenant-1',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link de pago',
    isActive: true,
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-05-15T10:00:00.000Z',
    ...overrides,
  }
}

const mounted: Array<ReturnType<typeof mount>> = []

function mountView() {
  const wrapper = mount(AdminPaymentMethodsView, {
    attachTo: document.body,
    global: {
      stubs: {
        DataTableToolbar: { template: '<div data-testid="toolbar" />' },
        DataTablePagination: { template: '<div data-testid="pagination" />' },
        PaymentMethodUpsertSlideover: true,
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

describe('AdminPaymentMethodsView states — empty', () => {
  it('shows "Aún no hay métodos de cobro" with the create action when allowed', () => {
    const wrapper = mountView()
    const empty = wrapper.get('.hf-empty-state')
    expect(empty.attributes('data-kind')).toBe('empty')
    expect(empty.get('.hf-empty-state__title').text()).toBe('Aún no hay métodos de cobro')
    expect(empty.get('button').text()).toContain('Crear método')
  })

  it('opens the create form from the empty action', async () => {
    const wrapper = mountView()
    await wrapper.get('.hf-empty-state button').trigger('click')
    const create = wrapper
      .findAllComponents({ name: 'PaymentMethodUpsertSlideover' })
      .find((slideover) => slideover.props('mode') === 'create')
    expect(create?.props('open')).toBe(true)
  })

  it('drops the create action without permission', () => {
    allow('update')
    const wrapper = mountView()
    expect(wrapper.get('.hf-empty-state__title').text()).toBe('Aún no hay métodos de cobro')
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

describe('AdminPaymentMethodsView states — loading', () => {
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

describe('AdminPaymentMethodsView states — data', () => {
  it('renders rows with the name and subtitle, a StatusBadge, the category and the ⋮ menu', () => {
    tableState.data.value = [makeRow(), makeRow({ id: 'pm-2', name: 'SPEI', subtitle: null, category: 'cash', isActive: false })]
    const wrapper = mountView()
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('.hf-row-primary').text()).toBe('Mercado Pago')
    expect(rows[0]!.get('.hf-row-secondary').text()).toBe('Link de pago')
    expect(rows[1]!.find('.hf-row-secondary').exists()).toBe(false)
    const badges = rows.map((row) => row.get('.hf-status-badge'))
    expect(badges.map((badge) => badge.text())).toEqual(['Activo', 'Inactivo'])
    expect(badges.map((badge) => badge.attributes('data-tone'))).toEqual(['success', 'neutral'])
    expect(rows[0]!.text()).toContain('Transferencia')
    expect(rows[1]!.text()).toContain('Efectivo')
    expect(wrapper.findAll('[aria-label="Acciones de Mercado Pago"]')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('pm-1')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(wrapper.find('[data-testid="table-skeleton"]').exists()).toBe(false)
  })

  it('does not render a "no active methods" banner even when every row is inactive', () => {
    tableState.data.value = [makeRow({ isActive: false })]
    const wrapper = mountView()
    expect(wrapper.find('[data-testid="no-active-methods-banner"]').exists()).toBe(false)
  })

  it('renders one card per row on mobile, with the badge and the same ⋮ menu', () => {
    isBelowBreakpoint.value = true
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    const card = wrapper.get('[data-testid="payment-method-card"]')
    expect(card.find('[aria-label="Acciones de Mercado Pago"]').exists()).toBe(true)
    expect(card.get('.hf-status-badge').text()).toBe('Activo')
    expect(card.text()).toContain('Transferencia')
  })

  it('opens the edit slideover on a row click and not from the ⋮ menu', async () => {
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    const edit = () =>
      wrapper
        .findAllComponents({ name: 'PaymentMethodUpsertSlideover' })
        .find((slideover) => slideover.props('mode') === 'edit')!
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
    await wrapper.get('[aria-label="Acciones de Mercado Pago"]').trigger('click')
    expect(edit().props('open')).toBe(false)
    await wrapper.get('tbody tr').trigger('click')
    expect(edit().props('open')).toBe(true)
    expect(edit().props('paymentMethod')).toMatchObject({ id: 'pm-1' })
  })

  it('makes rows non-clickable without update permission', () => {
    allow('delete')
    tableState.data.value = [makeRow()]
    const wrapper = mountView()
    expect(wrapper.get('tbody tr').classes()).not.toContain('hf-clickable-row')
  })
})

describe('AdminPaymentMethodsView states — row menu', () => {
  const openMenu = async (wrapper: ReturnType<typeof mountView>) => {
    await wrapper.get('[aria-label="Acciones de Mercado Pago"]').trigger('click')
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
    expect(wrapper.find('[aria-label="Acciones de Mercado Pago"]').exists()).toBe(false)
    expect(wrapper.get('tbody tr').classes()).toContain('hf-clickable-row')
  })
})

describe('AdminPaymentMethodsView states — error', () => {
  it('renders the table error state with a human title, never the backend message, and Reintentar that refetches', async () => {
    tableState.isError.value = true
    tableState.error.value = { response: { data: { message: 'Falla de red' } } }
    const wrapper = mountView()
    const error = wrapper.get('[data-testid="table-error-state"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudieron cargar los métodos de cobro')
    expect(error.text()).not.toContain('Falla de red')
    expect(wrapper.find('.hf-empty-state[data-kind="empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    expect(tableState.refresh).toHaveBeenCalledTimes(1)
  })

  it('keeps the human title when nothing else is available', () => {
    tableState.isError.value = true
    tableState.error.value = null
    const wrapper = mountView()
    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain(
      'No se pudieron cargar los métodos de cobro',
    )
  })
})

describe('AdminPaymentMethodsView states — page header', () => {
  it('shows the title outside the table surface and no subtitle', () => {
    const wrapper = mountView()
    expect(wrapper.get('.hf-page-title').text()).toBe('Métodos de cobro')
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.find('.hf-table-surface .hf-page-title').exists()).toBe(false)
  })
})

describe('AdminPaymentMethodsView — premium table layout', () => {
  it('persists the layout under a stable key and binds it to the table', async () => {
    const wrapper = mountView()
    const config = serverTableConfig.mock.lastCall![0] as { persistKey: string }
    expect(config.persistKey).toBe('admin-payment-methods')
    await expectLayoutBound(wrapper, { ...tableState, reset: tableState.resetLayout })
  })
})
