import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { axiosError } from '../../composables/__tests__/withQuery'
import { makeCustomer, makeDetail } from '../../utils/detail-fixture'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type {
  ChatbotRequestAction,
  ChatbotRequestCommandResponse,
  ChatbotRequestDetail,
} from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: {
    claim: vi.fn(),
    release: vi.fn(),
    reassign: vi.fn(),
    cancel: vi.fn(),
    merge: vi.fn(),
    linkCustomer: vi.fn(),
    resolve: vi.fn(),
    reply: vi.fn(),
    finish: vi.fn(),
    listAssignableUsers: vi.fn(),
    listMergeCandidates: vi.fn(),
    getZoneImpact: vi.fn(),
  },
}))

const auth = vi.hoisted(() => ({ perms: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    user: { id: 'u-1' },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

const toastAdd = vi.hoisted(() => vi.fn())
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({ useToast: () => ({ add: toastAdd }) }))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import RequestCommandHost from '../RequestCommandHost.vue'

const api = vi.mocked(chatbotRequestApi)

const ok = (version = 2): ChatbotRequestCommandResponse => ({
  request: {
    id: 'req-1',
    folio: 'S-000123',
    kind: 'DECISION',
    subtype: 'RESTOCK',
    status: 'RESOLVED',
    displayStatus: 'RESOLVED',
    version,
    assignee: null,
    claimedAt: null,
    overdueAt: null,
    closedAt: null,
  },
})

const STUBS = {
  UIcon: { template: '<span />' },
  UButton: {
    props: ['label', 'disabled', 'loading', 'type'],
    emits: ['click'],
    template:
      '<button :type="type || \'button\'" :disabled="disabled || loading" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
  AppResponsiveDrawer: {
    props: ['open', 'title', 'description'],
    emits: ['update:open'],
    template:
      '<section v-if="open" data-testid="drawer"><h2 data-testid="drawer-title">{{ title }}</h2><button data-testid="drawer-close" @click="$emit(\'update:open\', false)">x</button><slot name="body" /></section>',
  },
}

let client: QueryClient

function mountHost(detail: ChatbotRequestDetail = makeDetail()) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(RequestCommandHost, {
    props: { detail },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]], stubs: STUBS },
  })
}

type HostVm = { start: (action: ChatbotRequestAction) => void }
const start = async (wrapper: VueWrapper, action: ChatbotRequestAction) => {
  ;(wrapper.vm as unknown as HostVm).start(action)
  await flushPromises()
}
const byId = (wrapper: VueWrapper, id: string) => wrapper.get(`[data-testid="${id}"]`)
// jsdom only submits a connected form, so the submit event is triggered on the form itself.
const submit = async (wrapper: VueWrapper) => {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}
const type = async (wrapper: VueWrapper, id: string, value: string) => {
  await byId(wrapper, id).setValue(value)
}
const lastPending = (wrapper: VueWrapper) => {
  const events = wrapper.emitted('update:pendingAction') ?? []
  return events[events.length - 1]
}
const pick = async (wrapper: VueWrapper, value: string) => {
  await byId(wrapper, `radio-${value}`).trigger('click')
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
  toastAdd.mockReset()
  auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequest'])
  auth.tenantId = 'tenant-1'
})

const KEY = expect.stringMatching(/^[0-9a-f-]{36}$/)

describe('RequestCommandHost — claim and release (direct)', () => {
  it('claims with the version on screen, thanks in es-MX and no form', async () => {
    api.claim.mockResolvedValue(ok())
    const wrapper = mountHost(makeDetail({ version: 3 }))

    await start(wrapper, 'CLAIM')

    expect(api.claim).toHaveBeenCalledWith('req-1', { expectedVersion: 3 }, KEY)
    expect(toastAdd).toHaveBeenCalledWith({
      title: 'Solicitud tomada',
      description: 'S-000123 ahora está a tu nombre.',
      color: 'success',
    })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })

  it('releases directly, without a confirmation', async () => {
    api.release.mockResolvedValue(ok())
    const wrapper = mountHost(makeDetail({ status: 'IN_PROGRESS', version: 2 }))

    await start(wrapper, 'RELEASE')

    expect(api.release).toHaveBeenCalledWith('req-1', { expectedVersion: 2 }, KEY)
    expect(toastAdd.mock.calls[0]![0].title).toBe('Solicitud liberada')
  })

  it('reports which action is in flight while it runs', async () => {
    let finish!: (value: ChatbotRequestCommandResponse) => void
    api.claim.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    const wrapper = mountHost()

    await start(wrapper, 'CLAIM')
    expect(lastPending(wrapper)).toEqual(['CLAIM'])
    finish(ok())
    await flushPromises()
    expect(lastPending(wrapper)).toEqual([null])
  })

  it('shows who took it from current, with «Actualizar» that asks the view to refresh', async () => {
    api.claim.mockRejectedValue(
      axiosError(409, {
        code: 'REQUEST_CLAIMED_BY_OTHER',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: { id: 'u-2', displayName: 'Ana López' } },
      }),
    )
    const wrapper = mountHost()

    await start(wrapper, 'CLAIM')

    expect(byId(wrapper, 'command-notice-title').text()).toBe('Ana López ya tomó esta solicitud')
    expect(toastAdd).not.toHaveBeenCalled()

    await byId(wrapper, 'notice-refresh').trigger('click')
    expect(wrapper.emitted('refresh')).toHaveLength(1)
    expect(wrapper.find('[data-testid="command-notice"]').exists()).toBe(false)
  })

  it('«Reintentar» after a network failure resends the same attempt under the same key', async () => {
    api.claim.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(ok())
    const wrapper = mountHost()

    await start(wrapper, 'CLAIM')
    expect(byId(wrapper, 'command-notice-title').text()).toBe('No se pudo confirmar la acción')
    await byId(wrapper, 'notice-retry').trigger('click')
    await flushPromises()

    expect(api.claim).toHaveBeenCalledTimes(2)
    expect(api.claim.mock.calls[1]![2]).toBe(api.claim.mock.calls[0]![2])
    expect(toastAdd).toHaveBeenCalledTimes(1)
  })
})

