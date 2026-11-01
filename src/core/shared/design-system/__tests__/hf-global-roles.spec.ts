import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UButton from '@nuxt/ui/components/Button.vue'
import UApp from '@nuxt/ui/components/App.vue'
import { h, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import SaleTotalsFooter from '@/features/POS/sales/components/SaleTotalsFooter.vue'
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'
import CatalogLayout from '@/app/layouts/CatalogLayout.vue'

const main = readFileSync('src/assets/main.css', 'utf8')
const foundation = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const adapter = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const detail = readFileSync('src/features/POS/sales/styles/sales-detail-visual.css', 'utf8')
const styles: HTMLStyleElement[] = []
const wrappers: ReturnType<typeof mount>[] = []

function install(css: string) {
  const style = document.createElement('style')
  style.textContent = css.replace(/^@import.*$/gm, '')
  document.head.append(style)
  styles.push(style)
}

// Resolve custom properties along actual DOM ancestry. jsdom does not compute
// var() colors; this proves the CSS consumer path, not browser paint/contrast.
function value(element: Element, property: string): string | undefined {
  const chain: Element[] = []
  for (let node: Element | null = element; node; node = node.parentElement) chain.unshift(node)
  const values: Record<string, string> = {}
  for (const node of chain) {
    for (const style of styles) {
      for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
        if (rule.type !== CSSRule.STYLE_RULE) continue
        const entry = rule as CSSStyleRule
        if (!node.matches(entry.selectorText)) continue
        for (const name of Array.from(entry.style)) values[name] = entry.style.getPropertyValue(name).trim()
      }
    }
    // CSS resolves variables at the declaring element before inheritance.
    for (const name of Object.keys(values)) values[name] = resolve(values[name]) ?? ''
  }
  function resolve(raw: string | undefined): string | undefined {
    return raw?.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, name, fallback) =>
      resolve(values[name]) ?? fallback ?? '')
  }
  return resolve(values[property])
}

function installFoundation() {
  // Tailwind emits @theme static as :root variables; exercise that output shape
  // without loading Tailwind's unrelated utilities or external font imports.
  const theme = main.match(/@theme static\s*\{([\s\S]*?)\n\}/)![1]
  install(`:root {${theme}}`)
  install(foundation)
  install(adapter)
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  styles.splice(0).forEach(style => style.remove())
  document.body.className = ''
  document.documentElement.className = ''
})

describe('legacy semantic roles consume the HF foundation', () => {
  it.each(['light', 'dark'])('resolves the default roles in %s without flattening status or scales', theme => {
    document.documentElement.className = theme
    document.body.className = 'hf-theme hf-ui hf-app'
    installFoundation()
    const roles = {
      '--surface-page': '--hf-page', '--surface-card': '--hf-surface',
      '--surface-hover': '--hf-surface-muted', '--surface-input': '--hf-field',
      '--border-subtle': '--hf-border', '--border-card': '--hf-border',
      '--text-primary': '--hf-ink', '--text-secondary': '--hf-muted', '--text-muted': '--hf-muted',
      '--brand-primary': '--hf-action', '--brand-soft': '--hf-active-soft',
      '--brand-accent': '--hf-active', '--brand-warm': '--hf-gold-ink', '--brand-warm-soft': '--hf-gold-soft',
    }
    for (const [legacy, hf] of Object.entries(roles))
      expect(value(document.body, legacy), legacy).toBe(value(document.body, hf))
    expect(value(document.body, '--brand-danger')).toBe('#ef4444')
    expect(value(document.body, '--hf-warning')).not.toBe(value(document.body, '--hf-action'))
    expect(value(document.body, '--hf-success')).not.toBe(value(document.body, '--hf-action'))
    expect(value(document.body, '--color-coco-500')).toBe('#2442f6')
    expect(value(document.body, '--color-coco-900')).toBe('#080e31')
  })

  it.each(['light', 'dark'])('preserves the actual unthemed charge action and its behavior in %s', async theme => {
    document.documentElement.className = theme
    document.body.className = 'hf-theme hf-ui hf-app'
    installFoundation()
    const sale = { items: [{ quantity: 1 }], subtotalCents: 100, totalCents: 100 } as Sale
    const props = reactive({ sale, isChargePending: false })
    const host = mount(UApp, {
      attachTo: document.body,
      slots: { default: () => h(SaleTotalsFooter, props) },
      global: {
        components: { UButton },
        plugins: [createRouter({ history: createMemoryHistory(), routes: [] })],
        stubs: { UIcon: true, USeparator: true },
      },
    })
    wrappers.push(host)
    const wrapper = host.getComponent(SaleTotalsFooter)
    const button = wrapper.get('button')
    expect(button.classes()).toContain('!bg-(--brand-action)')
    expect(button.classes()).toContain('!text-black')
    expect(value(button.element, '--brand-action')).toBe(value(button.element, '--hf-gold'))
    expect(value(button.element, '--brand-action')).not.toBe(value(button.element, '--hf-action'))
    await button.trigger('click')
    expect(wrapper.emitted('charge-click')).toHaveLength(1)
    props.isChargePending = true
    await wrapper.vm.$nextTick()
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()

    // The existing detail composition explicitly owns a blue action/foreground
    // pair; the compatibility mapping must not override that local ownership.
    install(detail)
    wrapper.element.classList.add('sales-detail-visual')
    expect(value(button.element, '--brand-action')).toBe(value(button.element, '--hf-action'))
    expect(value(button.element, '--color-black')).toBe(value(button.element, '--hf-on-action'))
  })

  it('preserves the public catalog light policy under a dark app boundary', () => {
    document.documentElement.className = 'dark'
    document.body.className = 'hf-theme hf-ui hf-app'
    installFoundation()
    install(readFileSync('src/features/catalog/styles/catalog.css', 'utf8'))
    const catalog = mount(CatalogLayout, { attachTo: document.body })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.body.getAttribute('data-catalog-theme')).toBe('light')
    expect(value(document.body, '--ui-bg')).toBe('#ffffff')
    expect(value(document.body, '--ui-text')).toBe('#24313d')
    expect(value(catalog.element, 'background')).toBe('#f5f6f8')
    catalog.unmount()
    expect(document.body.hasAttribute('data-catalog-theme')).toBe(false)
  })

  it('keeps stylesheet-only imports inert and the isolated legacy gold fallback available', () => {
    installFoundation()
    expect(value(document.body, '--hf-page')).toBeUndefined()
    expect(value(document.body, 'background-color')).toBeUndefined()
    expect(value(document.body, '--brand-action')).toBe('#f6bb13')
    expect(adapter).not.toMatch(/--ui-(error|warning|success):/)
  })
})
