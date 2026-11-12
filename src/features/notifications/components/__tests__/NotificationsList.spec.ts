import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationsList from '../NotificationsList.vue'
import { makeNotice } from '../../composables/__tests__/support'

const NOW = new Date(2026, 10, 11, 11, 5, 0)
const today = (id: string, over = {}) =>
  makeNotice(id, { createdAt: new Date(2026, 10, 11, 10, 0).toISOString(), ...over })
const before = (id: string, over = {}) =>
  makeNotice(id, { createdAt: new Date(2026, 10, 8, 10, 0).toISOString(), readAt: 'x', ...over })

function mountList(props: Record<string, unknown> = {}) {
  return mount(NotificationsList, {
    props: {
      items: [],
      tab: 'all',
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      now: NOW,
      ...props,
    },
  })
}

describe('NotificationsList', () => {
  it('groups «Hoy» and «Antes» with a row each', () => {
    const wrapper = mountList({ items: [today('a'), before('b')] })
    const headings = wrapper.findAll('h3').map((h) => h.text())
    expect(headings).toEqual(['Hoy', 'Antes'])
    expect(wrapper.findAll('li')).toHaveLength(2)
  })

  it('loading: a busy skeleton with a name, and no rows', () => {
    const wrapper = mountList({ isLoading: true })
    const busy = wrapper.get('[aria-busy="true"]')
    expect(busy.attributes('aria-label')).toBe('Cargando notificaciones')
    expect(wrapper.findAll('li')).toHaveLength(0)
  })

  it('empty (Todas): «No tienes avisos»', () => {
    const wrapper = mountList()
    expect(wrapper.text()).toContain('No tienes avisos')
    expect(wrapper.text()).not.toContain('Todo leído')
  })

  it('empty (Sin leer): «Todo leído» with a way back to «Todas»', async () => {
    const wrapper = mountList({ tab: 'unread' })
    expect(wrapper.text()).toContain('Todo leído')
    expect(wrapper.text()).not.toContain('Aquí verás las solicitudes')

    await wrapper.get('[data-testid="show-all"]').trigger('click')
    expect(wrapper.emitted('show-all')).toHaveLength(1)
  })

  it('error: an alert with «Reintentar»', async () => {
    const wrapper = mountList({ isError: true })
    expect(wrapper.get('[role="alert"]').text()).toContain('No se pudieron cargar las notificaciones')

    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('«Ver anteriores» asks for the next page only when there is one', async () => {
    const without = mountList({ items: [today('a')] })
    expect(without.find('[data-testid="load-more"]').exists()).toBe(false)

    const wrapper = mountList({ items: [today('a')], hasNextPage: true })
    await wrapper.get('[data-testid="load-more"]').trigger('click')
    expect(wrapper.emitted('more')).toHaveLength(1)
  })

  it('«Ver anteriores» shows loading and cannot be pressed twice while fetching', () => {
    const wrapper = mountList({ items: [today('a')], hasNextPage: true, isFetchingNextPage: true })
    expect(wrapper.get('[data-testid="load-more"]').attributes('disabled')).toBeDefined()
  })

  it('relays open and mark from its rows', async () => {
    const wrapper = mountList({ items: [today('a')] })
    await wrapper.get('a').trigger('click')
    expect(wrapper.emitted('open')?.[0]).toEqual([expect.objectContaining({ id: 'a' })])
    await wrapper.get('a').trigger('click', { metaKey: true })
    expect(wrapper.emitted('mark')?.[0]).toEqual([expect.objectContaining({ id: 'a' })])
  })
})
