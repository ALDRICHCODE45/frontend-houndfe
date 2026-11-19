/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention; vitest resolves `.vue` through
// the Vue plugin while the plain TS server used by tooling cannot).
// CashTimeline: each step says who does it and its state in words; reachable
// steps open in place (aria-expanded), upcoming ones wait without an action.
import { afterEach, describe, expect, it } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashTimeline from '../CashTimeline.vue'
import { buildCashTimeline } from '../../utils/cash-timeline'

enableAutoUnmount(afterEach)

const STEPS = buildCashTimeline({
  status: 'OPEN',
  perspective: 'cashier',
  verified: false,
  drawerReleased: false,
  handoversDeclared: 0,
  handoversPending: 0,
  countedCashCents: null,
})

function render(openId = null) {
  return mountWithUApp(CashTimeline, {
    attachTo: document.body,
    props: { steps: STEPS, openId, label: 'Pasos del turno de Caja principal' },
    slots: { 'panel-movimientos': () => h('form', { 'data-testid': 'mov-form' }, 'x') },
  })
}

describe('CashTimeline', () => {
  it('is an ordered list named for the shift, one item per step with who and state', () => {
    const wrapper = render()
    const list = wrapper.get('[data-testid="cash-timeline"]')
    expect(list.element.tagName).toBe('OL')
    expect(list.attributes('aria-label')).toBe('Pasos del turno de Caja principal')
    expect(wrapper.findAll('li')).toHaveLength(9)
    expect(wrapper.get('[data-testid="cash-step-who-cierre"]').text()).toBe('Supervisor')
    expect(wrapper.get('[data-testid="cash-step-state-conteo"]').text()).toBe('Estado: Siguiente')
    expect(wrapper.get('[data-testid="cash-step-conteo"]').classes()).toContain('is-highlighted')
  })

  it('offers «Ver» for done steps, «Abrir» for reachable ones and nothing for upcoming ones', () => {
    const wrapper = render()
    expect(wrapper.get('[data-testid="cash-step-toggle-apertura"]').text()).toContain('Ver')
    const open = wrapper.get('[data-testid="cash-step-toggle-conteo"]')
    expect(open.text()).toContain('Abrir')
    expect(open.attributes('aria-label')).toBe('Abrir: Iniciar conteo')
    expect(open.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="cash-step-toggle-verificacion"]').exists()).toBe(false)
  })

  it('emits the step to toggle and never runs anything itself', async () => {
    const wrapper = render()
    await wrapper.get('[data-testid="cash-step-toggle-movimientos"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([['movimientos']])
  })

  it('shows the open panel in place, keeps the others mounted, and focuses its heading', async () => {
    const openId = ref(null)
    const Host = defineComponent(() => () =>
      h(
        CashTimeline,
        { steps: STEPS, openId: openId.value },
        { 'panel-movimientos': () => h('form', { 'data-testid': 'mov-form' }, 'x') },
      ),
    )
    const wrapper = mountWithUApp(Host, { attachTo: document.body })
    openId.value = 'movimientos'
    await nextTick()
    await nextTick()
    await nextTick()
    const panel = wrapper.get('[data-testid="cash-task-movimientos"]')
    expect(panel.element.style.display).toBe('')
    expect(panel.find('[data-testid="mov-form"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-task-conteo"]').element.style.display).toBe('none')
    expect(wrapper.get('[data-testid="cash-step-toggle-movimientos"]').text()).toContain('Ocultar')
    expect(document.activeElement?.getAttribute('data-step-title')).toBe('movimientos')
  })
})
