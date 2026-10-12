import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- Vue-aware checks resolve this SFC; the plain TS LSP cannot.
import CashSessionsPanel from '../CashSessionsPanel.vue'

describe('CashSessionsPanel presentation', () => {
  it('uses the shared Caja surface in light and dark modes', () => {
    const wrapper = mountWithUApp(CashSessionsPanel)
    const panel = wrapper.get('[data-testid="cash-sessions-panel"]')
    expect(panel.classes()).toContain('bg-[var(--cash-surface)]')
    expect(panel.classes()).toContain('dark:bg-[var(--cash-surface)]')
    expect(panel.classes()).not.toContain('dark:bg-coco-neutral-900')
    expect(wrapper.get('[data-testid="cash-sessions-empty"]').text()).toBe(
      'No hay sesiones para mostrar.',
    )
  })

  it('preserves the existing refresh action and own-session scope', async () => {
    const wrapper = mountWithUApp(CashSessionsPanel)
    await wrapper.get('[data-testid="cash-sessions-refresh"]').trigger('click')
    expect(wrapper.emitted('refresh')).toEqual([[]])
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.get('[data-testid="cash-sessions-scope-own"]').text()).toBe(
      'Ves solo tus propias sesiones: la auditoría no se otorga automáticamente.',
    )
  })
})
