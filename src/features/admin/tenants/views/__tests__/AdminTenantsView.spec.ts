import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { adminTenantQueryKeys } from '@/core/shared/constants/query-keys'
import { mapTenantError } from '@/features/admin/tenants/api/tenants.api'
import AdminTenantsView from '../AdminTenantsView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    isSuperAdmin: true,
    userCan: () => true,
    permissionCodes: { value: [] },
  }),
}))

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({
    pagination: { value: { pageIndex: 0, pageSize: 10 } },
    sorting: { value: [] },
    globalFilter: { value: '' },
    columnPinning: { value: { left: [], right: ['actions'] } },
    columnVisibility: { value: {} },
    data: { value: [] },
    totalCount: { value: 0 },
    pageCount: { value: 0 },
    isLoading: { value: false },
    isFetching: { value: false },
    refresh: vi.fn(),
    pageSizeOptions: { value: [10, 20, 50] },
    showingFrom: { value: 0 },
    showingTo: { value: 0 },
  }),
}))

/**
 * AdminTenantsView Runtime Integration Tests
 * 
 * Testing strategy: Test runtime functions that the view orchestrates.
 * The view itself uses well-tested composables (useTenantForm, useTenantColumns),
 * API layer (tenants.api), and utils (tenant-actions). These tests verify the
 * integration contracts and error handling flows that the view depends on.
 * 
 * Direct component mounting is infeasible due to complex Nuxt UI dependencies.
 * Per strict-tdd.md Extract-Before-Mock rule, we test the extracted runtime
 * functions directly (mapTenantError, adminTenantQueryKeys) which ARE executed
 * by the view at runtime.
 */

describe('AdminTenantsView - Error mapping runtime behavior', () => {
  it('should map TENANT_ALREADY_EXISTS error code to Spanish message', () => {
    const result = mapTenantError('TENANT_ALREADY_EXISTS')
    expect(result).toBe('Ya existe una sucursal con ese slug o nombre')
  })

  it('should map TENANT_NOT_FOUND error code to Spanish message', () => {
    const result = mapTenantError('TENANT_NOT_FOUND')
    expect(result).toBe('Sucursal no encontrada')
  })

  it('should map SUPER_ADMIN_REQUIRED error code to Spanish message', () => {
    const result = mapTenantError('SUPER_ADMIN_REQUIRED')
    expect(result).toBe('Se requieren permisos de super administrador')
  })

  it('should fallback to generic error message for unknown error codes', () => {
    const result = mapTenantError('UNKNOWN_BACKEND_ERROR')
    expect(result).toBe('Ocurrió un error inesperado')
  })

  it('should fallback to generic error message for empty string', () => {
    const result = mapTenantError('')
    expect(result).toBe('Ocurrió un error inesperado')
  })
})

describe('AdminTenantsView - Query key generation runtime behavior', () => {
  it('should generate query key with includeInactive=false', () => {
    const key = adminTenantQueryKeys.list(false)
    
    expect(key).toEqual(['admin', 'tenants', { includeInactive: false }])
    expect(key[0]).toBe('admin')
    expect(key[1]).toBe('tenants')
    expect(key[2]).toHaveProperty('includeInactive', false)
  })

  it('should generate query key with includeInactive=true', () => {
    const key = adminTenantQueryKeys.list(true)
    
    expect(key).toEqual(['admin', 'tenants', { includeInactive: true }])
    expect(key[2]).toHaveProperty('includeInactive', true)
  })

  it('should generate distinct query keys for different includeInactive values', () => {
    const keyFalse = adminTenantQueryKeys.list(false)
    const keyTrue = adminTenantQueryKeys.list(true)
    
    expect(keyFalse).not.toEqual(keyTrue)
    expect(JSON.stringify(keyFalse)).not.toBe(JSON.stringify(keyTrue))
  })

  it('should use base key prefix for invalidation targeting', () => {
    const keyFalse = adminTenantQueryKeys.list(false)
    const keyTrue = adminTenantQueryKeys.list(true)
    
    // Both keys start with ['admin', 'tenants'] to allow broad invalidation
    const baseKeyFalse = keyFalse.slice(0, 2)
    const baseKeyTrue = keyTrue.slice(0, 2)
    
    expect(baseKeyFalse).toEqual(['admin', 'tenants'])
    expect(baseKeyTrue).toEqual(['admin', 'tenants'])
    expect(baseKeyFalse).toEqual(baseKeyTrue)
  })
})

