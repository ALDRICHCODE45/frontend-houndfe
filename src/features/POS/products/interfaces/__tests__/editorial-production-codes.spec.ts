import { describe, expect, it, vi } from 'vitest'
import {
  EDITORIAL_PRODUCTION_DEFINITION_CODES,
  isEditorialProductionDefinitionCode,
  type EditorialProductionDefinitionCode,
} from '../editorial-production-codes'

// Independent first-column fixture from S10, not derived from the implementation.
const expectedCodes = [
  'animal.target',
  'life.stage',
  'pack.form',
  'pack.sale',
  'content.kind',
  'material',
  'color.base',
  'size.label',
  'size.animal',
  'food.format',
  'food.role',
  'food.process',
  'food.texture',
  'food.aquatic',
  'treat.form',
  'treat.base',
  'toy.type',
  'toy.feature',
  'hygiene.type',
  'hygiene.form',
  'hygiene.litter',
  'hygiene.scent',
  'accessory.type',
  'accessory.closure',
  'accessory.feature',
  'habitat.type',
  'habitat.environment',
  'habitat.substrate',
  'habitat.component',
  'care.type',
  'care.form',
  'care.device',
  'measure.net_mass',
  'measure.net_volume',
  'measure.content_count',
  'measure.pack_count',
  'measure.dimensions.external_length',
  'measure.dimensions.external_width',
  'measure.dimensions.external_height',
  'measure.dimensions.external_diameter',
  'measure.dimensions.internal_length',
  'measure.dimensions.internal_width',
  'measure.dimensions.internal_height',
  'measure.dimensions.internal_diameter',
  'measure.fit.neck',
  'measure.fit.chest',
  'measure.fit.back_length',
  'measure.animal_mass',
  'measure.capacity.container',
  'measure.capacity.habitat_usable_volume',
  'measure.equipment.power',
  'measure.equipment.voltage',
  'measure.equipment.frequency',
  'measure.equipment.flow',
  'measure.equipment.temperature',
  'measure.coverage.length',
  'measure.coverage.area',
  'text.ingredients',
  'text.protein_origin',
  'text.composition',
  'text.manufacturer_care',
  'text.instructions',
  'text.clinical_analysis',
  'text.concentration',
  'text.regulatory_warnings',
  'feature.washable',
  'feature.reusable',
  'feature.waterproof',
] as const

describe('editorial production definition codes (S3/S9/S10)', () => {
  it('exports exactly the normative 68 unique codes in order', () => {
    expect(EDITORIAL_PRODUCTION_DEFINITION_CODES).toEqual(expectedCodes)
    expect(EDITORIAL_PRODUCTION_DEFINITION_CODES).toHaveLength(68)
    expect(new Set(EDITORIAL_PRODUCTION_DEFINITION_CODES).size).toBe(68)
  })

  it.each(expectedCodes)('accepts the exact primitive literal %s', (code) => {
    expect(isEditorialProductionDefinitionCode(code)).toBe(true)
  })

  it('rejects whitespace and case changes to every definition', () => {
    for (const code of expectedCodes) {
      for (const variant of [` ${code}`, `${code} `, `${code}\n`, `\t${code}`, code.toUpperCase()]) {
        expect(isEditorialProductionDefinitionCode(variant)).toBe(false)
      }
    }
  })

  it.each([
    '', 'unknown', 'custom:code', 'custom:animal.target', 'animal.custom',
    'measure.custom', 'text.custom', 'feature.custom',
    'animal', 'measure', 'measure.dimensions', 'food', 'care',
    'dog', 'adult', 'animal.target.dog', 'animal.target:dog',
    'species', 'animal_target', 'net_mass', 'colour.base',
    '__proto__', 'constructor', 'toString',
  ])('rejects non-definition strings including options/groups/aliases: %s', (value) => {
    expect(isEditorialProductionDefinitionCode(value)).toBe(false)
  })

  it('rejects non-string values without coercion or property access', () => {
    const convert = vi.fn(() => 'animal.target')
    const coercible = { toString: convert, valueOf: convert, [Symbol.toPrimitive]: convert }
    const trapped = new Proxy({}, {
      get() { throw new Error('must not inspect input properties') },
      getPrototypeOf() { throw new Error('must not inspect input prototype') },
    })
    for (const value of [
      null, undefined, true, false, 0, 1, NaN, Infinity, 1n,
      Symbol('animal.target'), {}, [], ['animal.target'],
      new String('animal.target'), () => 'animal.target', coercible, trapped,
    ]) {
      expect(isEditorialProductionDefinitionCode(value)).toBe(false)
    }
    expect(convert).not.toHaveBeenCalled()
  })

  it('freezes the exported array against additions, removal and replacement', () => {
    expect(Object.isFrozen(EDITORIAL_PRODUCTION_DEFINITION_CODES)).toBe(true)
    const list = EDITORIAL_PRODUCTION_DEFINITION_CODES as unknown as string[]
    expect(() => list.push('custom:code')).toThrow(TypeError)
    expect(() => list.pop()).toThrow(TypeError)
    expect(() => { list[0] = 'custom:code' }).toThrow(TypeError)
    expect(EDITORIAL_PRODUCTION_DEFINITION_CODES).toEqual(expectedCodes)
    expect(isEditorialProductionDefinitionCode('custom:code')).toBe(false)
    expect(isEditorialProductionDefinitionCode('animal.target')).toBe(true)
  })

  it('exposes a literal union and narrows unknown input through the guard', () => {
    const first: EditorialProductionDefinitionCode = expectedCodes[0]
    const last: EditorialProductionDefinitionCode = expectedCodes[67]
    // @ts-expect-error custom codes must not widen the literal union
    const custom: EditorialProductionDefinitionCode = 'custom:code'
    // @ts-expect-error the public tuple must remain readonly
    const mutable: string[] = EDITORIAL_PRODUCTION_DEFINITION_CODES
    const value: unknown = first
    if (isEditorialProductionDefinitionCode(value)) {
      const narrowed: EditorialProductionDefinitionCode = value
      expect(narrowed).toBe(first)
    } else {
      expect.fail('a normative definition must narrow successfully')
    }
    expect(last).toBe('feature.waterproof')
    expect(custom).toBe('custom:code')
    expect(mutable).toBe(EDITORIAL_PRODUCTION_DEFINITION_CODES)
  })
})
