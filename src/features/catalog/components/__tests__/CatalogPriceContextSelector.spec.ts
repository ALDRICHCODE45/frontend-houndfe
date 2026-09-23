import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogPriceContextSelector from '../CatalogPriceContextSelector.vue'
import type { PublicCatalogPriceContextDto } from '../../interfaces/public-catalog-price-context.types'

const options: PublicCatalogPriceContextDto[] = [
  { priceListId: 'price-list-publico', name: 'Público', isCatalogDefault: true },
  { priceListId: 'price-list-mayoreo', name: 'Mayoreo', isCatalogDefault: false },
]

const mountSelector = (
  props: Partial<InstanceType<typeof CatalogPriceContextSelector>['$props']> = {},
) =>
  mount(CatalogPriceContextSelector, {
    props: { options, state: 'populated', modelValue: 'price-list-publico', ...props },
  })

const findMenu = (wrapper: ReturnType<typeof mountSelector>) =>
  wrapper.getComponent({ name: 'SelectMenu' })

describe('CatalogPriceContextSelector', () => {
  it('renders nothing until a real branch enables discovery', () => {
    const wrapper = mountSelector({ state: 'idle' })
    expect(wrapper.find('[data-testid="catalog-price-context-selector"]').exists()).toBe(false)
  })

  it('presents only the discovered options with priceListId identity and the accessible Spanish label', () => {
    const wrapper = mountSelector()
    expect(findMenu(wrapper).props('items')).toEqual(options)
    expect(findMenu(wrapper).props('valueKey')).toBe('priceListId')
    expect(findMenu(wrapper).props('labelKey')).toBe('name')
    expect(findMenu(wrapper).props('placeholder')).toBe('Elegir lista de precios')
    expect(wrapper.find('[aria-label="Lista de precios"]').exists()).toBe(true)
    expect(wrapper.get('[aria-label="Lista de precios"]').text()).toContain('Público')
  })

  it('shows the Spanish placeholder when no context is selected', () => {
    const wrapper = mountSelector({ modelValue: null })
    expect(findMenu(wrapper).props('placeholder')).toBe('Elegir lista de precios')
    expect(wrapper.get('[aria-label="Lista de precios"]').text()).toContain(
      'Elegir lista de precios',
    )
  })

  it('emits the exact discovered price list id when USelectMenu relays a visitor choice', async () => {
    const wrapper = mountSelector()
    findMenu(wrapper).vm.$emit('update:modelValue', 'price-list-mayoreo')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('select')).toEqual([['price-list-mayoreo']])
  })

  it('ignores empty or non-string selections so no unknown context is proposed', async () => {
    const wrapper = mountSelector()
    findMenu(wrapper).vm.$emit('update:modelValue', '')
    findMenu(wrapper).vm.$emit('update:modelValue', null)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('keeps the trigger disabled and loading while discovery is in flight', () => {
    const wrapper = mountSelector({ state: 'loading' })
    expect(findMenu(wrapper).props('loading')).toBe(true)
    expect(findMenu(wrapper).props('disabled')).toBe(true)
    expect(
      wrapper.get('[data-testid="catalog-price-context-loading"]').attributes('aria-busy'),
    ).toBeDefined()
    expect(wrapper.find('button[aria-label="Reintentar listas de precios"]').exists()).toBe(false)
  })

  it('keeps the trigger disabled and busy while a manual discovery retry is pending', () => {
    const wrapper = mountSelector({ state: 'retry-pending' })
    expect(findMenu(wrapper).props('loading')).toBe(true)
    expect(findMenu(wrapper).props('disabled')).toBe(true)
    expect(wrapper.get('[data-testid="catalog-price-context-loading"]').text()).toBe(
      'Reintentando listas…',
    )
  })

  it.each([
    ['empty', 'No hay listas de precios publicadas'],
    ['unavailable', 'La lista de precios no está disponible.'],
    ['rate-limit', 'Demasiadas solicitudes. Intenta de nuevo más tarde.'],
    ['server', 'No pudimos cargar las listas de precios.'],
    ['network', 'No se pudo conectar. Revisa tu conexión.'],
  ] as const)(
    'surfaces the %s discovery state with a separate discovery retry',
    async (state, copy) => {
      const wrapper = mountSelector({ state })
      expect(wrapper.get('[data-testid="catalog-price-context-message"]').text()).toBe(copy)
      expect(findMenu(wrapper).props('disabled')).toBe(true)

      const retry = wrapper.get('button[aria-label="Reintentar listas de precios"]')
      expect(retry.text()).toBe('Reintentar')
      await retry.trigger('click')
      expect(wrapper.emitted('retry')).toHaveLength(1)
    },
  )

  it('stays 320px-safe: full-width, non-shrinking, with a 44px trigger and a 44px retry target', () => {
    const wrapper = mountSelector()
    const root = wrapper.get('[data-testid="catalog-price-context-selector"]')
    expect(root.classes()).toEqual(expect.arrayContaining(['w-full', 'min-w-0']))
    expect(findMenu(wrapper).props('ui')).toMatchObject({ base: 'min-h-11' })
    expect(wrapper.get('[aria-label="Lista de precios"]').classes()).toEqual(
      expect.arrayContaining(['min-h-11']),
    )

    const errorWrapper = mountSelector({ state: 'empty' })
    const retry = errorWrapper.get('button[aria-label="Reintentar listas de precios"]')
    expect(retry.classes()).toEqual(expect.arrayContaining(['min-h-11']))
  })

  it('raises the teleported popup above the sticky catalog header so branch choices cannot intercept its options', () => {
    const wrapper = mountSelector()
    const ui = findMenu(wrapper).props('ui') as Record<string, string>
    // The catalog header is `sticky ... z-40`; the popup must out-rank it, or the inline branch
    // chooser painted above the popup would intercept real pointer events on its options.
    expect(ui.content).toContain('z-50')
  })
})
