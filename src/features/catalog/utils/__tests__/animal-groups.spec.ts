import { describe, expect, it } from 'vitest'
import {
  ANIMAL_COLLAPSED_SPECIES,
  animalFamilyOf,
  buildAnimalStrip,
  collapseSpecies,
  scrollOffsetToReveal,
  selectAnimalGroup,
  clearAnimalGroup,
  toggleAnimalSpecies,
  type AnimalGroup,
} from '../animal-groups'

const option = (code: string, label: string, count: number) => ({ code, label, count })
const facetOf = (options: ReturnType<typeof option>[]) => ({
  code: 'animal.target',
  label: 'Especie',
  options,
})
const token = (code: string) => `animal.target:${code}`

/** The real «centro» branch (spec L2). */
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
const groupOf = (groups: AnimalGroup[], label: string) => groups.find((g) => g.label === label)!

describe('animalFamilyOf', () => {
  it('maps the first two segments of the code to a family', () => {
    expect(animalFamilyOf('ani.bird_pet.canary')).toBe('aves')
    expect(animalFamilyOf('ani.bird_group.parrots')).toBe('aves')
    expect(animalFamilyOf('ani.freshwater_group.bettas')).toBe('peces')
    expect(animalFamilyOf('ani.freshwater.guppy')).toBe('peces')
    expect(animalFamilyOf('ani.marine.clownfish')).toBe('peces')
    expect(animalFamilyOf('ani.lizard.crested_gecko')).toBe('reptiles')
    expect(animalFamilyOf('ani.snake.corn_snake')).toBe('reptiles')
    expect(animalFamilyOf('ani.poultry.chicken')).toBe('corral')
    expect(animalFamilyOf('ani.amphibian.axolotl')).toBe('anfibios')
    expect(animalFamilyOf('ani.small.degu')).toBe('pequenos')
  })

  it('resolves ani.dom by the full code: dog, cat, everything else is a small mammal', () => {
    expect(animalFamilyOf('ani.dom.dog')).toBe('perro')
    expect(animalFamilyOf('ani.dom.cat')).toBe('gato')
    expect(animalFamilyOf('ani.dom.rabbit')).toBe('pequenos')
    expect(animalFamilyOf('ani.dom.guinea_pig')).toBe('pequenos')
  })

  it('sends unknown prefixes, short codes and empty codes to «otros»', () => {
    expect(animalFamilyOf('ani.zoo_new.capybara')).toBe('otros')
    expect(animalFamilyOf('dog')).toBe('otros')
    expect(animalFamilyOf('')).toBe('otros')
  })
})

