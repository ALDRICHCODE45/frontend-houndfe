// ChatbotSettingsView — the routed screen (design 01, «secciones y barra»). The real composables and
// components run; only the HTTP api, the auth store, the toast and the modal shell are replaced.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import ChatbotSettingsView from '../ChatbotSettingsView.vue'
import {
  defaultsFixture,
  settingsFixture,
} from '../../interfaces/__tests__/chatbot-settings.fixture'
import type { ChatbotApplyResult } from '../../interfaces/chatbot-settings.types'

vi.mock('../../api/chatbotSettings.api', () => ({
  chatbotSettingsApi: { get: vi.fn(), put: vi.fn(), applyToAllBranches: vi.fn() },
}))

const auth = vi.hoisted(() => ({ codes: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.codes.has(`${action}:${subject}`),
  }),
}))

const toastMock = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useToast: () => toastMock }
})

vi.mock('@nuxt/ui/runtime/components/Modal.vue', () => ({
  default: {
    name: 'UModal',
    props: ['open', 'title', 'dismissible', 'close', 'ui'],
    emits: ['update:open'],
    template:
      '<div v-if="open" data-testid="u-modal"><h2 data-testid="modal-title">{{ title }}</h2><slot name="body" /><slot name="footer" /></div>',
  },
}))

import { chatbotSettingsApi } from '../../api/chatbotSettings.api'

const api = vi.mocked(chatbotSettingsApi)
const EDITOR = ['read:ChatbotSettings', 'update:ChatbotSettings']
const ADMIN = [...EDITOR, 'update:ChatbotSettingsAllBranches']

const dry: ChatbotApplyResult = {
  dryRun: true,
  source: { tenantId: 't1', version: 3 },
  tenantsApplied: [{ tenantId: 't2', name: 'Sucursal Norte' }],
  tenantsUnchanged: [{ tenantId: 't1', name: 'Sucursal Centro' }],
  tenantsSkipped: [{ tenantId: 't3', name: 'Sucursal Sur', reason: 'NO_PERMISSION' }],
  tenantsFailed: [],
}

function axiosError(status: number, data: Record<string, unknown> = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })
}

async function mountView(codes: string[] = EDITOR, settings = settingsFixture()) {
  auth.codes = new Set(codes)
  api.get.mockResolvedValue(settings)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mountWithUApp(ChatbotSettingsView, {
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  })
  await flushPromises()
  return wrapper
}
type Wrapper = Awaited<ReturnType<typeof mountView>>

const sectionIds = (w: Wrapper) => w.findAll('section.cbs-sec').map((s) => s.attributes('id'))
const bar = (w: Wrapper) => w.find('[data-testid="save-bar"]')
async function editComplaintClaim(w: Wrapper, minutes: string) {
  const input = w.get('#s-COMPLAINT-claim')
  // 30 min is shown in minutes; the typed number is minutes.
  await input.setValue(minutes)
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  auth.tenantId = 'tenant-1'
})

describe('states', () => {
  it('without read:ChatbotSettings it shows the forbidden state and never calls the API', async () => {
    const w = await mountView([])
    expect(w.find('[data-testid="settings-forbidden"]').exists()).toBe(true)
    expect(api.get).not.toHaveBeenCalled()
    expect(sectionIds(w)).toEqual([])
  })

  it('shows the skeleton while loading', async () => {
    auth.codes = new Set(EDITOR)
    api.get.mockReturnValue(new Promise(() => undefined))
    const w = mountWithUApp(ChatbotSettingsView, {
      global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]] },
    })
    await flushPromises()
    expect(w.find('[data-testid="settings-loading"]').exists()).toBe(true)
  })

  it('a load error shows Reintentar and retries', async () => {
    auth.codes = new Set(EDITOR)
    api.get.mockRejectedValueOnce(axiosError(500))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const w = mountWithUApp(ChatbotSettingsView, {
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
    })
    await flushPromises()
    expect(w.find('[data-testid="settings-error"]').exists()).toBe(true)

    api.get.mockResolvedValue(settingsFixture())
    await w.get('[data-testid="retry-button"]').trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="settings-error"]').exists()).toBe(false)
  })
})

