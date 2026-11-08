/**
 * Shared assertion for the admin lists' premium table layout (premium-tables T9).
 *
 * Every list binds its persisted layout (order, sizing, pinning, visibility,
 * density) to AppDataTable's v-models, opts in to the «Guardado en tu vista»
 * cue with `persist-layout`, and resets the stored layout from the «Columnas»
 * panel's «Restablecer columnas».
 */
import { nextTick, type Ref } from 'vue'
import { expect, type Mock } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

export interface LayoutState {
  columnOrder: Ref<string[]>
  columnSizing: Ref<Record<string, number>>
  columnPinning: Ref<{ left?: string[]; right?: string[] }>
  columnVisibility: Ref<Record<string, boolean>>
  density: Ref<string>
  /** Called by the table's `reset-columns`. */
  reset: Mock
}

export async function expectLayoutBound(wrapper: VueWrapper, state: LayoutState) {
  const table = wrapper.findComponent({ name: 'AppDataTable' })
  const props = table.props() as Record<string, unknown>
  expect(props.persistLayout).toBe(true)
  expect(props.columnOrder).toEqual(state.columnOrder.value)
  expect(props.columnSizing).toEqual(state.columnSizing.value)
  expect(props.columnPinning).toEqual(state.columnPinning.value)
  expect(props.columnVisibility).toEqual(state.columnVisibility.value)
  expect(props.density).toBe(state.density.value)

  table.vm.$emit('update:columnOrder', ['moved'])
  table.vm.$emit('update:columnSizing', { moved: 200 })
  table.vm.$emit('update:columnPinning', { left: ['moved'], right: [] })
  table.vm.$emit('update:columnVisibility', { moved: false })
  table.vm.$emit('update:density', 'compact')
  await nextTick()
  expect(state.columnOrder.value).toEqual(['moved'])
  expect(state.columnSizing.value).toEqual({ moved: 200 })
  expect(state.columnPinning.value).toEqual({ left: ['moved'], right: [] })
  expect(state.columnVisibility.value).toEqual({ moved: false })
  expect(state.density.value).toBe('compact')

  table.vm.$emit('reset-columns')
  expect(state.reset).toHaveBeenCalled()
}
