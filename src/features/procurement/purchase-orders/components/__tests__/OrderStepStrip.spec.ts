import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OrderStepStrip from '../OrderStepStrip.vue'
const steps = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('li').map(li => `${li.attributes('data-step')}:${li.attributes('data-state')}`)
describe('step strip', () => {
  it('is an ordered list named for the confirm flow, with Completar, Guardar and Confirmar', () => {
    const wrapper = mount(OrderStepStrip, { props: { pending: 0, dirty: false } })
    expect(wrapper.get('ol').attributes('aria-label')).toBe('Pasos para confirmar')
    expect(wrapper.findAll('li .order-step-label').map(label => label.text())).toEqual(['Completar', 'Guardar', 'Confirmar'])
  })
  it('puts Completar current with its pending count while avisos remain', () => {
    const wrapper = mount(OrderStepStrip, { props: { pending: 1, dirty: false } })
    expect(steps(wrapper)).toEqual(['complete:current', 'save:upcoming', 'confirm:upcoming'])
    expect(wrapper.get('li[data-step="complete"] .order-step-label').text()).toBe('Completar · 1 pendiente')
    expect(mount(OrderStepStrip, { props: { pending: 3, dirty: false } }).get('.order-step-label').text()).toBe('Completar · 3 pendientes')
  })
  it('puts Guardar current when complete but unsaved, and Confirmar when saved', () => {
    expect(steps(mount(OrderStepStrip, { props: { pending: 0, dirty: true } }))).toEqual(['complete:done', 'save:current', 'confirm:upcoming'])
    expect(steps(mount(OrderStepStrip, { props: { pending: 0, dirty: false } }))).toEqual(['complete:done', 'save:done', 'confirm:current'])
  })
  it('marks exactly the current step with aria-current and shows a check for the done ones', () => {
    const wrapper = mount(OrderStepStrip, { props: { pending: 0, dirty: false } })
    expect(wrapper.findAll('[aria-current="step"]').map(li => li.attributes('data-step'))).toEqual(['confirm'])
    expect(wrapper.get('li[data-step="complete"] .order-step-mark').text()).toBe('')
    expect(wrapper.get('li[data-step="complete"] .order-step-mark').find('svg, [class*="i-lucide"]').exists()).toBe(true)
    expect(wrapper.get('li[data-step="confirm"] .order-step-mark').text()).toBe('3')
  })
  it('shortens the count to (n) in the compact mobile variant', () => {
    const wrapper = mount(OrderStepStrip, { props: { pending: 2, dirty: false, compact: true } })
    expect(wrapper.get('li[data-step="complete"] .order-step-label').text()).toBe('Completar (2)')
  })
})
