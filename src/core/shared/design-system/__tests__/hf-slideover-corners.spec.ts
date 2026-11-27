import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import USlideover from '@nuxt/ui/runtime/components/Slideover.vue'

// slideover-corners S2/S3. A slideover's content gets `rounded-lg` when `inset` (12px card
// corner inside `.hf-ui`) or `rounded-t-2xl` on the mobile sheets (16px). Without
// `overflow-hidden` on that same element, any opaque square-cornered first/last child (custom
// header and footer bars, `.hf-save-bar`, `.order-header`) paints over the curve and the corners
// look «partidas». The content slot clips its children once, app-wide, in vite.config.ts; every
// slideover scrolls on an inner element (Nuxt's `body` slot or its own `min-h-0 flex-1
// overflow-y-auto`), and popovers/menus/selects teleport out, so clipping cuts nothing.
const vite = readFileSync('vite.config.ts', 'utf8')

function block(source: string, key: string): string {
  const start = source.indexOf(`${key}: {`)
  if (start < 0) return ''
  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1)
  }
  return ''
}

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : vueFiles(path)
    return entry.name.endsWith('.vue') ? [path] : []
  })
}

const wrappers: VueWrapper[] = []
afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
  document.body.innerHTML = ''
})

async function openSlideover(props: Record<string, unknown>) {
  const wrapper = mount(defineComponent({
    setup: () => () => h(UApp, null, {
      default: () => h(USlideover, { open: true, title: 'Panel', ...props }, {
        content: () => h('div', { 'data-testid': 'square-bar', class: 'bg-default' }, 'Barra'),
      }),
    }),
  }), { attachTo: document.body })
  wrappers.push(wrapper)
  await flushPromises()
  const content = document.querySelector<HTMLElement>('[data-slot="content"]')
  expect(content).not.toBeNull()
  return content!.className.split(/\s+/)
}

describe('slideover corners clip their children (slideover-corners S2/S3)', () => {
  it('vite.config.ts gives the slideover content slot overflow-hidden', () => {
    const slideover = block(vite, 'slideover')
    expect(slideover).not.toBe('')
    expect(block(slideover, 'slots')).toMatch(/content:\s*'[^']*\boverflow-hidden\b[^']*'/)
  })

  it('an inset desktop slideover is rounded and clips', async () => {
    const classes = await openSlideover({ side: 'right', inset: true })
    expect(classes).toContain('rounded-lg')
    expect(classes).toContain('overflow-hidden')
  })

  it('a mobile bottom sheet set through :ui.content keeps its 16px top corner and clips', async () => {
    const classes = await openSlideover({ side: 'bottom', inset: true, ui: { content: 'h-[90dvh] max-h-[90dvh] rounded-t-2xl hf-theme hf-ui' } })
    expect(classes).toContain('rounded-t-2xl')
    expect(classes).toContain('overflow-hidden')
  })

  it('no slideover re-opens panel overflow through its :ui.content', () => {
    const offenders = vueFiles('src').flatMap((path) =>
      [...readFileSync(path, 'utf8').matchAll(/<USlideover\b[\s\S]*?>/g)]
        .map((match) => match[0])
        .filter((tag) => /:ui="[^"]*\boverflow(?:-y)?-(?:auto|scroll|visible)\b/.test(tag))
        .map(() => path),
    )
    expect(offenders).toEqual([])
  })
})
