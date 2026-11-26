/**
 * payment-split T1 (S2-S4, S7): pure cents math for splitting what is due across tenders.
 * Every split is integer cents and sums exactly to the target; non-cash never exceeds what is due.
 */
import { describe, expect, it } from 'vitest'
import {
  applyTenderAmounts,
  equalSplitCents,
  fillRemainingCents,
  parsePercentInput,
  percentSplitCents,
  remainingDueCents,
} from '../tenderSplit'

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

describe('remainingDueCents', () => {
  it('is the target minus what the tenders already cover', () => {
    expect(remainingDueCents(607629, [200000, 0])).toBe(407629)
  })

  it('treats blank (null/undefined) and negative amounts as 0', () => {
    expect(remainingDueCents(10000, [null, undefined, -500, 2500])).toBe(7500)
  })

  it('never goes below 0 when cash covers more than the target (change)', () => {
    expect(remainingDueCents(607629, [700000])).toBe(0)
  })
})

describe('fillRemainingCents («Lo que falta», S2)', () => {
  const tenders = [
    { method: 'cash', amountCents: 200000 },
    { method: 'card_credit', amountCents: 0 },
  ]

  it('gives the tender what the other tenders leave pending (2,000 cash → card 4,076.29)', () => {
    expect(fillRemainingCents(607629, tenders, 1)).toBe(407629)
  })

  it('ignores the tender own current amount', () => {
    const typed = [tenders[0]!, { method: 'card_credit', amountCents: 1234 }]
    expect(fillRemainingCents(607629, typed, 1)).toBe(407629)
  })

  it('a non-cash tender never gets more than what is due (S7)', () => {
    expect(fillRemainingCents(607629, [{ method: 'transfer', amountCents: null }], 0)).toBe(607629)
    const cashOver = [
      { method: 'cash', amountCents: 700000 },
      { method: 'card_debit', amountCents: 0 },
    ]
    expect(fillRemainingCents(607629, cashOver, 1)).toBe(0)
  })

  it('is 0 for an index out of range', () => {
    expect(fillRemainingCents(607629, tenders, 5)).toBe(0)
  })
})

describe('equalSplitCents («Repartir en partes iguales», S3)', () => {
  it('splits 6,076.29 in 3 exact parts of 2,025.43', () => {
    const parts = equalSplitCents(607629, 3)
    expect(parts).toEqual([202543, 202543, 202543])
    expect(sum(parts)).toBe(607629)
  })

  it('puts the leftover cent(s) on the last tender', () => {
    expect(equalSplitCents(100000, 3)).toEqual([33333, 33333, 33334])
    expect(equalSplitCents(607630, 4)).toEqual([151907, 151907, 151907, 151909])
    expect(sum(equalSplitCents(607630, 4))).toBe(607630)
  })

  it('keeps integer cents and the exact sum for every count 1-5', () => {
    for (let count = 1; count <= 5; count++) {
      const parts = equalSplitCents(123457, count)
      expect(parts).toHaveLength(count)
      expect(parts.every(Number.isInteger)).toBe(true)
      expect(sum(parts)).toBe(123457)
      expect(Math.max(...parts)).toBeLessThanOrEqual(123457)
    }
  })

  it('returns no parts for 0 tenders and zeros for a 0 target', () => {
    expect(equalSplitCents(607629, 0)).toEqual([])
    expect(equalSplitCents(0, 2)).toEqual([0, 0])
  })
})

describe('percentSplitCents («Por porcentaje», S4)', () => {
  it('splits 50/30/20 in exact cents', () => {
    expect(percentSplitCents(607629, [50, 30, 20])).toEqual({
      ok: true,
      amounts: [303814, 182288, 121527],
    })
    expect(sum([303814, 182288, 121527])).toBe(607629)
  })

  it('puts the rounding remainder on the last tender', () => {
    expect(percentSplitCents(100000, [33.33, 33.33, 33.34])).toEqual({
      ok: true,
      amounts: [33330, 33330, 33340],
    })
    expect(percentSplitCents(101, [50, 50])).toEqual({ ok: true, amounts: [50, 51] })
  })

  it('leaves a 0% tender at 0 (the remainder goes to the last tender with a percent)', () => {
    expect(percentSplitCents(101, [50, 50, 0])).toEqual({ ok: true, amounts: [50, 51, 0] })
  })

  it('flags totals that are not 100%', () => {
    expect(percentSplitCents(607629, [50, 30, 10])).toEqual({
      ok: false,
      error: 'total',
      totalPercent: 90,
    })
    expect(percentSplitCents(607629, [60, 50])).toEqual({
      ok: false,
      error: 'total',
      totalPercent: 110,
    })
  })

  it('flags invalid percents (blank, negative, over 100, more than 2 decimals)', () => {
    for (const percents of [[null, 100], [-10, 110], [101, -1], [33.333, 66.667]]) {
      expect(percentSplitCents(607629, percents)).toMatchObject({ ok: false, error: 'invalid' })
    }
  })
})

describe('parsePercentInput', () => {
  it('reads whole and decimal percents, with point or comma', () => {
    expect(parsePercentInput('50')).toBe(50)
    expect(parsePercentInput(' 33.33 ')).toBe(33.33)
    expect(parsePercentInput('33,5')).toBe(33.5)
    expect(parsePercentInput('20%')).toBe(20)
  })

  it('returns null for blank, out of range or more than 2 decimals', () => {
    for (const text of ['', '  ', 'abc', '-5', '100.01', '12.345', '1,2,3']) {
      expect(parsePercentInput(text)).toBeNull()
    }
  })
})

describe('applyTenderAmounts', () => {
  it('returns new tenders with the amounts, keeping every other field', () => {
    const tenders = [
      { method: 'cash', amountCents: 0 },
      { method: 'transfer', amountCents: 5, reference: 'X', paymentMethodId: 'id-1' },
    ]
    const next = applyTenderAmounts(tenders, [100, 200])
    expect(next).toEqual([
      { method: 'cash', amountCents: 100 },
      { method: 'transfer', amountCents: 200, reference: 'X', paymentMethodId: 'id-1' },
    ])
    expect(next[0]).not.toBe(tenders[0])
    expect(tenders[0]!.amountCents).toBe(0)
  })

  it('keeps the tenders untouched when the amount count does not match', () => {
    const tenders = [{ method: 'cash', amountCents: 1 }]
    expect(applyTenderAmounts(tenders, [1, 2])).toBe(tenders)
  })
})
