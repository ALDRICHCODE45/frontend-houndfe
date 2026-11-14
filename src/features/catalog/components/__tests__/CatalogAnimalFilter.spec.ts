import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '../../../../test/mountWithUApp'
import CatalogAnimalFilter from '../CatalogAnimalFilter.vue'

const option = (code: string, label: string, count: number) => ({ code, label, count })
const facetOf = (options: ReturnType<typeof option>[]) => ({
  code: 'animal.target',
  label: 'Especie',
  options,
})
const token = (code: string) => `animal.target:${code}`

/** The real «centro» branch. */
const centro = facetOf([
  option('ani.dom.dog', 'Perro', 26),
  option('ani.dom.cat', 'Gato', 13),
  option('ani.freshwater_group.bettas', 'Bettas', 1),
  option('ani.freshwater_group.swordtails', 'Colas de espada', 1),
  option('ani.freshwater_group.corydoras', 'Corydoras', 1),
  option('ani.freshwater.guppy', 'Guppy', 2),
  option('ani.freshwater_group.mollies', 'Mollys', 2),
  option('ani.freshwater_group.platies', 'Platys', 2),
  option('ani.freshwater.neon_tetra', 'Tetra neón', 2),
  option('ani.bird_pet.canary', 'Canario doméstico', 1),
  option('ani.bird_pet.zebra_finch', 'Diamante mandarín', 1),
  option('ani.bird_pet.cockatiel', 'Ninfa', 1),
  option('ani.bird_pet.budgerigar', 'Periquito australiano', 1),
  option('ani.lizard_group.anoles', 'Anolis', 1),
  option('ani.lizard_group.bearded_dragons', 'Dragones barbudos', 1),
  option('ani.lizard.crested_gecko', 'Gecko crestado', 1),
  option('ani.lizard.leopard_gecko', 'Gecko leopardo', 1),
  option('ani.snake.corn_snake', 'Serpiente del maíz', 1),
])
/** Peces in the order the row lists them: by count, then by name. */
const fishTokens = [
  'ani.freshwater.guppy',
  'ani.freshwater_group.mollies',
  'ani.freshwater_group.platies',
  'ani.freshwater.neon_tetra',
  'ani.freshwater_group.bettas',
  'ani.freshwater_group.swordtails',
  'ani.freshwater_group.corydoras',
].map(token)
/** A group with 16 species, for «Ver más». */
const manyFish = facetOf([
  option('ani.dom.dog', 'Perro', 5),
  option('ani.dom.cat', 'Gato', 4),
  ...Array.from({ length: 16 }, (_, i) =>
    option(`ani.freshwater.s${i}`, `Pez ${String(i).padStart(2, '0')}`, 20 - i),
  ),
])

function stubViewport(compact: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: !compact,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }))
}
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const mountStrip = (props: Record<string, unknown> = {}) => {
  stubViewport(false)
  return mount(CatalogAnimalFilter, {
    props: { facet: centro, total: 36, selected: [], resultTotal: 36, ...props },
  })
}
type Strip = ReturnType<typeof mountStrip>
const strip = (wrapper: Strip) => wrapper.get('section[aria-label="Explorar por animal"]')
const chips = (wrapper: Strip) => strip(wrapper).findAll('.catalog-animal-chip')
const chip = (wrapper: Strip, label: string) =>
  chips(wrapper).find((c) => (c.attributes('aria-label') ?? '').startsWith(label))!
const pills = (wrapper: Strip) => wrapper.findAll('.catalog-animal-pill:not(.catalog-animal-more)')
const pill = (wrapper: Strip, label: string) =>
  pills(wrapper).find((p) => (p.attributes('aria-label') ?? '').startsWith(label))!
const squash = (text: string) => text.replace(/\s+/g, ' ').trim()
type Emitter = { emitted: (name: string) => unknown[] | undefined }
const emittedChanges = (wrapper: Emitter) => wrapper.emitted('change') as string[][][]
const lastChange = (wrapper: Emitter) => {
  const all = emittedChanges(wrapper)
  return all[all.length - 1]![0]!
}

