import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationRow from '../NotificationRow.vue'
import { makeNotice } from '../../composables/__tests__/support'

const NOW = new Date(2026, 10, 11, 11, 5, 0)
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString()

function mountRow(over = {}, extra: { now?: Date } = {}) {
  return mount(NotificationRow, { props: { item: makeNotice('n1', { createdAt: at(7), ...over }), now: extra.now ?? NOW } })
}

describe('NotificationRow', () => {
  it.each([
    ['REQUEST_OVERDUE', 'Vencida'],
    ['REQUEST_ESCALATION', 'Por vencer'],
    ['REQUEST_CLAIM_REMINDER', 'Sin tomar'],
    ['REQUEST_CREATED', 'Nueva'],
    ['REQUEST_REASSIGNED', 'Reasignada a ti'],
    ['REQUEST_CANCELLED', 'Cerrada'],
  ])('%s carries the text label «%s»', (type, label) => {
    expect(mountRow({ type }).get('[data-testid="notification-type"]').text()).toBe(label)
  })

  it('live-chat notices carry their label; the unanswered one says the minutes from its level', () => {
    expect(mountRow({ type: 'CONVERSATION_CUSTOMER_MESSAGE' }).get('[data-testid="notification-type"]').text()).toBe(
      'Nuevo mensaje del cliente',
    )
    expect(mountRow({ type: 'CONVERSATION_UNANSWERED', level: 5 }).get('[data-testid="notification-type"]').text()).toBe(
      'Cliente sin respuesta · 5 min',
    )
    expect(mountRow({ type: 'CONVERSATION_UNANSWERED', level: 15 }).get('[data-testid="notification-type"]').text()).toBe(
      'Cliente sin respuesta · 15 min',
    )
  })

  it('an unknown type still reads «Aviso»', () => {
    expect(mountRow({ type: 'SOMETHING_NEW' }).get('[data-testid="notification-type"]').text()).toBe('Aviso')
  })

  it('shows the server title, the body and the relative time', () => {
    const wrapper = mountRow({ title: 'Solicitud vencida', body: 'Zona de entrega · S-000118' })
    expect(wrapper.text()).toContain('Solicitud vencida')
    expect(wrapper.text()).toContain('Zona de entrega · S-000118')
    expect(wrapper.get('time').text()).toBe('hace 7 min')
    expect(wrapper.get('time').attributes('datetime')).toBe(at(7))
  })

  it('renders title and body as text, never as HTML', () => {
    const wrapper = mountRow({ title: '<b>x</b>', body: '<img src=x onerror=alert(1)>' })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('unread: dot, «Sin leer» for screen readers, and the unread class', () => {
    const wrapper = mountRow({ readAt: null })
    expect(wrapper.get('li').classes()).toContain('is-unread')
    expect(wrapper.find('[data-testid="unread-dot"]').exists()).toBe(true)
    expect(wrapper.get('.sr-only').text()).toContain('Sin leer')
  })

  it('read: no dot and no «Sin leer»', () => {
    const wrapper = mountRow({ readAt: at(1) })
    expect(wrapper.get('li').classes()).not.toContain('is-unread')
    expect(wrapper.find('[data-testid="unread-dot"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Sin leer')
  })

  it('a plain click opens the notice (the host marks it and navigates) and does not follow the href', async () => {
    const wrapper = mountRow()
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('/chatbot/solicitudes/req-n1')

    await link.trigger('click')

    expect(wrapper.emitted('open')?.[0]).toEqual([expect.objectContaining({ id: 'n1' })])
    expect(wrapper.emitted('mark')).toBeUndefined()
  })

  it('a modified click (new tab) only marks it read', async () => {
    const wrapper = mountRow()
    await wrapper.get('a').trigger('click', { ctrlKey: true })

    expect(wrapper.emitted('mark')?.[0]).toEqual([expect.objectContaining({ id: 'n1' })])
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('without a request it is a button that opens (marks) it, no link', async () => {
    const wrapper = mountRow({ requestId: null })
    expect(wrapper.find('a').exists()).toBe(false)

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  describe('SALE_HOLD_REVIEW (BE handoff 24 §5)', () => {
    const review = {
      type: 'SALE_HOLD_REVIEW',
      title: 'Apartado vencido: revisa la venta',
      body: 'Venta W-000042 · Comprobante pendiente de revisar',
      requestId: null,
      saleId: 'sale-42',
      folio: 'W-000042',
    }

    it('renders the server title and body with the «Apartado vencido» warning label', () => {
      const wrapper = mountRow(review)
      expect(wrapper.text()).toContain('Apartado vencido: revisa la venta')
      expect(wrapper.text()).toContain('Venta W-000042 · Comprobante pendiente de revisar')
      expect(wrapper.get('[data-testid="notification-type"]').text()).toBe('Apartado vencido')
      // The folio is already in the body: no repeated ref line.
      expect(wrapper.find('[data-testid="notification-ref"]').exists()).toBe(false)
    })

    it('links to the sale detail, not the request inbox', () => {
      expect(mountRow(review).get('a').attributes('href')).toBe('/pos/ventas/sale-42')
    })

    it('a request notice with saleId null keeps its request link', () => {
      expect(mountRow({ saleId: null }).get('a').attributes('href')).toBe('/chatbot/solicitudes/req-n1')
    })

    it('without request nor sale it is a button, no link', () => {
      const wrapper = mountRow({ ...review, saleId: null })
      expect(wrapper.find('a').exists()).toBe(false)
      expect(wrapper.find('button').exists()).toBe(true)
    })
  })

  describe('BACKORDER_* notices (ODD restock-backorder S8)', () => {
    const backorder = {
      type: 'BACKORDER_RESERVED',
      title: 'Pedido por reposición apartado',
      body: 'BO-000012 · Rosa tiene 24 h para confirmar',
      requestId: null,
      saleId: null,
      backorderId: 'bo-12',
    }

    it('renders the server title and body with the «Pedido apartado» label', () => {
      const wrapper = mountRow(backorder)
      expect(wrapper.text()).toContain('Pedido por reposición apartado')
      expect(wrapper.text()).toContain('BO-000012 · Rosa tiene 24 h para confirmar')
      expect(wrapper.get('[data-testid="notification-type"]').text()).toBe('Pedido apartado')
    })

    it('links to the backorder detail', () => {
      expect(mountRow(backorder).get('a').attributes('href')).toBe('/pos/pedidos-reposicion/bo-12')
    })

    it('the undelivered notice is a warning that says what to do', () => {
      const wrapper = mountRow({ ...backorder, type: 'BACKORDER_NOTICE_UNDELIVERED', title: 'No se pudo avisar al cliente' })
      expect(wrapper.get('[data-testid="notification-type"]').text()).toBe('Avisar al cliente')
      expect(wrapper.get('.nt-tile').attributes('data-tone')).toBe('warning')
    })

    it('a request notice with backorderId null keeps its request link', () => {
      expect(mountRow({ backorderId: null }).get('a').attributes('href')).toBe('/chatbot/solicitudes/req-n1')
    })
  })

  describe('structured fields (handoff 13 §3, 8c12ae09)', () => {
    it('shows folio and the subtype label as a meta line', () => {
      const wrapper = mountRow({ folio: 'S-000118', subtype: 'UNKNOWN_QUESTION' })
      expect(wrapper.get('[data-testid="notification-ref"]').text()).toBe('S-000118 · Pregunta del bot')
    })

    it('shows only what is present: folio alone, subtype alone', () => {
      expect(mountRow({ folio: 'S-000118' }).get('[data-testid="notification-ref"]').text()).toBe('S-000118')
      expect(mountRow({ subtype: 'COMPLAINT' }).get('[data-testid="notification-ref"]').text()).toBe('Queja')
    })

    it('does not print the raw code of a subtype it does not know', () => {
      const wrapper = mountRow({ folio: 'S-000118', subtype: 'SOMETHING_NEW' })
      expect(wrapper.get('[data-testid="notification-ref"]').text()).toBe('S-000118')
      expect(wrapper.text()).not.toContain('SOMETHING_NEW')
    })

    it.each([
      ['REQUEST_OVERDUE', 'ASSIGNEE', 'Tuya'],
      ['REQUEST_ESCALATION', 'ASSIGNEE', 'Tuya'],
      ['REQUEST_OVERDUE', 'ESCALATION', 'Por escalamiento'],
      ['REQUEST_ESCALATION', 'ESCALATION', 'Por escalamiento'],
    ])('%s with reason %s carries the tag «%s»', (type, reason, label) => {
      expect(mountRow({ type, reason }).get('[data-testid="notification-reason"]').text()).toBe(label)
    })

    it('has no reason tag when reason is null or the type is not an 80 % / overdue notice', () => {
      expect(mountRow({ type: 'REQUEST_OVERDUE', reason: null }).find('[data-testid="notification-reason"]').exists()).toBe(false)
      expect(mountRow({ type: 'REQUEST_CREATED', reason: 'ASSIGNEE' }).find('[data-testid="notification-reason"]').exists()).toBe(false)
    })

    it('requestOpen false: a muted «Cerrada» tag and the link to the detail is kept', () => {
      const wrapper = mountRow({ type: 'REQUEST_OVERDUE', requestOpen: false })
      expect(wrapper.get('[data-testid="notification-closed"]').text()).toBe('Cerrada')
      expect(wrapper.get('[data-testid="notification-closed"]').attributes('data-tone')).toBe('neutral')
      expect(wrapper.get('a').attributes('href')).toBe('/chatbot/solicitudes/req-n1')
    })

    it('requestOpen true or null: no «Cerrada» tag', () => {
      expect(mountRow({ requestOpen: true }).find('[data-testid="notification-closed"]').exists()).toBe(false)
      expect(mountRow({ requestOpen: null }).find('[data-testid="notification-closed"]').exists()).toBe(false)
    })

    it('a cancelled notice already says «Cerrada» by type: no second tag', () => {
      const wrapper = mountRow({ type: 'REQUEST_CANCELLED', requestOpen: false })
      expect(wrapper.find('[data-testid="notification-closed"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="notification-type"]').text()).toBe('Cerrada')
    })

    it.each([
      ['CUSTOMER', 'El cliente canceló la solicitud'],
      ['RESOLVED_BY_OTHER', 'Otra persona resolvió la solicitud'],
      ['CANCELLED_BY_OTHER', 'Otra persona canceló la solicitud'],
      ['SIBLING_RESOLVED', 'Se resolvió junto con otras de su zona'],
      ['MERGED', 'Otra persona la unió con otra solicitud del cliente'],
    ])('REQUEST_CANCELLED with cause %s reads «%s»', (cause, text) => {
      const wrapper = mountRow({ type: 'REQUEST_CANCELLED', title: 'Solicitud cerrada', cause })
      expect(wrapper.get('[data-testid="notification-cause"]').text()).toBe(text)
    })

    it('the cause line is not repeated when the server title already says it', () => {
      const text = 'Otra persona la unió con otra solicitud del cliente'
      const wrapper = mountRow({ type: 'REQUEST_CANCELLED', title: text, cause: 'MERGED' })
      expect(wrapper.find('[data-testid="notification-cause"]').exists()).toBe(false)
      expect(wrapper.text().split(text)).toHaveLength(2)
    })

    it('no cause line without a cause, for an unknown cause, or on another type', () => {
      expect(mountRow({ type: 'REQUEST_CANCELLED', cause: null }).find('[data-testid="notification-cause"]').exists()).toBe(false)
      expect(mountRow({ type: 'REQUEST_CANCELLED', cause: 'NEW_CAUSE' }).find('[data-testid="notification-cause"]').exists()).toBe(false)
      expect(mountRow({ type: 'REQUEST_CREATED', cause: 'MERGED' }).find('[data-testid="notification-cause"]').exists()).toBe(false)
    })

    it('renders folio as text, never as HTML', () => {
      const wrapper = mountRow({ folio: '<img src=x onerror=alert(1)>' })
      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.get('[data-testid="notification-ref"]').text()).toContain('<img')
    })

    it('absent fields render exactly as before', () => {
      const wrapper = mountRow()
      for (const id of ['ref', 'reason', 'closed', 'cause']) {
        expect(wrapper.find(`[data-testid="notification-${id}"]`).exists()).toBe(false)
      }
      expect(wrapper.findAll('.hf-status-badge')).toHaveLength(1)
      expect(wrapper.get('[data-testid="notification-type"]').text()).toBe('Nueva')
    })

    it('null fields (a pre-existing row on the new backend) render like absent ones', () => {
      const wrapper = mountRow({ type: 'REQUEST_OVERDUE', folio: null, subtype: null, cause: null, reason: null, requestOpen: null })
      for (const id of ['ref', 'reason', 'closed', 'cause']) {
        expect(wrapper.find(`[data-testid="notification-${id}"]`).exists()).toBe(false)
      }
      expect(wrapper.findAll('.hf-status-badge')).toHaveLength(1)
    })
  })
})
