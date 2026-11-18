// ActionRow.spec.ts — one notification action as a whole-row switch
// (HfSwitchRow): the label, description, state word and track are one target.

import { describe, expect, it } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import ActionRow from '../ActionRow.vue'
import type { ActionDescriptor } from '../../interfaces/notification-config.types'

const LOW_STOCK: ActionDescriptor = {
  key: 'LOW_STOCK',
  label: 'Bajo inventario',
  description: 'Envía un correo cuando un producto cae por debajo de su inventario mínimo.',
}

function mountRow(props: Record<string, unknown> = {}) {
  return mountWithUApp(ActionRow, {
    props: { action: LOW_STOCK, modelValue: [], masterEnabled: true, ...props },
  })
}

const sw = (wrapper: ReturnType<typeof mountRow>) => wrapper.get('[role="switch"]')

describe('ActionRow — whole-row switch', () => {
  it('is one role=switch button named by the label and described by the description', () => {
    const wrapper = mountRow()
    const row = sw(wrapper)
    expect(row.element.tagName).toBe('BUTTON')
    expect(row.attributes('aria-checked')).toBe('false')
    expect(wrapper.get(`[id="${row.attributes('aria-labelledby')}"]`).text()).toBe('Bajo inventario')
    expect(row.text()).toContain(LOW_STOCK.description)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('reflects membership in aria-checked and the state word', () => {
    const on = mountRow({ modelValue: ['LOW_STOCK'] })
    expect(sw(on).attributes('aria-checked')).toBe('true')
    expect(on.get('.hf-switch-row__state').text()).toBe('Activado')
    expect(mountRow().get('.hf-switch-row__state').text()).toBe('Desactivado')
  })

  it('keeps the action-row-<slug> hook with data-checked', () => {
    const wrapper = mountRow({ modelValue: ['LOW_STOCK'] })
    const root = wrapper.get('[data-testid="action-row-low-stock"]')
    expect(root.attributes('data-checked')).toBe('true')
  })

  it('emits the toggled membership when the row is clicked', async () => {
    const wrapper = mountRow({ modelValue: ['DELIVERY_NEXT_STOP'] })
    await sw(wrapper).trigger('click')
    expect(wrapper.emitted('toggle')?.[0]).toEqual([['DELIVERY_NEXT_STOP', 'LOW_STOCK']])
  })

  it('renders no description when the action has none', () => {
    const wrapper = mountRow({ action: { key: 'LOW_STOCK', label: 'Bajo inventario' } })
    expect(wrapper.find('.hf-switch-row__desc').exists()).toBe(false)
  })
})

describe('ActionRow — master off', () => {
  it('stays focusable with aria-disabled, says En pausa and reads the pause reason', async () => {
    const wrapper = mountRow({ modelValue: ['LOW_STOCK'], masterEnabled: false })
    const row = sw(wrapper)
    expect(row.attributes('aria-disabled')).toBe('true')
    expect(row.attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.hf-switch-row__state').text()).toBe('En pausa')
    const ids = row.attributes('aria-describedby')!.split(' ')
    const described = ids.map((id) => wrapper.get(`[id="${id}"]`).text())
    expect(described).toContain('En pausa: las notificaciones están desactivadas.')
    await row.trigger('click')
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('an unselected action says why it cannot change', () => {
    const wrapper = mountRow({ masterEnabled: false })
    expect(wrapper.text()).toContain('No disponible mientras las notificaciones están desactivadas.')
  })
})

describe('ActionRow — read only (no update permission)', () => {
  it('is aria-disabled and does not emit, without the pause reason', async () => {
    const wrapper = mountRow({ readonly: true })
    const row = sw(wrapper)
    expect(row.attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('.hf-switch-row__reason').exists()).toBe(false)
    await row.trigger('click')
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })
})