describe('CatalogAnimalFilter', () => {
  describe('visibility', () => {
    it('renders nothing without the animal.target facet', () => {
      const wrapper = mountStrip({ facet: null })
      expect(wrapper.find('section').exists()).toBe(false)
      expect(wrapper.find('button').exists()).toBe(false)
    })

    it('hides the strip with fewer than two animal options', () => {
      expect(
        mountStrip({ facet: facetOf([option('ani.dom.dog', 'Perro', 13)]) })
          .find('section')
          .exists(),
      ).toBe(false)
      expect(
        mountStrip({
          facet: facetOf([option('ani.dom.dog', 'Perro', 13), option('ani.dom.cat', 'Gato', 0)]),
        })
          .find('section')
          .exists(),
      ).toBe(false)
    })

    it('keeps a lone animal visible while it is selected so it can be removed', async () => {
      const wrapper = mountStrip({
        facet: facetOf([option('ani.dom.dog', 'Perro', 13)]),
        selected: [token('ani.dom.dog')],
      })
      expect(chip(wrapper, 'Perro').attributes('aria-pressed')).toBe('true')
      await chip(wrapper, 'Perro').trigger('click')
      expect(lastChange(wrapper)).toEqual([])
    })
  })

  describe('group row', () => {
    it('shows «Todos» and one chip per group with its own icon and total', () => {
      const wrapper = mountStrip()
      expect(chips(wrapper).map((c) => squash(c.text()))).toEqual([
        'Todos 36',
        'Perro 26',
        'Gato 13',
        'Peces 11',
        'Reptiles 5',
        'Aves 4',
      ])
      expect(chips(wrapper).map((c) => c.attributes('aria-label'))).toEqual([
        'Todos, 36 productos',
        'Perro, 26 productos',
        'Gato, 13 productos',
        'Peces, 11 productos',
        'Reptiles, 5 productos',
        'Aves, 4 productos',
      ])
      expect(chips(wrapper).map((c) => c.find('.catalog-animal-icon').attributes('data-icon'))).toEqual([
        'i-lucide-package',
        'i-lucide-dog',
        'i-lucide-cat',
        'i-lucide-fish',
        'i-lucide-turtle',
        'i-lucide-bird',
      ])
    })

    it('uses buttons with aria-pressed, never checkboxes or native selects', () => {
      const wrapper = mountStrip({ selected: [token('ani.dom.cat')] })
      expect(chips(wrapper).every((c) => c.element.tagName === 'BUTTON')).toBe(true)
      expect(chip(wrapper, 'Gato').attributes('aria-pressed')).toBe('true')
      expect(wrapper.find('input[type="checkbox"], select').exists()).toBe(false)
    })

    it('omits the «Todos» count when the total is unknown', () => {
      const wrapper = mountStrip({ total: null })
      expect(squash(chips(wrapper)[0]!.text())).toBe('Todos')
      expect(chips(wrapper)[0]!.attributes('aria-label')).toBe('Todos')
    })

    it('shows the check inside a pressed chip and nowhere else', () => {
      const wrapper = mountStrip({ selected: [token('ani.dom.cat')] })
      const checks = (c: ReturnType<typeof chip>) => c.findAll('.catalog-animal-chip-check')
      expect(checks(chip(wrapper, 'Gato'))).toHaveLength(1)
      expect(checks(chip(wrapper, 'Perro'))).toHaveLength(0)
      expect(checks(chip(wrapper, 'Todos'))).toHaveLength(0)
    })

    it('gives chips that open species a chevron and an expanded state; direct chips none', () => {
      const wrapper = mountStrip()
      expect(chip(wrapper, 'Peces').attributes('aria-expanded')).toBe('false')
      expect(chip(wrapper, 'Peces').find('.catalog-animal-chevron').exists()).toBe(true)
      expect(chip(wrapper, 'Perro').attributes('aria-expanded')).toBeUndefined()
      expect(chip(wrapper, 'Perro').find('.catalog-animal-chevron').exists()).toBe(false)
    })

    it('truncates a long group name inside the chip and keeps the full name on hover', () => {
      const wrapper = mountStrip({
        facet: facetOf([
          option('ani.dom.dog', 'Perro', 3),
          option('ani.dom.cat', 'Gato', 2),
          option('ani.zoo.capybara', 'Capibara gigante de las praderas', 1),
        ]),
      })
      const long = chip(wrapper, 'Capibara gigante')
      expect(long.attributes('title')).toBe('Capibara gigante de las praderas')
      expect(long.find('.catalog-animal-name').exists()).toBe(true)
    })
  })

  describe('«Todos»', () => {
    it('is pressed only while no animal token is in the URL', () => {
      expect(chip(mountStrip(), 'Todos').attributes('aria-pressed')).toBe('true')
      expect(
        chip(mountStrip({ selected: ['life.stage:adult', 'food.format:kibble'] }), 'Todos').attributes(
          'aria-pressed',
        ),
      ).toBe('true')
      expect(
        chip(mountStrip({ selected: [token('ani.dom.cat')] }), 'Todos').attributes('aria-pressed'),
      ).toBe('false')
    })

    it('clears only the animal filters', async () => {
      const wrapper = mountStrip({
        selected: [token('ani.dom.cat'), 'life.stage:adult', token('ani.dom.dog'), 'food.format:kibble'],
      })
      await chip(wrapper, 'Todos').trigger('click')
      expect(lastChange(wrapper)).toEqual(['life.stage:adult', 'food.format:kibble'])
    })
  })

  describe('choosing a group', () => {
    it('selects every species token of the group and opens its species row', async () => {
      const wrapper = mountStrip({ selected: ['life.stage:adult'] })
      expect(pills(wrapper)).toHaveLength(0)
      await chip(wrapper, 'Peces').trigger('click')
      expect(lastChange(wrapper)).toEqual(['life.stage:adult', ...fishTokens])
      expect(chip(wrapper, 'Peces').attributes('aria-expanded')).toBe('true')
      const row = wrapper.get('[role="group"][aria-label="Especies de Peces"]')
      expect(chip(wrapper, 'Peces').attributes('aria-controls')).toBe(row.attributes('id'))
    })

    it('toggles a single-species chip directly, without a species row', async () => {
      const wrapper = mountStrip()
      await chip(wrapper, 'Perro').trigger('click')
      expect(lastChange(wrapper)).toEqual([token('ani.dom.dog')])
      expect(wrapper.find('[role="group"][aria-label^="Especies de"]').exists()).toBe(false)
      await wrapper.setProps({ selected: [token('ani.dom.dog')] })
      await chip(wrapper, 'Perro').trigger('click')
      expect(lastChange(wrapper)).toEqual([])
    })

    it('adds a second group to the first (the server ORs them)', async () => {
      const wrapper = mountStrip({ selected: [token('ani.dom.cat')] })
      await chip(wrapper, 'Peces').trigger('click')
      expect(lastChange(wrapper)).toEqual([token('ani.dom.cat'), ...fishTokens])
    })

    it('opens the row of the first group with a selection when it loads, without changing the URL', () => {
      const wrapper = mountStrip({ selected: [token('ani.lizard_group.bearded_dragons')] })
      expect(chip(wrapper, 'Reptiles').attributes('aria-expanded')).toBe('true')
      expect(wrapper.emitted('change')).toBeUndefined()
    })

    it('a pressed group with its row closed opens the row; a second click clears the group', async () => {
      const wrapper = mountStrip({ selected: [...fishTokens, token('ani.dom.cat')] })
      // The row of the group with the selection is open on load; collapse it by opening Reptiles.
      await chip(wrapper, 'Reptiles').trigger('click')
      expect(lastChange(wrapper)).toEqual(expect.arrayContaining(fishTokens))
      await wrapper.setProps({ selected: [...fishTokens, token('ani.dom.cat')] })
      expect(chip(wrapper, 'Peces').attributes('aria-expanded')).toBe('false')
      const before = emittedChanges(wrapper).length
      await chip(wrapper, 'Peces').trigger('click')
      expect(emittedChanges(wrapper).length).toBe(before)
      expect(chip(wrapper, 'Peces').attributes('aria-expanded')).toBe('true')
      await chip(wrapper, 'Peces').trigger('click')
      expect(lastChange(wrapper)).toEqual([token('ani.dom.cat')])
      expect(chip(wrapper, 'Peces').attributes('aria-expanded')).toBe('false')
    })

    it('shows a partial group as «n de m» with the matching label', () => {
      const wrapper = mountStrip({ selected: [token('ani.freshwater.guppy')] })
      expect(squash(chip(wrapper, 'Peces').text())).toBe('Peces 1 de 7')
      expect(chip(wrapper, 'Peces').attributes('aria-label')).toBe('Peces, 1 de 7 especies elegidas')
      expect(chip(wrapper, 'Peces').attributes('aria-pressed')).toBe('true')
    })
  })

  describe('species row', () => {
    it('starts with «Todos los peces» and then the species, each with name and count inline', async () => {
      const wrapper = mountStrip()
      await chip(wrapper, 'Peces').trigger('click')
      await wrapper.setProps({ selected: fishTokens })
      expect(pills(wrapper).map((p) => squash(p.text()))).toEqual([
        'Todos los peces 11',
        'Guppy 2',
        'Mollys 2',
        'Platys 2',
        'Tetra neón 2',
        'Bettas 1',
        'Colas de espada 1',
        'Corydoras 1',
      ])
      expect(pill(wrapper, 'Guppy').attributes('aria-label')).toBe('Guppy, 2 productos')
    })

    it('marks the whole group on «Todos los peces» and leaves the species neutral', async () => {
      const wrapper = mountStrip({ selected: fishTokens })
      expect(pill(wrapper, 'Todos los peces').attributes('aria-pressed')).toBe('true')
      expect(pill(wrapper, 'Todos los peces').find('.catalog-animal-pill-check').exists()).toBe(true)
      expect(pill(wrapper, 'Guppy').attributes('aria-pressed')).toBe('false')
    })

    it('narrows a whole group to the species picked', async () => {
      const wrapper = mountStrip({ selected: ['life.stage:adult', ...fishTokens] })
      await pill(wrapper, 'Guppy').trigger('click')
      expect(lastChange(wrapper)).toEqual(['life.stage:adult', token('ani.freshwater.guppy')])
    })

    it('toggles individual species of a partial selection, with the check inside the pill', async () => {
      const wrapper = mountStrip({ selected: [token('ani.freshwater.guppy')] })
      expect(pill(wrapper, 'Guppy').attributes('aria-pressed')).toBe('true')
      expect(pill(wrapper, 'Guppy').find('.catalog-animal-pill-check').exists()).toBe(true)
      expect(pill(wrapper, 'Mollys').find('.catalog-animal-pill-check').exists()).toBe(false)
      await pill(wrapper, 'Mollys').trigger('click')
      expect(lastChange(wrapper)).toEqual([
        token('ani.freshwater.guppy'),
        token('ani.freshwater_group.mollies'),
      ])
      await pill(wrapper, 'Guppy').trigger('click')
      expect(lastChange(wrapper)).toEqual([])
    })

    it('«Todos los peces» completes a partial group and clears a whole one', async () => {
      const wrapper = mountStrip({ selected: [token('ani.freshwater.guppy')] })
      await pill(wrapper, 'Todos los peces').trigger('click')
      expect(lastChange(wrapper)).toEqual([
        token('ani.freshwater.guppy'),
        ...fishTokens.filter((t) => t !== token('ani.freshwater.guppy')),
      ])
      await wrapper.setProps({ selected: fishTokens })
      await pill(wrapper, 'Todos los peces').trigger('click')
      expect(lastChange(wrapper)).toEqual([])
    })

    it('keeps one line per pill: ellipsis on the name, the count apart, the full name on hover', async () => {
      const wrapper = mountStrip({ selected: [token('ani.bird_pet.budgerigar')] })
      const long = pill(wrapper, 'Periquito australiano')
      expect(long.attributes('title')).toBe('Periquito australiano')
      expect(long.find('.catalog-animal-name').text()).toBe('Periquito australiano')
      expect(long.find('.catalog-animal-count').text()).toBe('1')
    })

    it('keeps a selected species with no products visible and removable', async () => {
      const facet = facetOf([
        option('ani.dom.dog', 'Perro', 3),
        option('ani.lizard.crested_gecko', 'Gecko crestado', 2),
        option('ani.lizard.leopard_gecko', 'Gecko leopardo', 0),
        option('ani.snake.corn_snake', 'Serpiente del maíz', 0),
      ])
      const wrapper = mountStrip({ facet, selected: [token('ani.lizard.leopard_gecko')] })
      expect(pill(wrapper, 'Gecko leopardo').attributes('aria-label')).toBe('Gecko leopardo, 0 productos')
      expect(pills(wrapper).some((p) => p.text().includes('Serpiente'))).toBe(false)
      await pill(wrapper, 'Gecko leopardo').trigger('click')
      expect(lastChange(wrapper)).toEqual([])
    })
  })

  describe('20+ options', () => {
    it('collapses the species to ten and says how many more with «Ver más (n)»', async () => {
      const wrapper = mountStrip({ facet: manyFish })
      await chip(wrapper, 'Peces').trigger('click')
      await wrapper.setProps({
        selected: manyFish.options
          .filter((o) => o.code.startsWith('ani.freshwater'))
          .map((o) => token(o.code)),
      })
      // «Todos los peces» plus ten species.
      expect(pills(wrapper)).toHaveLength(11)
      const more = wrapper.get('button.catalog-animal-more')
      expect(squash(more.text())).toBe('Ver más (6)')
      expect(more.attributes('aria-expanded')).toBe('false')
      await more.trigger('click')
      expect(pills(wrapper)).toHaveLength(17)
      expect(wrapper.get('button.catalog-animal-more').text()).toBe('Ver menos')
      expect(wrapper.get('button.catalog-animal-more').attributes('aria-expanded')).toBe('true')
    })

    it('offers a species search once expanded and filters ignoring accents', async () => {
      const facet = facetOf([
        option('ani.dom.dog', 'Perro', 5),
        ...Array.from({ length: 14 }, (_, i) => option(`ani.freshwater.s${i}`, `Pez ${i}`, 20 - i)),
        option('ani.freshwater.neon_tetra', 'Tetra neón', 1),
      ])
      const wrapper = mountStrip({ facet, selected: [token('ani.freshwater.s0')] })
      expect(wrapper.find('input[type="search"]').exists()).toBe(false)
      await wrapper.get('button.catalog-animal-more').trigger('click')
      const search = wrapper.get('input[type="search"]')
      expect(search.attributes('aria-label')).toBe('Buscar especie en Peces')
      await search.setValue('NEON')
      expect(pills(wrapper).some((p) => p.text().includes('Tetra neón'))).toBe(true)
      expect(pills(wrapper).some((p) => p.text().includes('Pez 3'))).toBe(false)
    })

    it('never hides a selected species behind «Ver más»', async () => {
      const selected = [token('ani.freshwater.s15')]
      const wrapper = mountStrip({ facet: manyFish, selected })
      expect(pill(wrapper, 'Pez 15')).toBeTruthy()
      expect(squash(wrapper.get('button.catalog-animal-more').text())).toBe('Ver más (5)')
    })
  })

  describe('on a phone', () => {
    const mountCompact = (props: Record<string, unknown> = {}) => {
      const wrapper = mountWithUApp(CatalogAnimalFilter, {
        attachTo: document.body,
        props: { facet: manyFish, total: 40, selected: [], resultTotal: 4, ...props },
      })
      return wrapper
    }
    const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')
    const dialogButtons = () => [...(dialog()?.querySelectorAll<HTMLButtonElement>('button') ?? [])]

    it('ends a long species row in «Ver todas (n)» and opens a sheet with search and rows', async () => {
      stubViewport(true)
      const wrapper = mountCompact({ selected: [token('ani.freshwater.s1')] })
      await nextTick()
      const all = wrapper.get('button.catalog-animal-more')
      expect(squash(all.text())).toBe('Ver todas (16)')
      expect(all.attributes('aria-haspopup')).toBe('dialog')
      await all.trigger('click')
      await nextTick()
      expect(dialog()).not.toBeNull()
      expect(dialog()!.getAttribute('aria-label') ?? dialog()!.textContent).toContain('Peces')
      expect(dialog()!.querySelector('input[type="search"]')).not.toBeNull()
      const rows = dialogButtons().filter((b) => b.hasAttribute('aria-pressed'))
      expect(rows).toHaveLength(16)
      expect(rows.find((r) => r.textContent!.includes('Pez 01'))!.getAttribute('aria-pressed')).toBe('true')
      expect(dialog()!.querySelector('input[type="checkbox"]')).toBeNull()
    })

    it('applies a species chosen in the sheet at once and closes with «Ver n productos»', async () => {
      stubViewport(true)
      const wrapper = mountCompact({ selected: [token('ani.freshwater.s1')] })
      await nextTick()
      await wrapper.get('button.catalog-animal-more').trigger('click')
      await nextTick()
      const row = dialogButtons().find((b) => b.textContent!.includes('Pez 02'))!
      row.click()
      await nextTick()
      expect(lastChange(wrapper)).toEqual([token('ani.freshwater.s1'), token('ani.freshwater.s2')])
      const done = dialogButtons().find((b) => b.textContent!.includes('Ver 4 productos'))!
      expect(done).toBeTruthy()
      done.click()
      await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).toBeNull())
    })

    it('keeps «Ver más (n)» inline on a wide screen', async () => {
      const wrapper = mountStrip({ facet: manyFish, selected: [token('ani.freshwater.s1')] })
      expect(squash(wrapper.get('button.catalog-animal-more').text())).toBe('Ver más (6)')
      expect(wrapper.get('button.catalog-animal-more').attributes('aria-haspopup')).toBeUndefined()
    })
  })
})
