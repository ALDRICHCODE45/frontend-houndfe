import { describe, expect, it } from 'vitest'
import { defineFiltersSchema } from '../defineFiltersSchema'
import { filter } from '../filterFactories'

const schema = defineFiltersSchema([
  filter.multiEnum({ id: 'paymentMethod', label: 'Método', param: 'paymentMethod', options: [{ label: 'Tarjeta débito', value: 'CARD_DEBIT' }] }),
  filter.multiEnum({ id: 'status', label: 'Estado', param: 'status', options: [{ label: 'Pagada', value: 'PAID' }], includeNull: { param: 'statusIncludeNull', label: 'x' } }),
  filter.numericRange({ id: 'total', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax' }),
  filter.dateRange({ id: 'confirmedAt', label: 'Fecha', fromParam: 'from', toParam: 'to' }),
  filter.multiText({ id: 'folio', label: 'Folio', param: 'folio', transform: { toBackend: v => v.map(x => `A-${x}`), fromBackend: v => v.map(x => x.replace('A-', '')) } }),
])

describe('defineFiltersSchema', () => {
  it('provides defaults and stable canonicalization', () => {
    const defaults = schema.defaults()
    expect(defaults.status).toEqual([])
    const a = schema.canonicalize({ ...defaults, total: { max: 10, min: 1 } })
    const b = schema.canonicalize({ ...defaults, total: { min: 1, max: 10 } })
    expect(a).toBe(b)
  })

  it('isActive resolveLabel activeChips and transforms', () => {
    const state = {
      ...schema.defaults(),
      paymentMethod: ['CARD_DEBIT'],
      status: ['PAID', 'X', 'Y', 'Z'],
      total: { min: 10 },
      folio: ['1', '2'],
    }
    expect(schema.resolveLabel('paymentMethod', 'CARD_DEBIT')).toBe('Tarjeta débito')
    expect(schema.resolveLabel('paymentMethod', 'UNKNOWN')).toBe('UNKNOWN')
    expect(schema.isActive('total', state)).toBe(true)
    const chips = schema.activeChips(state)
    expect(chips.find(c => c.filterId === 'paymentMethod')?.displayValue).toBe('Tarjeta débito')
    expect(chips.find(c => c.filterId === 'status')?.displayValue).toBe('4 seleccionados')
    expect(schema.serialize(state).folio).toBe('A-1,A-2')
  })
})