describe('RequestCommandHost — cancel', () => {
  const clarification = () => makeDetail({ kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', decision: null, version: 4 })

  it('opens a sheet titled «Cancelar solicitud» with reasons as radio rows and no checkboxes', async () => {
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')

    expect(byId(wrapper, 'drawer-title').text()).toBe('Cancelar solicitud')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(4)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(byId(wrapper, 'radio-NOT_ACTIONABLE').attributes('aria-checked')).toBe('true')
  })

  it('«Otro motivo» needs the internal note: nothing is sent until it is written', async () => {
    api.cancel.mockResolvedValue(ok())
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')

    await pick(wrapper, 'OTHER')
    await submit(wrapper)
    expect(api.cancel).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Con «Otro motivo» la nota interna es obligatoria.')

    await type(wrapper, 'cancel-note', 'Fuera de giro')
    await submit(wrapper)
    expect(api.cancel).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 4, reason: 'OTHER', note: 'Fuera de giro' },
      KEY,
    )
  })

  it('sends the customer message, toasts and closes the sheet', async () => {
    api.cancel.mockResolvedValue(ok())
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')

    await type(wrapper, 'cancel-customer-note', 'Por ahora no podemos ayudarte con eso.')
    await submit(wrapper)

    expect(api.cancel).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 4, reason: 'NOT_ACTIONABLE', customerNote: 'Por ahora no podemos ayudarte con eso.' },
      KEY,
    )
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({
      title: 'Solicitud cancelada',
      description: 'El bot enviará tu mensaje al cliente.',
    })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })

  it('hides «Mensaje para el cliente» and never sends it with «Duplicada»', async () => {
    api.cancel.mockResolvedValue(ok())
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')

    await type(wrapper, 'cancel-customer-note', 'No debe salir')
    await pick(wrapper, 'DUPLICATE')
    expect(wrapper.find('[data-testid="cancel-customer-note"]').exists()).toBe(false)
    expect(byId(wrapper, 'cancel-duplicate-hint').text()).toContain('no se envía mensaje al cliente')
    await submit(wrapper)

    expect(api.cancel.mock.calls[0]![1]).toEqual({ expectedVersion: 4, reason: 'DUPLICATE' })
  })

  it('limits both notes to 500 characters', async () => {
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')
    expect(byId(wrapper, 'cancel-note').attributes('maxlength')).toBe('500')
    expect(byId(wrapper, 'cancel-customer-note').attributes('maxlength')).toBe('500')
  })

  it('keeps the form and what was typed on a conflict, with the notice inside the sheet', async () => {
    api.cancel.mockRejectedValue(
      axiosError(409, { code: 'REQUEST_CLAIMED_BY_OTHER', current: { claimedBy: { id: 'u-2', displayName: 'Luis Ortega' } } }),
    )
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')
    await type(wrapper, 'cancel-note', 'Pregunta fuera de giro')
    await submit(wrapper)

    expect(byId(wrapper, 'drawer').text()).toContain('Luis Ortega ya tomó esta solicitud')
    expect((byId(wrapper, 'cancel-note').element as HTMLTextAreaElement).value).toBe('Pregunta fuera de giro')
    expect(wrapper.findAll('[data-testid="command-notice"]')).toHaveLength(1)
  })

  it('shows a 400 validation error under its field', async () => {
    api.cancel.mockRejectedValue(
      axiosError(400, {
        code: 'VALIDATION_ERROR',
        message: [{ property: 'note', constraints: { maxLength: 'note too long' } }],
      }),
    )
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')
    await submit(wrapper)

    expect(wrapper.find('[data-testid="command-notice"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Revisa este campo.')
  })

  it('moves the notice to the rail when the sheet is closed', async () => {
    api.cancel.mockRejectedValue(axiosError(409, { code: 'REQUEST_CLOSED' }))
    const wrapper = mountHost(clarification())
    await start(wrapper, 'CANCEL')
    await submit(wrapper)
    await byId(wrapper, 'drawer-close').trigger('click')

    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
    expect(byId(wrapper, 'command-notice-title').text()).toBe('Esta solicitud ya se cerró')
  })

  it('closes the form when a refetch says the action is no longer allowed', async () => {
    const wrapper = mountHost(makeDetail({ kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', decision: null, allowedActions: ['CANCEL'] }))
    await start(wrapper, 'CANCEL')
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(true)

    await wrapper.setProps({ detail: makeDetail({ status: 'CANCELLED', allowedActions: [] }) })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })
})

describe('RequestCommandHost — reassign', () => {
  const held = () => makeDetail({ status: 'IN_PROGRESS', assignee: { id: 'u-1', displayName: 'Laura' }, version: 2 })
  const people = { items: [{ id: 'u-1', displayName: 'Laura' }, { id: 'u-2', displayName: 'Luis Ortega' }] }

  it('lists the assignable people (not the holder) only with update:ChatbotRequestAssignment', async () => {
    auth.perms.add('update:ChatbotRequestAssignment')
    api.listAssignableUsers.mockResolvedValue(people)
    const wrapper = mountHost(held())

    expect(api.listAssignableUsers).not.toHaveBeenCalled()
    await start(wrapper, 'REASSIGN')

    expect(api.listAssignableUsers).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="radio-u-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="radio-u-1"]').exists()).toBe(false)
  })

  it('never requests the list without the permission', async () => {
    api.listAssignableUsers.mockResolvedValue(people)
    const wrapper = mountHost(held())
    await start(wrapper, 'REASSIGN')

    expect(api.listAssignableUsers).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="reassign-empty"]').exists()).toBe(true)
  })

  it('requires an assignee, then sends toUserId and the optional note', async () => {
    auth.perms.add('update:ChatbotRequestAssignment')
    api.listAssignableUsers.mockResolvedValue(people)
    api.reassign.mockResolvedValue(ok())
    const wrapper = mountHost(held())
    await start(wrapper, 'REASSIGN')

    await submit(wrapper)
    expect(api.reassign).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Elige a quién se la pasas.')

    await pick(wrapper, 'u-2')
    await type(wrapper, 'reassign-note', 'Cambio de turno')
    await submit(wrapper)

    expect(api.reassign).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 2, toUserId: 'u-2', note: 'Cambio de turno' },
      KEY,
    )
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({
      title: 'Solicitud reasignada',
      description: 'Ahora la atiende Luis Ortega.',
    })
  })

  it('shows USER_NOT_ASSIGNABLE under the picker and keeps the form', async () => {
    auth.perms.add('update:ChatbotRequestAssignment')
    api.listAssignableUsers.mockResolvedValue(people)
    api.reassign.mockRejectedValue(axiosError(422, { code: 'USER_NOT_ASSIGNABLE' }))
    const wrapper = mountHost(held())
    await start(wrapper, 'REASSIGN')
    await pick(wrapper, 'u-2')
    await submit(wrapper)

    expect(wrapper.text()).toContain('Esa persona no puede atender solicitudes en esta sucursal.')
    expect(wrapper.find('[data-testid="command-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(true)
  })
})

describe('RequestCommandHost — resolve RESTOCK and EXPIRATION', () => {
  it('RESTOCK: days between 1 and 365', async () => {
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(makeDetail({ version: 1 }))
    await start(wrapper, 'RESOLVE')

    expect(byId(wrapper, 'drawer-title').text()).toBe('Resolver · Reposición')
    expect(byId(wrapper, 'resolve-claims').text()).toBe('Al resolver también la tomas.')

    await type(wrapper, 'restock-days', '400')
    await submit(wrapper)
    expect(api.resolve).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe un número de días entre 1 y 365.')

    await type(wrapper, 'restock-days', '7')
    await submit(wrapper)
    expect(api.resolve).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 1, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 7 },
      KEY,
    )
    expect(toastAdd.mock.calls[0]![0].title).toBe('Solicitud resuelta')
  })

  it('RESTOCK: «No hay fecha estimada» sends the bare action', async () => {
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(makeDetail({ version: 1 }))
    await start(wrapper, 'RESOLVE')

    await pick(wrapper, 'NONE')
    expect(wrapper.find('[data-testid="restock-days"]').exists()).toBe(false)
    await submit(wrapper)

    expect(api.resolve.mock.calls[0]![1]).toEqual({
      expectedVersion: 1,
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
    })
  })

  const expiration = () =>
    makeDetail({
      subtype: 'EXPIRATION',
      version: 2,
      decision: {
        subtype: 'EXPIRATION',
        snapshot: {
          branchId: 'b-1',
          branchName: 'Centro',
          productId: 'p-1',
          productName: 'Antiparasitario',
          unit: null,
          variantId: null,
          variantName: null,
          variantOption: null,
          variantValue: null,
        },
        resolution: null,
      },
    })

  it('EXPIRATION: text up to 500, or «No disponible»', async () => {
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(expiration())
    await start(wrapper, 'RESOLVE')
    expect(byId(wrapper, 'expiration-text').attributes('maxlength')).toBe('500')

    await submit(wrapper)
    expect(api.resolve).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe la caducidad que verá el cliente.')

    await type(wrapper, 'expiration-text', 'marzo de 2027')
    await submit(wrapper)
    expect(api.resolve.mock.calls[0]![1]).toEqual({
      expectedVersion: 2,
      action: 'PROVIDE_EXPIRATION_TEXT',
      expirationText: 'marzo de 2027',
    })
  })

  it('EXPIRATION: «No disponible» sends the bare action', async () => {
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(expiration())
    await start(wrapper, 'RESOLVE')
    await pick(wrapper, 'NONE')
    await submit(wrapper)
    expect(api.resolve.mock.calls[0]![1]).toEqual({ expectedVersion: 2, action: 'REPORT_EXPIRATION_UNAVAILABLE' })
  })
})

