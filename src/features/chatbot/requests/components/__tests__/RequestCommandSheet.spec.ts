import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestCommandSheet from '../RequestCommandSheet.vue'

const DRAWER = {
  props: ['open', 'title', 'portalClass'],
  template: '<div data-testid="drawer" :data-portal-class="portalClass"><slot name="body" /></div>',
}
const mountSheet = (props: Record<string, unknown> = {}) =>
  mount(RequestCommandSheet, {
    props: { open: true, title: 'Adjuntar', ...props },
    slots: { default: '<p>contenido</p>' },
    global: { stubs: { AppResponsiveDrawer: DRAWER } },
  })

describe('RequestCommandSheet', () => {
  it('keeps the tall bottom sheet by default', () => {
    const portal = mountSheet().get('[data-testid="drawer"]').attributes('data-portal-class')
    expect(portal).toContain('chatbot-request-commands')
    expect(portal).not.toContain('rc-portal--short')
  })

  it('a short sheet asks the portal for a content-height bottom sheet', () => {
    const portal = mountSheet({ short: true }).get('[data-testid="drawer"]').attributes('data-portal-class')
    expect(portal).toContain('chatbot-request-commands')
    expect(portal).toContain('rc-portal--short')
  })
})
