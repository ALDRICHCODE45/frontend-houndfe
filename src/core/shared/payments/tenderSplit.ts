/**
 * tenderSplit.ts — split one amount due across several payment methods (payment-split S2-S4, S7).
 *
 * Pure and framework-free, shared by «Cobrar todo», the counter checkout and the sale debt payment.
 * Money is integer cents end to end: every split sums exactly to the target and the leftover
 * cent(s) go to the last tender. Every amount this module produces is ≤ the target, so a non-cash
 * tender never gets more than what is due; only cash typed by the cashier may exceed it (change).
 *
 * The callers keep their own tender shape; anything with `method` + `amountCents` fits.
 */

/** Minimal tender shape: `amountCents` may be blank (`null`/`undefined`) while being typed. */
export interface SplitTender {
  method: string
  amountCents: number | null | undefined
}

export type PercentSplitResult =
  | { ok: true; amounts: number[] }
  /** `total`: valid percents that do not add up to 100. `invalid`: a blank/out-of-range one. */
  | { ok: false; error: 'total' | 'invalid'; totalPercent: number }

/** Hundredths of a percent in 100%: percents are handled as integers to avoid float drift. */
const FULL_BASIS_POINTS = 10000

/** A safe non-negative integer amount of cents (blank, negative or non-finite → 0). */
function cents(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.trunc(value)
}

/** What is still due once the tenders are counted; never below 0 (cash over gives change). */
export function remainingDueCents(
  targetCents: number,
  amounts: ReadonlyArray<number | null | undefined>,
): number {
  const covered = amounts.reduce<number>((acc, amount) => acc + cents(amount), 0)
  return Math.max(0, cents(targetCents) - covered)
}

/**
 * «Lo que falta» for tender `index`: the amount that, with the OTHER tenders as they are, covers
 * the target exactly (its own current amount is ignored). Never more than the target, and 0 when
 * the others already cover it.
 */
export function fillRemainingCents(
  targetCents: number,
  tenders: ReadonlyArray<SplitTender>,
  index: number,
): number {
  if (index < 0 || index >= tenders.length) return 0
  const others = tenders.filter((_, current) => current !== index).map((t) => t.amountCents)
  return remainingDueCents(targetCents, others)
}

/** The target in `count` equal integer parts; the leftover cent(s) go to the last part. */
export function equalSplitCents(targetCents: number, count: number): number[] {
  const parts = Math.max(0, Math.trunc(count))
  if (parts === 0) return []
  const target = cents(targetCents)
  const base = Math.floor(target / parts)
  const amounts = Array.from({ length: parts }, () => base)
  amounts[parts - 1] = target - base * (parts - 1)
  return amounts
}

/** A percent as hundredths (`33.33` → `3333`), or `null` when blank, out of 0-100 or > 2 decimals. */
function toBasisPoints(percent: number | null | undefined): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent)) return null
  if (percent < 0 || percent > 100) return null
  const scaled = percent * 100
  const rounded = Math.round(scaled)
  return Math.abs(scaled - rounded) < 1e-6 ? rounded : null
}

/**
 * The target split by percent (`[50, 30, 20]`), each part floored to whole cents and the rounding
 * remainder on the last tender with a percent above 0 (a 0% tender stays at 0). The percents must
 * be 0-100 with at most 2 decimals and add up to exactly 100.
 */
export function percentSplitCents(
  targetCents: number,
  percents: ReadonlyArray<number | null | undefined>,
): PercentSplitResult {
  const points = percents.map(toBasisPoints)
  const valid = points.filter((value): value is number => value !== null)
  const totalPoints = valid.reduce((acc, value) => acc + value, 0)
  const totalPercent = totalPoints / 100
  if (valid.length !== points.length) return { ok: false, error: 'invalid', totalPercent }
  if (totalPoints !== FULL_BASIS_POINTS) return { ok: false, error: 'total', totalPercent }

  const target = cents(targetCents)
  const amounts = valid.map((value) => Math.floor((target * value) / FULL_BASIS_POINTS))
  let last = valid.length - 1
  while (last > 0 && valid[last] === 0) last--
  const assigned = amounts.reduce((acc, amount) => acc + amount, 0)
  amounts[last] = amounts[last]! + (target - assigned)
  return { ok: true, amounts }
}

/** Reads a typed percent («50», «33.33», «33,5», «20%»); `null` when blank or not valid. */
export function parsePercentInput(text: string): number | null {
  const cleaned = text.trim().replace(/%$/, '').trim().replace(',', '.')
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(cleaned)) return null
  const percent = Number(cleaned)
  return toBasisPoints(percent) === null ? null : percent
}

/** New tenders with `amounts` in order (other fields kept); the same array on a count mismatch. */
export function applyTenderAmounts<T extends SplitTender>(
  tenders: ReadonlyArray<T>,
  amounts: ReadonlyArray<number>,
): T[] {
  if (amounts.length !== tenders.length) return tenders as T[]
  return tenders.map((tender, index) => ({ ...tender, amountCents: cents(amounts[index]) }))
}
