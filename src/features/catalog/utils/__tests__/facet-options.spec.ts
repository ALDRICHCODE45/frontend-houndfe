import { describe, expect, it } from 'vitest'
import { mergeFacetOptions } from '../facet-options'

const lifeStage = {
  code: 'life.stage',
  label: 'Etapa de vida',
  options: [
    { code: 'life.dog.puppy', label: 'Cachorro', count: 3 },
    { code: 'life.dog.adult', label: 'Adulto', count: 4 },
    { code: 'life.cat.kitten', label: 'Gatito', count: 1 },
    { code: 'life.cat.adult', label: 'Adulto', count: 2 },
    { code: 'life.dog.senior', label: 'Senior', count: 0 },
    { code: 'life.cat.senior', label: 'Senior', count: 1 },
  ],
}

describe('mergeFacetOptions', () => {
  it('merges options of one definition that share a label, in the position of the first one', () => {
    expect(mergeFacetOptions(lifeStage)).toEqual([
      { label: 'Cachorro', tokens: ['life.stage:life.dog.puppy'], count: 3 },
      { label: 'Adulto', tokens: ['life.stage:life.dog.adult', 'life.stage:life.cat.adult'], count: 6 },
      { label: 'Gatito', tokens: ['life.stage:life.cat.kitten'], count: 1 },
      { label: 'Senior', tokens: ['life.stage:life.dog.senior', 'life.stage:life.cat.senior'], count: 1 },
    ])
  })

  it('sums the per-code counts: exact for disjoint codes, an upper bound when a product carries several', () => {
    // The listing reports unique products per option code only; there is no per-label count. A
    // product tagged with both life.dog.adult and life.cat.adult is counted twice here, which is
    // accepted: per-species codes are disjoint for almost every product.
    const [merged] = mergeFacetOptions({
      code: 'life.stage',
      label: 'Etapa de vida',
      options: [
        { code: 'life.dog.adult', label: 'Adulto', count: 2 },
        { code: 'life.cat.adult', label: 'Adulto', count: 2 },
      ],
    })
    expect(merged!.count).toBe(4)
  })

  it('keeps distinct labels untouched and compares labels exactly', () => {
    expect(
      mergeFacetOptions({
        code: 'animal.target',
        label: 'Especie',
        options: [
          { code: 'ani.dom.cat', label: 'Gato', count: 2 },
          { code: 'ani.dom.dog', label: 'Perro', count: 1 },
          { code: 'ani.dom.dog2', label: 'perro', count: 1 },
        ],
      }).map((option) => option.label),
    ).toEqual(['Gato', 'Perro', 'perro'])
  })
})
