import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationsBell from '../NotificationsBell.vue'

const mountBell = (props: Record<string, unknown> = {}) =>
  mount(NotificationsBell, { props: { count: 0, open: false, stale: false, ...props } })

describe('NotificationsBell', () => {
  it('a count shows in the badge and in the aria-label', () => {
    const wrapper = mountBell({ count: 3 })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Notificaciones, 3 sin leer')
    expect(wrapper.get('[data-testid="bell-badge"]').text()).toBe('3')
  })

  it('caps the badge at «99+»', () => {
    const wrapper = mountBell({ count: 250 })
    expect(wrapper.get('[data-testid="bell-badge"]').text()).toBe('99+')
    expect(wrapper.get('button').attributes('aria-label')).toBe('Notificaciones, más de 99 sin leer')
  })

  it('the badge is hidden from assistive tech (the label already says it)', () => {
    expect(mountBell({ count: 3 }).get('[data-testid="bell-badge"]').attributes('aria-hidden')).toBe('true')
  })

  it.each([0, null])('no badge for %s', (count) => {
    const wrapper = mountBell({ count })
    expect(wrapper.find('[data-testid="bell-badge"]').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toBe('Notificaciones, sin avisos nuevos')
  })

  it('says when the count could not be refreshed', () => {
    const wrapper = mountBell({ count: 3, stale: true })
    expect(wrapper.get('button').attributes('aria-label')).toBe(
      'Notificaciones, 3 sin leer (no se pudo actualizar)',
    )
    expect(wrapper.get('[data-testid="bell-badge"]').classes()).toContain('is-stale')
  })

  it('announces the dialog it opens and its state', () => {
    const closed = mountBell()
    expect(closed.get('button').attributes('aria-haspopup')).toBe('dialog')
    expect(closed.get('button').attributes('aria-expanded')).toBe('false')
    expect(mountBell({ open: true }).get('button').attributes('aria-expanded')).toBe('true')
  })

  it('a click is a click on the button (the parent toggles the panel)', async () => {
    const wrapper = mountBell()
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })
})
