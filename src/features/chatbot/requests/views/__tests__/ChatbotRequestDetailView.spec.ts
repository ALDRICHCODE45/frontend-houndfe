import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { axiosError } from '../../composables/__tests__/withQuery'
import { DETAIL_STUBS, makeAuditEvent, makeCustomer, makeDetail } from '../../utils/detail-fixture'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type { ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

const route = vi.hoisted(() => ({ params: { id: 'req-1' } as Record<string, string> }))
const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

vi.mock('../../api/chatbot-request.api', () => ({
  chatbotRequestApi: { getDetail: vi.fn(), listAudit: vi.fn() },
}))
vi.mock('../../api/chatbot-conversation.api', () => ({
  chatbotConversationApi: { getPage: vi.fn(), getMedia: vi.fn() },
}))

const auth = vi.hoisted(() => ({
  perms: new Set<string>(),
  tenantId: 'tenant-1',
  userId: 'u-1',
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    user: { id: auth.userId },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

import { chatbotRequestApi } from '../../api/chatbot-request.api'
import { chatbotConversationApi } from '../../api/chatbot-conversation.api'
import ChatbotRequestDetailView from '../ChatbotRequestDetailView.vue'
import { makeMessage } from '../../utils/conversation-fixture'

const getDetail = vi.mocked(chatbotRequestApi.getDetail)
const listAudit = vi.mocked(chatbotRequestApi.listAudit)
const getPage = vi.mocked(chatbotConversationApi.getPage)

const ALL_PERMS = ['read:ChatbotRequest', 'read:CustomerPhone', 'read:ChatbotConversation']

async function mountView(detail: ChatbotRequestDetail | Error = makeDetail()) {
  if (detail instanceof Error) getDetail.mockRejectedValue(detail)
  else getDetail.mockResolvedValue(detail)
  const wrapper = mount(ChatbotRequestDetailView, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]],
      stubs: {
        ...DETAIL_STUBS,
        // The frame is plain layout: render its three slots so the footer bar is reachable.
        EmptyState: {
          props: ['kind', 'title', 'description', 'actionLabel'],
          emits: ['action'],
          template:
            '<div data-testid="empty-state" :data-kind="kind"><p data-testid="empty-title">{{ title }}</p><p>{{ description }}</p><button v-if="actionLabel" data-testid="empty-action" @click="$emit(\'action\')">{{ actionLabel }}</button></div>',
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  getDetail.mockReset()
  listAudit.mockReset()
  getPage.mockReset()
  getPage.mockResolvedValue({ items: [], hasMoreBefore: false })
  push.mockReset()
  route.params = { id: 'req-1' }
  auth.perms = new Set(ALL_PERMS)
  auth.tenantId = 'tenant-1'
  auth.userId = 'u-1'
})

describe('ChatbotRequestDetailView — header and main column', () => {
  it('loads the request of the route and shows folio, subtype, status and the summary', async () => {
    const wrapper = await mountView()
    expect(getDetail).toHaveBeenCalledWith('req-1', { signal: expect.anything() })
    expect(wrapper.get('[data-testid="request-folio"]').text()).toBe('S-000123')
    expect(wrapper.get('h1').text()).toBe('Croquetas 15 kg para el viernes')
    const header = wrapper.get('[data-slot="header"]').text()
    expect(header).toContain('Reposición')
    expect(header).toContain('Nueva')
    expect(wrapper.get('[data-testid="breadcrumb-inbox"]').text()).toBe('Solicitudes')
  })

  it('shows the phone as the server sent it and no restriction note with read:CustomerPhone', async () => {
    const wrapper = await mountView(makeDetail({ customer: makeCustomer({ phone: '+523312345678' }) }))
    expect(wrapper.get('[data-testid="customer-phone"]').text()).toBe('+523312345678')
    expect(wrapper.find('[data-testid="phone-restricted"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="limited-view"]').exists()).toBe(false)
  })

  it('masks nothing itself but explains the restriction and the limited view without read:CustomerPhone', async () => {
    auth.perms.delete('read:CustomerPhone')
    const wrapper = await mountView(makeDetail({ customer: makeCustomer({ phone: '+5233 **** 5678' }) }))
    expect(wrapper.get('[data-testid="customer-phone"]').text()).toBe('+5233 **** 5678')
    expect(wrapper.find('[data-testid="phone-restricted"]').exists()).toBe(true)
    const limited = wrapper.get('[data-testid="limited-view"]').text()
    expect(limited).toContain('Vista limitada por tu rol')
    expect(limited).toContain('teléfono completo')
    expect(limited).not.toContain('conversación')
  })

  it('reads and shows the conversation only with read:ChatbotConversation, limited note otherwise', async () => {
    getPage.mockResolvedValue({
      items: [makeMessage({ seq: 1, text: 'Hola, ¿tienen croquetas?' })],
      hasMoreBefore: false,
    })
    const withIt = await mountView()
    expect(getPage).toHaveBeenCalledWith('req-1', { limit: 50 }, { signal: expect.anything() })
    expect(withIt.get('[data-testid="detail-conversation"]').text()).toContain('Hola, ¿tienen croquetas?')
    expect(withIt.text()).not.toContain('Disponible próximamente')

    getPage.mockClear()
    auth.perms.delete('read:ChatbotConversation')
    const without = await mountView()
    expect(without.find('[data-testid="detail-conversation"]').exists()).toBe(false)
    expect(without.get('[data-testid="limited-view"]').text()).toContain('conversación')
    expect(getPage).not.toHaveBeenCalled()
  })

  it('shows «Todavía no hay mensajes» for a loaded empty conversation', async () => {
    const wrapper = await mountView()
    expect(wrapper.get('[data-testid="conversation-empty"]').text()).toContain('Todavía no hay mensajes')
  })

  it('opening the conversation does not fetch the detail again (its unread count is zeroed in cache)', async () => {
    getPage.mockResolvedValue({ items: [makeMessage({ seq: 1 })], hasMoreBefore: false })
    await mountView(makeDetail({ unreadCustomerMessages: 3 }))
    await flushPromises()
    expect(getPage).toHaveBeenCalledTimes(1)
    expect(getDetail).toHaveBeenCalledTimes(1)
  })

  it('lists both missing permissions in the limited view', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    const wrapper = await mountView()
    const limited = wrapper.get('[data-testid="limited-view"]').text()
    expect(limited).toContain('teléfono completo')
    expect(limited).toContain('conversación')
  })

  it('renders needs and context as plain text', async () => {
    const wrapper = await mountView(
      makeDetail({ needs: '<b>Necesita</b> 6 piezas', context: { cartRef: 'cart-9', quantity: 6 } }),
    )
    expect(wrapper.get('[data-testid="request-needs"]').text()).toBe('<b>Necesita</b> 6 piezas')
    expect(wrapper.find('[data-testid="request-needs"] b').exists()).toBe(false)
    expect(wrapper.get('[data-testid="request-context"]').text()).toContain('cart-9')
  })

  it('shows the decision read view and, for a zone, the impact', async () => {
    const restock = await mountView()
    expect(restock.get('[data-testid="request-decision"]').text()).toContain('Croquetas Premium Adulto 15 kg')

    const zone = await mountView(
      makeDetail({
        subtype: 'DELIVERY_ZONE',
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
      }),
    )
    expect(zone.get('[data-testid="zone-impact"]').text()).toContain('Esto resolverá 4 solicitudes de 3 clientes')
  })

  it('has no decision block for a request without decision', async () => {
    const wrapper = await mountView(makeDetail({ kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', decision: null }))
    expect(wrapper.find('[data-testid="request-decision"]').exists()).toBe(false)
  })

  it('links the customer\'s other open requests to their detail', async () => {
    const wrapper = await mountView(
      makeDetail({ otherOpenRequests: [makeRow({ id: 'req-2', folio: 'S-000131', summary: 'Caducidad del lote' })] }),
    )
    const link = wrapper.get('[data-testid="other-open-link"]')
    expect(JSON.parse(link.attributes('data-to')!)).toEqual({
      name: 'chatbot-request-detail',
      params: { id: 'req-2' },
    })
    expect(link.text()).toContain('Caducidad del lote')
  })

  it('shows the deliveries only when there are some', async () => {
    expect((await mountView()).find('[data-testid="deliveries"]').exists()).toBe(false)
    const wrapper = await mountView(
      makeDetail({
        deliveries: [
          {
            deliveryId: 'd-1',
            type: 'RESOLUTION',
            createdAt: '2026-11-11T16:00:00.000Z',
            outcome: 'DELIVERY_UNKNOWN',
            attemptedAt: null,
            providerStatus: null,
            needsReconciliation: true,
          },
        ],
      }),
    )
    expect(wrapper.get('[data-testid="deliveries"]').text()).toContain('Entrega dudosa')
  })
})

describe('ChatbotRequestDetailView — audit', () => {
  const detail = () =>
    makeDetail({
      audit: [
        makeAuditEvent('CLAIMED', { id: 'e-2', actor: { kind: 'USER', id: 'u-1', displayName: 'Laura Méndez' } }),
        makeAuditEvent('CREATED', { id: 'e-1', actor: { kind: 'SYSTEM', id: null, displayName: null } }),
      ],
      auditNextCursor: 'cursor-1',
    })

  it('shows the latest events with labels and «Ver más eventos» while the detail has a cursor', async () => {
    const wrapper = await mountView(detail())
    const items = wrapper.findAll('[data-testid="audit-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Tomada por ti')
    expect(items[1]!.text()).toContain('Solicitud creada')
    expect(wrapper.get('[data-testid="audit-more"]').text()).toContain('Ver más eventos')
    expect(listAudit).not.toHaveBeenCalled()
  })

  it('«Ver más eventos» asks for the audit pages and shows them, with no more button at the end', async () => {
    listAudit.mockResolvedValue({
      items: [
        makeAuditEvent('CLAIMED', { id: 'e-2' }),
        makeAuditEvent('CREATED', { id: 'e-1' }),
        makeAuditEvent('RESOLVED', { id: 'e-0', data: { action: 'CONFIRM_RECEIPT' } }),
      ],
      nextCursor: null,
    })
    const wrapper = await mountView(detail())
    await wrapper.get('[data-testid="audit-more"]').trigger('click')
    await flushPromises()

    expect(listAudit).toHaveBeenCalledTimes(1)
    expect(listAudit.mock.calls[0]![0]).toBe('req-1')
    expect(wrapper.findAll('[data-testid="audit-item"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Confirmó el comprobante')
    expect(wrapper.find('[data-testid="audit-more"]').exists()).toBe(false)
  })

  it('asks for the next page while the audit still has a cursor', async () => {
    listAudit
      .mockResolvedValueOnce({ items: [makeAuditEvent('CLAIMED', { id: 'e-2' })], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [makeAuditEvent('CREATED', { id: 'e-1' })], nextCursor: null })
    const wrapper = await mountView(detail())
    await wrapper.get('[data-testid="audit-more"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="audit-item"]')).toHaveLength(1)

    await wrapper.get('[data-testid="audit-more"]').trigger('click')
    await flushPromises()
    expect(listAudit).toHaveBeenCalledTimes(2)
    expect(listAudit.mock.calls[1]![1]).toMatchObject({ cursor: 'c2' })
    expect(wrapper.findAll('[data-testid="audit-item"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="audit-more"]').exists()).toBe(false)
  })

  it('has no «Ver más eventos» when the detail has no cursor', async () => {
    const wrapper = await mountView(makeDetail({ auditNextCursor: null }))
    expect(wrapper.find('[data-testid="audit-more"]').exists()).toBe(false)
  })
})

describe('ChatbotRequestDetailView — rail', () => {
  it('shows «Tiempo límite» with the light, the deadline and the assignee', async () => {
    const wrapper = await mountView(
      makeDetail({
        status: 'IN_PROGRESS',
        displayStatus: 'IN_PROGRESS',
        assignee: { id: 'u-2', displayName: 'Luis Ortega' },
        resolveDeadlineAt: '2099-01-01T18:00:00.000Z',
        slaLevel: 'HALF',
      }),
    )
    const rail = wrapper.get('[data-testid="sla-panel"]')
    expect(rail.text()).toContain('Tiempo límite')
    expect(rail.get('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('warn')
    expect(rail.find('[data-testid="deadline-resolve"]').exists()).toBe(true)
    expect(rail.get('[data-testid="assignee"]').text()).toBe('La atiende Luis Ortega')
  })

  it('says it is paused and when it resumes', async () => {
    const wrapper = await mountView(makeDetail({ slaPaused: true, slaResumesAt: '2099-01-02T15:00:00.000Z' }))
    const indicator = wrapper.get('[data-testid="sla-panel"] [data-testid="sla-indicator"]')
    expect(indicator.attributes('data-tone')).toBe('pause')
    expect(indicator.text()).toContain('se reanuda')
  })

  it('says when it expired', async () => {
    const wrapper = await mountView(
      makeDetail({ status: 'IN_PROGRESS', displayStatus: 'EXPIRED', slaLevel: 'OVERDUE', overdueAt: '2026-11-11T15:00:00.000Z' }),
    )
    expect(wrapper.get('[data-testid="overdue-note"]').text()).toContain('Sigue abierta')
  })

  it('renders allowedActions as enabled buttons and does nothing yet when they are clicked (unit 4)', async () => {
    const wrapper = await mountView(makeDetail({ allowedActions: ['CLAIM', 'CANCEL'] }))
    const panel = wrapper.get('[data-testid="action-panel"]')
    expect(panel.get('[data-testid="action-CLAIM"]').attributes('disabled')).toBeUndefined()
    expect(panel.get('[data-testid="action-CANCEL"]').attributes('disabled')).toBeUndefined()
    // The first conversation read already refreshed the detail once (the unread count resets).
    const readsBeforeClick = getDetail.mock.calls.length
    await panel.get('[data-testid="action-CLAIM"]').trigger('click')
    expect(getDetail).toHaveBeenCalledTimes(readsBeforeClick)
    expect(push).not.toHaveBeenCalled()
  })

  it('renders deniedActions as disabled buttons with the reason', async () => {
    const wrapper = await mountView(
      makeDetail({
        status: 'IN_PROGRESS',
        displayStatus: 'IN_PROGRESS',
        assignee: { id: 'u-2', displayName: 'Luis Ortega' },
        allowedActions: [],
        deniedActions: [{ action: 'RESOLVE', code: 'REQUEST_CLAIMED_BY_OTHER' }],
      }),
    )
    const panel = wrapper.get('[data-testid="action-panel"]')
    expect(panel.get('[data-testid="action-RESOLVE"]').attributes('disabled')).toBeDefined()
    expect(panel.get('[data-testid="denied-reason-RESOLVE"]').text()).toBe('La atiende Luis Ortega.')
  })

  it('puts the action bar in the footer for mobile, next to the rail panel for desktop', async () => {
    const wrapper = await mountView(makeDetail({ allowedActions: ['CLAIM', 'CANCEL'] }))
    const footer = wrapper.get('[data-slot="footer"]')
    const bar = footer.get('[data-testid="mobile-action-bar"]')
    expect(bar.get('[data-testid="bar-primary"]').text()).toContain('Atender')
    expect(bar.find('[data-testid="bar-more"]').exists()).toBe(true)
    expect(wrapper.find('[data-slot="scroll"] [data-testid="mobile-action-bar"]').exists()).toBe(false)
  })

  it('has no footer bar for a closed request', async () => {
    const wrapper = await mountView(
      makeDetail({ status: 'RESOLVED', displayStatus: 'RESOLVED', allowedActions: [], slaLevel: null }),
    )
    expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
  })
})

describe('ChatbotRequestDetailView — closed requests', () => {
  it('shows how a resolved request ended', async () => {
    const wrapper = await mountView(
      makeDetail({
        status: 'RESOLVED',
        displayStatus: 'RESOLVED',
        resolvedBy: { id: 'u-2', displayName: 'Luis Ortega' },
        closedAt: '2026-11-11T16:00:00.000Z',
        allowedActions: [],
        slaLevel: null,
      }),
    )
    const notice = wrapper.get('[data-testid="closed-notice"]').text()
    expect(notice).toContain('Solicitud resuelta')
    expect(notice).toContain('Luis Ortega')
  })

  it('shows the cancel cause and links «Fusionada en S-…» to the request that stayed', async () => {
    const cancelled = await mountView(
      makeDetail({
        status: 'CANCELLED',
        displayStatus: 'CANCELLED',
        cancelReason: 'STAFF',
        staffCancelReason: 'NOT_ACTIONABLE',
        allowedActions: [],
        slaLevel: null,
      }),
    )
    expect(cancelled.get('[data-testid="closed-notice"]').text()).toContain('No se puede atender')

    const merged = await mountView(
      makeDetail({
        status: 'CANCELLED',
        displayStatus: 'CANCELLED',
        cancelReason: 'SUPERSEDED',
        mergedInto: { id: 'req-9', folio: 'S-000009' },
        allowedActions: [],
        slaLevel: null,
      }),
    )
    const link = merged.get('[data-testid="merged-into-link"]')
    expect(link.text()).toBe('S-000009')
    expect(JSON.parse(link.attributes('data-to')!)).toEqual({
      name: 'chatbot-request-detail',
      params: { id: 'req-9' },
    })
  })
})

describe('ChatbotRequestDetailView — states', () => {
  it('shows a skeleton while the request loads', async () => {
    getDetail.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(ChatbotRequestDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient: new QueryClient() }]],
        stubs: DETAIL_STUBS,
      },
    })
    await flushPromises()
    expect(wrapper.get('[data-testid="detail-loading"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="customer-card"]').exists()).toBe(false)
  })

  it('shows the error with a retry that reads the request again', async () => {
    const wrapper = await mountView(axiosError(500))
    expect(wrapper.get('[data-testid="empty-state"]').attributes('data-kind')).toBe('error')
    expect(wrapper.get('[data-testid="empty-title"]').text()).toBe('No pudimos cargar la solicitud')

    getDetail.mockResolvedValue(makeDetail())
    await wrapper.get('[data-testid="empty-action"]').trigger('click')
    await flushPromises()
    // Retry read + the refresh the first conversation read triggers.
    expect(getDetail.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('Croquetas 15 kg para el viernes')
  })

  it('a network failure is the same retryable error', async () => {
    const wrapper = await mountView(new Error('Network Error'))
    expect(wrapper.get('[data-testid="empty-title"]').text()).toBe('No pudimos cargar la solicitud')
  })

  it('a 404 says «Esta solicitud ya no existe» and goes back to the inbox', async () => {
    const wrapper = await mountView(axiosError(404, { code: 'NOT_FOUND' }))
    expect(wrapper.get('[data-testid="empty-title"]').text()).toBe('Esta solicitud ya no existe')
    expect(wrapper.find('[data-testid="customer-card"]').exists()).toBe(false)
    await wrapper.get('[data-testid="empty-action"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'chatbot-requests' })
  })

  it('a 403 from the server is the forbidden state, not a retryable error', async () => {
    const wrapper = await mountView(axiosError(403, { code: 'FORBIDDEN' }))
    expect(wrapper.get('[data-testid="empty-state"]').attributes('data-kind')).toBe('forbidden')
    expect(wrapper.get('[data-testid="empty-title"]').text()).toContain('No tienes permiso')
    expect(wrapper.find('[data-testid="customer-card"]').exists()).toBe(false)
  })

  it('without read:ChatbotRequest it is forbidden and nothing is requested', async () => {
    auth.perms = new Set()
    const wrapper = await mountView()
    expect(getDetail).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="empty-state"]').attributes('data-kind')).toBe('forbidden')
    expect(wrapper.get('[data-testid="empty-title"]').text()).toContain('No tienes permiso')
  })

  it('keeps a way back to the inbox in the header of every state', async () => {
    const wrapper = await mountView(axiosError(404))
    expect(wrapper.find('[data-slot="header"] [data-testid="back-to-inbox"]').exists()).toBe(true)
  })
})

describe('ChatbotRequestDetailView — reply and finish outcome (T7)', () => {
  const answered = (overrides: Partial<ChatbotRequestDetail> = {}) =>
    makeDetail({
      kind: 'CLARIFICATION',
      subtype: 'UNKNOWN_QUESTION',
      decision: null,
      status: 'RESOLVED',
      displayStatus: 'RESOLVED',
      closedAt: '2026-11-12T16:00:00.000Z',
      allowedActions: [],
      reply: {
        id: 'r-1',
        text: 'Sí, es apto desde las 8 semanas.',
        repliedBy: { id: 'u-2', displayName: 'Ana López' },
        repliedAt: '2026-11-12T16:00:00.000Z',
      },
      deliveries: [
        {
          deliveryId: 'd-1',
          type: 'request.answered',
          createdAt: '2026-11-12T16:00:00.000Z',
          outcome: 'DEFERRED_WINDOW_CLOSED',
          attemptedAt: null,
          providerStatus: null,
          needsReconciliation: false,
        },
      ],
      audit: [makeAuditEvent('REPLIED', { data: { messageId: 'r-1' }, fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED' })],
      ...overrides,
    })

  it('shows «Respuesta enviada» with the text, author and the pending delivery', async () => {
    const wrapper = await mountView(answered())
    const block = wrapper.get('[data-testid="reply-block"]')
    expect(block.text()).toContain('Respuesta enviada')
    expect(block.text()).toContain('Sí, es apto desde las 8 semanas.')
    expect(block.text()).toContain('Ana López')
    expect(wrapper.get('[data-testid="reply-delivery"]').text()).toBe(
      'Pendiente: se enviará cuando el cliente escriba',
    )
  })

  it('renders the REPLIED audit row without the text', async () => {
    const wrapper = await mountView(answered())
    const rows = wrapper.findAll('[data-testid="audit-item"]').map((row) => row.text())
    expect(rows[0]).toContain('Respuesta enviada')
    expect(rows[0]).not.toContain('apto desde')
  })

  it('has no reply block while the clarification is unanswered or for a decision', async () => {
    expect((await mountView(answered({ reply: null }))).find('[data-testid="reply-block"]').exists()).toBe(false)
    expect((await mountView()).find('[data-testid="reply-block"]').exists()).toBe(false)
  })

  it('shows the complaint outcome label of a finished complaint, and the outcome in the FINISHED row', async () => {
    const wrapper = await mountView(
      makeDetail({
        kind: 'CONVERSATION',
        subtype: 'COMPLAINT',
        decision: null,
        status: 'RESOLVED',
        displayStatus: 'RESOLVED',
        closedAt: '2026-11-12T16:00:00.000Z',
        allowedActions: [],
        complaintOutcome: 'REPLACEMENT',
        audit: [
          makeAuditEvent('FINISHED', { data: { complaintOutcome: 'REPLACEMENT' }, fromStatus: 'IN_PROGRESS', toStatus: 'RESOLVED' }),
        ],
      }),
    )
    expect(wrapper.get('[data-testid="complaint-outcome"]').text()).toBe('Resultado de la queja: Reemplazo')
    expect(wrapper.get('[data-testid="audit-item"]').text()).toContain('Reemplazo')
  })

  it('shows no outcome line for a complaint closed by the system (null) or a non-complaint', async () => {
    const wrapper = await mountView(
      makeDetail({ subtype: 'COMPLAINT', status: 'RESOLVED', displayStatus: 'RESOLVED', complaintOutcome: null, allowedActions: [] }),
    )
    expect(wrapper.find('[data-testid="complaint-outcome"]').exists()).toBe(false)
  })
})

describe('ChatbotRequestDetailView — live conversation (handoff 20)', () => {
  const liveDetail = (overrides: Partial<ChatbotRequestDetail> = {}) =>
    makeDetail({
      subtype: 'COMPLAINT',
      status: 'IN_PROGRESS',
      assignee: { id: 'u-1', displayName: 'Laura Méndez' },
      allowedActions: ['SEND_MESSAGE', 'FINISH'],
      liveSession: {
        state: 'ACTIVE',
        handoffEpoch: 3,
        lastStaffActivityAt: new Date().toISOString(),
        lastCustomerMessageAt: new Date().toISOString(),
      },
      ...overrides,
    })

  it('mounts the chat for the attendee without read:ChatbotConversation and reads their session', async () => {
    auth.perms.delete('read:ChatbotConversation')
    getPage.mockResolvedValue({ items: [makeMessage({ seq: 21, text: 'Hola, ¿sigue ahí?' })], hasMoreBefore: false })
    const wrapper = await mountView(liveDetail())

    expect(getPage).toHaveBeenCalledWith('req-1', { limit: 50 }, { signal: expect.anything() })
    expect(wrapper.get('[data-testid="detail-conversation"]').text()).toContain('Hola, ¿sigue ahí?')
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="banner-scoped"]').exists()).toBe(true)
    // The role still lacks the permission for the rest, but the conversation is not among the limits.
    expect(wrapper.find('[data-testid="limited-view"]').exists()).toBe(false)
  })

  it('shows «Esta conversación» in the rail for a live request, and only for one', async () => {
    const wrapper = await mountView(liveDetail())
    const card = wrapper.get('aside [data-testid="session-panel"]')
    expect(card.text()).toContain('Esta conversación')
    expect(card.get('[data-testid="session-attendee"]').text()).toBe('Laura Méndez (tú)')
    expect(card.get('[data-testid="session-state"]').text()).toContain('En vivo')

    const plain = await mountView(makeDetail())
    expect(plain.find('[data-testid="session-panel"]').exists()).toBe(false)
  })

  it('keeps the limited-view note for a viewer who is not the attendee', async () => {
    auth.perms.delete('read:ChatbotConversation')
    const wrapper = await mountView(liveDetail({ assignee: { id: 'u-9', displayName: 'Diego Ramírez' } }))
    expect(wrapper.find('[data-testid="detail-conversation"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="limited-view"]').text()).toContain('conversación')
    expect(getPage).not.toHaveBeenCalled()
  })

  it('a reader with the permission who is not the attendee gets the read-only view', async () => {
    const wrapper = await mountView(liveDetail({ assignee: { id: 'u-9', displayName: 'Diego Ramírez' }, allowedActions: [] }))
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="live-note"]').text()).toContain('Atiende Diego Ramírez')
  })

  it('the mobile bar opens the chat full screen and the back button returns to the detail', async () => {
    const wrapper = await mountView(liveDetail())
    const block = () => wrapper.get('[data-testid="detail-conversation"]')
    expect(block().classes()).not.toContain('rc--open')
    await wrapper.get('[data-testid="bar-primary"]').trigger('click')
    expect(block().classes()).toContain('rc--open')
    await wrapper.get('[data-testid="live-back"]').trigger('click')
    expect(block().classes()).not.toContain('rc--open')
  })

  it('«Atender de nuevo» in the chat runs the same claim as the action panel', async () => {
    // The list-only mock of this file has no commands: this test adds the one it needs.
    const claim = vi.fn()
    Object.assign(chatbotRequestApi, { claim })
    claim.mockResolvedValue({
      request: { id: 'req-1', folio: 'S-000123', kind: 'DECISION', subtype: 'COMPLAINT', status: 'IN_PROGRESS', displayStatus: 'IN_PROGRESS', version: 2, assignee: null, claimedAt: null, overdueAt: null, closedAt: null },
    })
    const wrapper = await mountView(
      liveDetail({
        status: 'NEW',
        assignee: null,
        version: 5,
        allowedActions: ['CLAIM'],
        liveSession: { state: 'WAITING', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: null },
      }),
    )
    await wrapper.get('[data-testid="banner-claim"]').trigger('click')
    await flushPromises()
    expect(claim).toHaveBeenCalledWith('req-1', { expectedVersion: 5 }, expect.any(String))
  })
})

describe('ChatbotRequestDetailView — scheduled conversations (handoff 21)', () => {
  const SCHEDULED = '2099-11-14T16:00:00.000Z'

  it('shows the booking and, when needsReschedule, the «Por reagendar» banner in the main column', async () => {
    const wrapper = await mountView(makeDetail({ scheduledFor: SCHEDULED, scheduleVersion: 1, needsReschedule: true }))
    expect(wrapper.get('[data-testid="schedule-chip"]').text()).toContain('Agendada para')
    expect(wrapper.get('[data-testid="reschedule-banner"]').text()).toContain('Por reagendar')
  })

  it('a too-early CLAIM reads «Disponible desde HH:MM» in the rail instead of a generic reason', async () => {
    const wrapper = await mountView(
      makeDetail({
        scheduledFor: SCHEDULED,
        allowedActions: ['RESCHEDULE'],
        deniedActions: [{ action: 'CLAIM', code: 'SCHEDULED_TOO_EARLY', claimableAt: '2099-11-14T15:55:00.000Z' }],
      }),
    )
    const reason = wrapper.get('[data-testid="denied-reason-CLAIM"]').text()
    expect(reason).toMatch(/^Disponible desde .*\d{1,2}:\d{2}$/)
    expect(reason).not.toContain('No está disponible ahora')
  })

  it('a request that was never scheduled shows no schedule block', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('[data-testid="schedule-block"]').exists()).toBe(false)
  })
})

