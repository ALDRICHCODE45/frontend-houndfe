// TenantCatalogSettingsView.spec.ts — STRICT-TDD tests for the WU3A routed
// composition surface (REQ-12, REQ-5).
//
// The view wires useSafeTenantId + useCatalogSettingsQuery and renders:
// loading skeleton → accepted read-only surface via CatalogSettingsReadView,
// GET error with Reintentar. WU3B later adds the editable form + toasts.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import TenantCatalogSettingsView from '../TenantCatalogSettingsView.vue'
import type { CatalogSettingsResponseDto } from '../../interfaces/catalog-settings.types'

// ── Mock the WU2C query composable at the boundary ───────────────────────────

const queryMock = {
  settings: ref<CatalogSettingsResponseDto | undefined>(undefined),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn().mockResolvedValue({}),
}

vi.mock('../../composables/useCatalogSettingsQuery', () => ({
  useCatalogSettingsQuery: () => queryMock,
}))

const tenantIdMock = { current: 'tenant-1' }

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => ({
    value: tenantIdMock.current,
  }),
}))

function makeResponse(
  overrides: Partial<CatalogSettingsResponseDto> = {},
): CatalogSettingsResponseDto {
  return {
    catalogPublished: true,
    effectivePublication: true,
    priceContexts: [
      { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
    ],
    stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    warnings: [],
    updatedAt: '2026-02-14T10:00:00.000Z',
    ...overrides,
  }
}

function resetMocks() {
  queryMock.settings.value = undefined
  queryMock.isLoading.value = false
  queryMock.isError.value = false
  queryMock.error.value = null
  queryMock.refetch.mockClear()
  tenantIdMock.current = 'tenant-1'
}

beforeEach(resetMocks)

describe('TenantCatalogSettingsView — loading state (REQ-12)', () => {
  it('renders USkeleton placeholders while the query is loading', () => {
    queryMock.isLoading.value = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    // No read surface while loading.
    expect(wrapper.find('[data-testid="catalog-settings-read"]').exists()).toBe(false)
  })
})

describe('TenantCatalogSettingsView — accepted read-only surface (REQ-5)', () => {
  it('renders CatalogSettingsReadView with the accepted response', () => {
    queryMock.settings.value = makeResponse()
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="catalog-settings-read"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Lista A')
  })

  it('does not render an editable form in WU3A', () => {
    queryMock.settings.value = makeResponse()
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="catalog-settings-form"]').exists()).toBe(false)
  })
})

describe('TenantCatalogSettingsView — GET error + retry (REQ-12)', () => {
  it('renders an error state with Reintentar and no synthetic defaults', () => {
    queryMock.isError.value = true
    queryMock.error.value = new Error('404')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="settings-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Reintentar')
    expect(wrapper.find('[data-testid="catalog-settings-read"]').exists()).toBe(false)
  })

  it('re-runs the query when Reintentar is clicked', async () => {
    queryMock.isError.value = true
    queryMock.error.value = new Error('boom')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await wrapper.find('[data-testid="retry-button"]').trigger('click')
    await nextTick()
    expect(queryMock.refetch).toHaveBeenCalledTimes(1)
  })

  it('does not auto-fire a toast on error render', () => {
    queryMock.isError.value = true
    queryMock.error.value = new Error('boom')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="error-toast"]').exists()).toBe(false)
  })
})

describe('TenantCatalogSettingsView — query wiring (WU2C contract)', () => {
  it('keeps the read surface absent while settings are undefined but not loading', () => {
    queryMock.settings.value = undefined
    queryMock.isLoading.value = false
    queryMock.isError.value = false
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="catalog-settings-read"]').exists()).toBe(false)
  })
})