describe('layout', () => {
  it('renders the sections in PUT order with a side index and the fixed pickup note, no checkbox', async () => {
    const w = await mountView()
    expect(sectionIds(w)).toEqual(['sec-hours', 'sec-dates', 'sec-sla', 'sec-extras', 'sec-sched'])
    expect(w.findAll('[data-testid="side-index"] li')).toHaveLength(5)
    expect(w.get('[data-testid="pickup-note"]').text()).toContain('No cambia el horario de recolección en tienda')
    expect(w.find('input[type="checkbox"]').exists()).toBe(false)
    expect(w.text()).toContain('Atención del chatbot')
  })

  it('marks only the stored-only scheduling «Aún sin efecto» (the template is sent from the live chat)', async () => {
    const w = await mountView()
    expect(w.get('[data-testid="section-sched"]').text()).toContain('Aún sin efecto')
    expect(w.get('[data-testid="section-extras"]').text()).not.toContain('Aún sin efecto')
    expect(w.get('[data-testid="section-sla"]').text()).not.toContain('Aún sin efecto')
  })

  it('shows no save bar until something changes', async () => {
    const w = await mountView()
    expect(bar(w).exists()).toBe(false)
  })
})

describe('saved by', () => {
  const ANA = { id: 'u1', displayName: 'Ana López' }

  it('shows «Guardado por …» with the time near the header', async () => {
    const w = await mountView(EDITOR, settingsFixture({ updatedBy: ANA, updatedAt: '2026-11-12T16:30:00.000Z' }))
    const text = w.get('[data-testid="saved-by"]').text()
    expect(text).toContain('Guardado por Ana López')
    expect(text).toContain('10:30')
  })

  it('shows nothing when nobody saved (version 0 or null author)', async () => {
    const w = await mountView(EDITOR, defaultsFixture())
    expect(w.find('[data-testid="saved-by"]').exists()).toBe(false)
  })

  it('shows it read-only too, and updates it after a save', async () => {
    const readonly = await mountView(['read:ChatbotSettings'], settingsFixture({ updatedBy: ANA, updatedAt: '2026-11-12T16:30:00.000Z' }))
    expect(readonly.get('[data-testid="saved-by"]').text()).toContain('Ana López')

    api.put.mockResolvedValue({
      ...settingsFixture({ version: 4, updatedBy: { id: 'u2', displayName: 'Luis Pérez' }, updatedAt: '2026-11-12T17:00:00.000Z' }),
      recompute: 'DONE',
    })
    const w = await mountView(EDITOR, settingsFixture({ updatedBy: ANA, updatedAt: '2026-11-12T16:30:00.000Z' }))
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="saved-by"]').text()).toContain('Luis Pérez')
  })
})

