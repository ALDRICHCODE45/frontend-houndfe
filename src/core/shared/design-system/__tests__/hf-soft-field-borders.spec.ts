import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, type Component } from 'vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UInputDate from '@nuxt/ui/components/InputDate.vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'
import UInputNumber from '@nuxt/ui/components/InputNumber.vue'
import UInputTags from '@nuxt/ui/components/InputTags.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

// S16 soft rest borders: source contract for the adapter plus the real Nuxt
// slot wiring from vite.config.ts. Hover, focus and paint stay browser evidence.
const adapter = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const vite = readFileSync('vite.config.ts', 'utf8')
const HOOK = 'hf-field-control'

function rules(css: string) {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({ selector: selector!.replace(/\s+/g, ' ').trim(), body: body! }))
}

function ringColor(body: string) {
  return body.match(/--tw-ring-color\s*:\s*([^;]+);/)?.[1]?.trim()
}

const fieldRules = rules(adapter).filter(rule => rule.selector.includes(`.${HOOK}`) && ringColor(rule.body))

describe('soft field borders: adapter contract', () => {
  it('rests every Nuxt field on --hf-border, never while focused', () => {
    const rest = fieldRules.filter(rule => !/:hover|aria-invalid|ring-error/.test(rule.selector))
    expect(rest).toHaveLength(1)
    expect(ringColor(rest[0]!.body)).toBe('var(--hf-border)')
    expect(rest[0]!.selector).toContain(':focus-visible')
  })

  it('shows --hf-field-border on hover, except when focused, invalid or disabled', () => {
    const hover = fieldRules.filter(rule => rule.selector.includes(':hover'))
    expect(hover).toHaveLength(1)
    expect(ringColor(hover[0]!.body)).toBe('var(--hf-field-border)')
    for (const state of [':focus-visible', ':disabled', '[data-disabled]', "[aria-invalid='true']"])
      expect(hover[0]!.selector).toContain(state)
  })

  it('marks an invalid field with --hf-danger at rest (aria-invalid or Nuxt color=error)', () => {
    const invalid = fieldRules.filter(rule => !rule.selector.includes(':hover') && /aria-invalid/.test(rule.selector))
    expect(invalid).toHaveLength(1)
    expect(ringColor(invalid[0]!.body)).toBe('var(--hf-danger)')
    expect(invalid[0]!.selector).toContain("[aria-invalid='true']")
    expect(invalid[0]!.selector).toContain('ring-error')
  })

  it('lets focus win: no field rule paints the ring while focused, the HF focus ring stays', () => {
    expect(fieldRules.length).toBeGreaterThan(0)
    for (const rule of fieldRules) {
      expect(rule.selector).toMatch(/:not\([^)]*:focus-visible/)
    }
    const focus = rules(adapter).find(rule => rule.selector.includes(':focus-visible') && /outline:\s*2px solid var\(--hf-focus\)/.test(rule.body))
    expect(focus).toBeDefined()
  })

  it('keeps --ui-border-accented for checkbox, radio, switch and outline buttons (WCAG 1.4.11)', () => {
    expect(adapter).toMatch(/--ui-border-accented:\s*color-mix\(in srgb, var\(--hf-muted\) 45%, var\(--hf-border\)\)/)
  })
})

describe('soft field borders: Nuxt slot defaults', () => {
  it.each([
    ['input', UInput, {}],
    ['textarea', UTextarea, {}],
    ['select', USelect, { items: ['A'] }],
    ['selectMenu', USelectMenu, { items: ['A'] }],
    ['inputMenu', UInputMenu, { items: ['A'] }],
    ['inputNumber', UInputNumber, {}],
    ['inputDate', UInputDate, {}],
    ['inputTags', UInputTags, {}],
  ] as [string, Component, Record<string, unknown>][])('hooks %s on the element that owns the field ring', (key, component, props) => {
    expect(vite).toMatch(new RegExp(`${key}: \\{\\s*slots: \\{ base: '${HOOK}' \\}`))
    const wrapper = mount({ render: () => h(component, props) })
    const owner = wrapper.findAll('*').find(node => node.classes().includes('ring-accented'))
    expect(owner, key).toBeDefined()
    expect(owner!.classes()).toContain(HOOK)
    wrapper.unmount()
  })

  it.each([
    ['rest', {}, 'var(--hf-border)'],
    ['aria-invalid', { 'aria-invalid': 'true' }, 'var(--hf-danger)'],
    ['color=error', { color: 'error', highlight: true }, 'var(--hf-danger)'],
  ])('resolves the %s ring on a mounted UInput inside .hf-ui', (_state, props, expected) => {
    const style = document.createElement('style')
    style.textContent = adapter.replace(/^@import.*$/gm, '')
    document.head.append(style)
    const wrapper = mount({ render: () => h('div', { class: 'hf-ui' }, [h(UInput as Component, props)]) }, { attachTo: document.body })
    const base = wrapper.get(`.${HOOK}`).element
    let color: string | undefined
    for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
      if (rule.type !== CSSRule.STYLE_RULE) continue
      const entry = rule as CSSStyleRule
      if (base.matches(entry.selectorText)) color = entry.style.getPropertyValue('--tw-ring-color').trim() || color
    }
    expect(color).toBe(expected)
    wrapper.unmount()
    style.remove()
  })

  it.each([
    ['checkbox', UCheckbox, {}],
    ['radioGroup', URadioGroup, { items: ['A', 'B'] }],
    ['switch', USwitch, {}],
  ] as [string, Component, Record<string, unknown>][])('leaves the %s outline on the stronger accented boundary', (_key, component, props) => {
    const wrapper = mount({ render: () => h(component, props) })
    expect(wrapper.html()).not.toContain(HOOK)
    wrapper.unmount()
  })
})