describe('RequestCommandHost — resolve TRANSFER_RECEIPT', () => {
  const receipt = () =>
    makeDetail({
      subtype: 'TRANSFER_RECEIPT',
      status: 'IN_PROGRESS',
      assignee: { id: 'u-1', displayName: 'Laura' },
      version: 2,
      decision: {
        subtype: 'TRANSFER_RECEIPT',
        receiptId: 'rc-1',
        saleId: 'sale-1',
        saleFolio: 'V-1042',
        declaredAmountCents: 184000,
        declaredAmountProvided: true,
        declaredDate: null,
        declaredReference: null,
        saleTotalCents: 184000,
        salePaidCents: 0,
        saleDebtCents: 184000,
        file: null,
        extracted: null,
        mismatch: null,
        resolution: null,
      },
    })

  it('confirm needs an amount of at least 1 cent and sends it in cents', async () => {
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(receipt())
    await start(wrapper, 'RESOLVE')
    expect(wrapper.find('[data-testid="resolve-claims"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('El cliente declaró')

    await type(wrapper, 'receipt-amount', '0')
    await submit(wrapper)
    expect(api.resolve).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('El monto debe ser mayor que $0.00.')

    await type(wrapper, 'receipt-amount', '1840.00')
    await submit(wrapper)
    expect(api.resolve.mock.calls[0]![1]).toEqual({ expectedVersion: 2, action: 'CONFIRM_RECEIPT', amountCents: 184000 })
  })

  it('reject needs the internal reason and the customer message (1–300)', async () => {
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(receipt())
    await start(wrapper, 'RESOLVE')
    await pick(wrapper, 'REJECT')

    expect(byId(wrapper, 'receipt-reason').attributes('maxlength')).toBe('1000')
    expect(byId(wrapper, 'receipt-customer-reason').attributes('maxlength')).toBe('300')
    await submit(wrapper)
    expect(api.resolve).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe el motivo interno.')
    expect(wrapper.text()).toContain('El mensaje para el cliente es obligatorio.')

    await type(wrapper, 'receipt-reason', 'monto distinto')
    await type(wrapper, 'receipt-customer-reason', 'El monto no coincide, envíanos otro comprobante.')
    await submit(wrapper)
    expect(api.resolve.mock.calls[0]![1]).toEqual({
      expectedVersion: 2,
      action: 'REJECT_RECEIPT',
      reason: 'monto distinto',
      customerReason: 'El monto no coincide, envíanos otro comprobante.',
    })
  })
})

describe('RequestCommandHost — resolve DELIVERY_ZONE', () => {
  const zone = () =>
    makeDetail({
      subtype: 'DELIVERY_ZONE',
      version: 3,
      decision: {
        subtype: 'DELIVERY_ZONE',
        validationId: 'val-1',
        zipCode: '44150',
        state: 'Jalisco',
        municipality: 'Guadalajara',
        neighborhood: 'Lafayette',
        requesterCount: 5,
        lastCustomerMessageAt: null,
        resolution: null,
      },
      zoneImpact: { requests: 4, customers: 3, setVersion: 7 },
    })

  it('shows the impact read fresh from the zone-impact route', async () => {
    api.getZoneImpact.mockResolvedValue({ requests: 5, customers: 4, setVersion: 8 })
    const wrapper = mountHost(zone())
    await start(wrapper, 'RESOLVE')

    expect(api.getZoneImpact).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(byId(wrapper, 'zone-impact-text').text()).toBe('Esto resolverá 5 solicitudes de 4 clientes')
  })

  it('approves with the zone type, sends both versions and tells how many siblings closed', async () => {
    api.getZoneImpact.mockResolvedValue({ requests: 4, customers: 3, setVersion: 7 })
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(zone())
    await start(wrapper, 'RESOLVE')

    await pick(wrapper, 'SURCHARGE')
    await submit(wrapper)
    expect(api.resolve).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe un cargo mayor a $0.00.')

    await type(wrapper, 'zone-surcharge', '50')
    await type(wrapper, 'zone-eta', '3')
    await submit(wrapper)

    expect(api.resolve).toHaveBeenCalledWith(
      'req-1',
      {
        expectedVersion: 3,
        action: 'APPROVE_DELIVERY_ZONE',
        zoneType: 'SURCHARGE',
        surchargeCents: 5000,
        etaDays: 3,
        expectedZoneSetVersion: 7,
      },
      KEY,
    )
    expect(toastAdd.mock.calls[0]![0].description).toBe('También se resolvieron 3 del mismo código postal.')
  })

  it('rejects with expectedZoneSetVersion only', async () => {
    api.getZoneImpact.mockResolvedValue({ requests: 4, customers: 3, setVersion: 7 })
    api.resolve.mockResolvedValue(ok())
    const wrapper = mountHost(zone())
    await start(wrapper, 'RESOLVE')
    await pick(wrapper, 'REJECT')
    await submit(wrapper)

    expect(api.resolve.mock.calls[0]![1]).toEqual({
      expectedVersion: 3,
      action: 'REJECT_DELIVERY_ZONE',
      expectedZoneSetVersion: 7,
    })
  })

  it('on ZONE_SET_CHANGED shows the new impact and the next confirmation sends the new setVersion', async () => {
    api.getZoneImpact.mockResolvedValue({ requests: 4, customers: 3, setVersion: 7 })
    api.resolve
      .mockRejectedValueOnce(
        axiosError(409, {
          code: 'ZONE_SET_CHANGED',
          current: { version: 3, zoneImpact: { requests: 5, customers: 4, setVersion: 8 } },
        }),
      )
      .mockResolvedValueOnce(ok())
    const wrapper = mountHost(zone())
    await start(wrapper, 'RESOLVE')
    await pick(wrapper, 'CARRIER_ONLY')
    await submit(wrapper)

    expect(byId(wrapper, 'command-notice-title').text()).toBe('Cambiaron los clientes de este código postal')
    expect(byId(wrapper, 'zone-impact-text').text()).toBe('Esto resolverá 5 solicitudes de 4 clientes')
    expect(byId(wrapper, 'command-submit').text()).toBe('Confirmar con los datos nuevos')
    expect(api.resolve).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="notice-reconfirm"]').exists()).toBe(false)

    await submit(wrapper)
    expect(api.resolve).toHaveBeenCalledTimes(2)
    expect(api.resolve.mock.calls[1]![1]).toEqual({
      expectedVersion: 3,
      action: 'APPROVE_DELIVERY_ZONE',
      zoneType: 'CARRIER_ONLY',
      expectedZoneSetVersion: 8,
    })
    expect(api.resolve.mock.calls[1]![2]).not.toBe(api.resolve.mock.calls[0]![2])
    expect(toastAdd.mock.calls[0]![0].description).toBe('También se resolvieron 4 del mismo código postal.')
  })

  it('does not send a zone decision when the impact cannot be read', async () => {
    api.getZoneImpact.mockRejectedValue(new Error('Network Error'))
    const wrapper = mountHost(makeDetail({ ...zone(), zoneImpact: null }))
    await start(wrapper, 'RESOLVE')

    expect(wrapper.find('[data-testid="zone-impact-missing"]').exists()).toBe(true)
    expect(byId(wrapper, 'command-submit').attributes('disabled')).toBeDefined()
    expect(api.resolve).not.toHaveBeenCalled()
  })

  it('falls back to the impact of the detail while the fresh read is pending', async () => {
    api.getZoneImpact.mockReturnValue(new Promise(() => undefined))
    const wrapper = mountHost(zone())
    await start(wrapper, 'RESOLVE')
    expect(byId(wrapper, 'zone-impact-text').text()).toBe('Esto resolverá 4 solicitudes de 3 clientes')
  })
})

describe('RequestCommandHost — merge', () => {
  const merging = () =>
    makeDetail({
      kind: 'CLARIFICATION',
      subtype: 'UNKNOWN_QUESTION',
      decision: null,
      version: 2,
      allowedActions: ['MERGE'],
    })
  const candidates = {
    items: [makeRow({ id: 'req-9', folio: 'S-000141', summary: 'Factura persona moral', version: 4 })],
  }

  it('lists the candidates only with update:ChatbotRequest and sends both versions', async () => {
    api.listMergeCandidates.mockResolvedValue(candidates)
    api.merge.mockResolvedValue(ok())
    const wrapper = mountHost(merging())
    expect(api.listMergeCandidates).not.toHaveBeenCalled()

    await start(wrapper, 'MERGE')
    expect(api.listMergeCandidates).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(byId(wrapper, 'radio-req-9').text()).toContain('S-000141 · Factura persona moral')

    await submit(wrapper)
    expect(api.merge).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Elige la solicitud que se queda.')

    await pick(wrapper, 'req-9')
    await submit(wrapper)
    expect(api.merge).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 2, intoRequestId: 'req-9', intoExpectedVersion: 4 },
      KEY,
    )
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({
      title: 'Solicitudes unidas',
      description: 'S-000123 se unió con S-000141.',
    })
  })

  it('never requests candidates without update:ChatbotRequest', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    api.listMergeCandidates.mockResolvedValue(candidates)
    const wrapper = mountHost(merging())
    await start(wrapper, 'MERGE')

    expect(api.listMergeCandidates).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="pick-empty"]').exists()).toBe(true)
  })

  it('tells which side moved when the target version is stale (409 with current)', async () => {
    api.listMergeCandidates.mockResolvedValue(candidates)
    api.merge.mockRejectedValue(
      axiosError(409, { code: 'VERSION_CONFLICT', intoRequestId: 'req-9', current: { version: 5 } }),
    )
    const wrapper = mountHost(merging())
    await start(wrapper, 'MERGE')
    await pick(wrapper, 'req-9')
    await submit(wrapper)

    expect(byId(wrapper, 'command-notice-title').text()).toBe('La solicitud que se queda cambió')
    expect(byId(wrapper, 'command-notice-detail').text()).not.toContain('versión')
  })
})

