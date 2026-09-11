import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
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
const mountCatalog = () => mountWithUApp(CatalogView, { global: { stubs } })
const control = (wrapper: ReturnType<typeof mountCatalog>, name: string) =>
  wrapper.findAll(name === 'Buscar en el catálogo' ? 'input' : 'button').find((element) => element.attributes('aria-label') === name)

const disabledShellControls = ['Seleccionar sucursal', 'Buscar en el catálogo', 'Todas las categorías', 'Ordenar catálogo', 'Ver carrito']

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

  it.each([['dark', 'light'], ['light', 'dark']] as const)('toggles the mocked color mode from %s to %s', async (initial, expected) => {
    colorMode.value = initial
    const wrapper = mountCatalog()

    await control(wrapper, 'Cambiar tema')?.trigger('click')
    expect(colorMode.value).toBe(expected)
  })
})
