// NotificationConfigView.spec.ts — STRICT-TDD tests for the view.
//
// The view is a composition surface: it owns the composables, passes their
// reactive state into the three cards (master / recipients / actions),
// and renders a Save button. We test the integration between the
// composables and the rendered components using mocks for the heavy
// composables (the form composable has its own pure-helper tests; we
// mount the real one with deps mocked at the boundary).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import NotificationConfigView from '../NotificationConfigView.vue'
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
}

const assignableMockState = {
  users: ref<{ id: string; name: string }[]>([]),
  isLoading: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
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
    const { watchEffect } = require('vue') as typeof import('vue')
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

  assignableMockState.users.value = []
  assignableMockState.isLoading.value = false

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

describe('NotificationConfigView — default render (REQ-3)', () => {
  it('renders the master toggle in the OFF/empty state when never configured', () => {
    // query still resolving (data undefined) — view MUST render defaults, NOT error.
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    // Master toggle wrapper exists.
    expect(wrapper.find('[data-testid="master-toggle"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Desactivadas')
  })

  it('renders the recipients card with "0 seleccionados" by default', () => {
    queryMockState.data.value = undefined
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.text()).toContain('0 seleccionados')
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