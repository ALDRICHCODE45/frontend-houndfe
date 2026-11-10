import { describe, expect, it } from 'vitest'
import { parseVariantSizeKey, sortVariantsBySize } from '../variant-order'

type Variant = { id: string; name: string; value?: string | null }
const ids = (variants: Variant[]) => sortVariantsBySize(variants).map((variant) => variant.id)

describe('parseVariantSizeKey', () => {
  it.each([
    ['500 g', 'mass', 500],
    ['2 kg', 'mass', 2000],
    ['1,5 kg', 'mass', 1500],
    ['16 oz', 'mass', 16 * 28.349523125],
    ['1 lb', 'mass', 453.59237],
    ['250 ml', 'volume', 250],
    ['1.5 l', 'volume', 1500],
    ['30 cm', 'length', 30],
    ['2 m', 'length', 200],
    ['NexGard 2-4.5 kg', 'mass', 2000],
    ['Perros 10,1 – 25 kg', 'mass', 10100],
    ['Nupec Adulto 20kg', 'mass', 20000],
  ])('reads «%s» as %s %d', (text, dimension, value) => {
    const key = parseVariantSizeKey(text)
    expect(key?.dimension).toBe(dimension)
    expect(key?.value).toBeCloseTo(value)
  })

  it('ranks garment sizes and Spanish size words', () => {
    const ranks = ['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((text) => parseVariantSizeKey(`Talla ${text}`))
    expect(ranks.every((key) => key?.dimension === 'size')).toBe(true)
    const values = ranks.map((key) => key!.value)
    expect([...values].sort((a, b) => a - b)).toEqual(values)
    const words = ['Chico', 'Mediano', 'Grande'].map((text) => parseVariantSizeKey(text)!)
    expect(words.every((key) => key.dimension === 'word')).toBe(true)
    expect(words[0]!.value).toBeLessThan(words[1]!.value)
    expect(words[1]!.value).toBeLessThan(words[2]!.value)
    expect(parseVariantSizeKey('Bolsa chica')?.value).toBe(words[0]!.value)
  })

  it('does not read units inside words or sizes from lowercase letters', () => {
    expect(parseVariantSizeKey('Sabor pollo')).toBeNull()
    expect(parseVariantSizeKey('10 mascotas')).toBeNull()
    expect(parseVariantSizeKey('Rojo')).toBeNull()
    expect(parseVariantSizeKey('')).toBeNull()
  })
})

describe('sortVariantsBySize', () => {
  it('orders weights naturally regardless of unit (Nupec arrives 20 kg, 2 kg, 8 kg)', () => {
    expect(
      ids([
        { id: '20', name: 'Nupec 20 kg' },
        { id: '2', name: 'Nupec 2 kg' },
        { id: '8', name: 'Nupec 8 kg' },
        { id: '500', name: 'Nupec 500 g' },
      ]),
    ).toEqual(['500', '2', '8', '20'])
  })

  it('orders weight bands by their lower bound (NexGard starts with the heaviest band)', () => {
    expect(
      ids([
        { id: 'xl', name: 'NexGard 25.1-50 kg' },
        { id: 'l', name: 'NexGard 10.1-25 kg' },
        { id: 's', name: 'NexGard 2-4 kg' },
        { id: 'm', name: 'NexGard 4.1-10 kg' },
      ]),
    ).toEqual(['s', 'm', 'l', 'xl'])
  })

  it('falls back to the option value when the name carries no size', () => {
    expect(
      ids([
        { id: 'big', name: 'Bolsa', value: '1 kg' },
        { id: 'small', name: 'Bolsa', value: '250 g' },
      ]),
    ).toEqual(['small', 'big'])
  })

  it('orders garment sizes and size words', () => {
    expect(
      ids([
        { id: 'L', name: 'Talla L' },
        { id: 'XS', name: 'Talla XS' },
        { id: 'M', name: 'Talla M' },
      ]),
    ).toEqual(['XS', 'M', 'L'])
    expect(
      ids([
        { id: 'g', name: 'Grande' },
        { id: 'c', name: 'Chico' },
        { id: 'm', name: 'Mediano' },
      ]),
    ).toEqual(['c', 'm', 'g'])
  })

  it('keeps the server order entirely when any variant has no key or the keys are not comparable', () => {
    expect(
      ids([
        { id: 'a', name: '8 kg' },
        { id: 'b', name: 'Sabor pollo' },
        { id: 'c', name: '2 kg' },
      ]),
    ).toEqual(['a', 'b', 'c'])
    expect(
      ids([
        { id: 'a', name: '2 l' },
        { id: 'b', name: '500 g' },
      ]),
    ).toEqual(['a', 'b'])
  })

  it('is stable for equal keys and never mutates the input', () => {
    const input = [
      { id: 'b', name: '1 kg' },
      { id: 'a', name: '1000 g' },
      { id: 'c', name: '500 g' },
    ]
    expect(ids(input)).toEqual(['c', 'b', 'a'])
    expect(input.map((variant) => variant.id)).toEqual(['b', 'a', 'c'])
  })
})
