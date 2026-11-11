import { describe, expect, it } from 'vitest'
import {
  buildFacetChips,
  buildFilterGroups,
  clearRecipientTokens,
  findRecipientFacet,
  toggleFacetTokens,
} from '../filter-model'

const recipient = {
  code: 'animal.target',
  label: 'Especie',
  options: [
    { code: 'dog', label: 'Perro', count: 13 },
    { code: 'cat', label: 'Gato', count: 12 },
  ],
}
const stage = {
  code: 'life.stage',
  label: 'Etapa de vida',
  options: [
    { code: 'life.dog.adult', label: 'Adulto', count: 4 },
    { code: 'life.cat.adult', label: 'Adulto', count: 2 },
    { code: 'life.dog.puppy', label: 'Cachorro', count: 3 },
    { code: 'life.dog.senior', label: 'Senior', count: 0 },
  ],
}
const lonely = {
  code: 'food.format',
  label: 'Formato',
  options: [{ code: 'dry', label: 'Croqueta', count: 5 }],
}
const categories = [
  { id: 'c-1', name: 'Accesorios', count: 9 },
  { id: 'c-2', name: 'Juguetes', count: 4 },
]

describe('findRecipientFacet', () => {
  it('returns the animal.target facet only when it is present with options', () => {
    expect(findRecipientFacet([stage, recipient])).toBe(recipient)
    expect(findRecipientFacet([stage])).toBeNull()
    expect(findRecipientFacet(undefined)).toBeNull()
    expect(findRecipientFacet([{ ...recipient, options: [] }])).toBeNull()
  })
})

describe('toggleFacetTokens and clearRecipientTokens', () => {
  it('adds or removes every token of a merged option and keeps the order', () => {
    expect(toggleFacetTokens(['a:1'], ['b:1', 'b:2'])).toEqual(['a:1', 'b:1', 'b:2'])
    expect(toggleFacetTokens(['a:1', 'b:1', 'b:2'], ['b:1', 'b:2'])).toEqual(['a:1'])
    expect(toggleFacetTokens(['b:1'], ['b:1', 'b:2'])).toEqual([])
  })

  it('drops only the animal.target tokens', () => {
    expect(
      clearRecipientTokens(['animal.target:dog', 'life.stage:life.dog.adult', 'animal.target:cat']),
    ).toEqual(['life.stage:life.dog.adult'])
  })
})

describe('buildFilterGroups', () => {
  it('builds Categoría with counts and marks the selected category', () => {
    const { groups } = buildFilterGroups({
      categories,
      attributes: [],
      categoryId: 'c-2',
      tokens: [],
    })
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ key: 'category', kind: 'category', label: 'Categoría' })
    expect(groups[0]!.options.map((o) => [o.label, o.count, o.pressed])).toEqual([
      ['Accesorios', 9, false],
      ['Juguetes', 4, true],
    ])
    expect(groups[0]!.options[0]!.target).toEqual({ kind: 'category', id: 'c-1' })
    expect(groups[0]!.options[0]!.ariaLabel).toBe('Categoría: Accesorios, 9 productos')
    expect(groups[0]!.selectedLabel).toBe('Juguetes')
  })

  it('merges same-label options, hides empty options and single-option groups, and never lists animal.target', () => {
    const { groups } = buildFilterGroups({
      categories: [],
      attributes: [recipient, stage, lonely],
      categoryId: null,
      tokens: ['life.stage:life.dog.puppy'],
    })
    expect(groups.map((group) => group.key)).toEqual(['life.stage'])
    expect(groups[0]!.options.map((o) => [o.label, o.count, o.pressed])).toEqual([
      ['Adulto', 6, false],
      ['Cachorro', 3, true],
    ])
    expect(groups[0]!.options[0]!.target).toEqual({
      kind: 'facet',
      tokens: ['life.stage:life.dog.adult', 'life.stage:life.cat.adult'],
    })
  })

  it('keeps a single-option group while its option is selected, so it can be unselected', () => {
    const { groups } = buildFilterGroups({
      categories: [],
      attributes: [lonely],
      categoryId: null,
      tokens: ['food.format:dry'],
    })
    expect(groups.map((group) => group.key)).toEqual(['food.format'])
    expect(groups[0]!.options[0]!.pressed).toBe(true)
  })

  it('shows only Categoría plus a hint while a recipient facet exists and nothing is selected', () => {
    const idle = buildFilterGroups({
      categories,
      attributes: [recipient, stage],
      categoryId: null,
      tokens: [],
    })
    expect(idle.groups.map((group) => group.key)).toEqual(['category'])
    expect(idle.recipientHint).toBe(true)

    const chosen = buildFilterGroups({
      categories,
      attributes: [recipient, stage],
      categoryId: null,
      tokens: ['animal.target:dog'],
    })
    expect(chosen.groups.map((group) => group.key)).toEqual(['category', 'life.stage'])
    expect(chosen.recipientHint).toBe(false)
  })

  it('shows every group, with no hint, when the response has no recipient facet', () => {
    const { groups, recipientHint } = buildFilterGroups({
      categories,
      attributes: [stage],
      categoryId: null,
      tokens: [],
    })
    expect(groups.map((group) => group.key)).toEqual(['category', 'life.stage'])
    expect(recipientHint).toBe(false)
  })

  it('gives no hint when the gated groups would be empty anyway', () => {
    expect(
      buildFilterGroups({
        categories,
        attributes: [recipient, lonely],
        categoryId: null,
        tokens: [],
      }).recipientHint,
    ).toBe(false)
  })
})

describe('buildFacetChips', () => {
  it('groups selected tokens by option label and keeps unknown tokens as «Otros filtros»', () => {
    const chips = buildFacetChips(
      [recipient, stage],
      ['animal.target:dog', 'life.stage:life.dog.adult', 'life.stage:life.cat.adult', 'x.y:z'],
    )
    expect(chips).toEqual([
      { kind: 'facet', key: 'animal.target:dog', label: 'Perro', tokens: ['animal.target:dog'] },
      {
        kind: 'facet',
        key: 'life.stage:life.dog.adult',
        label: 'Adulto',
        tokens: ['life.stage:life.dog.adult', 'life.stage:life.cat.adult'],
      },
      { kind: 'facet', key: 'facet-rest', label: 'Otros filtros', tokens: ['x.y:z'] },
    ])
  })
})
