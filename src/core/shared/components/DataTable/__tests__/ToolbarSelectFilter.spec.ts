import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ToolbarSelectFilter from '../ToolbarSelectFilter.vue'

const items = [{ label: 'Todas', value: 'ALL' }, { label: 'Borradores', value: 'DRAFT' }, { label: 'Confirmadas', value: 'CONFIRMED' }]
const dispose: Array<() => void> = []
afterEach(() => { dispose.splice(0).forEach(fn => fn()); document.body.innerHTML = '' })

function setup(props: Record<string, unknown> = {}) {
  const value = ref('ALL')
  const root = mount(defineComponent({
    setup: () => () => h(UApp, null, { default: () => h(ToolbarSelectFilter, { modelValue: value.value, 'onUpdate:modelValue': (next: string) => { value.value = next }, items, label: 'Estado', portalClass: 'hf-theme hf-ui test-portal', testId: 'status-filter', ...props }) }),
  }), { attachTo: document.body })
  dispose.push(() => root.unmount())
  return { root, value }
}
const trigger = () => document.querySelector<HTMLElement>('[data-testid="status-filter"]')!
async function open() {
  trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  await vi.waitFor(() => expect(document.querySelector('[role="listbox"]')).not.toBeNull())
}

describe('ToolbarSelectFilter', () => {
  it('renders a labelled USelect trigger inside a titled filter section, never a native select', async () => {
    setup()
    await flushPromises()
    expect(trigger().getAttribute('role')).toBe('combobox')
    expect(trigger().getAttribute('aria-label')).toBe('Estado')
    expect(trigger().textContent).toContain('Todas')
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('p')?.textContent).toBe('Estado')
  })
  it('keeps the 44px HF boundary hook on the trigger', async () => {
    setup()
    await flushPromises()
    expect(trigger().classList.contains('hf-toolbar-select')).toBe(true)
  })
  it('opens a listbox of readable labels owned by the portal class, and emits the chosen value', async () => {
    const { value } = setup()
    await flushPromises()
    await open()
    const listbox = document.querySelector('[role="listbox"]')!
    expect(Array.from(listbox.querySelectorAll('[role="option"]')).map(option => option.textContent?.trim())).toEqual(['Todas', 'Borradores', 'Confirmadas'])
    expect(listbox.closest('.test-portal')).not.toBeNull()
    const option = Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]')).find(item => item.textContent?.includes('Confirmadas'))!
    option.focus()
    option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await vi.waitFor(() => expect(value.value).toBe('CONFIRMED'))
  })
  it('leaves the native portal defaults alone without a portal class', async () => {
    setup({ portalClass: undefined })
    await flushPromises()
    await open()
    expect(document.querySelector('[role="listbox"]')!.closest('.test-portal')).toBeNull()
  })
  it('shows its name inside the control, as "Estado · Todas", and follows the selection', async () => {
    const { value } = setup()
    await flushPromises()
    const shown = () => trigger().textContent?.replace(/\s+/g, ' ').trim()
    expect(shown()).toBe('Estado · Todas')
    expect(trigger().querySelector('.hf-toolbar-select-name')?.textContent?.trim()).toBe('Estado ·')
    value.value = 'DRAFT'
    await flushPromises()
    expect(shown()).toBe('Estado · Borradores')
  })
  it('keeps the name once per control for any consumer label, with no change at the call site', async () => {
    setup({ label: 'Vencimiento' })
    await flushPromises()
    expect(trigger().textContent?.replace(/\s+/g, ' ').trim()).toBe('Vencimiento · Todas')
    expect(trigger().getAttribute('aria-label')).toBe('Vencimiento')
  })
  it('falls back to the bare label when nothing matches the model, never "undefined"', async () => {
    setup({ modelValue: 'MISSING', items: [{ label: 'Todas', value: 'ALL' }] })
    await flushPromises()
    expect(trigger().textContent).not.toContain('undefined')
    expect(trigger().textContent?.replace(/\s+/g, ' ').trim()).toContain('Estado')
  })
})
