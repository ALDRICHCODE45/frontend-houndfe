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
import type {
  CatalogSettingsDraft,
  CatalogSettingsResponseDto,
} from '../../interfaces/catalog-settings.types'

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


// ── WU3B mocks: permissions, editable form, candidates, mutation, toast ──────

const permissionCodes = ref(new Set<string>())

const authMock = {
  userCan: (action: string, subject: string) => permissionCodes.value.has(`${action}:${subject}`),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

const formMock = {
  draft: ref<CatalogSettingsDraft | null>(null),
  accepted: ref<CatalogSettingsResponseDto | null>(null),
  isDirty: ref(false),
  validationErrors: ref<string[]>([]),
  isRisingEdge: ref(false),
  canSave: ref(false),
  confirmationOpen: ref(false),
  requestSave: vi.fn(),
  confirmPublish: vi.fn(),
  cancelPublish: vi.fn(),
  buildSaveBody: vi.fn(),
  acceptPatch: vi.fn(),
  beginMutation: vi.fn(),
  endMutation: vi.fn(),
}

vi.mock('../../composables/useCatalogSettingsForm', () => ({
  useCatalogSettingsForm: () => formMock,
}))

const candidatesMock = {
  candidates: ref<Array<{ id: string; name: string }>>([]),
  isLoading: ref(false),
  isError: ref(false),
  refetch: vi.fn().mockResolvedValue({}),
}

vi.mock('../../composables/useCatalogPriceListCandidatesQuery', () => ({
  useCatalogPriceListCandidatesQuery: () => candidatesMock,
}))

const mutateAsyncMock = vi.fn()

vi.mock('../../composables/useUpdateCatalogSettingsMutation', () => ({
  useUpdateCatalogSettingsMutation: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: ref(false),
  }),
}))

vi.mock('../../components/CatalogSettingsForm.vue', () => ({
  default: {
    name: 'CatalogSettingsForm',
    props: [
      'draft',
      'acceptedContexts',
      'candidates',
      'validationErrors',
      'canSave',
      'saving',
      'canEditContexts',
    ],
    emits: ['save'],
    template:
      '<div data-testid="catalog-settings-form" :data-can-edit-contexts="String(canEditContexts)"></div>',
  },
}))

vi.mock('@/core/shared/components/ConfirmModal.vue', () => ({
  default: {
    name: 'ConfirmModal',
    props: ['open', 'title', 'description', 'confirmLabel', 'cancelLabel', 'loading'],
    emits: ['update:open', 'confirm', 'cancel'],
    template:
      '<div v-if="open" data-testid="confirm-modal"><p data-testid="confirm-description">{{ description }}</p><button data-testid="confirm-accept" @click="$emit(\'confirm\')">Confirmar</button><button data-testid="confirm-cancel" @click="$emit(\'cancel\')">Cancelar</button></div>',
  },
}))

const toastMock = { add: vi.fn() }

// useToast is auto-imported from Nuxt UI by the vite plugin — partially mock
// its module (UApp's Toaster also imports injection keys from it).
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useToast: () => toastMock }
})

function grant(...codes: string[]) {
  permissionCodes.value = new Set(codes)
}

function resetMocks() {
  queryMock.settings.value = undefined
  queryMock.isLoading.value = false
  queryMock.isError.value = false
  queryMock.error.value = null
  queryMock.refetch.mockClear()
  tenantIdMock.current = 'tenant-1'
  formMock.draft.value = null
  formMock.accepted.value = null
  formMock.isDirty.value = false
  formMock.validationErrors.value = []
  formMock.canSave.value = false
  formMock.confirmationOpen.value = false
  formMock.requestSave.mockReset()
  formMock.confirmPublish.mockReset()
  formMock.cancelPublish.mockReset()
  formMock.buildSaveBody.mockReset()
  formMock.acceptPatch.mockReset()
  formMock.beginMutation.mockReset()
  formMock.endMutation.mockReset()
  mutateAsyncMock.mockReset()
  toastMock.add.mockReset()
  permissionCodes.value = new Set()
  candidatesMock.refetch.mockClear()
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

// ── WU3B: editable composition, rising-edge confirmation, toasts ─────────────

describe('TenantCatalogSettingsView — editable form gating (REQ-6A / REQ-12)', () => {
  it('renders the editable form when update:TenantCatalogSettings is granted', () => {
    queryMock.settings.value = makeResponse()
    formMock.draft.value = {
      catalogPublished: false,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.find('[data-testid="catalog-settings-form"]').exists()).toBe(true)
  })

  it('disables ONLY context editing when read:GlobalPriceList is missing', () => {
    queryMock.settings.value = makeResponse()
    formMock.draft.value = {
      catalogPublished: false,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const form = wrapper.find('[data-testid="catalog-settings-form"]')
    expect(form.attributes('data-can-edit-contexts')).toBe('false')
  })

  it('keeps context editing enabled with both settings-update and global read', () => {
    queryMock.settings.value = makeResponse()
    formMock.draft.value = {
      catalogPublished: false,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    grant(
      'read:TenantCatalogSettings',
      'update:TenantCatalogSettings',
      'read:GlobalPriceList',
    )
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const form = wrapper.find('[data-testid="catalog-settings-form"]')
    expect(form.attributes('data-can-edit-contexts')).toBe('true')
  })
})
