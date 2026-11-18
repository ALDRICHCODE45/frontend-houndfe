import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PreferenceSwitchRow from '../PreferenceSwitchRow.vue'
import HfSwitchRow from '@/core/shared/components/selection/HfSwitchRow.vue'

const base = { prefKey: 'soundEnabled', title: 'Sonido de avisos', description: 'Suena al llegar.', checked: true }

describe('PreferenceSwitchRow', () => {
  it('is the shared HfSwitchRow with the profile test ids', () => {
    const wrapper = mount(PreferenceSwitchRow, { props: base })
    expect(wrapper.findComponent(HfSwitchRow).exists()).toBe(true)
    expect(wrapper.get('[data-testid="pref-soundEnabled"]').attributes('role')).toBe('switch')
  })

  it('emits toggle from the row and from «Reintentar», and keeps the kept value in the error', async () => {
    const wrapper = mount(PreferenceSwitchRow, { props: { ...base, failed: true } })
    expect(wrapper.get('[data-testid="pref-error-soundEnabled"]').text()).toContain(
      'No se pudo guardar. Tu preferencia sigue en «Activado».',
    )
    await wrapper.get('[data-testid="pref-soundEnabled"]').trigger('click')
    await wrapper.get('[data-testid="pref-retry-soundEnabled"]').trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(2)
  })
})
