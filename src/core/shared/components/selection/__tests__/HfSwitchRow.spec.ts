import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfSwitchRow from '../HfSwitchRow.vue'

function mountRow(props: Record<string, unknown> = {}) {
  return mount(HfSwitchRow, {
    attachTo: document.body,
    props: {
      label: 'Avisos por correo',
      description: 'Te escribimos cuando llega un pedido.',
      modelValue: false,
      ...props,
    },
  })
}

const sw = (wrapper: ReturnType<typeof mountRow>) => wrapper.get('[role="switch"]')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfSwitchRow', () => {
  it('is one native button with role switch, named by the label and described by the description', () => {
    const wrapper = mountRow()
    const row = sw(wrapper)
    expect(row.element.tagName).toBe('BUTTON')
    expect(row.attributes('type')).toBe('button')
    expect(row.attributes('aria-checked')).toBe('false')
    const labelId = row.attributes('aria-labelledby')!
    expect(wrapper.get(`[id="${labelId}"]`).text()).toBe('Avisos por correo')
    const describedBy = row.attributes('aria-describedby')!.split(' ')
    expect(describedBy.map((id) => wrapper.get(`[id="${id}"]`).text())).toContain(
      'Te escribimos cuando llega un pedido.',
    )
    // The label and the description live inside the target.
    expect(row.text()).toContain('Avisos por correo')
    expect(row.text()).toContain('Te escribimos cuando llega un pedido.')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('says the state in words, and the words can be hidden', async () => {
    const wrapper = mountRow({ modelValue: true })
    expect(sw(wrapper).text()).toContain('Activado')
    await wrapper.setProps({ modelValue: false })
    expect(sw(wrapper).text()).toContain('Desactivado')
    await wrapper.setProps({ showState: false })
    expect(sw(wrapper).text()).not.toContain('Desactivado')
  })

  it('a click anywhere on the row emits the next value', async () => {
    const wrapper = mountRow({ modelValue: false })
    await wrapper.get('.hf-switch-row__label').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]])
    await wrapper.setProps({ modelValue: true })
    await sw(wrapper).trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[true], [false]])
  })

  it('stays focusable when disabled, says why and ignores clicks', async () => {
    const wrapper = mountRow({ disabled: true, disabledReason: 'Lista interna; no se puede publicar' })
    const row = sw(wrapper)
    expect(row.attributes('aria-disabled')).toBe('true')
    expect(row.attributes('disabled')).toBeUndefined()
    const ids = row.attributes('aria-describedby')!.split(' ')
    expect(ids.map((id) => wrapper.get(`[id="${id}"]`).text())).toContain(
      'Lista interna; no se puede publicar',
    )
    await row.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows «Guardando…» and aria-busy while saving', () => {
    const wrapper = mountRow({ modelValue: true, saving: true })
    expect(sw(wrapper).attributes('aria-busy')).toBe('true')
    expect(sw(wrapper).text()).toContain('Guardando…')
  })

  it('links an error alert to the switch and offers «Reintentar»', async () => {
    const wrapper = mountRow({
      error: 'No se pudo guardar.',
      testId: 'row',
      errorTestId: 'row-error',
      retryTestId: 'row-retry',
    })
    const alert = wrapper.get('[data-testid="row-error"]')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain('No se pudo guardar.')
    expect(wrapper.get('[data-testid="row"]').attributes('aria-describedby')).toContain(
      alert.attributes('id'),
    )
    await wrapper.get('[data-testid="row-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
