import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, shallowRef } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '../../../../test/mountWithUApp'
import CatalogFilterSheet from '../CatalogFilterSheet.vue'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const page = (total: number) => ({
  items: [],
  meta: { page: 1, limit: 1, total, totalPages: total },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext: { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
})
const categories = [
  { id: 'c-1', name: 'Accesorios', count: 5 },
  { id: 'c-2', name: 'Juguetes', count: 1 },
]
const attributes = [
  {
    code: 'animal.target',
    label: 'Especie',
    options: [
      { code: 'dog', label: 'Perro', count: 13 },
      { code: 'cat', label: 'Gato', count: 12 },
    ],
  },
  {
    code: 'life.stage',
    label: 'Etapa de vida',
    options: [
      { code: 'adult', label: 'Adulto', count: 2 },
      { code: 'puppy', label: 'Cachorro', count: 2 },
    ],
  },
]
const baseProps = {
  open: true,
  branchSlug: 'centro',
  priceListId: 'list-1',
  search: 'croq',
  categories,
  attributes,
  selectedCategoryId: null as string | null,
  selectedTokens: ['animal.target:dog'] as string[],
}

let fetchMock: ReturnType<typeof vi.fn>
const mountSheet = (props: Record<string, unknown> = {}) =>
  mountWithUApp(CatalogFilterSheet, { attachTo: document.body, props: { ...baseProps, ...props } })
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
const buttons = () => [...(dialog()?.querySelectorAll('button') ?? [])]
const byLabel = (label: string) =>
  buttons().find((button) =>
    (button.getAttribute('aria-label') ?? button.textContent ?? '').trim().startsWith(label),
  )!
const footerPrimary = () =>
  dialog()!.querySelector<HTMLButtonElement>('[data-testid="catalog-filter-apply"]')!
const probeUrls = () => fetchMock.mock.calls.map(([url]) => new URL(String(url)))

async function press(element: Element) {
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flushPromises()
}
async function settle() {
  await vi.advanceTimersByTimeAsync(400)
  await flushPromises()
}

describe('CatalogFilterSheet', () => {
  let wrapper: VueWrapper
  /** `mountWithUApp` returns the sheet's wrapper; the app behind it is what must go. */
  const unmount = () => {
    wrapper?.vm.$.appContext.app.unmount()
  }
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = vi.fn(() => Promise.resolve(json(page(13))))
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    unmount()
    document.body.innerHTML = ''
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('is a modal dialog titled «Filtros» with the draft chips and a count badge, and probes with the committed selection', async () => {
    wrapper = mountSheet()
    await settle()
    const el = dialog()
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('Filtros')
    expect(byLabel('Cerrar filtros')).toBeTruthy()
    expect(el!.querySelector('[aria-label="1 filtro elegido"]')).not.toBeNull()
    expect(byLabel('Quitar filtro: Perro')).toBeTruthy()
    const url = probeUrls()[0]!
    expect(url.pathname).toBe('/public/catalog/centro/products')
    expect(url.searchParams.get('limit')).toBe('1')
    expect(url.searchParams.get('q')).toBe('croq')
    expect(url.searchParams.get('priceListId')).toBe('list-1')
    expect(url.searchParams.getAll('facet')).toEqual(['animal.target:dog'])
    expect(footerPrimary().textContent!.trim()).toBe('Ver 13 productos')
  })

  it('keeps changes as a draft: nothing is emitted until «Ver N productos», which applies the draft', async () => {
    wrapper = mountSheet()
    await settle()
    // Accordion: the first group (Categoría) is open; Etapa opens on demand.
    await press(byLabel('Categoría: Accesorios'))
    expect(byLabel('Categoría: Accesorios').getAttribute('aria-pressed')).toBe('true')
    await press(dialog()!.querySelectorAll('[data-testid="catalog-filter-group-toggle"]')[1]!)
    expect(dialog()!.querySelector('[aria-label^="Categoría: Accesorios"]')).toBeNull()
    await press(byLabel('Etapa de vida: Adulto'))
    expect(wrapper.emitted('apply')).toBeUndefined()

    fetchMock.mockImplementation(() => Promise.resolve(json(page(2))))
    await settle()
    const last = probeUrls().slice(-1)[0]!
    expect(last.searchParams.get('categoryId')).toBe('c-1')
    expect(last.searchParams.getAll('facet')).toEqual(['animal.target:dog', 'life.stage:adult'])
    expect(footerPrimary().textContent!.trim()).toBe('Ver 2 productos')

    await press(footerPrimary())
    expect(wrapper.emitted('apply')).toEqual([
      [{ categoryId: 'c-1', tokens: ['animal.target:dog', 'life.stage:adult'] }],
    ])
    expect(wrapper.emitted('update:open')!.slice(-1)[0]).toEqual([false])
  })

  it('shows a neutral label while counting and falls back to «Ver productos» on error', async () => {
    let release!: (response: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)))
    wrapper = mountSheet()
    await flushPromises()
    expect(footerPrimary().textContent!.trim()).toBe('Contando…')
    expect(footerPrimary().disabled).toBe(false)
    release(json({}, 500))
    await flushPromises()
    expect(footerPrimary().textContent!.trim()).toBe('Ver productos')
  })

  it('«Limpiar» empties the draft without applying it', async () => {
    wrapper = mountSheet()
    await settle()
    await press(byLabel('Limpiar'))
    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(
      dialog()!.querySelector('[aria-label$="filtro elegido"], [aria-label$="filtros elegidos"]'),
    ).toBeNull()
    await settle()
    expect(probeUrls().slice(-1)[0]!.searchParams.has('facet')).toBe(false)
    await press(footerPrimary())
    expect(wrapper.emitted('apply')).toEqual([[{ categoryId: null, tokens: [] }]])
  })

  it('removes a draft chip', async () => {
    wrapper = mountSheet()
    await settle()
    await press(byLabel('Quitar filtro: Perro'))
    expect(byLabel('Quitar filtro: Perro')).toBeUndefined()
    await press(footerPrimary())
    expect(wrapper.emitted('apply')![0]![0]).toEqual({ categoryId: null, tokens: [] })
  })

  it('shows the recipient hint instead of stage groups until a recipient is in the draft', async () => {
    wrapper = mountSheet({ selectedTokens: [] })
    await settle()
    expect(dialog()!.textContent).toContain(
      'Elige un destinatario para ver filtros de etapa, tamaño y más.',
    )
    expect(dialog()!.textContent).not.toContain('Etapa de vida')
  })

  it('closes with the X and with Escape without applying anything', async () => {
    wrapper = mountSheet()
    await settle()
    await press(byLabel('Cerrar filtros'))
    expect(wrapper.emitted('update:open')!.slice(-1)[0]).toEqual([false])
    expect(wrapper.emitted('apply')).toBeUndefined()

    unmount()
    document.body.innerHTML = ''
    wrapper = mountSheet()
    await settle()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.emitted('update:open')!.slice(-1)[0]).toEqual([false])
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('starts each opening from the committed selection and never probes while closed', async () => {
    const open = shallowRef(false)
    const app = mount(
      defineComponent({
        setup: () => () =>
          h(UApp, null, {
            default: () => h(CatalogFilterSheet, { ...baseProps, open: open.value }),
          }),
      }),
      { attachTo: document.body },
    )
    await settle()
    expect(dialog()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    open.value = true
    await settle()
    expect(dialog()).not.toBeNull()
    expect(probeUrls()[0]!.searchParams.getAll('facet')).toEqual(['animal.target:dog'])
    // A draft change is dropped when the sheet closes and reopens.
    await press(byLabel('Quitar filtro: Perro'))
    open.value = false
    await settle()
    open.value = true
    await settle()
    expect(byLabel('Quitar filtro: Perro')).toBeTruthy()
    app.unmount()
  })
})
