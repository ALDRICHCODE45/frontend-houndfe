// NotificationConfigView.spec.ts — STRICT-TDD tests for the view.
//
// The view is a composition surface: it owns the composables, passes their
// reactive state into the three cards (master / recipients / actions),
// and renders a Save button. We test the integration between the
// composables and the rendered components using mocks for the heavy
// composables (the form composable has its own pure-helper tests; we
// mount the real one with deps mocked at the boundary).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive, ref, watchEffect } from 'vue'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mountWithUApp } from '@/test/mountWithUApp'
import NotificationConfigView from '../NotificationConfigView.vue'
import { ACTION_REGISTRY } from '../../registry/action-registry'
import type {
  NotificationConfigForm,
  NotificationConfigResponse,
} from '../../interfaces/notification-config.types'

// ── Mock the composable surface ──────────────────────────────────────────────

const queryMockState = {
  data: ref<NotificationConfigForm | undefined>(undefined),
  isLoading: ref(false),
  isPending: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}

const assignableMockState = {
  users: ref<{ id: string; name: string }[]>([]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refetch: vi.fn(),
}

// Form composable state — mirrors the real composable's return shape.
// The mock factory accepts the source ref and reactively mirrors its value
// into the form snapshot (mirroring the real composable's
// watch(source, hydrate, { immediate: true }) behavior).
function makeFormMockState() {
  const form = reactive<NotificationConfigForm>({
    enabled: false,
    recipientUserIds: [],
    enabledActions: [],
  })
  const pristine = reactive<NotificationConfigForm>({
    enabled: false,
    recipientUserIds: [],
    enabledActions: [],
  })
  const isDirty = ref(false)
  const canSave = ref(false)
  const isPending = ref(false)
  const canUpdate = ref(true)
  const zeroRecipientViolation = ref(false)
  const fieldErrors = reactive<{ recipients: string | null }>({ recipients: null })
  const save = vi.fn().mockResolvedValue(undefined)
  const hydrate = vi.fn((response: NotificationConfigForm) => {
    Object.assign(form, {
      enabled: response.enabled,
      recipientUserIds: [...response.recipientUserIds],
      enabledActions: [...response.enabledActions],
    })
    Object.assign(pristine, {
      enabled: response.enabled,
      recipientUserIds: [...response.recipientUserIds],
      enabledActions: [...response.enabledActions],
    })
  })

  return {
    form,
    pristine,
    isDirty,
    canSave,
    isPending,
    canUpdate,
    zeroRecipientViolation,
    fieldErrors,
    save,
    hydrate,
  }
}

let currentFormMock: ReturnType<typeof makeFormMockState> = makeFormMockState()

vi.mock('../../composables/useNotificationConfigQuery', () => ({
  useNotificationConfigQuery: () => queryMockState,
  useAssignableUsersQuery: () => assignableMockState,
}))

const authMock = {
  currentTenantId: 'tenant-1',
  userCan: vi.fn().mockReturnValue(true),
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

vi.mock('../../composables/useNotificationConfigForm', () => ({
  useNotificationConfigForm: (source: { value: NotificationConfigForm | undefined }) => {
    // Mimic the real composable's watch(source, hydrate, { immediate: true })
    // by hydrating on setup if a source value exists, AND watching future
    // changes. We use a watchEffect for simplicity here.
    watchEffect(() => {
      const value = source.value
      if (value) currentFormMock.hydrate(value)
    })
    return currentFormMock
  },
}))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return actual
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetMocks() {
  queryMockState.data.value = undefined
  queryMockState.isLoading.value = false
  queryMockState.isPending.value = false
  queryMockState.isError.value = false
  queryMockState.error.value = null
  queryMockState.refetch.mockClear()

  assignableMockState.users.value = []
  assignableMockState.isLoading.value = false
  assignableMockState.isError.value = false
  assignableMockState.refetch.mockClear()

  currentFormMock = makeFormMockState()
  Object.assign(currentFormMock.form, {
    enabled: false,
    recipientUserIds: [],
    enabledActions: [],
  })
  currentFormMock.isDirty.value = false
  currentFormMock.canSave.value = false
  currentFormMock.isPending.value = false
  currentFormMock.canUpdate.value = true
  currentFormMock.zeroRecipientViolation.value = false
  currentFormMock.fieldErrors.recipients = null
  currentFormMock.save.mockClear()
}

beforeEach(() => {
  resetMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationConfigView — loading state (REQ-9)', () => {
  it('renders USkeleton placeholders while the query is loading', () => {
    queryMockState.isLoading.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    // USkeleton renders a `<span>` with the animate-pulse class. We check
    // for any element carrying that class.
    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })
})

describe('NotificationConfigView — four states (S10)', () => {
  it('empty: a never-configured tenant renders the defaults, not an error or empty-state chrome', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.find('[data-testid="master-toggle"]').attributes('data-enabled')).toBe('false')
    expect(wrapper.find('[data-testid="recipient-chips"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('loading: skeleton cards in the shape of the three sections and no footer', () => {
    queryMockState.isLoading.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.findAll('.notifications-section')).toHaveLength(3)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
    // Shaped like the content: the toggle row, the recipients select, the four module rows.
    const skeleton = wrapper.get('[data-testid="notifications-loading"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(skeleton.findAll('[data-skeleton="master"]')).toHaveLength(1)
    expect(skeleton.findAll('[data-skeleton="recipients"]')).toHaveLength(1)
    expect(skeleton.findAll('[data-skeleton="module-row"]')).toHaveLength(4)
    expect(wrapper.find('[data-testid="master-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notifications-footer"]').exists()).toBe(false)
  })

  it('data: master, recipients and actions cards with the single primary Save', () => {
    queryMockState.data.value = { enabled: true, recipientUserIds: [], enabledActions: [] }
    const wrapper = mountWithUApp(NotificationConfigView)
    for (const card of ['master', 'recipients', 'actions']) {
      expect(wrapper.find(`[data-testid="notifications-card-${card}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-testid="master-toggle-badge"]').attributes('data-tone')).toBe('success')
    expect(wrapper.findAll('[data-testid="save-button"]')).toHaveLength(1)
  })

  it('error: EmptyState error with Reintentar that refetches, and no form or footer', async () => {
    queryMockState.isError.value = true
    queryMockState.error.value = new Error('boom')
    const wrapper = mountWithUApp(NotificationConfigView)
    const error = wrapper.find('[data-testid="notifications-error"]')
    expect(error.attributes('data-kind')).toBe('error')
    expect(error.attributes('role')).toBe('alert')
    expect(wrapper.find('[data-testid="master-toggle"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notifications-footer"]').exists()).toBe(false)
    await wrapper.find('[data-testid="notifications-retry"]').trigger('click')
    expect(queryMockState.refetch).toHaveBeenCalledTimes(1)
  })

  it('error with data already on screen keeps the form (a background refetch failure)', () => {
    queryMockState.isError.value = true
    queryMockState.data.value = { enabled: true, recipientUserIds: [], enabledActions: [] }
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.find('[data-testid="notifications-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="master-toggle"]').exists()).toBe(true)
  })

  it('says each thing once: no subtitle, no section descriptions and no repeated master heading', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.find('.hf-page-subtitle').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Estos usuarios recibirán')
    expect(wrapper.text()).not.toContain('Selecciona las acciones que dispararán')
    expect(wrapper.find('[data-testid="notifications-card-master"] h2').exists()).toBe(false)
    expect(wrapper.find('[data-testid="notifications-card-master"]').attributes('aria-label')).toBe('Notificaciones')
  })

  it('mutes the read-only notice because nothing is pending for the user to fix', () => {
    currentFormMock.canUpdate.value = false
    const notice = mountWithUApp(NotificationConfigView).find('[data-testid="no-update-perm-notice"]')
    expect(notice.classes()).toContain('text-muted')
    expect(notice.classes()).not.toContain('text-warning')
  })
})

describe('NotificationConfigView — default render (REQ-3)', () => {
  it('renders the master toggle in the OFF/empty state when never configured', () => {
    // query still resolving (data undefined) — view MUST render defaults, NOT error.
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    // Master toggle wrapper exists.
    expect(wrapper.find('[data-testid="master-toggle"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Desactivadas')
  })

  it('renders the recipients card with no chips and the add prompt by default', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.find('[data-testid="recipient-chips"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="recipient-select-trigger"]').text()).toContain('Agregar usuarios')
  })

  it('a failed users read shows its own error with Reintentar that refetches the users (T7)', async () => {
    queryMockState.data.value = { enabled: true, recipientUserIds: ['u1'], enabledActions: [] }
    assignableMockState.isError.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    await nextTick()
    expect(wrapper.text()).not.toContain('Usuario no disponible')
    await wrapper.get('[data-testid="recipient-retry"]').trigger('click')
    expect(assignableMockState.refetch).toHaveBeenCalledTimes(1)
  })

  it('renders the actions accordion with the modules from the registry', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.find('[data-testid="actions-accordion"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Punto de venta')
    expect(wrapper.text()).toContain('Bajo inventario')
  })
})

describe('NotificationConfigView — Save button gating (REQ-6)', () => {
  it('disables Save when canSave=false', () => {
    queryMockState.data.value = undefined
    currentFormMock.canSave.value = false
    const wrapper = mountWithUApp(NotificationConfigView)
    const saveBtn = wrapper.find('[data-testid="save-button"]')
    expect(saveBtn.exists()).toBe(true)
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })

  it('enables Save when canSave=true', () => {
    queryMockState.data.value = undefined
    currentFormMock.canSave.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    const saveBtn = wrapper.find('[data-testid="save-button"]')
    expect(saveBtn.attributes('disabled')).toBeUndefined()
  })

  it('shows the zero-recipient inline message when zeroRecipientViolation=true', () => {
    queryMockState.data.value = undefined
    currentFormMock.zeroRecipientViolation.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).toContain('Selecciona al menos un usuario')
  })

  it('shows the "no update perm" notice when canUpdate=false', () => {
    queryMockState.data.value = undefined
    currentFormMock.canUpdate.value = false
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).toContain('No tienes permisos para guardar')
  })

  it('calls form.save() when Save is clicked and canSave=true', async () => {
    queryMockState.data.value = undefined
    currentFormMock.canSave.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    const saveBtn = wrapper.find('[data-testid="save-button"]')
    await saveBtn.trigger('click')
    await nextTick()
    expect(currentFormMock.save).toHaveBeenCalledTimes(1)
  })
})

describe('NotificationConfigView — composable wiring (REQ-3, REQ-7)', () => {
  it('passes the query data ref as the source to useNotificationConfigForm', async () => {
    const data: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    }
    queryMockState.data.value = {
      enabled: data.enabled,
      recipientUserIds: [...data.recipients],
      enabledActions: [...data.enabledActions],
    }

    mountWithUApp(NotificationConfigView)
    await nextTick()

    // After hydration the form snapshot reflects the source.
    expect(currentFormMock.form.enabled).toBe(true)
    expect(currentFormMock.form.recipientUserIds).toEqual(['u1'])
    expect(currentFormMock.form.enabledActions).toEqual(['LOW_STOCK'])
  })

  it('passes query data and assignable list down to the components', async () => {
    queryMockState.data.value = {
      enabled: true,
      recipientUserIds: ['u1'],
      enabledActions: ['LOW_STOCK'],
    }
    assignableMockState.users.value = [{ id: 'u1', name: 'Ana' }]
    const wrapper = mountWithUApp(NotificationConfigView)
    await nextTick()
    // Master reflects enabled=true via the badge.
    expect(wrapper.text()).toContain('Activadas')
    // Recipients card shows Ana (assignable name resolution).
    expect(wrapper.text()).toContain('Ana')
  })
})

describe('NotificationConfigView — in-view permission gate (WU-12)', () => {
  it('hides the no-update notice when canUpdate=true (default)', () => {
    queryMockState.data.value = undefined
    currentFormMock.canUpdate.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).not.toContain('No tienes permisos para guardar')
  })

  it('renders the no-update notice when canUpdate=false', () => {
    queryMockState.data.value = undefined
    currentFormMock.canUpdate.value = false
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).toContain('No tienes permisos para guardar')
  })

  it('keeps Save disabled when canUpdate=false even if other gates pass', () => {
    queryMockState.data.value = undefined
    currentFormMock.canUpdate.value = false
    currentFormMock.isDirty.value = true
    currentFormMock.canSave.value = false
    const wrapper = mountWithUApp(NotificationConfigView)
    const saveBtn = wrapper.find('[data-testid="save-button"]')
    expect(saveBtn.attributes('disabled')).toBeDefined()
  })
})

describe('NotificationConfigView — Promociones group (PCA-4)', () => {
  function promotions() {
    return ACTION_REGISTRY.find((m) => m.moduleKey === 'promotions')!
  }

  it('renders the Promociones module + both actions straight from the registry', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).toContain(promotions().moduleLabel)
    for (const action of promotions().actions) {
      expect(wrapper.text()).toContain(action.label)
    }
  })

  it('renders exactly one action row per registry action (data-driven, no duplicates)', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    const expected = ACTION_REGISTRY.reduce((total, m) => total + m.actions.length, 0)
    expect(wrapper.findAll('[data-testid^="action-row-"]')).toHaveLength(expected)
  })

  it('renders both promotion toggles OFF by default (tenant default disabled)', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(
      wrapper.find('[data-testid="action-row-promotion-expiring"]').attributes('data-checked'),
    ).toBe('false')
    expect(
      wrapper.find('[data-testid="action-row-promotion-near-capacity"]').attributes('data-checked'),
    ).toBe('false')
  })

  it('keeps permission/save gating with the promotion group present', () => {
    queryMockState.data.value = undefined
    currentFormMock.canUpdate.value = false
    currentFormMock.canSave.value = false
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).toContain(promotions().moduleLabel)
    expect(wrapper.find('[data-testid="save-button"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('No tienes permisos para guardar')
  })

  it('has NO bespoke promotion branches in the view/accordion/row sources (registry-only)', () => {
    const files = [
      '../NotificationConfigView.vue',
      '../../components/ActionsAccordion.vue',
      '../../components/ModuleAccordionItem.vue',
      '../../components/ActionRow.vue',
    ]
    for (const relative of files) {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
      expect(source).not.toMatch(/PROMOTION_/)
    }
  })
})
