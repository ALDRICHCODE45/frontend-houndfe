import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DataTableBulkActions from '../DataTableBulkActions.vue'

const sfc = readFileSync(resolve(__dirname, '../DataTableBulkActions.vue'), 'utf8')

const UButtonStub = {
  props: ['label', 'disabled', 'color', 'icon', 'ariaLabel'],
  emits: ['click'],
  template:
    '<button type="button" :disabled="disabled" :data-color="color" :aria-label="ariaLabel" @click="$emit(\'click\')">{{ label }}<slot /></button>',
}

function mountBar(selectedCount: number, onClick = vi.fn(), props: Record<string, unknown> = {}, slots = {}) {
  return mount(DataTableBulkActions, {
    props: {
      selectedCount,
      totalCount: 10,
      actions: [{ id: 'archive', label: 'Archivar', onClick }],
      ...props,
    },
    slots,
    global: { stubs: { UButton: UButtonStub, Button: UButtonStub, Transition: false } },
  })
}

describe('DataTableBulkActions', () => {
  it('shows the selected count as a neutral token count, not a legacy badge', () => {
    const wrapper = mountBar(3)
    const count = wrapper.get('[data-testid="bulk-selected-count"]')
    expect(count.text()).toBe('3')
    expect(count.classes()).toContain('hf-bulk-count')
    expect(wrapper.get('.hf-bulk-bar__count').text()).toBe('3 seleccionados')
    expect(sfc).not.toMatch(/AppBadge|UBadge/)
    expect(sfc).toMatch(/var\(--hf-/)
  })

  it('names the selection with the consumer noun, singular and plural', async () => {
    const wrapper = mountBar(1, vi.fn(), { selectedLabel: { one: 'seleccionada', other: 'seleccionadas' } })
    expect(wrapper.get('.hf-bulk-bar__count').text()).toBe('1 seleccionada')
    await wrapper.setProps({ selectedCount: 3 })
    expect(wrapper.get('.hf-bulk-bar__count').text()).toBe('3 seleccionadas')
  })

  it('renders nothing without a selection', () => {
    expect(mountBar(0).find('[data-testid="bulk-selected-count"]').exists()).toBe(false)
  })

  it('is a labelled region that announces the count politely', () => {
    const wrapper = mountBar(3)
    const region = wrapper.get('[role="region"]')
    expect(region.attributes('aria-label')).toBe('Acciones para las filas seleccionadas')
    expect(region.classes()).toContain('hf-bulk-bar')
    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('3 seleccionados de 10')
  })

  it('emits clearSelection from ✕ «Quitar selección» and runs the bulk action', async () => {
    const onClick = vi.fn()
    const wrapper = mountBar(2, onClick)
    await wrapper.get('[aria-label="Quitar selección"]').trigger('click')
    expect(wrapper.emitted('clearSelection')).toHaveLength(1)
    await wrapper.findAll('button').find((b) => b.text() === 'Archivar')!.trigger('click')
    expect(onClick).toHaveBeenCalledWith([])
  })

  it('passes the selected rows to the action when given', async () => {
    const onClick = vi.fn()
    const wrapper = mountBar(1, onClick, { selectedRows: [{ id: 7 }] })
    await wrapper.findAll('button').find((b) => b.text() === 'Archivar')!.trigger('click')
    expect(onClick).toHaveBeenCalledWith([{ id: 7 }])
  })

  it('renders the summary slot beside the count', () => {
    const wrapper = mountBar(2, vi.fn(), {}, { summary: '<span>Total <b>$1,200.00</b></span>' })
    expect(wrapper.get('.hf-bulk-bar__summary').text()).toBe('Total $1,200.00')
  })

  it('keeps the disabled state and puts destructive actions last, styled as danger', () => {
    const wrapper = mountBar(2, vi.fn(), {
      actions: [
        { id: 'delete', label: 'Eliminar', variant: 'destructive', onClick: vi.fn() },
        { id: 'end', label: 'Finalizar', variant: 'warning', disabled: true, onClick: vi.fn() },
        { id: 'react', label: 'Reactivar', variant: 'primary', onClick: vi.fn() },
      ],
    })
    const actions = wrapper.findAll('[data-bulk-action]')
    expect(actions.map((b) => b.text())).toEqual(['Finalizar', 'Reactivar', 'Eliminar'])
    expect(actions[0]!.attributes('disabled')).toBeDefined()
    expect(actions[2]!.attributes('data-color')).toBe('error')
    expect(actions[2]!.classes()).toContain('hf-bulk-bar__danger')
  })

  it('centres itself over the table surface it is given', () => {
    const wrapper = mountBar(2, vi.fn(), { anchor: { left: 240, width: 1000 } })
    const style = (wrapper.get('.hf-bulk-bar').element as HTMLElement).style
    expect(style.getPropertyValue('--hf-bulk-center')).toBe('740px')
    expect(style.getPropertyValue('--hf-bulk-max')).toBe('968px')
  })
})
