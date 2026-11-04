import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, shallowRef, type Component } from 'vue'
import { mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import EditorialSelect from '../EditorialSelect.vue'
import EditorialSelectMenu from '../EditorialSelectMenu.vue'

const tick = () => new Promise(resolve => setTimeout(resolve, 60))
const cleanup: (() => void)[] = []
// The listbox scrolls the highlighted option into view, which jsdom lacks.
beforeAll(() => { HTMLElement.prototype.scrollIntoView = () => {} })
afterEach(() => { cleanup.splice(0).forEach(stop => stop()); document.body.innerHTML = '' })

function render(props: Record<string, unknown> = {}, initial: string | string[] | undefined = undefined, controlled = true, menu = false) {
  const value = shallowRef<string | readonly string[] | undefined>(initial), events: unknown[] = []
  const wrapper = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h((menu ? EditorialSelectMenu : EditorialSelect) as Component, {
    id: 'pick', label: 'Etapa de vida · Producto', items: [{ label: 'Cachorro', value: 'puppy' }, { label: 'Adulto', value: 'adult' }, { label: 'Viejo (no disponible)', value: 'old', disabled: true }],
    modelValue: value.value, 'onUpdate:modelValue': (next: string | readonly string[] | undefined) => { events.push(next); if (controlled) value.value = next }, ...props }) }) }), { attachTo: document.body })
  cleanup.push(() => wrapper.unmount())
  return { wrapper, value, events }
}
// A Reka select opens on a pointer press or a key and picks on Enter; a menu (combobox) opens on click.
const open = async (trigger: { element: Element }, menu = false) => {
  if (menu) (trigger.element as HTMLElement).click()
  else trigger.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
  await tick()
}
const pick = async (option: HTMLElement) => { option.focus(); option.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick() }
const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'))

describe('EditorialSelect', () => {
  it('is a Nuxt UI select whose trigger names the row, shows "Elige…" and has no native <select>', () => {
    const { wrapper } = render()
    const trigger = wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]')
    expect(trigger.attributes('aria-label')).toBe('Etapa de vida · Producto')
    expect(trigger.attributes('id')).toBe('pick')
    expect(trigger.text()).toBe('Elige…')
    expect(wrapper.find('select:not([aria-hidden])').exists()).toBe(false)
  })

  it('opens a listbox themed for dark mode and emits the item value', async () => {
    const { wrapper, events } = render()
    await open(wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]'))
    expect(document.querySelector('[role="listbox"]')!.closest('.hf-theme.hf-ui')).not.toBeNull()
    expect(options().map(option => option.textContent?.trim())).toEqual(['Cachorro', 'Adulto', 'Viejo (no disponible)'])
    expect(options()[2]!.getAttribute('aria-disabled') ?? options()[2]!.getAttribute('data-disabled')).not.toBeNull()
    await pick(options()[1]!)
    expect(events).toEqual(['adult'])
  })

  it('shows the chosen label, and a custom placeholder when asked', () => {
    expect(render({}, 'puppy').wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]').text()).toBe('Cachorro')
    expect(render({ placeholder: 'Sin familia' }).wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]').text()).toBe('Sin familia')
  })

  it('is disabled when asked and flags an invalid choice', () => {
    const { wrapper } = render({ disabled: true, invalid: true, describedby: 'pick-issue' })
    const trigger = wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]')
    expect(trigger.attributes('disabled')).toBeDefined()
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(trigger.attributes('aria-describedby')).toBe('pick-issue')
  })

  it('an action select goes back to the placeholder after a pick when the caller keeps the model empty', async () => {
    const { wrapper, events } = render({}, undefined, false)
    await open(wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]'))
    await pick(options()[0]!)
    expect(events).toEqual(['puppy'])
    expect(wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]').text()).toBe('Elige…')
  })

  it('multiple: a listbox menu that emits the whole selection', async () => {
    const { wrapper, events } = render({}, [], true, true)
    const trigger = wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]')
    expect(trigger.attributes('aria-label')).toBe('Etapa de vida · Producto')
    expect(trigger.text()).toBe('Elige…')
    await open(trigger, true)
    expect(document.querySelector('[role="listbox"]')!.closest('.hf-theme.hf-ui')).not.toBeNull()
    options()[0]!.click(); await tick()
    options()[1]!.click(); await tick()
    expect(events).toEqual([['puppy'], ['puppy', 'adult']])
  })
})
