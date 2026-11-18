// NotificationConfigView.spec.ts — the redesigned screen (artboards
// design/notification-config/01 and 04): header with subtitle, groups
// Estado / Usuarios a notificar / Acciones a notificar, whole-row switches,
// users listbox, module «Activar todas», HfSaveBar and the page states.
//
// The composables are mocked at their boundary; the saved payload through
// the real form composable is covered in NotificationConfigView.payload.spec.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, reactive, ref, watchEffect } from 'vue'
import { flushPromises } from '@vue/test-utils'
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

const DATA: NotificationConfigForm = {
  enabled: true,
  recipientUserIds: ['u1'],
  enabledActions: ['LOW_STOCK'],
}

function mountReady(data: NotificationConfigForm = DATA) {
  queryMockState.data.value = { ...data }
  assignableMockState.users.value = [
    { id: 'u1', name: 'Ana Ruiz' },
    { id: 'u2', name: 'Bruno Gil' },
  ]
  return mountWithUApp(NotificationConfigView)
}

const saveButton = (wrapper: ReturnType<typeof mountReady>) =>
  wrapper.findAll('.hf-save-bar button').find((b) => b.text() === 'Guardar cambios')!
const discardButton = (wrapper: ReturnType<typeof mountReady>) =>
  wrapper.findAll('.hf-save-bar button').find((b) => b.text() === 'Descartar')

