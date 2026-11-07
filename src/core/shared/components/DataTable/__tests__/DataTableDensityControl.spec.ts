/**
 * Premium tables T6: the density segmented control (artboard 01) — Compacta 40 / Normal 48 /
 * Cómoda 64 as a radio group «Densidad de filas» with one tab stop and arrow keys.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTableDensityControl from '../DataTableDensityControl.vue'
import type { TableDensity } from '../tableLayout'

function mountControl(density: TableDensity = 'comfortable', props: Record<string, unknown> = {}) {
  return mount(DataTableDensityControl, { props: { density, ...props }, attachTo: document.body })
}
type Wrapper = ReturnType<typeof mountControl>
const radios = (wrapper: Wrapper) => wrapper.findAll('[role="radio"]')
const radio = (wrapper: Wrapper, label: string) => radios(wrapper).find(item => item.text() === label)!
const last = (wrapper: Wrapper) => wrapper.emitted('update:density')?.slice(-1)[0]

describe('DataTableDensityControl', () => {
  it('is a radio group named «Densidad de filas» with the three presets and their heights', () => {
    const wrapper = mountControl()
    const group = wrapper.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Densidad de filas')
    expect(radios(wrapper).map(item => item.text())).toEqual(['Compacta', 'Normal', 'Cómoda'])
    expect(radios(wrapper).map(item => item.attributes('title'))).toEqual([
      'Filas de 40 px',
      'Filas de 48 px',
      'Filas de 64 px',
    ])
    wrapper.unmount()
  })

  it('checks the current density and keeps it as the only tab stop', () => {
    const wrapper = mountControl('normal')
    expect(radios(wrapper).map(item => item.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios(wrapper).map(item => item.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    wrapper.unmount()
  })

  it('emits the density picked with a click, and nothing for the current one', async () => {
    const wrapper = mountControl()
    await radio(wrapper, 'Compacta').trigger('click')
    await radio(wrapper, 'Cómoda').trigger('click')
    expect(wrapper.emitted('update:density')).toEqual([['compact']])
    wrapper.unmount()
  })

  it('moves the choice with the arrow keys, wrapping at the ends, and follows it with the focus', async () => {
    const wrapper = mountControl('comfortable')
    await radio(wrapper, 'Cómoda').trigger('keydown', { key: 'ArrowRight' })
    expect(last(wrapper)).toEqual(['compact'])
    await wrapper.setProps({ density: 'compact' })
    await radio(wrapper, 'Compacta').trigger('keydown', { key: 'ArrowLeft' })
    expect(last(wrapper)).toEqual(['comfortable'])
    await radio(wrapper, 'Compacta').trigger('keydown', { key: 'ArrowDown' })
    expect(last(wrapper)).toEqual(['normal'])
    await wrapper.setProps({ density: 'normal' })
    expect(document.activeElement).toBe(radio(wrapper, 'Normal').element)
    wrapper.unmount()
  })

  it('can be disabled', () => {
    const wrapper = mountControl('comfortable', { disabled: true })
    expect(radios(wrapper).every(item => item.attributes('disabled') !== undefined)).toBe(true)
    wrapper.unmount()
  })
})
