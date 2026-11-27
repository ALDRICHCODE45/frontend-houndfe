import { describe, expect, it } from 'vitest'
import { defineFiltersSchema } from '../defineFiltersSchema'
import { filter } from '../filterFactories'

// One-value filters on top of the multi-enum kind, so DataTableFilters renders them with no new
// primitive: a yes/no flag and a single choice (30/60/90 días). The last picked value wins.
describe('filter.booleanFlag', () => {
  const schema = defineFiltersSchema([
    filter.booleanFlag({ id: 'hasDebt', label: 'Con deuda', section: 'Deuda' }),
  ])

  it('is a multi-enum on its own param with «Sí» and «No», or the labels it is given', () => {
    const field = schema.byId.hasDebt!
    expect(field.kind).toBe('multi-enum')
    expect(field).toMatchObject({ param: 'hasDebt', section: 'Deuda' })
    expect('options' in field && field.options).toEqual([
      { label: 'Sí', value: 'true' },
      { label: 'No', value: 'false' },
    ])
    const custom = filter.booleanFlag({ id: 'hasEmail', label: 'Correo', trueLabel: 'Con correo', falseLabel: 'Sin correo' })
    expect(custom.options.map((option) => option.label)).toEqual(['Con correo', 'Sin correo'])
  })

  it('sends true, false or nothing, never both', () => {
    expect(schema.serialize({ hasDebt: [] })).toEqual({})
    expect(schema.serialize({ hasDebt: ['true'] })).toEqual({ hasDebt: 'true' })
    expect(schema.serialize({ hasDebt: ['false'] })).toEqual({ hasDebt: 'false' })
    // Picking «No» after «Sí» switches the flag: the last pick wins.
    expect(schema.serialize({ hasDebt: ['true', 'false'] })).toEqual({ hasDebt: 'false' })
  })

  it('reads only true or false back from the URL', () => {
    expect(schema.deserialize({ hasDebt: 'true' }).hasDebt).toEqual(['true'])
    expect(schema.deserialize({ hasDebt: 'false' }).hasDebt).toEqual(['false'])
    expect(schema.deserialize({ hasDebt: 'yes' }).hasDebt).toEqual([])
    expect(schema.deserialize({ hasDebt: 'true,false' }).hasDebt).toEqual(['false'])
    expect(schema.deserialize({}).hasDebt).toEqual([])
  })

  it('is active with a value and shows its label in the chip', () => {
    expect(schema.isActive('hasDebt', { hasDebt: [] })).toBe(false)
    expect(schema.activeChips({ hasDebt: ['false'] })).toEqual([
      { filterId: 'hasDebt', label: 'Con deuda', displayValue: 'No' },
    ])
  })
})

describe('filter.singleEnum', () => {
  const schema = defineFiltersSchema([
    filter.singleEnum({
      id: 'overdueMoreThanDays',
      label: 'Vencida hace más de',
      options: [
        { label: '30 días', value: '30' },
        { label: '60 días', value: '60' },
        { label: '90 días', value: '90' },
      ],
    }),
  ])

  it('sends one value: the last picked', () => {
    expect(schema.serialize({ overdueMoreThanDays: ['30'] })).toEqual({ overdueMoreThanDays: '30' })
    expect(schema.serialize({ overdueMoreThanDays: ['30', '90'] })).toEqual({ overdueMoreThanDays: '90' })
    expect(schema.serialize({ overdueMoreThanDays: [] })).toEqual({})
  })

  it('ignores a URL value that is not one of its options', () => {
    expect(schema.deserialize({ overdueMoreThanDays: '60' }).overdueMoreThanDays).toEqual(['60'])
    expect(schema.deserialize({ overdueMoreThanDays: '45' }).overdueMoreThanDays).toEqual([])
  })
})

// owner-ideas-batch T2: the filters sheet renders one-value filters as single-select chips.
describe('single-value marker', () => {
  it('marks singleEnum and booleanFlag as single-select, multiEnum stays multiple', () => {
    expect(filter.booleanFlag({ id: 'hasDebt', label: 'Con deuda' }).selection).toBe('single')
    expect(filter.singleEnum({ id: 'd', label: 'Días', options: [{ label: '30 días', value: '30' }] }).selection).toBe('single')
    expect(filter.multiEnum({ id: 's', label: 'S', param: 's', options: [] }).selection).toBeUndefined()
  })
})

// customers-module L12: count ranges must not show «$».
describe('filter.numericRange unit', () => {
  const base = { id: 'r', label: 'R', minParam: 'rMin', maxParam: 'rMax' }

  it('keeps the unit it is given, including none', () => {
    expect(filter.numericRange({ ...base, unit: '', formatAs: 'plain' }).unit).toBe('')
    expect(filter.numericRange({ ...base, unit: 'kg', formatAs: 'plain' }).unit).toBe('kg')
    expect(filter.numericRange({ ...base, unit: '$', formatAs: 'currency' }).unit).toBe('$')
  })

  it('defaults to «$» only for money: a plain or unformatted range has no unit', () => {
    expect(filter.numericRange({ ...base, formatAs: 'currency' }).unit).toBe('$')
    expect(filter.numericRange({ ...base, formatAs: 'plain' }).unit).toBe('')
    expect(filter.numericRange({ ...base }).unit).toBe('')
  })
})
