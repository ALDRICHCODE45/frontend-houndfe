import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DataTableBulkActions from '../DataTableBulkActions.vue'

const sfc = readFileSync(resolve(__dirname, '../DataTableBulkActions.vue'), 'utf8')

const UButtonStub = {
  props: ['label'],
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')">{{ label }}</button>',
}

function mountBar(selectedCount: number, onClick = vi.fn()) {
  return mount(DataTableBulkActions, {
    props: {
      selectedCount,
      totalCount: 10,
      actions: [{ id: 'archive', label: 'Archivar', onClick }],
    },
    global: { stubs: { UButton: UButtonStub, Transition: false } },
  })
}

describe('DataTableBulkActions', () => {
  it('shows the selected count as a neutral token count, not a legacy badge', () => {
    const wrapper = mountBar(3)
    const count = wrapper.get('[data-testid="bulk-selected-count"]')
    expect(count.text()).toBe('3')
    expect(count.classes()).toContain('hf-bulk-count')
    expect(wrapper.text()).toContain('de 10 seleccionados')
    expect(sfc).not.toMatch(/AppBadge|UBadge/)
    expect(sfc).toMatch(/var\(--hf-/)
  })

  it('renders nothing without a selection', () => {
    expect(mountBar(0).find('[data-testid="bulk-selected-count"]').exists()).toBe(false)
  })

  it('emits clearSelection and runs the bulk action', async () => {
    const onClick = vi.fn()
    const wrapper = mountBar(2, onClick)
    const buttons = wrapper.findAll('button')
    await buttons.find((b) => b.text() === 'Deseleccionar')!.trigger('click')
    expect(wrapper.emitted('clearSelection')).toHaveLength(1)
    await buttons.find((b) => b.text() === 'Archivar')!.trigger('click')
    expect(onClick).toHaveBeenCalledWith([])
  })
})