describe('RequestCommandHost — link customer', () => {
  const unlinked = () =>
    makeDetail({
      version: 1,
      allowedActions: ['LINK_CUSTOMER'],
      customer: makeCustomer({
        id: null,
        displayName: null,
        ambiguous: true,
        candidates: [
          { id: 'c-a', displayName: 'Estética Canina', phone: '55 **** 0142', isTrusted: true, customerSince: null, lastOrderAt: '2026-11-05T10:00:00.000Z' },
          { id: 'c-b', displayName: 'Guadalupe Camarena', phone: '55 **** 0142', isTrusted: false, customerSince: null, lastOrderAt: null },
        ],
      }),
    })

  it('picks from detail.customer.candidates and sends customerId', async () => {
    api.linkCustomer.mockResolvedValue(ok())
    const wrapper = mountHost(unlinked())
    await start(wrapper, 'LINK_CUSTOMER')

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(2)
    await submit(wrapper)
    expect(api.linkCustomer).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Elige un cliente.')

    await pick(wrapper, 'c-b')
    await submit(wrapper)
    expect(api.linkCustomer).toHaveBeenCalledWith('req-1', { expectedVersion: 1, customerId: 'c-b' }, KEY)
    expect(toastAdd.mock.calls[0]![0]).toMatchObject({
      title: 'Cliente vinculado',
      description: 'Guadalupe Camarena quedó en esta y otras solicitudes del teléfono.',
    })
  })

  it('shows CUSTOMER_PHONE_MISMATCH under the picker', async () => {
    api.linkCustomer.mockRejectedValue(axiosError(422, { code: 'CUSTOMER_PHONE_MISMATCH', current: { version: 1 } }))
    const wrapper = mountHost(unlinked())
    await start(wrapper, 'LINK_CUSTOMER')
    await pick(wrapper, 'c-a')
    await submit(wrapper)

    expect(wrapper.text()).toContain('El teléfono de ese cliente no coincide con el de la solicitud.')
    expect(wrapper.find('[data-testid="command-notice"]').exists()).toBe(false)
  })
})

