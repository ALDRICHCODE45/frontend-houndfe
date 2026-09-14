import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogView from '@/features/catalog/views/CatalogView.vue'

const colorMode = shallowRef<'light' | 'dark'>('light')
const useCatalogStore = vi.hoisted(() => vi.fn(() => { throw new Error('Catalog store must stay unreachable') }))

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useColorMode: () => colorMode,
}))
vi.mock('../../composables/useCatalogStore', () => ({ useCatalogStore }))
const UButton = defineComponent({
  inheritAttrs: false,
  props: { disabled: Boolean },
  setup: (props, { attrs, slots }) => () => h('button', { ...attrs, disabled: props.disabled }, [slots.leading?.(), slots.default?.(), slots.trailing?.()]),
})
const UInput = defineComponent({
  inheritAttrs: false,
  props: { modelValue: String, disabled: Boolean },
  setup: (props, { attrs }) => () => h('input', { ...attrs, value: props.modelValue, disabled: props.disabled }),
})
const stubs = { UButton, UInput, UIcon: defineComponent({ setup: () => () => h('span') }) }
const mountCatalog = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return mountWithUApp(CatalogView, { global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs } })
}
const control = (wrapper: ReturnType<typeof mountCatalog>, name: string) =>
  wrapper.findAll(name === 'Buscar en el catálogo' ? 'input' : 'button').find((element) => element.attributes('aria-label') === name)

const disabledShellControls = ['Buscar en el catálogo', 'Todas las categorías', 'Ordenar catálogo', 'Ver carrito']

const branchResponse = (branches: unknown) => new Response(JSON.stringify(branches), { status: 200 })
const singleBranch = [{ id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }]


