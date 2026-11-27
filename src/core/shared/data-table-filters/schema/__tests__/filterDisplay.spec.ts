import { describe, expect, it } from 'vitest'
import { FILTER_CHIPS_MAX_OPTIONS, usesToggleChips } from '../filterDisplay'
import { filter } from '../filterFactories'

const options = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `O${index}`, value: `${index}` }))

describe('usesToggleChips (owner-ideas-batch T2)', () => {
  it('defaults to 8 options', () => {
    expect(FILTER_CHIPS_MAX_OPTIONS).toBe(8)
  })

  it('is true for a multi-enum with up to the threshold of chips, counting the «sin valor» chip', () => {
    expect(usesToggleChips(filter.multiEnum({ id: 'a', label: 'A', param: 'a', options: options(8) }))).toBe(true)
    expect(usesToggleChips(filter.multiEnum({ id: 'a', label: 'A', param: 'a', options: options(9) }))).toBe(false)
    expect(usesToggleChips(filter.multiEnum({
      id: 'a', label: 'A', param: 'a', options: options(8), includeNull: { param: 'aNone', label: 'Sin' },
    }))).toBe(false)
    expect(usesToggleChips(filter.multiEnum({ id: 'a', label: 'A', param: 'a', options: options(3) }), 2)).toBe(false)
  })

  it('is false for searchable enums, async lists and every other kind', () => {
    expect(usesToggleChips(filter.multiEnum({ id: 'a', label: 'A', param: 'a', searchable: true, options: options(2) }))).toBe(false)
    expect(usesToggleChips(filter.multiAsync({ id: 'a', label: 'A', param: 'a', options: options(2) }))).toBe(false)
    expect(usesToggleChips(filter.multiText({ id: 'a', label: 'A', param: 'a' }))).toBe(false)
    expect(usesToggleChips(filter.numericRange({ id: 'a', label: 'A', minParam: 'x', maxParam: 'y' }))).toBe(false)
  })

  it('obeys an explicit display on the field', () => {
    expect(usesToggleChips(filter.multiEnum({ id: 'a', label: 'A', param: 'a', display: 'select', options: options(2) }))).toBe(false)
    expect(usesToggleChips(filter.multiEnum({ id: 'a', label: 'A', param: 'a', display: 'chips', options: options(20) }))).toBe(true)
  })
})