describe('buildAnimalStrip groups', () => {
  it('derives five groups from the centro codes, ordered by total, species by count then name', () => {
    const { groups } = buildAnimalStrip(centro, [])
    expect(groups.map((g) => [g.label, g.total, g.single])).toEqual([
      ['Perro', 26, true],
      ['Gato', 13, true],
      ['Peces', 11, false],
      ['Reptiles', 5, false],
      ['Aves', 4, false],
    ])
    expect(groupOf(groups, 'Peces').species.map((s) => s.label)).toEqual([
      'Guppy',
      'Mollys',
      'Platys',
      'Tetra neón',
      'Bettas',
      'Colas de espada',
      'Corydoras',
    ])
  })

  it('gives each group its own icon and a label for «all of them»', () => {
    const { groups } = buildAnimalStrip(centro, [])
    expect(groups.map((g) => g.icon)).toEqual([
      'i-lucide-dog',
      'i-lucide-cat',
      'i-lucide-fish',
      'i-lucide-turtle',
      'i-lucide-bird',
    ])
    expect(groupOf(groups, 'Peces').allLabel).toBe('Todos los peces')
    expect(groupOf(groups, 'Aves').allLabel).toBe('Todas las aves')
  })

  it('collapses a group of one species into a direct chip named after the species', () => {
    const strip = buildAnimalStrip(
      facetOf([
        option('ani.dom.dog', 'Perro', 3),
        option('ani.dom.cat', 'Gato', 2),
        option('ani.poultry.chicken', 'Gallina doméstica', 2),
        option('ani.amphibian.axolotl', 'Ajolote mexicano', 1),
      ]),
      [],
    )
    expect(strip.groups.map((g) => [g.label, g.single])).toEqual([
      ['Perro', true],
      ['Gato', true],
      ['Gallina doméstica', true],
      ['Ajolote mexicano', true],
    ])
    expect(strip.groups[2]!.species[0]!.tokens).toEqual([token('ani.poultry.chicken')])
  })

  it('puts ani.dom rabbits and ani.small species together as «Pequeños mamíferos»', () => {
    const { groups } = buildAnimalStrip(
      facetOf([
        option('ani.dom.dog', 'Perro', 3),
        option('ani.dom.rabbit', 'Conejo doméstico', 3),
        option('ani.dom.guinea_pig', 'Cobaya', 2),
        option('ani.small.degu', 'Degú', 1),
      ]),
      [],
    )
    const small = groupOf(groups, 'Pequeños mamíferos')
    expect(small.total).toBe(6)
    expect(small.icon).toBe('i-lucide-rabbit')
    expect(small.species.map((s) => s.label)).toEqual(['Conejo doméstico', 'Cobaya', 'Degú'])
  })

  it('never loses an option: unknown prefixes land in «Otros animales» with a paw', () => {
    const { groups } = buildAnimalStrip(
      facetOf([
        option('ani.dom.dog', 'Perro', 3),
        option('ani.zoo_new.capybara', 'Capibara', 1),
        option('ani.zoo_new.fennec', 'Fénec', 2),
      ]),
      [],
    )
    const others = groupOf(groups, 'Otros animales')
    expect(others.icon).toBe('i-lucide-paw-print')
    expect(others.total).toBe(3)
    expect(others.single).toBe(false)
    expect(others.species.map((s) => s.label)).toEqual(['Fénec', 'Capibara'])
  })

  it('merges same-label options into one species that carries every token', () => {
    const { groups } = buildAnimalStrip(
      facetOf([
        option('ani.freshwater.guppy', 'Guppy', 2),
        option('ani.freshwater_group.guppy', 'Guppy', 1),
        option('ani.freshwater.neon_tetra', 'Tetra neón', 2),
      ]),
      [],
    )
    const guppy = groupOf(groups, 'Peces').species.find((s) => s.label === 'Guppy')!
    expect(guppy.count).toBe(3)
    expect(guppy.tokens).toEqual([token('ani.freshwater.guppy'), token('ani.freshwater_group.guppy')])
  })

  it('returns no groups without a facet', () => {
    expect(buildAnimalStrip(null, [])).toMatchObject({ groups: [], visible: false, allPressed: true })
  })
})