describe('CatalogView P0 demo deactivation', () => {
  beforeEach(() => {
    colorMode.value = 'light'
    useCatalogStore.mockClear()
  })

  it('mounts the five real SFCs as an inert, neutral shell without demo UI or catalog initialization', () => {
    const wrapper = mountCatalog()

    expect(wrapper.get('h1').text()).toBe('La selección de sucursal todavía no está disponible')
    for (const name of disabledShellControls) expect(control(wrapper, name)?.attributes('disabled')).toBeDefined()
    expect(useCatalogStore).not.toHaveBeenCalled()
    expect(wrapper.findAll('[role="dialog"], a[href^="tel:"], a[href*="whatsapp"]').length).toBe(0)
    expect(wrapper.text()).not.toMatch(/Coco|WhatsApp|Adult Medium Breed|precio|contacto/i)
  })

  it('renders a returned branch as an explicit unselected choice without product requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const wrapper = mountCatalog()

    await flushPromises()
    expect(wrapper.get('button[aria-label="Sucursal Centro"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Sucursales disponibles')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/public/catalog/branches')
  })

  it('renders many published branches in response order and the zero-branch empty state', async () => {
    const branches = [{ id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }, { id: 'b-2', name: 'Sucursal Norte', slug: 'norte', address: null, phone: null }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(branches), { status: 200 })))
    const wrapper = mountCatalog()

    await flushPromises()
    const names = wrapper.findAll('button[aria-label]').map((element) => element.attributes('aria-label')).filter((name) => name?.startsWith('Sucursal '))
    expect(names).toEqual(['Sucursal Centro', 'Sucursal Norte'])
    expect(names.every((name) => control(wrapper, name!)?.attributes('disabled') !== undefined)).toBe(true)
  })

      it('renders the empty state when no branches are published', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))
        const wrapper = mountCatalog()

        await flushPromises()
        expect(wrapper.text()).toContain('No hay sucursales publicadas')
        expect(wrapper.findAll('button[aria-label="Reintentar"]').length).toBe(1)
      })

      it('renders distinct copy for rate-limit, server, and network failures with enabled retry', async () => {
        const fetchMock = vi.fn()
          .mockResolvedValueOnce(new Response('{}', { status: 429 }))
          .mockResolvedValueOnce(new Response('{}', { status: 500 }))
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        vi.stubGlobal('fetch', fetchMock)
        const wrapper = mountCatalog()

        await flushPromises()
        expect(wrapper.text()).toContain('Demasiadas solicitudes. Intenta de nuevo más tarde.')
        await control(wrapper, 'Reintentar')?.trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('No pudimos cargar las sucursales.')
        expect(wrapper.text()).not.toContain('Demasiadas solicitudes')
        await control(wrapper, 'Reintentar')?.trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('No se pudo conectar. Revisa tu conexión.')
        expect(wrapper.text()).not.toContain('No pudimos cargar')
        expect(control(wrapper, 'Reintentar')?.attributes('disabled')).toBeUndefined()
      })

      it('shows retry-pending copy and disables retry while a manual retry is in flight', async () => {
        let resolveRetry!: (value: Response) => void
        const fetchMock = vi.fn()
          .mockResolvedValueOnce(new Response('[]', { status: 200 }))
          .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveRetry = resolve }))
        vi.stubGlobal('fetch', fetchMock)
        const wrapper = mountCatalog()

        await flushPromises()
        expect(wrapper.text()).toContain('No hay sucursales publicadas')
        void control(wrapper, 'Reintentar')?.trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('Reintentando…')
        expect(wrapper.text()).not.toContain('No hay sucursales publicadas')
        resolveRetry(new Response('[]', { status: 200 }))
        await flushPromises()
        expect(wrapper.text()).toContain('No hay sucursales publicadas')
      })

      it('guards rapid retry clicks at the view level so no overlapping request is issued', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const wrapper = mountCatalog()

        await flushPromises()
        await Promise.all([control(wrapper, 'Reintentar')!.trigger('click'), control(wrapper, 'Reintentar')!.trigger('click')])
        await flushPromises()
        expect(fetchMock).toHaveBeenCalledTimes(2)
      })

      it.each([['dark', 'light'], ['light', 'dark']] as const)('toggles the mocked color mode from %s to %s', async (initial, expected) => {
        colorMode.value = initial
        const wrapper = mountCatalog()

        await control(wrapper, 'Cambiar tema')?.trigger('click')
        expect(colorMode.value).toBe(expected)
      })
    })

    describe('supplied slug regression', () => {
      const mountAtSlug = async (slug: string) => {
        const { createMemoryHistory, createRouter } = await import('vue-router')
        const router = createRouter({
          history: createMemoryHistory(),
          routes: [{ path: '/catalogo/:branchSlug?', name: 'public-catalog', component: CatalogView }],
        })
        await router.push(`/catalogo/${slug}`)
        await router.isReady()
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
        return { wrapper: mountWithUApp(CatalogView, { global: { plugins: [[VueQueryPlugin, { queryClient }], [router]], stubs } }), router }
      }

      it.each(['centro', 'slug-sin-branch'])('preserves the supplied %s slug through retry and branch interaction', async (slug) => {
        const fetchMock = vi.fn()
          .mockResolvedValueOnce(new Response('{}', { status: 500 }))
          .mockResolvedValueOnce(branchResponse(singleBranch))
        vi.stubGlobal('fetch', fetchMock)
        const { wrapper, router } = await mountAtSlug(slug)
        const pushSpy = vi.spyOn(router, 'push')
        const replaceSpy = vi.spyOn(router, 'replace')

        await flushPromises()
        expect(wrapper.text()).toContain('No pudimos cargar las sucursales.')
        await wrapper.get('button[aria-label="Reintentar"]').trigger('click')
        await flushPromises()
        const choice = wrapper.get('button[aria-label="Sucursal Centro"]')
        expect(choice.attributes('disabled')).toBeDefined()
        expect(choice.attributes('aria-selected')).toBeUndefined()
        await choice.trigger('click')
        await wrapper.get('button[aria-label="Explorar sucursales"]').trigger('click')
        expect(router.currentRoute.value.fullPath).toBe(`/catalogo/${slug}`)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(pushSpy).not.toHaveBeenCalled()
        expect(replaceSpy).not.toHaveBeenCalled()
      })
    })
