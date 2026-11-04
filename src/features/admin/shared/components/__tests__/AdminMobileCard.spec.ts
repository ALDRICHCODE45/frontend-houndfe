import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminMobileCard from '../AdminMobileCard.vue'

const item = { id: 'row-1', name: 'Caja' }
const actions = [
  { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' },
  { key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true },
]

function mountCard(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(AdminMobileCard<typeof item>, {
    attachTo: document.body,
    props: { item, label: 'Caja', actions, openable: true, ...props },
    slots,
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AdminMobileCard', () => {
  it('shows the label as the primary button and never the id', () => {
    const wrapper = mountCard()
    const name = wrapper.get('[data-testid="admin-card-name"]')
    expect(name.element.tagName).toBe('BUTTON')
    expect(name.classes()).toContain('hf-row-primary')
    expect(name.text()).toBe('Caja')
    expect(wrapper.text()).not.toContain('row-1')
    wrapper.unmount()
  })

  it('opens from the whole card and from the name button', async () => {
    const wrapper = mountCard()
    await wrapper.get('article').trigger('click')
    await wrapper.get('[data-testid="admin-card-name"]').trigger('click')
    expect(wrapper.get('article').classes()).toContain('hf-clickable-row')
    expect(wrapper.emitted('open')).toEqual([[item], [item]])
    wrapper.unmount()
  })

  it('does not open from the ⋮ menu', async () => {
    const wrapper = mountCard()
    const trigger = wrapper.get('button[aria-haspopup="menu"]')
    expect(trigger.attributes('aria-label')).toBe('Acciones de Caja')
    await trigger.trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
    wrapper.unmount()
  })

  it('is a plain, non-clickable card when it opens nothing', async () => {
    const wrapper = mountCard({ openable: false })
    const name = wrapper.get('[data-testid="admin-card-name"]')
    expect(name.element.tagName).toBe('SPAN')
    expect(wrapper.get('article').classes()).not.toContain('hf-clickable-row')
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
    wrapper.unmount()
  })

  it('renders no ⋮ when the row has no actions', () => {
    const wrapper = mountCard({ actions: [] })
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders the optional regions only when their slots are given', () => {
    const bare = mountCard()
    expect(bare.find('.hf-row-secondary').exists()).toBe(false)
    expect(bare.find('.admin-card-badges').exists()).toBe(false)
    expect(bare.find('.admin-card-footer').exists()).toBe(false)
    bare.unmount()

    const full = mountCard({}, { secondary: 'Efectivo', badges: '<b>Activo</b>', footer: '<span>3 nov</span>' })
    expect(full.get('.hf-row-secondary').text()).toBe('Efectivo')
    expect(full.get('.admin-card-badges').text()).toBe('Activo')
    expect(full.get('.admin-card-footer').text()).toBe('3 nov')
    full.unmount()
  })
})