describe('closed date reasons', () => {
  it('a typed reason makes the draft dirty and goes in the PUT trimmed, for the present date only', async () => {
    api.put.mockResolvedValue({ ...settingsFixture({ version: 4 }), recompute: 'DONE' })
    const w = await mountView()
    await w.get('#r-2026-12-25').setValue('  Navidad ')
    await flushPromises()
    expect(w.find('[data-testid="dirty-count"]').exists()).toBe(true)

    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(api.put.mock.calls[0]![0].closedDateReasons).toEqual({ '2026-12-25': 'Navidad' })
  })

  it('removing a date drops its reason from the PUT', async () => {
    api.put.mockResolvedValue({ ...settingsFixture({ version: 4 }), recompute: 'DONE' })
    const w = await mountView(EDITOR, settingsFixture({ closedDateReasons: { '2026-12-25': 'Navidad', '2027-01-01': 'Año nuevo' } }))
    await w.get('[data-testid="date-remove-2026-12-25"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(api.put.mock.calls[0]![0].closedDateReasons).toEqual({ '2027-01-01': 'Año nuevo' })
  })
})

describe('400 fieldErrors', () => {
  it('puts each message on its field, lists them, and focuses the first', async () => {
    api.put.mockRejectedValue(
      axiosError(400, {
        code: 'VALIDATION_ERROR',
        fieldErrors: [
          { path: 'slas[5].resolveMinutes', code: 'RESOLVE_BELOW_CLAIM' },
          { path: 'closedDateReasons["2026-12-25"]', code: 'INVALID_TEXT' },
        ],
      }),
    )
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    const checklist = w.get('[data-testid="error-checklist"]').text()
    expect(checklist).toContain('Queja: resolver')
    expect(checklist).toContain('Motivo de 2026-12-25')
    expect(w.get('[data-testid="date-2026-12-25"]').text()).toContain('Escribe solo texto')
    expect(w.find('[data-testid="notice-validation"]').exists()).toBe(false)
    expect(w.get('[data-testid="save-bar"]').attributes('data-state')).toBe('invalid')
    expect(document.activeElement?.id).toBe('s-COMPLAINT-resolve')
  })

  it('unknown paths fall back to the generic message', async () => {
    api.put.mockRejectedValue(
      axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors: [{ path: 'brandNew.thing', code: 'FUTURE_CODE' }] }),
    )
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="notice-validation"]').text()).toContain('El servidor no aceptó algún valor')
    expect(w.find('[data-testid="error-checklist"]').exists()).toBe(false)
  })

  it('TOO_MANY_RANGES lands on its day', async () => {
    api.put.mockRejectedValue(
      axiosError(400, { code: 'VALIDATION_ERROR', fieldErrors: [{ path: 'openingHours.days[3].ranges', code: 'TOO_MANY_RANGES' }] }),
    )
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="error-checklist"]').text()).toContain('Jueves')
    expect(w.get('[data-testid="error-checklist"]').text()).toContain('Máximo 6 horarios por día')
  })
})

describe('dirty state and save', () => {
  it('an edit shows the dirty bar, marks the section and the index; discard restores', async () => {
    const w = await mountView()
    await editComplaintClaim(w, '20')

    expect(bar(w).exists()).toBe(true)
    expect(w.get('[data-testid="dirty-count"]').text()).toBe('1 cambio sin guardar')
    expect(w.get('[data-testid="dirty-sla"]').text()).toBe('Modificado')
    expect(w.find('[data-testid="index-sla"] .cbs-index__dot').exists()).toBe(true)

    await w.get('[data-testid="discard"]').trigger('click')
    await flushPromises()
    expect(bar(w).exists()).toBe(false)
    expect((w.get('#s-COMPLAINT-claim').element as HTMLInputElement).value).toBe('30')
  })

  it('PUTs the full object with expectedVersion, round-tripping what the screen does not edit', async () => {
    const saved = { ...settingsFixture({ version: 4 }), recompute: 'DONE' as const }
    api.put.mockResolvedValue(saved)
    const w = await mountView()
    await editComplaintClaim(w, '20')

    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(api.put).toHaveBeenCalledTimes(1)
    const body = api.put.mock.calls[0]![0]
    expect(body.expectedVersion).toBe(3)
    expect(body).not.toHaveProperty('version')
    expect(body).not.toHaveProperty('recompute')
    expect(body.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes).toBe(20)
    expect(body.enabledSubtypes).toEqual(['RESTOCK', 'COMPLAINT'])
    expect(body.branchOpeningHours).toEqual(settingsFixture().branchOpeningHours)
    expect(body.windowWarningMinutes).toBe(120)
    expect(body.scheduling).toEqual(settingsFixture().scheduling)
    expect(toastMock.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cambios guardados' }))
  })

  it('after saving, the bar says «Todo guardado» with the new version', async () => {
    api.put.mockResolvedValue({ ...settingsFixture({ version: 4 }), recompute: 'DONE' })
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="save-bar"]').text()).toContain('Todo guardado')
    expect(w.get('[data-testid="save-bar"]').text()).toContain('Versión 4')
  })

  it('recompute FAILED shows the «Guardado; los plazos…» notice and keeps the new version', async () => {
    api.put.mockResolvedValue({ ...settingsFixture({ version: 4 }), recompute: 'FAILED' })
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="notice-failed"]').text()).toContain('se actualizarán más tarde')
  })

  it('an invalid draft is not sent: the checklist and the field error appear', async () => {
    const w = await mountView()
    const window = w.get('#cbs-window')
    await window.setValue('30')
    // The unit select of the «ventana» field (the view has one per duration).
    w.findAllComponents({ name: 'DurationField' })
      .find((field) => field.props('id') === 'cbs-window')!
      .getComponent({ name: 'Select' })
      .vm.$emit('update:modelValue', 'min')
    await w.vm.$nextTick()
    await w.get('#cbs-window').setValue('1441')
    await flushPromises()

    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(api.put).not.toHaveBeenCalled()
    expect(w.get('[data-testid="error-checklist"]').text()).toContain('Aviso de ventana')
    expect(w.find('[data-testid="window-error"]').exists()).toBe(true)
    expect(w.get('[data-testid="save-bar"]').attributes('data-state')).toBe('invalid')
  })

  it('a 500 keeps the draft and offers Reintentar', async () => {
    api.put.mockRejectedValue(axiosError(500))
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    expect(w.find('[data-testid="notice-error"]').exists()).toBe(true)
    expect((w.get('#s-COMPLAINT-claim').element as HTMLInputElement).value).toBe('20')
    expect(w.find('[data-testid="dirty-count"]').exists()).toBe(true)
  })
})