describe('buildAnimalStrip selection', () => {
  it('marks «Todos» only while no animal token is in the URL', () => {
    expect(buildAnimalStrip(centro, []).allPressed).toBe(true)
    expect(buildAnimalStrip(centro, ['life.stage:adult', 'food.format:kibble']).allPressed).toBe(true)
    expect(buildAnimalStrip(centro, [token('ani.dom.cat')]).allPressed).toBe(false)
    // An animal token the facet does not list still counts as an animal filter.
    expect(buildAnimalStrip(centro, [token('ani.gone.x')]).allPressed).toBe(false)
  })

  it('tells whole, partial and none apart per group', () => {
    const peces = centro.options.filter((o) => /ani\.freshwater/.test(o.code)).map((o) => token(o.code))
    const whole = groupOf(buildAnimalStrip(centro, peces).groups, 'Peces')
    expect([whole.selectedCount, whole.whole, whole.partial, whole.pressed]).toEqual([7, true, false, true])
    const part = groupOf(buildAnimalStrip(centro, [peces[0]!]).groups, 'Peces')
    expect([part.selectedCount, part.whole, part.partial, part.pressed]).toEqual([1, false, true, true])
    const none = groupOf(buildAnimalStrip(centro, []).groups, 'Peces')
    expect([none.selectedCount, none.whole, none.partial, none.pressed]).toEqual([0, false, false, false])
  })

  it('presses a single-species chip when its token is in the URL', () => {
    const { groups } = buildAnimalStrip(centro, [token('ani.dom.cat')])
    expect(groups.map((g) => g.pressed)).toEqual([false, true, false, false, false])
  })

  it('hides options with no products unless they are selected', () => {
    const facet = facetOf([
      option('ani.dom.dog', 'Perro', 3),
      option('ani.dom.cat', 'Gato', 0),
      option('ani.lizard.leopard_gecko', 'Gecko leopardo', 0),
      option('ani.lizard.crested_gecko', 'Gecko crestado', 2),
    ])
    expect(buildAnimalStrip(facet, []).groups.map((g) => g.label)).toEqual(['Perro', 'Gecko crestado'])
    const selected = buildAnimalStrip(facet, [token('ani.lizard.leopard_gecko')])
    const reptiles = groupOf(selected.groups, 'Reptiles')
    expect(reptiles.species.map((s) => [s.label, s.count, s.selected])).toEqual([
      ['Gecko crestado', 2, false],
      ['Gecko leopardo', 0, true],
    ])
    expect(reptiles.total).toBe(2)
  })
})

describe('buildAnimalStrip visibility', () => {
  it('shows the strip from two animal options on', () => {
    expect(buildAnimalStrip(centro, []).visible).toBe(true)
    expect(buildAnimalStrip(facetOf([option('ani.dom.dog', 'Perro', 3), option('ani.dom.cat', 'Gato', 1)]), []).visible).toBe(true)
  })

  it('hides it with fewer than two options, counting only options with products', () => {
    expect(buildAnimalStrip(facetOf([option('ani.dom.dog', 'Perro', 13)]), []).visible).toBe(false)
    expect(buildAnimalStrip(facetOf([]), []).visible).toBe(false)
    expect(
      buildAnimalStrip(facetOf([option('ani.dom.dog', 'Perro', 13), option('ani.dom.cat', 'Gato', 0)]), []).visible,
    ).toBe(false)
  })

  it('keeps it visible when the only animal is already chosen, so it can be removed', () => {
    const facet = facetOf([option('ani.dom.dog', 'Perro', 13)])
    expect(buildAnimalStrip(facet, [token('ani.dom.dog')]).visible).toBe(true)
  })
})

describe('selectAnimalGroup and clearAnimalGroup', () => {
  const peces = (selected: string[]) => groupOf(buildAnimalStrip(centro, selected).groups, 'Peces')
  const pecesTokens = peces([]).species.flatMap((s) => s.tokens)

  it('selects every species token of the group and keeps the other filters and animals', () => {
    const next = selectAnimalGroup(['life.stage:adult', token('ani.dom.cat')], peces([]))
    expect(next).toEqual(['life.stage:adult', token('ani.dom.cat'), ...pecesTokens])
  })

  it('completes a partial group without repeating tokens', () => {
    const partial = [pecesTokens[0]!, token('ani.dom.dog')]
    expect(selectAnimalGroup(partial, peces(partial))).toEqual([
      pecesTokens[0]!,
      token('ani.dom.dog'),
      ...pecesTokens.slice(1),
    ])
  })

  it('clears only the tokens of that group', () => {
    const current = ['life.stage:adult', ...pecesTokens, token('ani.dom.cat')]
    expect(clearAnimalGroup(current, peces(current))).toEqual(['life.stage:adult', token('ani.dom.cat')])
  })

  it('works for a single-species chip through its own tokens', () => {
    const perro = groupOf(buildAnimalStrip(centro, []).groups, 'Perro')
    expect(selectAnimalGroup([], perro)).toEqual([token('ani.dom.dog')])
    expect(clearAnimalGroup([token('ani.dom.dog'), token('ani.dom.cat')], perro)).toEqual([token('ani.dom.cat')])
  })
})

