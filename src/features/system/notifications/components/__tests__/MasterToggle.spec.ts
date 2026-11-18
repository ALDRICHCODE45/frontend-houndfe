// MasterToggle.spec.ts — the master «Notificaciones» switch as a whole-row
// switch (HfSwitchRow) with the Activadas / Desactivadas state word.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import MasterToggle from '../MasterToggle.vue'
import { computeMasterBadgeState } from '../masterToggleState'

describe('computeMasterBadgeState (pure)', () => {
  it('returns "Activadas" with success tone when enabled=true', () => {
    expect(computeMasterBadgeState(true)).toEqual({ label: 'Activadas', tone: 'success' })
  })

  it('returns "Desactivadas" with neutral tone when enabled=false', () => {
    expect(computeMasterBadgeState(false)).toEqual({ label: 'Desactivadas', tone: 'neutral' })
  })
})

function mountToggle(props: Record<string, unknown> = {}) {
  return mountWithUApp(MasterToggle, { props: { modelValue: false, ...props } })
}

describe('MasterToggle', () => {
  it('is one role=switch row named «Notificaciones por correo» with a description', () => {
    const wrapper = mountToggle()
    const row = wrapper.get('[role="switch"]')
    expect(row.element.tagName).toBe('BUTTON')
    expect(wrapper.get(`[id="${row.attributes('aria-labelledby')}"]`).text()).toBe(
      'Notificaciones por correo',
    )
    expect(row.text()).toContain('Interruptor general')
  })

  it('reflects the state in aria-checked, the state word and data-enabled', () => {
    const on = mountToggle({ modelValue: true })
    expect(on.get('[role="switch"]').attributes('aria-checked')).toBe('true')
    expect(on.get('.hf-switch-row__state').text()).toBe('Activadas')
    expect(on.get('[data-testid="master-toggle"]').attributes('data-enabled')).toBe('true')
    const off = mountToggle({ modelValue: false })
    expect(off.get('.hf-switch-row__state').text()).toBe('Desactivadas')
  })

  it('emits the next value when the row is clicked', async () => {
    const wrapper = mountToggle({ modelValue: false })
    await wrapper.get('[role="switch"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
  })

  it('is aria-disabled and silent when disabled', async () => {
    const wrapper = mountToggle({ modelValue: true, disabled: true })
    const row = wrapper.get('[role="switch"]')
    expect(row.attributes('aria-disabled')).toBe('true')
    await row.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
