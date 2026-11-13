import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestLiveTemplateSheet from '../RequestLiveTemplateSheet.vue'

const COST = 'Cada plantilla se cobra a la tarifa de WhatsApp Business (aprox. $0.62 MXN).'
const STUBS = {
  UIcon: { template: '<span />' },
  UButton: {
    props: ['label', 'disabled', 'loading'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled || loading" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
  AppResponsiveDrawer: {
    props: ['open', 'title', 'description'],
    emits: ['update:open'],
    template: '<section v-if="open" data-testid="drawer"><h2 data-testid="drawer-title">{{ title }}</h2><slot name="body" /></section>',
  },
}

const mountSheet = (props: Record<string, unknown> = {}) =>
  mount(RequestLiveTemplateSheet, {
    props: { open: true, costText: COST, ...props },
    global: { stubs: STUBS },
  })

describe('RequestLiveTemplateSheet — confirming the paid template', () => {
  it('asks the question, shows the cost text of the settings and what happens next', () => {
    const wrapper = mountSheet()
    expect(wrapper.get('[data-testid="drawer-title"]').text()).toBe('¿Enviar plantilla al cliente?')
    expect(wrapper.get('[data-testid="template-confirm-cost"]').text()).toBe(COST)
    expect(wrapper.text()).toContain('No podrás escribirle hasta que responda')
    expect(wrapper.text()).toContain('Una sola por ventana cerrada')
  })

  it('renders nothing while closed', () => {
    expect(mountSheet({ open: false }).find('[data-testid="drawer"]').exists()).toBe(false)
  })

  it('«Enviar plantilla» confirms; «Cancelar» only closes', async () => {
    const wrapper = mountSheet()
    await wrapper.get('[data-testid="template-confirm"]').trigger('click')
    expect(wrapper.emitted('confirm')).toHaveLength(1)
    await wrapper.get('[data-testid="template-cancel"]').trigger('click')
    expect(wrapper.emitted('update:open')![0]).toEqual([false])
    expect(wrapper.emitted('confirm')).toHaveLength(1)
  })

  it('cannot be confirmed twice while it sends', () => {
    const wrapper = mountSheet({ busy: true })
    expect(wrapper.get('[data-testid="template-confirm"]').attributes('disabled')).toBeDefined()
  })

  it('a retry says it is a new send and charges again', () => {
    const wrapper = mountSheet({ retry: true })
    expect(wrapper.text()).toContain('Reintentar crea un envío nuevo')
  })
})

describe('RequestLiveTemplateSheet — size', () => {
  it('is a short, content-height bottom sheet on small screens', () => {
    const wrapper = mount(RequestLiveTemplateSheet, {
      props: { open: true, costText: COST },
      global: {
        stubs: {
          ...STUBS,
          AppResponsiveDrawer: {
            props: ['open', 'portalClass'],
            template: '<section data-testid="drawer" :data-portal-class="portalClass"><slot name="body" /></section>',
          },
        },
      },
    })
    expect(wrapper.get('[data-testid="drawer"]').attributes('data-portal-class')).toContain('rc-portal--short')
  })
})