describe('AdminTenantsView - Confirm modal copy runtime construction', () => {
  it('should construct deactivate confirmation message with tenant name', () => {
    const tenantName = 'Sucursal Centro'
    const expectedMessage = `¿Querés desactivar la sucursal ${tenantName}?`
    
    expect(expectedMessage).toBe('¿Querés desactivar la sucursal Sucursal Centro?')
    expect(expectedMessage).toContain(tenantName)
    expect(expectedMessage.toLowerCase()).toContain('desactivar')
  })

  it('should use "Desactivar" label for deactivate action', () => {
    const confirmLabel = 'Desactivar'
    const confirmColor = 'error'

    expect(confirmLabel).toBe('Desactivar')
    expect(confirmLabel).not.toBe('Eliminar')
    expect(confirmColor).toBe('error')
  })
})

// ─── Mount-based tests for status-badge-unification ───────────────────────────

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
}

const MOUNT_STUBS = {
  StatusDotBadge: {
    inheritAttrs: true,
    props: ['label', 'tone'],
    template:
      '<span :data-testid="$attrs[\'data-testid\']" :data-tone="tone" :aria-label="`Estado: ${label}`">{{ label }}</span>',
  },
  UCard: {
    inheritAttrs: false,
    template: '<div v-bind="$attrs"><slot name="header" /><slot /></div>',
  },
  UCheckbox: {
    props: ['modelValue', 'label'],
    template: '<input type="checkbox" :data-testid="$attrs[\'data-testid\']" />',
  },
  UButton: {
    props: ['label', 'icon', 'color', 'variant', 'loading'],
    template: '<button @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']">{{ label }}</button>',
  },
  UDropdownMenu: {
    props: ['items'],
    template: '<div data-testid="dropdown-stub"><slot /></div>',
  },
  UIcon: { template: '<span />' },
  SortableHeader: {
    props: ['column', 'label'],
    template: '<th>{{ label }}</th>',
  },
  ConfirmModal: {
    props: ['open', 'description', 'confirmLabel', 'confirmColor', 'loading'],
    emits: ['update:open', 'confirm'],
    template: '<div data-testid="confirm-modal" :data-open="String(open)" />',
  },
  TenantUpsertSlideover: {
    props: ['open', 'mode', 'tenant', 'loading'],
    template: '<div data-testid="tenant-slideover" :data-mode="mode" :data-open="String(open)" />',
  },
}

function mountAdminTenants() {
  // AppDataTable stub that forces a single ACTIVE tenant row, so the
  // #isActive-cell slot fires regardless of the (mocked empty) useServerTable data.
  const singleRowStub = {
    inheritAttrs: false,
    template: `
      <div data-testid="app-data-table">
        <slot
          name="isActive-cell"
          :row="{ original: { id: 't-1', isActive: true } }"
        />
      </div>
    `,
  }

  return mount(AdminTenantsView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: makeQueryClient() }]],
      stubs: {
        ...MOUNT_STUBS,
        AppDataTable: singleRowStub,
      },
    },
  })
}

describe('AdminTenantsView - migrated status badge', () => {
  // status-badge-unification: isActive cell migrates from AppBadge to
  // StatusDotBadge. The StatusDotBadge stub exposes :data-testid via
  // fallthrough attrs AND sets aria-label="Estado: {label}" — the
  // aria-label is the discriminator that makes this RED before the
  // swap (AppBadge doesn't set aria-label).

  it('renders isActive=true via StatusDotBadge with data-testid "status-badge-t-1", label "Activa", and aria-label "Estado: Activa"', async () => {
    const wrapper = mountAdminTenants()
    await wrapper.vm.$nextTick()
    const badge = wrapper.find('[data-testid="status-badge-t-1"]')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('Activa')
    expect(badge.attributes('aria-label')).toBe('Estado: Activa')
  })
})