describe('toggleAnimalSpecies', () => {
  const peces = (selected: string[]) => groupOf(buildAnimalStrip(centro, selected).groups, 'Peces')
  const pecesTokens = peces([]).species.flatMap((s) => s.tokens)
  const guppy = token('ani.freshwater.guppy')

  it('adds a species to a partial selection and removes it again', () => {
    const one = [token('ani.freshwater_group.mollies')]
    const species = peces(one).species.find((s) => s.label === 'Guppy')!
    expect(toggleAnimalSpecies(one, peces(one), species)).toEqual([...one, guppy])
    const two = [...one, guppy]
    const picked = peces(two).species.find((s) => s.label === 'Guppy')!
    expect(toggleAnimalSpecies(two, peces(two), picked)).toEqual(one)
  })

  it('narrows a whole group to the species that was picked', () => {
    const species = peces(pecesTokens).species.find((s) => s.label === 'Guppy')!
    expect(toggleAnimalSpecies(['life.stage:adult', ...pecesTokens, token('ani.dom.cat')], peces(pecesTokens), species)).toEqual([
      'life.stage:adult',
      token('ani.dom.cat'),
      guppy,
    ])
  })

  it('picks a species of an untouched group on its own', () => {
    const species = peces([]).species.find((s) => s.label === 'Guppy')!
    expect(toggleAnimalSpecies([token('ani.dom.dog')], peces([]), species)).toEqual([token('ani.dom.dog'), guppy])
  })
})

describe('collapseSpecies', () => {
  const many = facetOf(
    Array.from({ length: 16 }, (_, i) => option(`ani.freshwater.s${i}`, `Pez ${String(i).padStart(2, '0')}`, 20 - i)),
  )
  const group = (selected: string[]) => buildAnimalStrip(many, selected).groups[0]!

  it('shows the first ten species and says how many are left', () => {
    expect(ANIMAL_COLLAPSED_SPECIES).toBe(10)
    const { shown, hidden } = collapseSpecies(group([]), false)
    expect(shown).toHaveLength(10)
    expect(hidden).toBe(6)
  })

  it('never hides a selected species, even past the limit', () => {
    const selected = [token('ani.freshwater.s14')]
    const { shown, hidden } = collapseSpecies(group(selected), false)
    expect(shown.map((s) => s.label)).toContain('Pez 14')
    expect(shown).toHaveLength(11)
    expect(hidden).toBe(5)
  })

  it('keeps a whole group collapsed: its «Todos» pill carries the selection', () => {
    const all = many.options.map((o) => token(o.code))
    const { shown, hidden } = collapseSpecies(group(all), false)
    expect(shown).toHaveLength(10)
    expect(hidden).toBe(6)
  })

  it('shows everything once expanded, and everything when the group is small', () => {
    expect(collapseSpecies(group([]), true)).toMatchObject({ hidden: 0 })
    expect(collapseSpecies(group([]), true).shown).toHaveLength(16)
    const small = buildAnimalStrip(centro, []).groups.find((g) => g.label === 'Aves')!
    expect(collapseSpecies(small, false)).toMatchObject({ hidden: 0 })
  })
})

describe('scrollOffsetToReveal', () => {
  it('centres a selection that fits the viewport', () => {
    expect(scrollOffsetToReveal({ start: 500, end: 600, viewport: 390 })).toBe(500 - (390 - 100) / 2)
  })

  it('starts the selection near the left edge when it is wider than the viewport', () => {
    expect(scrollOffsetToReveal({ start: 500, end: 1000, viewport: 390 })).toBe(488)
  })

  it('does not scroll when the selection is already at the start', () => {
    expect(scrollOffsetToReveal({ start: 10, end: 110, viewport: 390 })).toBe(0)
  })
})