describe('NotificationConfigView — layout (artboard 01)', () => {
  it('has the page header with title and subtitle', () => {
    const wrapper = mountReady()
    expect(wrapper.get('.hf-page-title').text()).toBe('Configuración de notificaciones')
    expect(wrapper.get('.hf-page-subtitle').text()).toBe(
      'Elige qué avisos se envían por correo y a quién. Nada cambia hasta que guardas.',
    )
  })

  it('renders three labelled groups: Estado, Usuarios a notificar, Acciones a notificar', () => {
    const wrapper = mountReady()
    const groups = wrapper.findAll('section[aria-labelledby]')
    expect(
      groups.map((g) => wrapper.get(`[id="${g.attributes('aria-labelledby')}"]`).text()),
    ).toEqual(['Estado', 'Usuarios a notificar', 'Acciones a notificar'])
  })

  it('renders one module group per registry module with one switch row per action', () => {
    const wrapper = mountReady()
    expect(wrapper.findAll('[data-testid^="module-group-"]')).toHaveLength(ACTION_REGISTRY.length)
    const expected = ACTION_REGISTRY.reduce((total, m) => total + m.actions.length, 0)
    expect(wrapper.findAll('[data-testid^="action-row-"]')).toHaveLength(expected)
    // Master + every action: all switch rows, no checkbox anywhere.
    expect(wrapper.findAll('[role="switch"]')).toHaveLength(expected + 1)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('shows «Activar todas» only on modules with two or more actions', () => {
    const wrapper = mountReady()
    const multi = ACTION_REGISTRY.filter((m) => m.actions.length >= 2).map((m) => m.moduleKey)
    const found = wrapper
      .findAll('[data-testid^="module-all-"]')
      .map((b) => b.attributes('data-testid')!.replace('module-all-', ''))
    expect(found).toEqual(multi)
  })

  it('counts the active actions in the actions group head', () => {
    const wrapper = mountReady({ ...DATA, enabledActions: ['LOW_STOCK', 'PROMOTION_EXPIRING'] })
    expect(wrapper.get('[data-testid="actions-count"]').text()).toBe('2 de 5 activadas')
  })

  it('shows the delivery summary under the master switch', () => {
    const wrapper = mountReady()
    expect(wrapper.get('[data-testid="delivery-summary"]').text()).toContain(
      'Se envía 1 aviso por correo a 1 usuario',
    )
  })

  it('a never-configured tenant renders the defaults, not an error', () => {
    const wrapper = mountWithUApp(NotificationConfigView)
    expect(wrapper.get('[data-testid="master-toggle"]').attributes('data-enabled')).toBe('false')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })

  it('has no bespoke promotion branches in the view or components (registry-only)', () => {
    const files = [
      '../NotificationConfigView.vue',
      '../../components/ActionModuleGroup.vue',
      '../../components/ActionRow.vue',
      '../../components/MasterToggle.vue',
      '../../components/RecipientSelect.vue',
    ]
    for (const relative of files) {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
      expect(source).not.toMatch(/PROMOTION_|LOW_STOCK|DELIVERY_NEXT_STOP/)
    }
  })
})

describe('NotificationConfigView — whole-row switches', () => {
  it('the master row writes form.enabled', async () => {
    const wrapper = mountReady()
    await nextTick()
    await wrapper.get('[data-testid="master-toggle"] [role="switch"]').trigger('click')
    expect(currentFormMock.form.enabled).toBe(false)
  })

  it('an action row writes form.enabledActions', async () => {
    const wrapper = mountReady()
    await nextTick()
    await wrapper.get('[data-testid="action-row-promotion-expiring"] [role="switch"]').trigger('click')
    expect(currentFormMock.form.enabledActions).toEqual(['LOW_STOCK', 'PROMOTION_EXPIRING'])
  })

  it('«Activar todas» writes every module action', async () => {
    const wrapper = mountReady()
    await nextTick()
    await wrapper.get('[data-testid="module-all-promotions"]').trigger('click')
    expect(currentFormMock.form.enabledActions).toEqual([
      'LOW_STOCK',
      'PROMOTION_EXPIRING',
      'PROMOTION_NEAR_CAPACITY',
    ])
  })
})

describe('NotificationConfigView — master off', () => {
  it('pauses every action row with its reason and says the actions are paused', async () => {
    const wrapper = mountReady({ ...DATA, enabled: false })
    await nextTick()
    const rows = wrapper.findAll('[data-testid^="action-row-"] [role="switch"]')
    expect(rows.every((r) => r.attributes('aria-disabled') === 'true')).toBe(true)
    expect(wrapper.get('[data-testid="action-row-low-stock"]').text()).toContain('En pausa')
    expect(wrapper.get('[data-testid="actions-paused"]').text()).toContain('Acciones en pausa.')
    await rows[0]!.trigger('click')
    expect(currentFormMock.form.enabledActions).toEqual(['LOW_STOCK'])
  })

  it('«Activar notificaciones» in the paused notice turns the master on', async () => {
    const wrapper = mountReady({ ...DATA, enabled: false })
    await nextTick()
    await wrapper.get('[data-testid="actions-reactivate"]').trigger('click')
    expect(currentFormMock.form.enabled).toBe(true)
  })
})

describe('NotificationConfigView — users to notify', () => {
  it('renders the users as a multiselect listbox with aria-selected and the count', async () => {
    const wrapper = mountReady()
    await nextTick()
    const list = wrapper.get('[role="listbox"]')
    expect(list.attributes('aria-multiselectable')).toBe('true')
    expect(wrapper.findAll('[role="option"]').map((o) => o.attributes('aria-selected'))).toEqual([
      'true',
      'false',
    ])
    expect(wrapper.get('.hf-selectable-rows__count').text()).toBe('1 de 2 seleccionados')
  })

  it('a row click writes form.recipientUserIds', async () => {
    const wrapper = mountReady()
    await nextTick()
    await wrapper.findAll('[role="option"]')[1]!.trigger('click')
    expect(currentFormMock.form.recipientUserIds).toEqual(['u1', 'u2'])
  })

  it('shows the required error under the list when actions need users and none is chosen', async () => {
    currentFormMock.zeroRecipientViolation.value = true
    const wrapper = mountReady({ ...DATA, recipientUserIds: [] })
    await nextTick()
    expect(wrapper.get('[role="listbox"]').attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('.hf-selectable-rows__error').text()).toContain(
      'Selecciona al menos un usuario a notificar',
    )
    expect(wrapper.get('.hf-selectable-rows__error').text()).toContain('Bajo inventario')
  })

  it('shows the server field error under the list', async () => {
    currentFormMock.fieldErrors.recipients = 'Uno de los usuarios seleccionados no pertenece a esta cuenta'
    const wrapper = mountReady()
    await nextTick()
    expect(wrapper.get('.hf-selectable-rows__error').text()).toContain('no pertenece a esta cuenta')
  })

  it('marks an unavailable user and keeps it', async () => {
    const wrapper = mountReady({ ...DATA, recipientUserIds: ['u1', 'gone'] })
    await nextTick()
    expect(wrapper.get('[data-testid="recipient-stale-gone"]').text()).toContain('Usuario no disponible')
    expect(currentFormMock.form.recipientUserIds).toEqual(['u1', 'gone'])
  })

  it('a failed users read shows its own error with Reintentar that refetches the users', async () => {
    queryMockState.data.value = { enabled: true, recipientUserIds: ['u1'], enabledActions: [] }
    assignableMockState.isError.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    await nextTick()
    expect(wrapper.text()).not.toContain('Usuario no disponible')
    await wrapper.get('[data-testid="recipient-retry"]').trigger('click')
    expect(assignableMockState.refetch).toHaveBeenCalledTimes(1)
  })
})

describe('NotificationConfigView — HfSaveBar', () => {
  it('clean: no Descartar and Guardar disabled', async () => {
    const wrapper = mountReady()
    await nextTick()
    expect(discardButton(wrapper)).toBeUndefined()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('dirty: says how many changes and offers Descartar, which restores the loaded values', async () => {
    const wrapper = mountReady()
    await nextTick()
    currentFormMock.form.enabled = false
    currentFormMock.form.enabledActions = ['LOW_STOCK', 'PROMOTION_EXPIRING']
    currentFormMock.canSave.value = true
    await nextTick()
    expect(wrapper.get('.hf-save-bar__status').text()).toContain('2 cambios sin guardar')
    await discardButton(wrapper)!.trigger('click')
    expect(currentFormMock.form.enabled).toBe(true)
    expect(currentFormMock.form.enabledActions).toEqual(['LOW_STOCK'])
    expect(currentFormMock.save).not.toHaveBeenCalled()
  })

  it('Guardar calls form.save() when the form can be saved', async () => {
    const wrapper = mountReady()
    await nextTick()
    currentFormMock.form.enabled = false
    currentFormMock.canSave.value = true
    await nextTick()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(currentFormMock.save).toHaveBeenCalledTimes(1)
  })

  it('saving: says Guardando… and blocks both actions', async () => {
    const wrapper = mountReady()
    await nextTick()
    currentFormMock.form.enabled = false
    currentFormMock.isPending.value = true
    await nextTick()
    expect(wrapper.get('.hf-save-bar__status').text()).toContain('Guardando…')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
    expect(discardButton(wrapper)!.attributes('disabled')).toBeDefined()
  })

  it('error: a failed save says so in the bar and keeps the changes', async () => {
    currentFormMock.save.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountReady()
    await nextTick()
    currentFormMock.form.enabled = false
    currentFormMock.canSave.value = true
    await nextTick()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('.hf-save-bar__status').attributes('data-state')).toBe('error')
    expect(wrapper.get('.hf-save-bar__status').text()).toContain('No se guardó')
    expect(currentFormMock.form.enabled).toBe(false)
  })

  it('missing users: Guardar does not save and the bar says what is missing', async () => {
    currentFormMock.zeroRecipientViolation.value = true
    const wrapper = mountReady({ ...DATA, recipientUserIds: ['u1'] })
    await nextTick()
    currentFormMock.form.recipientUserIds = []
    currentFormMock.canSave.value = false
    await nextTick()
    await saveButton(wrapper).trigger('click')
    await flushPromises()
    expect(currentFormMock.save).not.toHaveBeenCalled()
    expect(wrapper.get('.hf-save-bar__status').text()).toContain('falta elegir usuarios')
  })
})

describe('NotificationConfigView — page states', () => {
  it('loading: a busy status with USkeleton shapes for the three groups and no form or bar', () => {
    queryMockState.isLoading.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    const loading = wrapper.get('[data-testid="notifications-loading"]')
    expect(loading.attributes('role')).toBe('status')
    expect(loading.attributes('aria-busy')).toBe('true')
    expect(loading.findAll('[data-skeleton="group"]')).toHaveLength(3)
    expect(loading.findAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)
    expect(wrapper.find('.hf-save-bar').exists()).toBe(false)
  })

  it('error: EmptyState error with Reintentar that refetches, and no form or bar', async () => {
    queryMockState.isError.value = true
    const wrapper = mountWithUApp(NotificationConfigView)
    const error = wrapper.get('[data-testid="notifications-error"]')
    expect(error.attributes('data-kind')).toBe('error')
    expect(error.attributes('role')).toBe('alert')
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)
    expect(wrapper.find('.hf-save-bar').exists()).toBe(false)
    await wrapper.get('[data-testid="notifications-retry"]').trigger('click')
    expect(queryMockState.refetch).toHaveBeenCalledTimes(1)
  })

  it('error with data already on screen keeps the form (a background refetch failure)', () => {
    queryMockState.isError.value = true
    const wrapper = mountReady()
    expect(wrapper.find('[data-testid="notifications-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="master-toggle"]').exists()).toBe(true)
  })

  it('no update permission: everything is visible but locked, the notice replaces the save bar', async () => {
    currentFormMock.canUpdate.value = false
    const wrapper = mountReady()
    await nextTick()
    expect(wrapper.find('.hf-save-bar').exists()).toBe(false)
    expect(wrapper.get('[data-testid="no-update-perm-notice"]').text()).toContain(
      'No tienes permisos para guardar cambios',
    )
    const switches = wrapper.findAll('[role="switch"]')
    expect(switches.every((s) => s.attributes('aria-disabled') === 'true')).toBe(true)
    expect(
      wrapper.findAll('[role="option"]').every((o) => o.attributes('aria-disabled') === 'true'),
    ).toBe(true)
    await switches[0]!.trigger('click')
    expect(currentFormMock.form.enabled).toBe(true)
  })

  it('with update permission there is no read-only notice', () => {
    const wrapper = mountReady()
    expect(wrapper.find('[data-testid="no-update-perm-notice"]').exists()).toBe(false)
  })
})

describe('NotificationConfigView — composable wiring', () => {
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
    expect(currentFormMock.form).toEqual({
      enabled: true,
      recipientUserIds: ['u1'],
      enabledActions: ['LOW_STOCK'],
    })
  })
})
