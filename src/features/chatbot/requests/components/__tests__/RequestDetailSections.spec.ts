import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailHeader from '../RequestDetailHeader.vue'
import RequestDetailOtherOpen from '../RequestDetailOtherOpen.vue'
import RequestDetailDeliveries from '../RequestDetailDeliveries.vue'
import RequestDetailAudit from '../RequestDetailAudit.vue'
import RequestDetailClosedNotice from '../RequestDetailClosedNotice.vue'
import RequestDetailSkeleton from '../RequestDetailSkeleton.vue'
import { DETAIL_STUBS, makeAuditEvent, makeDetail } from '../../utils/detail-fixture'
import { makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-11T17:05:00.000Z')
const global = { stubs: DETAIL_STUBS }

describe('RequestDetailHeader', () => {
  const mountHeader = (overrides = {}, extra: Record<string, unknown> = {}) =>
    mount(RequestDetailHeader, {
      props: { request: makeDetail(overrides), timeZone: TZ, now: NOW, ...extra },
      global,
    })

  it('shows the breadcrumb back to the inbox, folio, subtype, status badge and the summary as the title', () => {
    const wrapper = mountHeader()
    const crumb = wrapper.get('[data-testid="breadcrumb-inbox"]')
    expect(crumb.text()).toBe('Solicitudes')
    expect(JSON.parse(crumb.attributes('data-to')!)).toEqual({ name: 'chatbot-requests' })
    expect(JSON.parse(wrapper.get('[data-testid="back-to-inbox"]').attributes('data-to')!)).toEqual({
      name: 'chatbot-requests',
    })
    expect(wrapper.get('[data-testid="request-folio"]').text()).toBe('S-000123')
    expect(wrapper.text()).toContain('Reposición')
    expect(wrapper.text()).toContain('Nueva')
    expect(wrapper.get('h1').text()).toBe('Croquetas 15 kg para el viernes')
  })

  it('renders the bot summary as text, never as HTML', () => {
    const wrapper = mountHeader({ summary: '<b>urgente</b><img src=x>' })
    expect(wrapper.get('h1').text()).toBe('<b>urgente</b><img src=x>')
    expect(wrapper.find('h1 b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('says «Vencida» and who holds it for an overdue request in attention', () => {
    const wrapper = mountHeader(
      {
        status: 'IN_PROGRESS',
        displayStatus: 'EXPIRED',
        assignee: { id: 'u-2', displayName: 'Luis Ortega' },
      },
      { currentUserId: 'u-1' },
    )
    expect(wrapper.text()).toContain('Vencida · por Luis Ortega')
  })

  it('tags the closing WhatsApp window only when it closes within two hours', () => {
    const soon = mountHeader({ whatsappWindowClosesAt: '2026-11-11T18:05:00.000Z' })
    expect(soon.get('[data-testid="window-tag"]').text()).toContain('Ventana de 24 h cierra en 1 h')
    const far = mountHeader({ whatsappWindowClosesAt: '2026-11-12T10:00:00.000Z' })
    expect(far.find('[data-testid="window-tag"]').exists()).toBe(false)
  })
})

describe('RequestDetailOtherOpen', () => {
  it('links every other open request of the customer to its detail with its time light', () => {
    const wrapper = mount(RequestDetailOtherOpen, {
      props: {
        requests: [
          makeRow({ id: 'req-2', folio: 'S-000131', subtype: 'EXPIRATION', summary: 'Caducidad del lote', slaLevel: 'HALF' }),
          makeRow({ id: 'req-3', folio: 'S-000134', subtype: 'DELIVERY_ZONE', summary: 'Zona 44150', slaLevel: 'OVERDUE', displayStatus: 'EXPIRED' }),
        ],
        timeZone: TZ,
        now: NOW,
      },
      global,
    })
    const links = wrapper.findAll('[data-testid="other-open-link"]')
    expect(links).toHaveLength(2)
    expect(JSON.parse(links[0]!.attributes('data-to')!)).toEqual({
      name: 'chatbot-request-detail',
      params: { id: 'req-2' },
    })
    expect(links[0]!.text()).toContain('S-000131')
    expect(links[0]!.text()).toContain('Caducidad del lote')
    expect(links[0]!.text()).toContain('Caducidad')
    expect(links[0]!.find('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('warn')
    expect(links[1]!.find('[data-testid="sla-indicator"]').attributes('data-tone')).toBe('bad')
    expect(wrapper.get('[data-testid="other-open-count"]').text()).toBe('2')
  })

  it('says there are none', () => {
    const wrapper = mount(RequestDetailOtherOpen, { props: { requests: [] }, global })
    expect(wrapper.text()).toContain('No tiene otras solicitudes abiertas')
    expect(wrapper.find('[data-testid="other-open-link"]').exists()).toBe(false)
  })

  it('renders a bot summary as text', () => {
    const wrapper = mount(RequestDetailOtherOpen, {
      props: { requests: [makeRow({ summary: '<i>hola</i>' })] },
      global,
    })
    expect(wrapper.find('i').exists()).toBe(false)
    expect(wrapper.text()).toContain('<i>hola</i>')
  })
})

describe('RequestDetailDeliveries', () => {
  it('lists each delivery with its outcome and flags a doubtful one', () => {
    const wrapper = mount(RequestDetailDeliveries, {
      props: {
        deliveries: [
          {
            deliveryId: 'd-1',
            type: 'RESOLUTION',
            createdAt: '2026-11-11T16:00:00.000Z',
            outcome: 'PROVIDER_ACCEPTED',
            attemptedAt: '2026-11-11T16:00:05.000Z',
            providerStatus: 'accepted',
            needsReconciliation: false,
          },
          {
            deliveryId: 'd-2',
            type: 'RESOLUTION',
            createdAt: '2026-11-11T15:00:00.000Z',
            outcome: 'DELIVERY_UNKNOWN',
            attemptedAt: null,
            providerStatus: null,
            needsReconciliation: true,
          },
        ],
        timeZone: TZ,
        now: NOW,
      },
      global,
    })
    const items = wrapper.findAll('[data-testid="delivery-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Entregada al proveedor')
    expect(items[1]!.text()).toContain('Entrega dudosa')
    expect(items[1]!.attributes('data-doubtful')).toBe('true')
    expect(items[0]!.attributes('data-doubtful')).toBe('false')
    expect(wrapper.text()).not.toContain('RESOLUTION')
  })
})

describe('RequestDetailAudit', () => {
  const events = [
    makeAuditEvent('CLAIMED', { id: 'e-3', createdAt: '2026-11-11T16:30:00.000Z' }),
    makeAuditEvent('SLA_MILESTONE', {
      id: 'e-2',
      actor: { kind: 'SYSTEM', id: null, displayName: null },
      data: { milestone: 'OVERDUE', clock: 'CLAIM' },
    }),
    makeAuditEvent('FROM_THE_FUTURE' as never, { id: 'e-1', data: { x: 1 } }),
  ]
  const mountAudit = (props: Record<string, unknown> = {}) =>
    mount(RequestDetailAudit, {
      props: { events, hasMore: false, loadingMore: false, currentUserId: 'u-1', timeZone: TZ, now: NOW, ...props },
      global,
    })

  it('lists the events newest first with their labels, actor and detail', () => {
    const items = mountAudit().findAll('[data-testid="audit-item"]')
    expect(items).toHaveLength(3)
    expect(items[0]!.text()).toContain('Tomada por Luis Ortega')
    expect(items[1]!.text()).toContain('Venció')
    expect(items[1]!.text()).toContain('Sistema')
    expect(items[1]!.text()).toContain('Tiempo para tomarla')
    expect(items[1]!.attributes('data-tone')).toBe('bad')
  })

  it('reads «Tomada por ti» for the signed-in user and a generic line for an unknown event type', () => {
    const wrapper = mountAudit({
      events: [
        makeAuditEvent('CLAIMED', { actor: { kind: 'USER', id: 'u-1', displayName: 'Laura Méndez' } }),
        makeAuditEvent('FROM_THE_FUTURE' as never, { id: 'e-9' }),
      ],
    })
    const items = wrapper.findAll('[data-testid="audit-item"]')
    expect(items[0]!.text()).toContain('Tomada por ti')
    expect(items[1]!.text()).toContain('Evento de la solicitud')
    expect(items[1]!.text()).not.toContain('FROM_THE_FUTURE')
  })

  it('offers «Ver más eventos» only with more pages, emits «more» and disables it while loading', async () => {
    expect(mountAudit().find('[data-testid="audit-more"]').exists()).toBe(false)
    const wrapper = mountAudit({ hasMore: true })
    const more = wrapper.get('[data-testid="audit-more"]')
    expect(more.text()).toContain('Ver más eventos')
    await more.trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)

    const loading = mountAudit({ hasMore: true, loadingMore: true })
    expect(loading.get('[data-testid="audit-more"]').attributes('disabled')).toBeDefined()
  })

  it('shows the customer message of a cancellation as text', () => {
    const wrapper = mountAudit({
      events: [
        makeAuditEvent('CANCELLED', {
          data: { reason: 'NOT_ACTIONABLE', customerNote: '<b>Gracias</b>' },
        }),
      ],
    })
    expect(wrapper.text()).toContain('mensaje al cliente: «<b>Gracias</b>»')
    expect(wrapper.find('small b').exists()).toBe(false)
  })

  it('says there are no events', () => {
    expect(mountAudit({ events: [] }).text()).toContain('Todavía no hay eventos')
  })
})

describe('RequestDetailClosedNotice', () => {
  const mountNotice = (overrides = {}) =>
    mount(RequestDetailClosedNotice, {
      props: { request: makeDetail(overrides), timeZone: TZ, now: NOW, currentUserId: 'u-9' },
      global,
    })

  it('renders nothing for an open request', () => {
    expect(mountNotice().find('[data-testid="closed-notice"]').exists()).toBe(false)
  })

  it('a resolved request says who resolved it and when', () => {
    const wrapper = mountNotice({
      status: 'RESOLVED',
      displayStatus: 'RESOLVED',
      resolvedBy: { id: 'u-1', displayName: 'Laura Méndez' },
      closedAt: '2026-11-11T16:00:00.000Z',
      slaLevel: null,
    })
    const text = wrapper.get('[data-testid="closed-notice"]').text()
    expect(text).toContain('Solicitud resuelta')
    expect(text).toContain('Laura Méndez')
    expect(text).toContain('hoy 10:00')
  })

  it('a staff cancellation shows its cause', () => {
    const wrapper = mountNotice({
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      cancelReason: 'STAFF',
      staffCancelReason: 'DUPLICATE',
      closedAt: '2026-11-11T16:00:00.000Z',
    })
    const text = wrapper.get('[data-testid="closed-notice"]').text()
    expect(text).toContain('Solicitud cancelada')
    expect(text).toContain('Cancelada por el personal · Duplicada')
  })

  it('a merged-away request links «Fusionada en S-…» to the request that stayed', () => {
    const wrapper = mountNotice({
      status: 'CANCELLED',
      displayStatus: 'CANCELLED',
      cancelReason: 'SUPERSEDED',
      mergedInto: { id: 'req-9', folio: 'S-000009' },
      closedAt: '2026-11-11T16:00:00.000Z',
    })
    const link = wrapper.get('[data-testid="merged-into-link"]')
    expect(link.text()).toBe('S-000009')
    expect(JSON.parse(link.attributes('data-to')!)).toEqual({
      name: 'chatbot-request-detail',
      params: { id: 'req-9' },
    })
    expect(wrapper.get('[data-testid="closed-notice"]').text()).toContain('Fusionada en')
  })

  it('a customer withdrawal reads its cause and a cancelled request with no cause does not crash', () => {
    const withdrew = mountNotice({ status: 'CANCELLED', displayStatus: 'CANCELLED', cancelReason: 'CUSTOMER_WITHDREW' })
    expect(withdrew.text()).toContain('El cliente la retiró')
    const bare = mountNotice({ status: 'CANCELLED', displayStatus: 'CANCELLED', cancelReason: null })
    expect(bare.get('[data-testid="closed-notice"]').text()).toContain('Solicitud cancelada')
  })
})

describe('RequestDetailSkeleton', () => {
  it('is a busy, labelled placeholder', () => {
    const wrapper = mount(RequestDetailSkeleton, { global })
    const root = wrapper.get('[data-testid="detail-loading"]')
    expect(root.attributes('aria-busy')).toBe('true')
    expect(root.text()).toContain('Cargando solicitud')
  })
})
