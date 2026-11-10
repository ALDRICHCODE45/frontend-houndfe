/**
 * Display order for detail variants. The server returns them in creation order (Nupec arrives
 * 20 kg, 2 kg, 8 kg), so they are sorted by a natural size key read from the name and option
 * value. Keys only compare within one dimension; when any variant has no key, or the keys mix
 * dimensions, the server order is kept entirely rather than half-sorted.
 */
export type VariantSizeDimension = 'mass' | 'volume' | 'length' | 'size' | 'word'

export interface VariantSizeKey {
  dimension: VariantSizeDimension
  /** Base unit: grams, milliliters, centimeters, or a rank for sizes and size words. */
  value: number
}

const UNITS: Record<string, { dimension: VariantSizeDimension; factor: number }> = {
  mg: { dimension: 'mass', factor: 0.001 },
  g: { dimension: 'mass', factor: 1 },
  gr: { dimension: 'mass', factor: 1 },
  grs: { dimension: 'mass', factor: 1 },
  kg: { dimension: 'mass', factor: 1000 },
  oz: { dimension: 'mass', factor: 28.349523125 },
  lb: { dimension: 'mass', factor: 453.59237 },
  lbs: { dimension: 'mass', factor: 453.59237 },
  ml: { dimension: 'volume', factor: 1 },
  l: { dimension: 'volume', factor: 1000 },
  lt: { dimension: 'volume', factor: 1000 },
  lts: { dimension: 'volume', factor: 1000 },
  cm: { dimension: 'length', factor: 1 },
  m: { dimension: 'length', factor: 100 },
}

// First number, an optional range whose lower bound wins («2-4.5 kg», «10,1 – 25 kg») and a unit
// that is not the start of a longer word («10 mascotas» has no unit).
const AMOUNT =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|—|a)\s*\d+(?:[.,]\d+)?)?\s*(mg|grs|gr|g|kg|oz|lbs|lb|ml|lts|lt|l|cm|m)(?![\p{L}\d])/iu
const GARMENT_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
// Uppercase only, so Spanish words and lowercase units never read as sizes.
const GARMENT = /(?<![\p{L}\d])(XXXL|XXL|XL|XXS|XS|S|M|L)(?![\p{L}\d])/u
const WORDS = /(?<!\p{L})(chic[oa]|median[oa]|grande)(?!\p{L})/iu
const WORD_RANK: Record<string, number> = { chic: 0, median: 1, grand: 2 }

export function parseVariantSizeKey(text: string): VariantSizeKey | null {
  const amount = AMOUNT.exec(text)
  if (amount) {
    const unit = UNITS[amount[2]!.toLowerCase()]!
    return {
      dimension: unit.dimension,
      value: Number(amount[1]!.replace(',', '.')) * unit.factor,
    }
  }
  const garment = GARMENT.exec(text)
  if (garment) return { dimension: 'size', value: GARMENT_SIZES.indexOf(garment[1]!) }
  const word = WORDS.exec(text)
  if (word) return { dimension: 'word', value: WORD_RANK[word[1]!.toLowerCase().slice(0, -1)]! }
  return null
}

/** Returns a sorted copy; ties keep their server order. */
export function sortVariantsBySize<T extends { name: string; value?: string | null }>(
  variants: readonly T[],
): T[] {
  // Name and value are read together, so a number anywhere beats a size word («Bolsa mediana» with
  // value «500 g» sorts by grams).
  const keys = variants.map((variant) =>
    parseVariantSizeKey([variant.name, variant.value].filter(Boolean).join(' ')),
  )
  const dimension = keys[0]?.dimension
  if (keys.some((key) => key === null || key.dimension !== dimension)) return [...variants]
  return variants
    .map((variant, index) => ({ variant, value: keys[index]!.value }))
    .sort((a, b) => a.value - b.value)
    .map(({ variant }) => variant)
}
