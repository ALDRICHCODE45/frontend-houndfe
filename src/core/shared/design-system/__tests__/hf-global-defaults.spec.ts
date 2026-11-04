import { readFileSync } from 'node:fs'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, Teleport } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UCard from '@nuxt/ui/components/Card.vue'
import { useHfAppTheme } from '../useHfAppTheme'

const foundation = readFileSync('src/core/shared/design-system/houndfe-theme.css', 'utf8')
const adapter = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const vite = readFileSync('vite.config.ts', 'utf8')
const styles: HTMLStyleElement[] = []
const wrappers: ReturnType<typeof mount>[] = []

// Inspect declarations matching actual DOM ancestry, not jsdom's incomplete
// computed custom-property resolution. Browser paint remains separate evidence.
function declarations(element: Element) {
  const result: Record<string, string> = {}
  for (const style of styles) {
    for (const rule of Array.from(style.sheet?.cssRules ?? [])) {
      if (rule.type !== CSSRule.STYLE_RULE) continue
      const entry = rule as CSSStyleRule
      if (!element.matches(entry.selectorText)) continue
      for (const name of Array.from(entry.style))
        result[name] = entry.style.getPropertyValue(name).trim()
    }
  }
  return result
}

function installStyles() {
  for (const css of [foundation, adapter]) {
    const style = document.createElement('style')
    style.textContent = css.replace(/^@import.*$/gm, '')
    document.head.append(style)
    styles.push(style)
  }
}

function mountApp() {
  const wrapper = mount(defineComponent({
    setup() {
      useHfAppTheme()
      return () => h('main', [
        h(UCard, {}, { default: () => 'Panel HF' }),
        h(Teleport, { to: 'body' }, h(UButton, { 'data-test': 'portal-action' }, () => 'Guardar')),
      ])
    },
  }), {
    attachTo: document.body,
    global: {
      plugins: [createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: defineComponent(() => () => null) }],
      })],
    },
  })
  wrappers.push(wrapper)
  return wrapper
}

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  styles.splice(0).forEach(style => style.remove())
  document.body.className = ''
  document.documentElement.className = ''
})

describe('application HF default boundary', () => {
  it('does not force non-app fixtures, but keeps explicit opt-ins usable', () => {
    installStyles()
    expect(declarations(document.body)['--hf-page']).toBeUndefined()
    document.body.classList.add('hf-theme', 'hf-ui')
    expect(declarations(document.body)['--hf-page']).toBe('#f5f6f8')
    expect(declarations(document.body)['--ui-bg']).toBe('var(--hf-surface)')
  })

  it.each(['light', 'dark'])('covers app and real teleported controls in %s', theme => {
    document.documentElement.className = theme
    installStyles()
    const wrapper = mountApp()
    expect(document.body.classList.contains('hf-app')).toBe(true)
    const portal = document.body.querySelector('[data-test="portal-action"]')!
    expect(portal.parentElement).toBe(document.body)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(portal.closest('.hf-ui')).toBe(document.body)
    expect(declarations(document.body)).toMatchObject({
      '--hf-page': theme === 'dark' ? '#0e1520' : '#f5f6f8',
      '--ui-bg': 'var(--hf-surface)',
      '--background-color-default': 'var(--hf-surface)',
      '--text-color-default': 'var(--hf-ink)',
      '--border-color-default': 'var(--hf-border)',
      '--ui-primary': 'var(--hf-action)',
      'background-color': 'var(--hf-page)',
    })
    expect(declarations(portal)['--text-color-inverted']).toBe('var(--hf-on-action)')
    expect(wrapper.text()).toContain('Panel HF')
    expect(portal.textContent).toContain('Guardar')
  })

  it('releases only markers owned by the mounted app', () => {
    document.body.className = 'host-fixture hf-theme'
    const wrapper = mountApp()
    wrapper.unmount()
    expect(document.body.className).toBe('host-fixture hf-theme')
    expect(document.body.querySelector('[data-test="portal-action"]')).toBeNull()
  })

  it('activates at App composition root and removes literal Nuxt defaults only', () => {
    const app = readFileSync('src/App.vue', 'utf8')
    expect(app).toContain('useHfAppTheme()')
    expect(app).toContain("design-system/houndfe-ui.css")
    expect(vite).not.toMatch(/bg-white dark:bg-coco-neutral-900|bg-coco-neutral-50 dark:bg-coco-neutral-950/)
    expect(vite).toContain('bg-default')
    expect(vite).toContain('bg-[var(--hf-page)]')
    for (const semantic of ['warning', 'success'])
      expect(adapter).not.toContain(`--ui-${semantic}:`)
    expect(adapter).not.toContain('!important')
  })
})
