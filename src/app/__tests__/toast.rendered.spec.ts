import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import App from '../../App.vue'
import { readFileSync } from 'node:fs'

const initiallyDark = document.documentElement.classList.contains('dark')

const route = reactive({ meta: { layout: 'auth' } })
vi.mock('vue-router', () => ({ useRoute: () => route }))

let wrapper: VueWrapper | undefined
let toast: ReturnType<typeof useToast>
const Trigger = defineComponent({
  setup() {
    toast = useToast()
    return () => h('div', { 'data-testid': 'route-content' })
  },
})
const Layout = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('main', slots.default?.()),
})

async function render(layout = 'auth') {
  route.meta.layout = layout
  wrapper = mount(App, {
    attachTo: document.body,
    global: {
      components: { UApp },
      stubs: {
        DashboardLayout: Layout,
        AuthLayout: Layout,
        CatalogLayout: Layout,
        RouterView: Trigger,
      },
    },
  })
  toast.clear()
  const style = document.createElement('style')
  try {
    style.textContent = [
      'src/core/shared/design-system/houndfe-theme.css',
      'src/app/layouts/styles/unified-shell.css',
      'src/core/shared/design-system/hf-toast.css',
    ]
      .map((path) => readFileSync(path, 'utf8').replace(/^@import.*$/gm, ''))
      .join('\n')
  } catch {
    /* RED: stylesheet does not exist yet. */
  }
  style.dataset.toastTest = ''
  document.head.append(style)
  await flushPromises()
}

async function add(options: Parameters<typeof toast.add>[0]) {
  toast.add(options)
  await nextTick()
  await flushPromises()
  await vi.waitFor(() =>
    expect(document.querySelector('[data-state="open"][data-orientation]')).not.toBeNull(),
  )
  return document.querySelector('[data-state="open"][data-orientation]') as HTMLElement
}

afterEach(() => {
  toast?.clear()
  wrapper?.unmount()
  document.body.innerHTML = ''
  document.documentElement.classList.toggle('dark', initiallyDark)
  document.querySelectorAll('style[data-toast-test]').forEach((style) => style.remove())
})

describe('central toast presentation through real UApp and useToast', () => {
  it.each(['auth', 'catalog', 'dashboard'])(
    'reaches the body teleport on %s without a shell ancestor',
    async (layout) => {
      await render(layout)
      const root = await add({ title: 'Guardado', color: 'success' })
      expect(root.closest('.hf-toast-viewport')).not.toBeNull()
      expect(root.classList.contains('hf-shell-toast')).toBe(true)
      expect(root.closest('.hf-shell')).toBeNull()
      expect(wrapper!.element.contains(root)).toBe(false)
    },
  )

  it.each([
    ['success', 'check'],
    ['error', 'alert'],
    ['warning', 'warning'],
    ['info', 'info'],
    ['primary', 'info'],
    ['secondary', 'info'],
    ['neutral', 'info'],
    [undefined, 'info'],
  ] as const)(
    'renders the decorative fallback glyph for %s without requiring an icon prop',
    async (color, icon) => {
      await render()
      const root = await add({ title: 'Notificación', color })
      expect(root.classList.contains(`hf-toast--${color ?? 'primary'}`)).toBe(true)
      // jsdom does not paint pseudo-elements; check the real DOM's computed
      // fallback selection plus the stylesheet's glyph/explicit-icon contracts.
      expect(getComputedStyle(root).getPropertyValue('--toast-icon').trim()).toBe(
        `var(--toast-icon-${icon})`,
      )
    },
  )

  it('retains an explicit icon, title, description, action callback and close control', async () => {
    await render()
    const onClick = vi.fn()
    const root = await add({
      title: 'No se pudo guardar',
      description: 'Revisa los datos e intenta de nuevo.',
      color: 'error',
      icon: 'i-lucide-wifi-off',
      actions: [{ label: 'Reintentar', onClick }],
      duration: 12000,
    })
    expect(root.querySelector('[data-slot="icon"]')).not.toBeNull()
    expect(
      wrapper!
        .findAllComponents({ name: 'Icon' })
        .some((icon) => icon.props('name') === 'i-lucide-wifi-off'),
    ).toBe(true)
    expect(root.matches('.hf-shell-toast:has(> [data-slot="icon"])')).toBe(true)
    expect(root.querySelector('[data-slot="title"]')?.textContent).toBe('No se pudo guardar')
    expect(root.querySelector('[data-slot="description"]')?.textContent).toBe(
      'Revisa los datos e intenta de nuevo.',
    )
    expect(root.querySelector('button[aria-label="Cerrar"]')).not.toBeNull()
    const action = Array.from(root.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Reintentar'),
    )
    expect(action).toBeTruthy()
    action!.click()
    await flushPromises()
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(toast.toasts.value[0]?.duration).toBe(12000)
  })

  it.each([false, true])(
    'resolves a standalone paired palette and readable text (dark=%s)',
    async (dark) => {
      document.documentElement.classList.toggle('dark', dark)
      await render('catalog')
      const root = await add({ title: 'Notificación', description: 'Información adicional' })
      const tokens = getComputedStyle(root)
      expect(tokens.getPropertyValue('--shell-card').trim()).toBe(dark ? '#1b2736' : '#ffffff')
      const luminance = (token: string) => {
        const hex = tokens.getPropertyValue(token).trim().slice(1)
        const channels = [0, 2, 4].map((index) => {
          const channel = parseInt(hex.slice(index, index + 2), 16) / 255
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
        return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      }
      const surface = luminance('--shell-card')
      for (const role of ['--shell-ink', '--shell-muted']) {
        const text = luminance(role)
        expect(
          (Math.max(surface, text) + 0.05) / (Math.min(surface, text) + 0.05),
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('keeps installed position, timing, expanded stack and progress defaults', async () => {
    await render()
    const root = await add({ title: 'Valores instalados' })
    const toaster = wrapper!.findComponent({ name: 'Toaster' })
    expect(toaster.props()).toMatchObject({ duration: 5000, max: 5, expand: true, progress: true })
    const viewport = root.closest('.hf-toast-viewport')!
    expect(viewport.classList.contains('bottom-4')).toBe(true)
    expect(viewport.classList.contains('right-4')).toBe(true)
    expect(root.getAttribute('data-expanded')).toBe('true')
    expect(root.style.getPropertyValue('--transform')).toContain('translateY')
    expect(root.querySelector('[role="progressbar"]')).not.toBeNull()
  })

  it('preserves a caller avatar instead of covering it with a fallback icon', async () => {
    await render()
    const root = await add({ title: 'Perfil', avatar: { alt: 'Perfil' } })
    expect(root.querySelector('.hf-toast-avatar')).not.toBeNull()
    expect(root.matches('.hf-shell-toast:has(> .hf-toast-avatar)')).toBe(true)
  })

  it('keeps native dismissal and caller close opt-out', async () => {
    await render()
    let root = await add({ title: 'Cerrar esta notificación' })
    root.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click()
    await flushPromises()
    expect(toast.toasts.value[0]?.open).toBe(false)
    toast.clear()
    root = await add({ title: 'Sin botón de cierre', close: false, progress: false })
    expect(root.querySelector('button[aria-label="Cerrar"]')).toBeNull()
    expect(root.querySelector('[data-slot="progress"]')).toBeNull()
  })
})
