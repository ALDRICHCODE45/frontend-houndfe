/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — mounted SFC spec (repo convention: specs import `.vue` and the
// plain TS server used by tooling cannot resolve SFC types; vitest resolves them
// through the Vue plugin at runtime).
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CashWorkspace from '../CashWorkspace.vue'

function render(slots: Record<string, () => unknown> = {}) {
  return mountWithUApp(CashWorkspace, {
    props: { title: 'Caja' },
    slots: {
      side: () => h('div', { 'data-testid': 'side-slot' }, 'tu turno'),
      head: () => h('h2', { id: 'cash-shift-heading' }, 'Caja principal'),
      default: () => h('ol', { 'data-testid': 'timeline-slot' }, 'pasos'),
      context: () => h('div', { 'data-testid': 'context-slot' }, 'resumen'),
      ...slots,
    },
  })
}

describe('CashWorkspace · direction A shell', () => {
  it('keeps one page title that matches the breadcrumb', () => {
    const wrapper = render()
    expect(wrapper.get('[data-testid="cash-workspace-heading"]').text()).toBe('Caja')
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('lays out the sessions, the selected shift and its summary as named regions', () => {
    const wrapper = render()

    expect(wrapper.get('[data-testid="cash-workspace-side"]').attributes('aria-label')).toBe('Sesiones')
    expect(wrapper.get('[data-testid="cash-workspace-side"]').text()).toContain('tu turno')
    const main = wrapper.get('[data-testid="cash-workspace-main"]')
    expect(main.element.tagName).toBe('MAIN')
    expect(main.attributes('aria-labelledby')).toBe('cash-shift-heading')
    expect(main.get('[data-testid="cash-workspace-head"]').text()).toContain('Caja principal')
    expect(main.get('[data-testid="timeline-slot"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="cash-workspace-context"]').attributes('aria-label')).toBe(
      'Resumen del turno',
    )
  })

  it('renders the mobile action bar outside the regions only when supplied', () => {
    expect(render().find('[data-testid="cash-workspace-bar"]').exists()).toBe(false)
    const withBar = render({ bar: () => h('button', { type: 'button' }, 'Iniciar conteo') })
    const bar = withBar.get('[data-testid="cash-workspace-bar"]')
    expect(bar.text()).toBe('Iniciar conteo')
    expect(withBar.get('[data-testid="cash-workspace-main"]').element.contains(bar.element)).toBe(false)
  })

  it('omits the context region when no summary is supplied', () => {
    const wrapper = mountWithUApp(CashWorkspace, {
      props: { title: 'Caja' },
      slots: { default: () => 'x' },
    })
    expect(wrapper.find('[data-testid="cash-workspace-context"]').exists()).toBe(false)
  })
})
