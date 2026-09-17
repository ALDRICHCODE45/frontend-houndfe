// TenantCatalogSettingsView.spec.ts — STRICT-TDD tests for the WU3A routed
// composition surface (REQ-12, REQ-5).
//
// The view wires useSafeTenantId + useCatalogSettingsQuery and renders:
// loading skeleton → accepted read-only surface via CatalogSettingsReadView,
// GET error with Reintentar. WU3B adds the editable form + toasts.
//
// WU3B refactor: save/notice moved from form to the page-level sticky footer;
// canSave/saving/save emit removed from CatalogSettingsForm; canUpdate removed
// from CatalogSettingsReadView.
//
// U5 refactor: unified large-card shell — one UCard with #header, card body,
// and #footer; footer is no longer viewport-sticky. All data-testid contracts
// and responsive class behavior are preserved.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import TenantCatalogSettingsView from '@/features/system/catalog-settings/views/TenantCatalogSettingsView.vue'
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
    priceContexts: [{ priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true }],
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

// Render the form boundary with semantic sections and controls so parent intent
// handlers are exercised through the DOM rather than component-instance emits.
vi.mock('../../components/CatalogSettingsForm.vue', () => ({
  default: {
    name: 'CatalogSettingsForm',
    props: ['draft', 'acceptedContexts', 'candidates', 'validationErrors', 'canEditContexts'],
    emits: ['toggle-publish', 'add-context', 'remove-context', 'set-default', 'stock-change'],
    template: `
      <div data-testid="catalog-settings-form" :data-can-edit-contexts="String(canEditContexts)">
        <section data-testid="publication-card"></section>
        <section data-testid="contexts-card">
          <button type="button" data-testid="remove-context-pl-a" @click="$emit('remove-context', 'pl_a')">Remove Lista A</button>
          <button type="button" data-testid="remove-context-pl-b" @click="$emit('remove-context', 'pl_b')">Remove Lista B</button>
        </section>
        <section data-testid="stock-card"></section>
      </div>
    `,
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
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings', 'read:GlobalPriceList')
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const form = wrapper.find('[data-testid="catalog-settings-form"]')
    expect(form.attributes('data-can-edit-contexts')).toBe('true')
  })
})

