import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { DETAIL_STUBS } from '../../utils/detail-fixture'
import RequestLiveBlocked from '../RequestLiveBlocked.vue'

const COST = 'Cada plantilla se cobra a la tarifa de WhatsApp Business (aprox. $0.62 MXN).'

function mountBlocked(props: Record<string, unknown> = {}) {
  return mount(RequestLiveBlocked, {
    props: {
      draft: '',
      lastCustomerLabel: 'ayer a las 10:05',
      templateState: 'ready',
      templateAvailable: true,
      costText: COST,
      ...props,
    },
    global: { stubs: DETAIL_STUBS },
  })
}

describe('RequestLiveBlocked — the 24 h window is closed', () => {
  it('says so, since when, and shows the cost before the button', () => {
    const wrapper = mountBlocked()
    expect(wrapper.get('h3').text()).toBe('La ventana de 24 h está cerrada')
    expect(wrapper.text()).toContain('ayer a las 10:05')
    expect(wrapper.get('[data-testid="template-cost"]').text()).toContain(COST)
    expect(wrapper.get('[data-testid="template-open"]').text()).toContain('Enviar plantilla')
  })

  it('has no text box to type in', () => {
    expect(mountBlocked().find('textarea').exists()).toBe(false)
  })

  it('the button asks for the confirmation, it never sends by itself', async () => {
    const wrapper = mountBlocked()
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    expect(wrapper.emitted('template')).toHaveLength(1)
  })

  it('keeps the draft visible as text, never HTML', () => {
    const wrapper = mountBlocked({ draft: 'Te confirmo <b>en unos minutos</b>.' })
    expect(wrapper.get('[data-testid="blocked-draft"]').text()).toContain('Te confirmo <b>en unos minutos</b>.')
    expect(wrapper.find('[data-testid="blocked-draft"] b').exists()).toBe(false)
  })

  it('pending: says the template was sent and cannot be sent again', () => {
    const wrapper = mountBlocked({ templateState: 'pending', templateAvailable: false })
    expect(wrapper.get('[data-testid="template-state"]').text()).toContain('Plantilla enviada')
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeDefined()
  })

  it('failed: offers to retry, with the cost again', () => {
    const wrapper = mountBlocked({ templateState: 'failed' })
    expect(wrapper.get('[data-testid="template-state"]').text()).toContain('no se pudo entregar')
    expect(wrapper.get('[data-testid="template-open"]').text()).toContain('Reintentar plantilla')
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="template-cost"]').exists()).toBe(true)
  })

  it('unknown: no retry (it may already have been sent and charged)', () => {
    const wrapper = mountBlocked({ templateState: 'unknown', templateAvailable: false })
    expect(wrapper.get('[data-testid="template-state"]').text()).toContain('Entrega dudosa')
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeDefined()
  })

  it('none: sends the admin to the settings screen', () => {
    const wrapper = mountBlocked({ templateState: 'none', templateAvailable: false })
    expect(wrapper.get('[data-testid="template-state"]').text()).toContain('No hay plantilla configurada')
    expect(JSON.parse(wrapper.get('[data-testid="template-settings-link"]').attributes('data-to')!)).toEqual({
      name: 'chatbot-settings',
    })
  })

  it('not available (the server does not list it): the button is disabled and says why', () => {
    const wrapper = mountBlocked({ templateAvailable: false })
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="template-unavailable"]').text()).toContain('no está disponible')
  })

  it('shows the working state while it sends', () => {
    const wrapper = mountBlocked({ busy: true })
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeDefined()
  })
})
