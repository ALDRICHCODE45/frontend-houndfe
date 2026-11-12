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
})
