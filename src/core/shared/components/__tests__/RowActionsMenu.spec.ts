import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RowActionsMenu from '../RowActionsMenu.vue'

// UDropdownMenu is registered by @nuxt/ui at the Vite level, so the real menu
// renders: open it from the real trigger and read the portal Reka mounts on body.
const actions = [
  { key: 'continue', label: 'Continuar', icon: 'i-lucide-pencil' },
  { key: 'discard', label: 'Descartar borrador', icon: 'i-lucide-trash-2', destructive: true },
  { key: 'confirm', label: 'Confirmar…', icon: 'i-lucide-check' },
  { key: 'cancel', label: 'Cancelar…', icon: 'i-lucide-ban', disabled: true },
]

function mountMenu(props: Record<string, unknown> = {}) {
  return mount(RowActionsMenu, {
    attachTo: document.body,
    props: { rowLabel: 'la orden de Distribuidora Veterinaria del Norte', actions, ...props },
  })
}

const tick = () => new Promise(resolve => setTimeout(resolve, 50))
const items = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => items().map(item => (item.textContent ?? '').trim())

async function open(wrapper: ReturnType<typeof mountMenu>) {
  await wrapper.get('button').trigger('click')
  await tick()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('RowActionsMenu', () => {
  it('renders an icon-only ⋮ button named after the row', () => {
    const wrapper = mountMenu()
    const trigger = wrapper.get('button')
    expect(trigger.attributes('aria-label')).toBe('Acciones de la orden de Distribuidora Veterinaria del Norte')
    expect(trigger.text()).toBe('')
    expect(trigger.attributes('aria-haspopup')).toBe('menu')
    wrapper.unmount()
  })

  it('lets the caller override the accessible name', () => {
    const wrapper = mountMenu({ ariaLabel: 'Más acciones del renglón 2' })
    expect(wrapper.get('button').attributes('aria-label')).toBe('Más acciones del renglón 2')
    wrapper.unmount()
  })

  it('renders nothing when there are no actions', () => {
    const wrapper = mountMenu({ actions: [] })
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('keeps the given order and moves the destructive item last', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    expect(labels()).toEqual(['Continuar', 'Confirmar…', 'Cancelar…', 'Descartar borrador'])
    wrapper.unmount()
  })

  it('separates the destructive item and styles it with the danger role', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    const all = items()
    const last = all[all.length - 1]!
    expect(last.className).toContain('hf-row-action-danger')
    expect(all.slice(0, -1).some(item => item.className.includes('hf-row-action-danger'))).toBe(false)
    const separator = document.querySelector('[role="separator"]')
    expect(separator).not.toBeNull()
    expect(separator!.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(separator!.compareDocumentPosition(all[0]!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    wrapper.unmount()
  })

  it('draws no separator when every action is destructive', async () => {
    const wrapper = mountMenu({ actions: [actions[1]] })
    await open(wrapper)
    expect(labels()).toEqual(['Descartar borrador'])
    expect(document.querySelector('[role="separator"]')).toBeNull()
    wrapper.unmount()
  })

  it('shows the icon and label of every item', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    expect(items()[0]!.querySelector('[data-slot="itemLeadingIcon"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('emits the key of the selected action', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    items().find(item => item.textContent?.includes('Confirmar'))!.click()
    await tick()
    expect(wrapper.emitted('select')).toEqual([['confirm']])
    wrapper.unmount()
  })

  it('emits the key of the destructive action too', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    items().find(item => item.textContent?.includes('Descartar'))!.click()
    await tick()
    expect(wrapper.emitted('select')).toEqual([['discard']])
    wrapper.unmount()
  })

  it('does not emit for a disabled action', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    const disabled = items().find(item => item.textContent?.includes('Cancelar'))!
    expect(disabled.getAttribute('data-disabled')).not.toBeNull()
    disabled.click()
    await tick()
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const wrapper = mountMenu()
    await open(wrapper)
    expect(items().length).toBeGreaterThan(0)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()
    await tick()
    expect(items()).toHaveLength(0)
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('button').element)
    wrapper.unmount()
  })

  it('opens from the keyboard on the trigger (ArrowDown)', async () => {
    const wrapper = mountMenu()
    wrapper.get('button').element.focus()
    await wrapper.get('button').trigger('keydown', { key: 'ArrowDown' })
    await tick()
    expect(labels()).toContain('Continuar')
    wrapper.unmount()
  })

  it('does not let trigger clicks or keys reach a clickable parent row', async () => {
    const parentClick = vi.fn()
    const parentKey = vi.fn()
    const parent = document.createElement('div')
    parent.addEventListener('click', parentClick)
    parent.addEventListener('keydown', parentKey)
    document.body.append(parent)
    const wrapper = mount(RowActionsMenu, { attachTo: parent, props: { rowLabel: 'x', actions } })
    await wrapper.get('button').trigger('click')
    await wrapper.get('button').trigger('keydown', { key: 'Enter' })
    expect(parentClick).not.toHaveBeenCalled()
    expect(parentKey).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('puts the theme boundary on the teleported menu content', async () => {
    const wrapper = mountMenu({ portalClass: 'purchase-orders-portal' })
    await open(wrapper)
    const content = document.querySelector('[role="menu"]')!
    expect(content.className).toContain('hf-theme')
    expect(content.className).toContain('hf-ui')
    expect(content.className).toContain('purchase-orders-portal')
    wrapper.unmount()
  })
  it('keeps Enter and Space from opening the row but lets Escape and Tab reach an enclosing dialog', async () => {
    const parent = vi.fn()
    const wrapper = mountMenu()
    wrapper.element.parentElement?.addEventListener('keydown', (event: Event) => parent((event as KeyboardEvent).key))
    const trigger = wrapper.get('button')
    for (const key of ['Enter', ' ', 'Escape', 'Tab']) trigger.element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    expect(parent.mock.calls.map(call => call[0])).toEqual(['Escape', 'Tab'])
    wrapper.unmount()
  })
})
