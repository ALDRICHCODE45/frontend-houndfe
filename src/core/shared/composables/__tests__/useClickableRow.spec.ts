import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import RowActionsMenu from '../../components/RowActionsMenu.vue'
import { isInteractiveTarget, useClickableRow } from '../useClickableRow'

interface Order { name: string }
const order: Order = { name: 'Distribuidora' }

function fire(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  target.dispatchEvent(event)
  return event
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

// A real row: cells of every interactive kind, wired through rowProps().
function mountRow(open = vi.fn(), options?: { focusable?: boolean }) {
  const Row = defineComponent({
    setup() {
      const { rowProps } = useClickableRow<Order>(open, options)
      return () =>
        h('table', [h('tbody', [h('tr', { 'data-testid': 'row', ...rowProps(order) }, [
          h('td', { 'data-testid': 'plain' }, 'Distribuidora'),
          h('td', [h('a', { href: '#', 'data-testid': 'link' }, 'ir')]),
          h('td', [h('button', { 'data-testid': 'button' }, [h('svg', { 'data-testid': 'icon' })])]),
          h('td', [h('input', { 'data-testid': 'input' })]),
          h('td', [h('select', { 'data-testid': 'select' })]),
          h('td', [h('label', { 'data-testid': 'label' }, 'x')]),
          h('td', [h('span', { role: 'checkbox', 'data-testid': 'checkbox' })]),
          h('td', [h('span', { 'data-row-ignore': '', 'data-testid': 'ignored' }, 'z')]),
        ])])])
    },
  })
  return mount(Row, { attachTo: document.body })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('isInteractiveTarget', () => {
  it('is false for plain content and for the boundary itself', () => {
    const wrapper = mountRow()
    const row = wrapper.get('[data-testid=row]').element
    expect(isInteractiveTarget(wrapper.get('[data-testid=plain]').element, row)).toBe(false)
    expect(isInteractiveTarget(row, row)).toBe(false)
    wrapper.unmount()
  })

  it.each(['link', 'button', 'icon', 'input', 'select', 'label', 'checkbox', 'ignored'])(
    'is true for %s inside the row',
    id => {
      const wrapper = mountRow()
      const row = wrapper.get('[data-testid=row]').element
      expect(isInteractiveTarget(wrapper.get(`[data-testid=${id}]`).element, row)).toBe(true)
      wrapper.unmount()
    },
  )

  it('does not look past the boundary', () => {
    const outer = document.createElement('button')
    const row = document.createElement('div')
    outer.append(row)
    expect(isInteractiveTarget(row, row)).toBe(false)
  })
})

describe('useClickableRow', () => {
  it('opens the item when a plain cell is clicked', () => {
    const open = vi.fn()
    const wrapper = mountRow(open)
    fire(wrapper.get('[data-testid=plain]').element)
    expect(open).toHaveBeenCalledExactlyOnceWith(order)
    wrapper.unmount()
  })

  it.each(['link', 'button', 'icon', 'input', 'select', 'label', 'checkbox', 'ignored'])(
    'does not open when the click comes from %s',
    id => {
      const open = vi.fn()
      const wrapper = mountRow(open)
      fire(wrapper.get(`[data-testid=${id}]`).element)
      expect(open).not.toHaveBeenCalled()
      wrapper.unmount()
    },
  )

  it('ignores secondary buttons, modifier clicks and handled events', () => {
    const open = vi.fn()
    const wrapper = mountRow(open)
    const cell = wrapper.get('[data-testid=plain]').element
    fire(cell, { button: 2 })
    fire(cell, { ctrlKey: true })
    fire(cell, { metaKey: true })
    cell.addEventListener('click', event => event.preventDefault(), { once: true })
    fire(cell)
    expect(open).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not open while the user is selecting text', () => {
    const open = vi.fn()
    const wrapper = mountRow(open)
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'Distri' } as Selection)
    fire(wrapper.get('[data-testid=plain]').element)
    expect(open).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('opens on Enter pressed on the row itself and prevents the default', () => {
    const open = vi.fn()
    const wrapper = mountRow(open)
    const event = press(wrapper.get('[data-testid=row]').element, 'Enter')
    expect(open).toHaveBeenCalledWith(order)
    expect(event.defaultPrevented).toBe(true)
    wrapper.unmount()
  })

  it('leaves Enter to an interactive child and ignores other keys', () => {
    const open = vi.fn()
    const wrapper = mountRow(open)
    press(wrapper.get('[data-testid=button]').element, 'Enter')
    press(wrapper.get('[data-testid=input]').element, 'Enter')
    press(wrapper.get('[data-testid=row]').element, 'a')
    press(wrapper.get('[data-testid=row]').element, 'Enter', { ctrlKey: true })
    expect(open).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('exposes row props: class, tabindex and handlers', () => {
    const wrapper = mountRow()
    const row = wrapper.get('[data-testid=row]')
    expect(row.classes()).toContain('hf-clickable-row')
    expect(row.attributes('tabindex')).toBe('0')
    wrapper.unmount()
  })

  it('can skip the tab stop when the primary cell already holds a real button', () => {
    const wrapper = mountRow(vi.fn(), { focusable: false })
    expect(wrapper.get('[data-testid=row]').attributes('tabindex')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('clickable row + RowActionsMenu', () => {
  it('opens from the row but not from the ⋮ trigger, and Enter on the trigger stays with the menu', async () => {
    const open = vi.fn()
    const Row = defineComponent({
      setup() {
        const { rowProps } = useClickableRow<Order>(open)
        return () =>
          h('div', { 'data-testid': 'row', ...rowProps(order) }, [
            h('span', { 'data-testid': 'name' }, order.name),
            h(RowActionsMenu, { rowLabel: 'la orden de Distribuidora', actions: [{ key: 'view', label: 'Ver orden' }] }),
          ])
      },
    })
    const wrapper = mount(Row, { attachTo: document.body })
    const trigger = wrapper.get('button[aria-label="Acciones de la orden de Distribuidora"]')

    fire(trigger.element)
    press(trigger.element, 'Enter')
    expect(open).not.toHaveBeenCalled()

    fire(wrapper.get('[data-testid=name]').element)
    expect(open).toHaveBeenCalledOnce()
    wrapper.unmount()
  })
})
