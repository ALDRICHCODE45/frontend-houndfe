// MasterToggle.spec.ts — STRICT-TDD tests for the master notifications
// switch component.
//
// MasterToggle is a thin wrapper over USwitch with:
//   - a state badge (Activadas / Desactivadas) per spec
//   - data-testid hooks for integration tests
//   - pure computed `computeMasterBadgeState` extracted for unit testing
//
// Per project rules: a thin component can have 1 prop + 1 emit; the badge
// text is derived from a pure helper, not branched in the template.

import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import MasterToggle from '../MasterToggle.vue'
import { computeMasterBadgeState } from '../masterToggleState'

describe('computeMasterBadgeState (pure)', () => {
  it('returns "Activadas" with success tone when enabled=true', () => {
    expect(computeMasterBadgeState(true)).toEqual({
      label: 'Activadas',
      color: 'success',
    })
  })

  it('returns "Desactivadas" with neutral tone when enabled=false', () => {
    expect(computeMasterBadgeState(false)).toEqual({
      label: 'Desactivadas',
      color: 'neutral',
    })
  })
})

describe('MasterToggle — render', () => {
  function mountToggle(props: Record<string, unknown> = {}) {
    return mountWithUApp(MasterToggle, {
      props: { modelValue: false, ...props },
    })
  }

  it('renders the "Activadas" badge when modelValue=true', () => {
    const wrapper = mountToggle({ modelValue: true })
    expect(wrapper.text()).toContain('Activadas')
  })

  it('renders the "Desactivadas" badge when modelValue=false', () => {
    const wrapper = mountToggle({ modelValue: false })
    expect(wrapper.text()).toContain('Desactivadas')
  })

  it('renders the description text from the label/description props', () => {
    const wrapper = mountToggle({
      modelValue: true,
      label: 'Notificaciones',
      description: 'Cuando estén activadas, los usuarios seleccionados recibirán notificaciones del sistema.',
    })
    expect(wrapper.text()).toContain('Notificaciones')
    expect(wrapper.text()).toContain('recibirán notificaciones')
  })
})

describe('MasterToggle — interaction', () => {
  function mountToggle(props: Record<string, unknown> = {}) {
    return mountWithUApp(MasterToggle, {
      props: { modelValue: false, ...props },
    })
  }

  it('emits @update:modelValue with true when the switch is flipped ON', async () => {
    const wrapper = mountToggle({ modelValue: false })
    const switchBtn = wrapper.find('button[role="switch"]')
    expect(switchBtn.exists()).toBe(true)
    await switchBtn.trigger('click')
    await nextTick()

    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual([true])
  })

  it('emits @update:modelValue with false when the switch is flipped OFF', async () => {
    const wrapper = mountToggle({ modelValue: true })
    const switchBtn = wrapper.find('button[role="switch"]')
    await switchBtn.trigger('click')
    await nextTick()

    const events = wrapper.emitted('update:modelValue')
    expect(events![events!.length - 1]).toEqual([false])
  })

  it('marks the switch as disabled when :disabled=true', () => {
    const wrapper = mountToggle({ modelValue: false, disabled: true })
    const switchBtn = wrapper.find('button[role="switch"]')
    // USwitch surfaces `disabled` and a `data-disabled` marker.
    expect(switchBtn.attributes('disabled')).toBeDefined()
    expect(switchBtn.attributes('data-disabled')).toBe('')
  })
})