describe('409 VERSION_CONFLICT', () => {
  const theirs = () => {
    const current = settingsFixture({ version: 4 })
    current.closedDates = [...current.closedDates, '2027-01-06']
    return current
  }

  async function conflicted() {
    api.put.mockRejectedValueOnce(axiosError(409, { code: 'VERSION_CONFLICT', current: theirs() }))
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()
    return w
  }

  it('keeps the draft and opens the comparison with «Conservar mis cambios»', async () => {
    const w = await conflicted()
    expect(w.get('[data-testid="conflict-dialog"]').text()).toContain('versión 4')
    expect(w.get('[data-testid="conflict-only-mine"]').text()).toContain('Plazo de queja')
    expect(w.get('[data-testid="conflict-only-theirs"]').text()).toContain('Fechas cerradas')
    expect((w.get('#s-COMPLAINT-claim').element as HTMLInputElement).value).toBe('20')
    expect(api.put).toHaveBeenCalledTimes(1)
  })

  it('«Conservar mis cambios» keeps my edit on top of their version and the next PUT uses their version', async () => {
    const w = await conflicted()
    await w.get('[data-testid="conflict-keep-mine"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="conflict-dialog"]').exists()).toBe(false)
    expect((w.get('#s-COMPLAINT-claim').element as HTMLInputElement).value).toBe('20')
    expect(w.findAll('li.cbs-date')).toHaveLength(4)

    api.put.mockResolvedValue({ ...theirs(), version: 5, recompute: 'DONE' })
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()
    const body = api.put.mock.calls[1]![0]
    expect(body.expectedVersion).toBe(4)
    expect(body.closedDates).toContain('2027-01-06')
    expect(body.slas.find((s) => s.subtype === 'COMPLAINT')!.claimMinutes).toBe(20)
  })

  it('the banner names the other person and the time from current, and falls back to «Otra persona»', async () => {
    const named = () => ({
      ...theirs(),
      updatedBy: { id: 'u1', displayName: 'Ana López' },
      updatedAt: '2026-11-12T16:30:00.000Z',
    })
    api.put.mockRejectedValueOnce(axiosError(409, { code: 'VERSION_CONFLICT', current: named() }))
    const w = await mountView()
    await editComplaintClaim(w, '20')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()
    // close the dialog to see the banner
    w.findComponent({ name: 'ConflictDialog' }).vm.$emit('close')
    await flushPromises()
    expect(w.get('[data-testid="conflict-banner"]').text()).toContain('Ana López guardó cambios a las 10:30')

    const anon = await conflicted()
    anon.findComponent({ name: 'ConflictDialog' }).vm.$emit('close')
    await flushPromises()
    expect(anon.get('[data-testid="conflict-banner"]').text()).toContain('Otra persona guardó cambios antes que tú')
  })

  it('closing the dialog leaves the conflict banner with «Ver cambios»; «Usar la versión 4» drops my edit', async () => {
    const w = await conflicted()
    await w.get('[data-testid="u-modal"] button[data-testid="conflict-use-theirs"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="conflict-banner"]').exists()).toBe(false)
    expect((w.get('#s-COMPLAINT-claim').element as HTMLInputElement).value).toBe('30')
    expect(w.findAll('li.cbs-date')).toHaveLength(4)
    expect(bar(w).exists()).toBe(false)
  })
})