describe('RequestCommandHost — refresh of the feature cache', () => {
  it('invalidates the tenant key after a success', async () => {
    api.claim.mockResolvedValue(ok())
    const wrapper = mountHost()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await start(wrapper, 'CLAIM')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['chatbot-requests', 'tenant-1'] })
  })
})

describe('RequestCommandHost — reply to a clarification (T7b)', () => {
  const clarification = (overrides: Partial<ChatbotRequestDetail> = {}) =>
    makeDetail({
      kind: 'CLARIFICATION',
      subtype: 'UNKNOWN_QUESTION',
      decision: null,
      status: 'IN_PROGRESS',
      version: 4,
      assignee: { id: 'u-1', displayName: 'Laura' },
      allowedActions: ['RELEASE', 'REPLY', 'CANCEL'],
      ...overrides,
    })

  it('opens «Responder al cliente» with a plain textarea and a 0/1500 counter', async () => {
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')

    expect(byId(wrapper, 'drawer-title').text()).toBe('Responder al cliente')
    expect(wrapper.find('[data-testid="reply-form"]').exists()).toBe(true)
    expect(byId(wrapper, 'reply-text').element.tagName).toBe('TEXTAREA')
    expect(byId(wrapper, 'reply-text-count').text()).toBe('0/1500')
    expect(wrapper.find('[data-testid="reply-claims"]').exists()).toBe(false)
    await type(wrapper, 'reply-text', 'Hola')
    expect(byId(wrapper, 'reply-text-count').text()).toBe('4/1500')
  })

  it('on a NEW clarification says that replying also takes and resolves it', async () => {
    const wrapper = mountHost(clarification({ status: 'NEW', assignee: null, allowedActions: ['CLAIM', 'REPLY', 'CANCEL'] }))
    await start(wrapper, 'REPLY')
    expect(byId(wrapper, 'reply-claims').text()).toBe('Al responder también la tomas y la resuelves.')
  })

  it('sends {expectedVersion, text} trimmed with an Idempotency-Key, thanks and closes', async () => {
    api.reply.mockResolvedValue(ok(5))
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')

    await type(wrapper, 'reply-text', '  Sí, es apto desde las 8 semanas.  ')
    await submit(wrapper)

    expect(api.reply).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 4, text: 'Sí, es apto desde las 8 semanas.' },
      KEY,
    )
    expect(toastAdd).toHaveBeenCalledWith({
      title: 'Respuesta enviada',
      description: 'S-000123 quedó resuelta. El bot se la hará llegar al cliente.',
      color: 'success',
    })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })

  it('a blank reply shows the error under the field and sends nothing', async () => {
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')

    await type(wrapper, 'reply-text', '   ')
    await submit(wrapper)

    expect(api.reply).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('Escribe la respuesta para el cliente.')
  })

  it('NOT_ASSIGNEE keeps the form and the text, names the holder and offers «Actualizar»', async () => {
    api.reply.mockRejectedValue(
      axiosError(403, {
        code: 'NOT_ASSIGNEE',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: { id: 'u-2', displayName: 'Ana López' } },
      }),
    )
    const wrapper = mountHost(clarification({ status: 'NEW', assignee: null, allowedActions: ['CLAIM', 'REPLY'] }))
    await start(wrapper, 'REPLY')
    await type(wrapper, 'reply-text', 'Hola')
    await submit(wrapper)

    expect(byId(wrapper, 'command-notice-title').text()).toBe('La atiende Ana López')
    expect((byId(wrapper, 'reply-text').element as HTMLTextAreaElement).value).toBe('Hola')
    expect(toastAdd).not.toHaveBeenCalled()
  })

  it('REQUEST_CLOSED (someone answered first) says it was closed and refreshes', async () => {
    api.reply.mockRejectedValue(axiosError(409, { code: 'REQUEST_CLOSED' }))
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')
    await type(wrapper, 'reply-text', 'Hola')
    await submit(wrapper)

    expect(byId(wrapper, 'command-notice-title').text()).toBe('Esta solicitud ya se cerró')
    expect(wrapper.find('[data-testid="notice-refresh"]').exists()).toBe(true)
  })

  it('VERSION_CONFLICT behaves like the other commands: notice with the new version, text kept', async () => {
    api.reply.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT', current: { version: 6 } }))
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')
    await type(wrapper, 'reply-text', 'Hola')
    await submit(wrapper)

    expect(byId(wrapper, 'command-notice-title').text()).toBe('La solicitud cambió mientras la mirabas')
    expect((byId(wrapper, 'reply-text').element as HTMLTextAreaElement).value).toBe('Hola')
  })

  it('resending the same text after a network error reuses the Idempotency-Key', async () => {
    api.reply.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(ok(5))
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')
    await type(wrapper, 'reply-text', 'Hola')
    await submit(wrapper)
    await submit(wrapper)

    expect(api.reply).toHaveBeenCalledTimes(2)
    expect(api.reply.mock.calls[1]![2]).toBe(api.reply.mock.calls[0]![2])
  })

  it('closes the form when a refetch no longer offers REPLY', async () => {
    const wrapper = mountHost(clarification())
    await start(wrapper, 'REPLY')
    await wrapper.setProps({ detail: clarification({ allowedActions: ['CANCEL'] }) })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })
})

