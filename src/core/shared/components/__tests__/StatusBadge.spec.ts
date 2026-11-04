import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StatusBadge from '../StatusBadge.vue'

function mountBadge(props: Record<string, unknown> = {}) {
  return mount(StatusBadge, { props: { label: 'Borrador', ...props } })
}

describe('StatusBadge', () => {
  it('renders the label with a leading dot on the neutral tone by default', () => {
    const wrapper = mountBadge()
    const root = wrapper.get('.hf-status-badge')
    expect(root.text()).toBe('Borrador')
    expect(root.attributes('data-tone')).toBe('neutral')
    expect(root.find('.hf-status-badge__dot').exists()).toBe(true)
    expect(root.find('.hf-status-badge__icon').exists()).toBe(false)
  })

  it.each(['neutral', 'info', 'success', 'warning', 'danger'])('exposes the %s tone', tone => {
    const wrapper = mountBadge({ tone })
    expect(wrapper.get('.hf-status-badge').attributes('data-tone')).toBe(tone)
  })

  it.each([
    ['error', 'danger'],
    ['inactive', 'danger'],
    ['active', 'success'],
    ['pending', 'warning'],
    ['automatic', 'info'],
    ['manual', 'neutral'],
    ['type', 'neutral'],
  ])('maps the legacy %s tone to %s', (tone, expected) => {
    const wrapper = mountBadge({ tone })
    expect(wrapper.get('.hf-status-badge').attributes('data-tone')).toBe(expected)
  })

  it('is calm unless it is urgent', () => {
    const wrapper = mountBadge({ tone: 'warning' })
    expect(wrapper.get('.hf-status-badge').attributes('data-urgent')).toBeUndefined()
  })

  it('uses the alert icon by default when urgent', () => {
    const wrapper = mountBadge({ tone: 'danger', urgent: true })
    expect(wrapper.get('.hf-status-badge__icon').attributes('data-icon')).toBe('i-lucide-triangle-alert')
  })

  it('urgent draws attention with its marker and an icon in place of the dot', () => {
    const wrapper = mountBadge({ tone: 'danger', urgent: true, label: 'Vencida' })
    const root = wrapper.get('.hf-status-badge')
    expect(root.attributes('data-urgent')).toBe('true')
    expect(root.find('.hf-status-badge__icon').exists()).toBe(true)
    expect(root.find('.hf-status-badge__dot').exists()).toBe(false)
    expect(root.text()).toBe('Vencida')
  })

  it('lets the caller choose the urgent icon', () => {
    const wrapper = mountBadge({ label: 'Vence hoy', tone: 'warning', urgent: true, icon: 'i-lucide-clock' })
    expect(wrapper.get('.hf-status-badge__icon').attributes('data-icon')).toBe('i-lucide-clock')
  })

  it('names the status for assistive tech', () => {
    const wrapper = mountBadge({ label: 'Confirmada', tone: 'success' })
    const root = wrapper.get('.hf-status-badge')
    expect(root.attributes('role')).toBe('img')
    expect(root.attributes('aria-label')).toBe('Estado: Confirmada')
  })

  it('states the urgency in words, not only in colour', () => {
    const wrapper = mountBadge({ label: 'Vencida', tone: 'danger', urgent: true })
    expect(wrapper.get('.hf-status-badge').attributes('aria-label')).toBe('Estado: Vencida, urgente')
  })

  it('supports an aria prefix and a full aria-label override', () => {
    expect(mountBadge({ ariaPrefix: 'Pago:' }).get('.hf-status-badge').attributes('aria-label')).toBe('Pago: Borrador')
    expect(mountBadge({ urgent: true, ariaLabel: 'Orden vencida' }).get('.hf-status-badge').attributes('aria-label')).toBe(
      'Orden vencida',
    )
  })

  it('hides the decorative marker from assistive tech', () => {
    const wrapper = mountBadge({ urgent: true })
    expect(wrapper.get('.hf-status-badge__icon').attributes('aria-hidden')).toBe('true')
    const calm = mountBadge()
    expect(calm.get('.hf-status-badge__dot').attributes('aria-hidden')).toBe('true')
  })
})
