/**
 * Units of the box form (S4): sizes typed in cm with one decimal, weights typed
 * in kg and sent as whole grams. A decimal comma is accepted. Each reader
 * returns `null` for anything the backend would reject (handoff §5).
 */

const NUMBER = /^\d+(?:[.,]\d+)?$/

function decimals(text: string): number {
  return text.split(/[.,]/)[1]?.length ?? 0
}

/** `0.1..300`, at most one decimal. */
export function cmFromText(text: string): number | null {
  const raw = text.trim()
  if (!NUMBER.test(raw) || decimals(raw) > 1) return null
  const value = Number(raw.replace(',', '.'))
  return value >= 0.1 && value <= 300 ? value : null
}

/** kg → whole grams `1..70000` (so at most three decimals). */
export function gramsFromKgText(text: string): number | null {
  const raw = text.trim()
  if (!NUMBER.test(raw) || decimals(raw) > 3) return null
  const grams = Math.round(Number(raw.replace(',', '.')) * 1000)
  return grams >= 1 && grams <= 70000 ? grams : null
}

export function formatCm(value: number): string {
  return String(Number(value.toFixed(1)))
}

export function formatKg(grams: number): string {
  return String(Number((grams / 1000).toFixed(3)))
}