describe('version 0 defaults', () => {
  it('shows the defaults banner and a «Guardar configuración» bar; the first save sends expectedVersion 0', async () => {
    api.put.mockResolvedValue({ ...defaultsFixture(), version: 1, recompute: 'DONE' })
    const w = await mountView(EDITOR, defaultsFixture())

    expect(w.get('[data-testid="defaults-banner"]').text()).toContain('versión 0')
    expect(w.get('[data-testid="save"]').text()).toBe('Guardar configuración')
    await w.get('[data-testid="save"]').trigger('click')
    await flushPromises()

    const body = api.put.mock.calls[0]![0]
    expect(body.expectedVersion).toBe(0)
    expect(body).not.toHaveProperty('branchOpeningHours')
    expect(w.find('[data-testid="defaults-banner"]').exists()).toBe(false)
  })
})

describe('read-only without update:ChatbotSettings', () => {
  it('shows the values, the read-only banner, and no editing control, save bar or apply button', async () => {
    const w = await mountView(['read:ChatbotSettings'])

    expect(w.find('[data-testid="readonly-banner"]').exists()).toBe(true)
    expect(w.get('[data-testid="ranges-WEDNESDAY"]').text()).toBe('09:00 – 14:00 · 16:00 – 19:00')
    expect(w.get('[data-testid="RESTOCK-claimMinutes-readonly"]').text()).toBe('1 h')
    expect(w.find('input').exists()).toBe(false)
    expect(w.find('select:not([aria-hidden="true"])').exists()).toBe(false)
    expect(w.find('[role="combobox"]').exists()).toBe(false)
    expect(w.find('textarea').exists()).toBe(false)
    expect(w.find('[data-testid="save-bar"]').exists()).toBe(false)
    expect(w.find('[data-testid="apply-open"]').exists()).toBe(false)
  })
})

