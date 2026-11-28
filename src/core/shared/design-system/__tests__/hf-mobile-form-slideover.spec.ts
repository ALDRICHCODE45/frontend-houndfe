import { readFileSync } from 'node:fs'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import USlideover from '@nuxt/ui/runtime/components/Slideover.vue'

// mobile-tables T1 (S2c). On phones (< sm, 640px) a side slideover (`inset`, the form panels:
// «Nuevo cliente», employees, roles…) floated 16px from every edge with rounded corners, nested
// section cards and right-aligned footer buttons. Shared fix: the slideover theme turns a side
// inset panel into a full-height edge-to-edge sheet below sm; form overlays drop the section card
// paint and give the footer equal full-width actions above the safe area. md+ is untouched.
const ui = readFileSync('src/core/shared/design-system/houndfe-ui.css', 'utf8')
const form = readFileSync('src/core/shared/components/form/hf-form.css', 'utf8')

function media(source: string, query: string) {
  const start = source.indexOf(`@media ${query} {`)
  if (start < 0) return ''
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}' && --depth === 0) return source.slice(source.indexOf('{', start) + 1, index)
  }
  return ''
}

function rule(source: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return source.match(new RegExp(`(?:^|[},/]\\s*)[^{}]*${escaped}[^{}]*\\{([^}]*)\\}`, 'm'))?.[1] ?? ''
}

const wrappers: VueWrapper[] = []
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

async function contentClasses(props: Record<string, unknown>) {
  const wrapper = mount(defineComponent({
    setup: () => () => h(UApp, null, {
      default: () => h(USlideover, { open: true, title: 'Panel', ...props }, { body: () => h('p', 'Cuerpo') }),
    }),
  }), { attachTo: document.body })
  wrappers.push(wrapper)
  await flushPromises()
  return document.querySelector<HTMLElement>('[data-slot="content"]')!.className.split(/\s+/)
}

describe('side inset slideover on phones', () => {
  for (const side of ['right', 'left'] as const) {
    it(`${side}: full height and width below sm, the desktop inset kept from sm`, async () => {
      const classes = await contentClasses({ side, inset: true })
      expect(classes).toEqual(expect.arrayContaining(['max-sm:inset-0', 'max-sm:w-full', 'max-sm:max-w-none', 'max-sm:rounded-none']))
      // Desktop (sm+) keeps Nuxt's inset panel exactly.
      expect(classes).toEqual(expect.arrayContaining(['w-[calc(100%-2rem)]', 'inset-y-4', `${side}-4`, 'rounded-lg', 'max-w-md', 'overflow-hidden']))
    })
  }

  it('leaves the bottom sheets (Filtros, Columnas) alone', async () => {
    const bottom = await contentClasses({ side: 'bottom', inset: true })
    expect(bottom.some((value) => value.startsWith('max-sm:'))).toBe(false)
  })

  it('leaves the non-inset side panels alone', async () => {
    const flush = await contentClasses({ side: 'right' })
    expect(flush.some((value) => value.startsWith('max-sm:'))).toBe(false)
  })
})

describe('form overlay footer on phones', () => {
  const phone = media(ui, '(max-width: 639px)')
  const footer = ".hf-ui.hf-form-overlay:is([data-side='right'], [data-side='left']) > [data-slot='footer']"

  it('keeps the footer clear of the home indicator', () => {
    expect(rule(phone, footer)).toMatch(/padding-bottom: max\(1rem, env\(safe-area-inset-bottom\)\)/)
    expect(rule(phone, footer)).toMatch(/flex-shrink: 0/)
  })

  it('lays a buttons-only footer out as equal full-width 44px columns', () => {
    const grid = rule(phone, `${footer} > div:only-child:not(.hf-save-bar, :has(> :not(button, a)))`)
    expect(grid).toMatch(/display: grid/)
    expect(grid).toMatch(/grid-auto-flow: column/)
    expect(grid).toMatch(/grid-auto-columns: minmax\(0, 1fr\)/)
    expect(grid).toMatch(/width: 100%/)
    const action = rule(phone, `${footer} > div:only-child > :is(button, a)`)
    expect(action).toMatch(/justify-content: center/)
    expect(action).toMatch(/min-height: 44px/)
  })
})

describe('form sections on phones', () => {
  it('drops the section card paint inside a form overlay below sm (no nested decorative cards)', () => {
    const phone = media(form, '(max-width: 639px)')
    const flat = rule(phone, '.hf-ui.hf-form-overlay .hf-section-card')
    expect(flat).toMatch(/padding: 0/)
    expect(flat).toMatch(/border: 0/)
    expect(flat).toMatch(/border-radius: 0/)
    expect(flat).toMatch(/background-color: transparent/)
    // Groups stay apart with one hairline, like the rest of the sheet.
    const next = rule(phone, '.hf-ui.hf-form-overlay .hf-section-card + .hf-section-card')
    expect(next).toMatch(/border-top: 1px solid var\(--hf-border\)/)
    expect(next).toMatch(/padding-top: 20px/)
  })

  it('keeps the desktop card rule as it was', () => {
    const card = rule(form, '.hf-ui .hf-section-card')
    expect(card).toMatch(/padding: 16px/)
    expect(card).toMatch(/border: 1px solid var\(--hf-border\)/)
    expect(card).toMatch(/background-color: var\(--hf-surface\)/)
    expect(form).toMatch(/@media \(min-width: 768px\) \{\s*\.hf-ui \.hf-section-card \{\s*padding: 24px;/)
  })
})