describe('RequestCommandHost — finish a conversation (T7c)', () => {
  const live = (overrides: Partial<ChatbotRequestDetail> = {}) =>
    makeDetail({
      kind: 'CONVERSATION',
      subtype: 'TALK_TO_HUMAN',
      decision: null,
      status: 'IN_PROGRESS',
      version: 6,
      assignee: { id: 'u-1', displayName: 'Laura' },
      allowedActions: ['FINISH'],
      ...overrides,
    })
  const complaint = (overrides: Partial<ChatbotRequestDetail> = {}) => live({ subtype: 'COMPLAINT', ...overrides })

  it('opens «Finalizar conversación» with an internal note and no outcome for a non-complaint', async () => {
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')

    expect(byId(wrapper, 'drawer-title').text()).toBe('Finalizar conversación')
    expect(byId(wrapper, 'finish-note').element.tagName).toBe('TEXTAREA')
    expect(byId(wrapper, 'finish-note-count').text()).toBe('0/1000')
    expect(wrapper.text()).toContain('Solo la ve el personal')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(0)
  })

  it('FINISH_IDLE opens the same form and says the customer has been silent for 30 minutes', async () => {
    const wrapper = mountHost(live({ allowedActions: ['FINISH', 'FINISH_IDLE'] }))
    await start(wrapper, 'FINISH_IDLE')

    expect(byId(wrapper, 'drawer-title').text()).toBe('Finalizar conversación')
    expect(byId(wrapper, 'finish-idle').text()).toContain('30 min')
    expect(wrapper.find('[data-testid="finish-note"]').exists()).toBe(true)
  })

  it('plain FINISH does not claim the customer is idle', async () => {
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')
    expect(wrapper.find('[data-testid="finish-idle"]').exists()).toBe(false)
  })

  it('sends {expectedVersion, note} without complaintOutcome for a non-complaint', async () => {
    api.finish.mockResolvedValue(ok(7))
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')

    await type(wrapper, 'finish-note', '  Resuelto por teléfono  ')
    await submit(wrapper)

    expect(api.finish).toHaveBeenCalledWith('req-1', { expectedVersion: 6, note: 'Resuelto por teléfono' }, KEY)
    expect(toastAdd).toHaveBeenCalledWith({
      title: 'Conversación finalizada',
      description: 'S-000123 quedó resuelta.',
      color: 'success',
    })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })

  it('a complaint shows the four outcomes as radio rows, none preselected, no checkboxes', async () => {
    const wrapper = mountHost(complaint())
    await start(wrapper, 'FINISH')

    const labels = wrapper.findAll('[role="radio"]').map((row) => row.text())
    expect(labels).toEqual([
      expect.stringContaining('Devolución'),
      expect.stringContaining('Reemplazo'),
      expect.stringContaining('Reembolso'),
      expect.stringContaining('Sin acción'),
    ])
    expect(wrapper.findAll('[role="radio"][aria-checked="true"]')).toHaveLength(0)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('a complaint cannot be finished without an outcome: the error shows on the selector and nothing is sent', async () => {
    const wrapper = mountHost(complaint())
    await start(wrapper, 'FINISH')

    await type(wrapper, 'finish-note', 'Se atendió')
    await submit(wrapper)

    expect(api.finish).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('Elige cómo terminó la queja.')
  })

  it('a complaint sends the chosen complaintOutcome', async () => {
    api.finish.mockResolvedValue(ok(7))
    const wrapper = mountHost(complaint())
    await start(wrapper, 'FINISH')

    await pick(wrapper, 'REFUND')
    await type(wrapper, 'finish-note', 'Se devolvió el dinero')
    await submit(wrapper)

    expect(api.finish).toHaveBeenCalledWith(
      'req-1',
      { expectedVersion: 6, note: 'Se devolvió el dinero', complaintOutcome: 'REFUND' },
      KEY,
    )
  })

  it('an empty note shows its error and sends nothing', async () => {
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')
    await submit(wrapper)
    expect(api.finish).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('Escribe una nota interna.')
  })

  it('a 422 COMPLAINT_OUTCOME_REQUIRED (fieldErrors complaintOutcome) lands on the selector, form kept', async () => {
    api.finish.mockRejectedValue(
      axiosError(422, {
        code: 'COMPLAINT_OUTCOME_REQUIRED',
        fieldErrors: [{ path: 'complaintOutcome', code: 'REQUIRED' }],
      }),
    )
    const wrapper = mountHost(complaint())
    await start(wrapper, 'FINISH')
    await pick(wrapper, 'RETURN')
    await type(wrapper, 'finish-note', 'Listo')
    await submit(wrapper)

    expect(api.finish).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="alert"]').text()).toBe('Elige cómo terminó la queja.')
    expect(wrapper.find('[data-testid="command-notice"]').exists()).toBe(false)
    expect((byId(wrapper, 'finish-note').element as HTMLTextAreaElement).value).toBe('Listo')
  })

  it('SESSION_NOT_ACTIVE keeps the form and shows the notice with «Actualizar»', async () => {
    api.finish.mockRejectedValue(axiosError(409, { code: 'SESSION_NOT_ACTIVE' }))
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')
    await type(wrapper, 'finish-note', 'Listo')
    await submit(wrapper)

    expect(byId(wrapper, 'command-notice-title').text()).toBe('No se pudo aplicar tu acción')
    expect(wrapper.get('[data-testid="command-notice"]').text()).toContain('La conversación no está activa')
    expect(wrapper.find('[data-testid="notice-refresh"]').exists()).toBe(true)
  })

  it('VERSION_CONFLICT shows the new version, and the resend carries the refreshed version', async () => {
    api.finish.mockRejectedValue(axiosError(409, { code: 'VERSION_CONFLICT', current: { version: 8 } }))
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')
    await type(wrapper, 'finish-note', 'Listo')
    await submit(wrapper)
    expect(byId(wrapper, 'command-notice-title').text()).toBe('La solicitud cambió mientras la mirabas')

    api.finish.mockResolvedValue(ok(9))
    await wrapper.setProps({ detail: live({ version: 8 }) })
    await submit(wrapper)
    expect(api.finish).toHaveBeenLastCalledWith('req-1', { expectedVersion: 8, note: 'Listo' }, KEY)
  })

  it('closes the form when neither FINISH nor FINISH_IDLE is offered any more', async () => {
    const wrapper = mountHost(live())
    await start(wrapper, 'FINISH')
    await wrapper.setProps({ detail: live({ allowedActions: [] }) })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(false)
  })

  it('keeps the form open while FINISH_IDLE alone is still offered', async () => {
    const wrapper = mountHost(live({ allowedActions: ['FINISH_IDLE'] }))
    await start(wrapper, 'FINISH_IDLE')
    await wrapper.setProps({ detail: live({ allowedActions: ['FINISH_IDLE'], version: 7 }) })
    expect(wrapper.find('[data-testid="drawer"]').exists()).toBe(true)
  })
})
