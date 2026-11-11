import { describe, expect, it } from 'vitest'
import { computeUnitPrices, type UnitPriceInput } from '../unit-price'
import type { PublicProductAttribute } from '../../interfaces/public-catalog-product-detail.types'

const content = (
  value: number,
  unit: { code: string; label: string } | null = { code: 'kg', label: 'kg' },
  code = 'measure.net_mass',
): PublicProductAttribute => ({
  code,
  label: 'Contenido',
  facet: false,
  section: null,
  value: { type: 'number', value, unit },
  display: `${value}`,
})

const item = (
  id: string,
  name: string,
  priceCents: number | null,
  attributes: PublicProductAttribute[],
): UnitPriceInput => ({ id, name, priceCents, attributes })

describe('computeUnitPrices', () => {
  it('prices every presentation per unit and credits the bigger ones against the smallest', () => {
    const result = computeUnitPrices([
      item('a', '2 kg', 22000, [content(2)]),
      item('b', '8 kg', 74900, [content(8)]),
      item('c', '20 kg', 168900, [content(20)]),
    ])
    expect(result.a).toEqual({
      label: '$110.00 / kg',
      amount: '$110.00',
      unit: 'kg',
      saving: null,
    })
    expect(result.b).toEqual({
      label: '$93.63 / kg',
      amount: '$93.63',
      unit: 'kg',
      saving: { percent: 15, versus: '2 kg' },
    })
    expect(result.c?.label).toBe('$84.45 / kg')
    expect(result.c?.saving).toEqual({ percent: 23, versus: '2 kg' })
  })

  it('shows nothing when the presentations do not share a unit', () => {
    expect(
      computeUnitPrices([
        item('a', '500 g', 10000, [content(500, { code: 'g', label: 'g' })]),
        item('b', '2 kg', 30000, [content(2)]),
      ]),
    ).toEqual({})
  })

  it('shows nothing when one presentation lacks the attribute', () => {
    expect(
      computeUnitPrices([item('a', '2 kg', 22000, [content(2)]), item('b', '8 kg', 74900, [])]),
    ).toEqual({})
  })

  it('shows nothing for attributes that are not net content (dimensions)', () => {
    expect(
      computeUnitPrices([
        item('a', 'S', 10000, [content(20, { code: 'cm', label: 'cm' }, 'measure.dimensions.external_length')]),
      ]),
    ).toEqual({})
  })

  it('shows nothing for attributes without a unit or a positive value', () => {
    expect(computeUnitPrices([item('a', 'X', 10000, [content(2, null)])])).toEqual({})
    expect(computeUnitPrices([item('a', 'X', 10000, [content(0)])])).toEqual({})
  })

  it('gives a single presentation its unit price and no saving', () => {
    expect(computeUnitPrices([item('a', '2 kg', 22000, [content(2)])])).toEqual({
      a: { label: '$110.00 / kg', amount: '$110.00', unit: 'kg', saving: null },
    })
  })

  it('names word units in lowercase', () => {
    const piece = { code: 'piece', label: 'Pieza' }
    const result = computeUnitPrices(
      [item('a', '10', 10000, [content(10, piece, 'measure.content_count')])],
    )
    expect(result.a?.label).toBe('$10.00 / pieza')
  })

  it('leaves out presentations without a price and never invents a saving for them', () => {
    const result = computeUnitPrices([
      item('a', '2 kg', 22000, [content(2)]),
      item('b', '8 kg', null, [content(8)]),
      item('c', '20 kg', 168900, [content(20)]),
    ])
    expect(result.b).toBeUndefined()
    expect(result.c?.saving).toEqual({ percent: 23, versus: '2 kg' })
  })

  it('shows no saving when a bigger presentation is not cheaper per unit', () => {
    const result = computeUnitPrices([
      item('a', '2 kg', 20000, [content(2)]),
      item('b', '8 kg', 90000, [content(8)]),
    ])
    expect(result.b).toEqual({
      label: '$112.50 / kg',
      amount: '$112.50',
      unit: 'kg',
      saving: null,
    })
  })

  it('returns nothing for an empty list', () => {
    expect(computeUnitPrices([])).toEqual({})
  })
})
