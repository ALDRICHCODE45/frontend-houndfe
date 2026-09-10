import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import AppResponsiveDrawer from '../AppResponsiveDrawer.vue'
const { mobileViewport } = vi.hoisted(() => ({ mobileViewport: { value: false } }))
vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  const { computed } = await import('vue')
  return { ...actual, useBreakpoints: () => ({ smaller: () => computed(() => mobileViewport.value) }) }
})
const SlideoverStub = defineComponent({
  name: 'SlideoverStub',
  inheritAttrs: false,
  props: ['open', 'title', 'description', 'side', 'inset', 'close', 'ui'],
  emits: ['update:open', 'after:enter', 'after:leave'],
  setup(_, { emit }) {
    return { closeDrawer: () => emit('update:open', false) }
  },
  template: `
    <section v-if="open" v-bind="$attrs" :data-side="side">
      <slot v-if="$slots.content" name="content" :close="closeDrawer" />
      <template v-else>
        <header><slot name="title">{{ title }}</slot></header>
        <p><slot name="description">{{ description }}</slot></p>
        <main><slot name="body" /></main>
        <footer v-if="$slots.footer"><slot name="footer" /></footer>
      </template>
    </section>`,
})
const ButtonStub = {
  emits: ['click'],
  template: '<button type="button" v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
}
type DrawerMountOptions = {
  props?: Partial<{ open: boolean; title: string; description: string; desktopUi: Record<string, string>; mobileBodyClass: string }>
  attrs?: Record<string, string>
  slots?: Record<string, string>
}
function mountDrawer(options: DrawerMountOptions = {}) {
  return mount(AppResponsiveDrawer, {
    ...options,
    props: { open: true, title: 'Historial', description: 'Ventas confirmadas', ...options.props },
    global: {
      stubs: {
        Slideover: SlideoverStub,
        USlideover: SlideoverStub,
        Button: ButtonStub,
        UButton: ButtonStub,
      },
    },
  })
}
describe('AppResponsiveDrawer', () => {
  beforeEach(() => {
    mobileViewport.value = false
  })
  it('renders one accessible bottom sheet below lg', async () => {
    mobileViewport.value = true
    const wrapper = mountDrawer({ attrs: { 'data-testid': 'history-drawer' } })
    const surface = wrapper.getComponent({ name: 'SlideoverStub' })
    expect(wrapper.findAllComponents({ name: 'SlideoverStub' })).toHaveLength(1)
    expect(surface.props()).toMatchObject({
      side: 'bottom',
      title: 'Historial',
      description: 'Ventas confirmadas',
    })
    expect(surface.props('ui').content).toContain('h-[90dvh]')
    expect(wrapper.get('[data-testid="history-drawer"]')).toBeTruthy()
    expect(wrapper.get('[data-testid="mobile-drawer-handle"]')).toBeTruthy()
    const close = wrapper.get('[data-testid="mobile-drawer-close"]')
    expect(close.attributes('aria-label')).toBe('Cerrar Historial')
    expect(close.classes()).toEqual(expect.arrayContaining(['min-h-[44px]', 'min-w-[44px]']))
    await close.trigger('click')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
  it('uses one explicit mobile overflow mode and a safe-area footer', () => {
    mobileViewport.value = true
    const wrapper = mountDrawer({
      props: { open: true, title: 'Carrito', mobileBodyClass: 'overflow-hidden' },
      slots: { body: '<div data-testid="body" />', footer: '<div>Acciones</div>' },
    })
    const body = wrapper.get('[data-testid="body"]').element.parentElement!
    expect(body.classList).toContain('overflow-hidden')
    expect(body.classList).not.toContain('overflow-y-auto')
    expect(wrapper.get('[data-testid="mobile-drawer-footer"]').classes())
      .toContain('pb-[env(safe-area-inset-bottom)]')
  })
  it('defaults the mobile body to vertical scrolling', () => {
    mobileViewport.value = true
    const wrapper = mountDrawer({ slots: { body: '<div data-testid="body" />' } })
    expect(wrapper.get('[data-testid="body"]').element.parentElement!.classList)
      .toContain('overflow-y-auto')
  })
  it('renders the native right-side slot contract at lg and above', () => {
    const desktopUi = { content: 'sm:!max-w-[520px]', body: 'p-0' }
    const wrapper = mountDrawer({
      props: { open: true, title: 'Fallback', description: 'Fallback description', desktopUi },
      slots: {
        title: '<strong>Cliente</strong>',
        description: '<span>Historial completo</span>',
        body: '<div>Venta 123</div>',
        footer: '<button>Anterior</button>',
      },
    })
    const surface = wrapper.getComponent({ name: 'SlideoverStub' })
    expect(surface.props('side')).toBe('right')
    expect(surface.props('ui')).toEqual(desktopUi)
    expect(wrapper.text()).toContain('Cliente')
    expect(wrapper.text()).toContain('Historial completo')
    expect(wrapper.text()).toContain('Venta 123')
    expect(wrapper.text()).toContain('Anterior')
  })
  it('forwards native lifecycle and model events exactly once', async () => {
    const wrapper = mountDrawer()
    const surface = wrapper.getComponent({ name: 'SlideoverStub' })
    surface.vm.$emit('update:open', false)
    surface.vm.$emit('after:leave')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(wrapper.emitted('after:leave')).toHaveLength(1)
  })
})