describe('apply to all branches', () => {
  it('the button is gated by update:ChatbotSettingsAllBranches', async () => {
    expect((await mountView(EDITOR)).find('[data-testid="apply-open"]').exists()).toBe(false)
    expect((await mountView(ADMIN)).find('[data-testid="apply-open"]').exists()).toBe(true)
  })

  it('clean draft: dry run with expectedVersion, branch list with skipped reasons, confirm, per-branch result', async () => {
    api.applyToAllBranches.mockResolvedValueOnce(dry)
    const w = await mountView(ADMIN)
    await w.get('[data-testid="apply-open"]').trigger('click')
    await flushPromises()

    expect(api.applyToAllBranches).toHaveBeenCalledWith({ dryRun: true, expectedVersion: 3 })
    expect(w.get('[data-testid="branches-applied"]').text()).toContain('Sucursal Norte')
    expect(w.get('[data-testid="branches-skipped"]').text()).toContain('No tienes permiso para aplicar ahí')
    expect(w.find('[data-testid="apply-dialog"]').text()).toContain('Solo se incluyen las sucursales donde tienes membresía')

    api.applyToAllBranches.mockResolvedValueOnce({
      ...dry,
      dryRun: false,
      tenantsApplied: [{ tenantId: 't2', name: 'Sucursal Norte', recompute: 'FAILED' }],
      tenantsFailed: [{ tenantId: 't4', name: 'Sucursal Poniente' }],
    })
    await w.get('[data-testid="apply-confirm"]').trigger('click')
    await flushPromises()

    expect(api.applyToAllBranches).toHaveBeenLastCalledWith({ expectedVersion: 3 })
    expect(w.get('[data-testid="modal-title"]').text()).toBe('Se aplicó en algunas sucursales')
    expect(w.get('[data-testid="branches-failed"]').text()).toContain('Sucursal Poniente')
    expect(w.get('[data-testid="branches-applied"]').text()).toContain('se actualizarán más tarde')

    await w.get('[data-testid="apply-done"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="apply-dialog"]').exists()).toBe(false)
  })

  it('with unsaved changes it saves first, then dry-runs with the NEW version', async () => {
    api.put.mockResolvedValue({ ...settingsFixture({ version: 4 }), recompute: 'DONE' })
    api.applyToAllBranches.mockResolvedValueOnce({ ...dry, source: { tenantId: 't1', version: 4 } })
    const w = await mountView(ADMIN)
    await editComplaintClaim(w, '20')

    await w.get('[data-testid="apply-open"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="modal-title"]').text()).toBe('Guardar y revisar')
    expect(api.applyToAllBranches).not.toHaveBeenCalled()

    await w.get('[data-testid="apply-save-first"]').trigger('click')
    await flushPromises()

    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.applyToAllBranches).toHaveBeenCalledWith({ dryRun: true, expectedVersion: 4 })
    expect(w.get('[data-testid="modal-title"]').text()).toBe('Aplicar a 1 sucursal')
  })

  it('read + apply-all without update:ChatbotSettings on a version 0 branch: an explicit message, nothing is sent', async () => {
    const w = await mountView(['read:ChatbotSettings', 'update:ChatbotSettingsAllBranches'], defaultsFixture())
    await w.get('[data-testid="apply-open"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="modal-title"]').text()).toBe('Primero hay que guardar la configuración')
    expect(w.get('[data-testid="apply-blocked"]').text()).toContain('alguien con permiso para editar')
    expect(api.put).not.toHaveBeenCalled()
    expect(api.applyToAllBranches).not.toHaveBeenCalled()
    await w.get('[data-testid="apply-close"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="apply-dialog"]').exists()).toBe(false)
  })

  it('a 409 on the dry run without «current» asks to review again', async () => {
    api.applyToAllBranches.mockRejectedValueOnce(axiosError(409, { code: 'VERSION_CONFLICT' }))
    const w = await mountView(ADMIN)
    await w.get('[data-testid="apply-open"]').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="modal-title"]').text()).toBe('La configuración cambió')
    expect(w.get('[data-testid="apply-retry"]').text()).toBe('Volver a revisar')

    api.get.mockResolvedValue(settingsFixture({ version: 4 }))
    api.applyToAllBranches.mockResolvedValueOnce({ ...dry, source: { tenantId: 't1', version: 4 } })
    await w.get('[data-testid="apply-retry"]').trigger('click')
    await flushPromises()
    expect(api.applyToAllBranches).toHaveBeenLastCalledWith({ dryRun: true, expectedVersion: 4 })
  })
})

describe('tenant switch', () => {
  it('reads the settings under another tenant key instead of reusing the previous branch', async () => {
    await mountView()
    expect(api.get).toHaveBeenCalledTimes(1)
    auth.tenantId = 'tenant-2'
    await mountView()
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})

