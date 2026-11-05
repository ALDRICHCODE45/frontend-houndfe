import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

// jsdom does not implement `scrollIntoView`, which Reka calls on the highlighted item.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// The real Nuxt UI items, opened in their portals, read against the adapter.
// Nuxt draws its items as `flex items-start` and its highlight as
// `before:bg-elevated/50`; the adapter forces a 44px minimum (so the label sat
// at the top with a gap under it) and binds `--ui-bg-elevated` to the surface
// (so the highlight was invisible). Browser paint stays separate evidence.
const foundation = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const adapter = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const styles: HTMLStyleElement[] = []
const tick = () => new Promise(resolve => setTimeout(resolve, 50))

function declarations(element: Element, pseudo = '') {
  const result: Record<string, string> = {}
  for (const style of styles) {
    for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
      if (!(rule instanceof CSSStyleRule)) continue
      const entry = rule
      const selectors = splitSelectors(entry.selectorText)
        .filter(selector => pseudo ? selector.endsWith(pseudo) : !selector.includes('::'))
        .map(selector => pseudo ? selector.slice(0, -pseudo.length) : selector)
      if (!selectors.some(selector => element.matches(selector))) continue
      for (const name of Array.from(entry.style))
        result[name] = entry.style.getPropertyValue(name).trim()
    }
  }
  return result
}

function splitSelectors(text: string) {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += char
  }
  parts.push(current.trim())
  return parts
}

beforeEach(() => {
  document.body.className = 'hf-theme hf-ui'
  for (const css of [foundation, adapter]) {
    const style = document.createElement('style')
    style.textContent = css.replace(/^@import.*$/gm, '')
    document.head.append(style)
    styles.push(style)
  }
})

afterEach(() => {
  styles.splice(0).forEach(style => style.remove())
  document.body.innerHTML = ''
  document.body.className = ''
})

const items = [{ label: 'Bolsa', value: 'bolsa' }, { label: 'Lata', value: 'lata' }]

async function openSelect(component: Component) {
  const wrapper = mount(defineComponent(() => () => h(component, { items, modelValue: 'bolsa', 'aria-label': 'Envase' })), {
    attachTo: document.body,
  })
  // Reka's Select opens on pointerdown or the keyboard, not on click; Enter works for both.
  const trigger = wrapper.get('[data-slot="base"]')
  await (component === (USelect as Component) ? trigger.trigger('keydown', { key: 'Enter' }) : trigger.trigger('click'))
  await tick()
  return wrapper
}

async function openMenu() {
  const wrapper = mount(defineComponent(() => () => h(UDropdownMenu, { items: [{ label: 'Editar' }, { label: 'Duplicar' }] }, {
    default: () => h(UButton, { label: 'Acciones' }),
  })), { attachTo: document.body })
  await wrapper.get('button').trigger('click')
  await tick()
  return wrapper
}

describe('hf-ui select and menu items', () => {
  it.each([
    ['USelect', () => openSelect(USelect as Component), '[role="option"]'],
    ['USelectMenu', () => openSelect(USelectMenu as Component), '[role="option"]'],
    ['UDropdownMenu', openMenu, '[role="menuitem"]'],
  ] as const)('%s centers the label in the item, with no gap under it', async (_name, open, role) => {
    const wrapper = await open()
    const item = document.querySelector(role)!
    expect(item).not.toBeNull()
    expect(declarations(item)['align-items']).toBe('center')
    wrapper.unmount()
  })

  it.each([
    ['USelect', () => openSelect(USelect as Component), '[role="option"]'],
    ['USelectMenu', () => openSelect(USelectMenu as Component), '[role="option"]'],
    ['UDropdownMenu', openMenu, '[role="menuitem"]'],
  ] as const)('%s highlights the hovered or keyboard item with the active-soft wash', async (_name, open, role) => {
    const wrapper = await open()
    const item = document.querySelector(role)!
    item.setAttribute('data-highlighted', '')
    expect(declarations(item, '::before')['background-color']).toContain('var(--hf-active-soft)')
    wrapper.unmount()
  })

  it('keeps the destructive row action on its own danger wash', () => {
    const rules = adapter.replace(/\s+/g, ' ')
    expect(rules).toContain('.hf-ui .hf-row-action-danger[data-highlighted]::before { background-color: color-mix(in srgb, var(--hf-danger) 10%, var(--hf-surface)); }')
    // The shared highlight stays below the danger rule's specificity (0,3,1) through :where().
    expect(rules).toMatch(/\.hf-ui :where\(\[data-slot='item'\]\)\[data-highlighted\]:not\(\[data-disabled\]\)::before/)
  })
})