describe('TenantCatalogSettingsView — card shell (U5)', () => {
  beforeEach(() => {
    queryMock.settings.value = makeResponse({ catalogPublished: false })
    formMock.draft.value = {
      catalogPublished: false,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings', 'read:GlobalPriceList')
  })

  // ── Card shell ─────────────────────────────────────────────────────────────

  it('renders one enclosing card root', () => {
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    expect(wrapper.findAll('[data-testid="settings-card"]').length).toBe(1)
  })

  // ── Header is inside the card ─────────────────────────────────────────────

  it('header title and description are descendants of the card', () => {
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')
    expect(card.text()).toContain('Configuración del catálogo online')
    expect(card.text()).toContain('Controla la visibilidad')
  })

  // ── Body states are descendants of the card ──────────────────────────────

  it('loading skeleton is a descendant of the card', () => {
    queryMock.settings.value = undefined
    queryMock.isLoading.value = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')
    // At least one animate-pulse skeleton inside the card body
    expect(card.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('GET error state is a descendant of the card', () => {
    queryMock.settings.value = undefined
    queryMock.isLoading.value = false
    queryMock.isError.value = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')
    expect(card.find('[data-testid="settings-error"]').exists()).toBe(true)
    expect(card.text()).toContain('Reintentar')
  })

  it('keeps all editable sections inside the outer card without nested cards', () => {
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')

    expect(wrapper.findAllComponents({ name: 'Card' })).toHaveLength(1)
    expect(card.find('[data-testid="catalog-settings-form"]').exists()).toBe(true)
    for (const testId of ['publication-card', 'contexts-card', 'stock-card']) {
      expect(card.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  it('keeps all read-only sections inside the outer card without nested cards', () => {
    permissionCodes.value = new Set(['read:TenantCatalogSettings'])
    queryMock.settings.value = makeResponse()
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')

    expect(wrapper.findAllComponents({ name: 'Card' })).toHaveLength(1)
    expect(card.find('[data-testid="catalog-settings-read"]').exists()).toBe(true)
    for (const testId of ['publication-card', 'contexts-card', 'stock-card']) {
      expect(card.find(`[data-testid="${testId}"]`).exists()).toBe(true)
    }
  })

  // ── Footer is inside the card, NOT viewport-sticky ────────────────────────

  it('footer is a descendant of the card', () => {
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')
    expect(card.find('[data-testid="settings-footer"]').exists()).toBe(true)
  })

  it('footer has no sticky or bottom-0 class', () => {
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const footer = wrapper.find('[data-testid="settings-footer"]')
    expect(footer.classes()).not.toContain('sticky')
    expect(footer.classes()).not.toContain('bottom-0')
  })

  it('disables the footer save CTA when the draft cannot save and enables it when it can', () => {
    const cannotSave = mountWithUApp(TenantCatalogSettingsView)
    expect(
      cannotSave.find('[data-testid="footer-save-button"]').attributes('disabled'),
    ).toBeDefined()

    formMock.canSave.value = true
    const canSave = mountWithUApp(TenantCatalogSettingsView)
    expect(
      canSave.find('[data-testid="footer-save-button"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it('read-only notice is a descendant of the card footer when no update permission', () => {
    permissionCodes.value = new Set(['read:TenantCatalogSettings'])
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const card = wrapper.find('[data-testid="settings-card"]')
    expect(card.findAll('[data-testid="readonly-notice"]').length).toBe(1)
    expect(card.findAll('[data-testid="footer-save-button"]').length).toBe(0)
  })

  it('footer responsive class: stacks on mobile, horizontal at sm', () => {
    formMock.canSave.value = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const footer = wrapper.find('[data-testid="settings-footer"]')
    expect(footer.classes()).toContain('flex')
    expect(footer.classes()).toContain('flex-col')
    expect(footer.classes()).toContain('items-stretch')
    expect(footer.classes()).toContain('sm:flex-row')
    expect(footer.classes()).toContain('sm:items-center')
    expect(footer.classes()).toContain('sm:justify-end')
  })

  it('save button is full-width on mobile and auto-width at sm breakpoint', () => {
    formMock.canSave.value = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    const button = wrapper.find('[data-testid="footer-save-button"]')
    expect(button.classes()).toContain('w-full')
    expect(button.classes()).toContain('justify-center')
    expect(button.classes()).toContain('sm:w-auto')
  })
})

describe('TenantCatalogSettingsView — rising-edge confirmation (REQ-10)', () => {
  beforeEach(() => {
    queryMock.settings.value = makeResponse({ catalogPublished: false })
    formMock.draft.value = {
      catalogPublished: false,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings', 'read:GlobalPriceList')
  })

  it('opens the confirm modal and sends NO PATCH before confirmation', async () => {
    formMock.canSave.value = true
    formMock.requestSave.mockReturnValue('confirm')
    formMock.confirmationOpen.value = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    // Trigger the page footer CTA instead of a form emit.
    await wrapper.find('[data-testid="footer-save-button"]').trigger('click')
    await flushPromises()
    expect(formMock.requestSave).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('El catálogo será visible para clientes públicos. ¿Continuar?')
  })

  it('confirms the publish: one whitelisted PATCH, PATCH-response acceptance, success toast', async () => {
    formMock.requestSave.mockReturnValue('confirm')
    formMock.confirmationOpen.value = true
    formMock.buildSaveBody.mockReturnValue({ catalogPublished: true })
    mutateAsyncMock.mockResolvedValue(makeResponse({ catalogPublished: true }))
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await flushPromises()
    await wrapper.find('[data-testid="confirm-accept"]').trigger('click')
    expect(formMock.confirmPublish).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      body: { catalogPublished: true },
    })
    expect(formMock.acceptPatch).toHaveBeenCalledWith(makeResponse({ catalogPublished: true }))
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Configuración de catálogo guardada' }),
    )
  })

  it('cancel closes the modal, sends no PATCH, and keeps the dirty draft editable', async () => {
    formMock.requestSave.mockReturnValue('confirm')
    formMock.confirmationOpen.value = true
    formMock.draft.value!.catalogPublished = true
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await wrapper.find('[data-testid="confirm-cancel"]').trigger('click')
    expect(formMock.cancelPublish).toHaveBeenCalledTimes(1)
    expect(mutateAsyncMock).not.toHaveBeenCalled()
    expect(formMock.draft.value!.catalogPublished).toBe(true)
  })

  it('descending edge saves directly without opening the modal', async () => {
    formMock.canSave.value = true
    formMock.requestSave.mockReturnValue('save')
    formMock.buildSaveBody.mockReturnValue({ catalogPublished: false })
    mutateAsyncMock.mockResolvedValue(makeResponse())
    queryMock.settings.value = makeResponse({ catalogPublished: true })
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await wrapper.find('[data-testid="footer-save-button"]').trigger('click')
    await flushPromises()
    expect(formMock.confirmationOpen.value).toBe(false)
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1)
  })

  it('failure keeps the draft dirty and surfaces the mapped Spanish error toast', async () => {
    formMock.canSave.value = true
    formMock.requestSave.mockReturnValue('save')
    formMock.buildSaveBody.mockReturnValue({ catalogPublished: true })
    mutateAsyncMock.mockRejectedValue({ response: { status: 403 } })
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await wrapper.find('[data-testid="footer-save-button"]').trigger('click')
    await flushPromises()
    expect(formMock.acceptPatch).not.toHaveBeenCalled()
    expect(toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No tienes permisos para guardar cambios' }),
    )
    expect(formMock.endMutation).toHaveBeenCalled()
  })
})

describe('TenantCatalogSettingsView — context removal atomic triple (REQ-9 / WU3B)', () => {
  beforeEach(() => {
    queryMock.settings.value = makeResponse({ catalogPublished: true })
    grant('read:TenantCatalogSettings', 'update:TenantCatalogSettings', 'read:GlobalPriceList')
  })

  it('removing the only context from the form mock clears draft IDs to [], default to null, and publication to false', async () => {
    formMock.draft.value = {
      catalogPublished: true,
      publicPriceListIds: ['pl_a'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await wrapper.find('[data-testid="remove-context-pl-a"]').trigger('click')
    await nextTick()
    // The parent handler removes pl_a from publicPriceListIds, clears the default,
    // and clears publication because no contexts remain.
    expect(formMock.draft.value!.publicPriceListIds).toEqual([])
    expect(formMock.draft.value!.catalogDefaultPriceListId).toBe(null)
    expect(formMock.draft.value!.catalogPublished).toBe(false)
  })

  it('removing a non-default context only removes it from IDs without clearing default', async () => {
    formMock.draft.value = {
      catalogPublished: true,
      publicPriceListIds: ['pl_a', 'pl_b'],
      catalogDefaultPriceListId: 'pl_a',
      stockPresentationDefault: { mode: 'SYSTEM_STATUS', customQuantity: null },
    }
    const wrapper = mountWithUApp(TenantCatalogSettingsView)
    await wrapper.find('[data-testid="remove-context-pl-b"]').trigger('click')
    await nextTick()
    expect(formMock.draft.value!.publicPriceListIds).toEqual(['pl_a'])
    expect(formMock.draft.value!.catalogDefaultPriceListId).toBe('pl_a')
    expect(formMock.draft.value!.catalogPublished).toBe(true)
  })
})
