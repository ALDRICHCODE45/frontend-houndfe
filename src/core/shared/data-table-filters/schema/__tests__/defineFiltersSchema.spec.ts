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

  describe('activeChips display formatting', () => {
    const chipsSchema = defineFiltersSchema([
      filter.multiEnum({
        id: 'paymentMethod',
        label: 'Método',
        param: 'paymentMethod',
        options: [
          { label: 'Efectivo', value: 'CASH' },
          { label: 'Transferencia', value: 'TRANSFER' },
          { label: 'Tarjeta débito', value: 'CARD_DEBIT' },
          { label: 'Tarjeta crédito', value: 'CARD_CREDIT' },
        ],
        includeNull: { param: 'paymentMethodIncludeNull', label: 'Sin método' },
      }),
      filter.numericRange({
        id: 'total',
        label: 'Total',
        minParam: 'totalMin',
        maxParam: 'totalMax',
        formatAs: 'currency',
      }),
      filter.numericRange({
        id: 'quantity',
        label: 'Cantidad',
        minParam: 'quantityMin',
        maxParam: 'quantityMax',
      }),
      filter.dateRange({
        id: 'confirmedAt',
        label: 'Fecha de venta',
        fromParam: 'confirmedFrom',
        toParam: 'confirmedTo',
      }),
      filter.dateRange({
        id: 'dueDate',
        label: 'Vencimiento',
        fromParam: 'dueDateFrom',
        toParam: 'dueDateTo',
        includeNull: { param: 'dueDateIncludeNull', label: 'Incluir ventas sin vencimiento' },
      }),
    ])

    it('formats multi-enum with include-null integration', () => {
      const defaults = chipsSchema.defaults()

      const onlyIncludeNull = chipsSchema.activeChips({
        ...defaults,
        paymentMethod: [],
        paymentMethodIncludeNull: true,
      })
      expect(onlyIncludeNull.find(c => c.filterId === 'paymentMethod')?.displayValue).toBe('Sin método')

      const oneValue = chipsSchema.activeChips({
        ...defaults,
        paymentMethod: ['CASH'],
        paymentMethodIncludeNull: true,
      })
      expect(oneValue.find(c => c.filterId === 'paymentMethod')?.displayValue).toBe('Efectivo + sin método')

      const twoValues = chipsSchema.activeChips({
        ...defaults,
        paymentMethod: ['CASH', 'TRANSFER'],
        paymentMethodIncludeNull: true,
      })
      expect(twoValues.find(c => c.filterId === 'paymentMethod')?.displayValue).toBe('Efectivo, Transferencia + sin método')

      const fourValues = chipsSchema.activeChips({
        ...defaults,
        paymentMethod: ['CASH', 'TRANSFER', 'CARD_DEBIT', 'CARD_CREDIT'],
        paymentMethodIncludeNull: true,
      })
      expect(fourValues.find(c => c.filterId === 'paymentMethod')?.displayValue).toBe('4 seleccionados + sin método')

      const noSuffix = chipsSchema.activeChips({
        ...defaults,
        paymentMethod: ['CASH'],
        paymentMethodIncludeNull: false,
      })
      expect(noSuffix.find(c => c.filterId === 'paymentMethod')?.displayValue).toBe('Efectivo')
    })

    it('formats numeric-range currency from cents to pesos', () => {
      const defaults = chipsSchema.defaults()

      const onlyMin = chipsSchema.activeChips({ ...defaults, total: { min: 50000 } })
      expect(onlyMin.find(c => c.filterId === 'total')?.displayValue).toBe('Desde $500')

      const onlyMax = chipsSchema.activeChips({ ...defaults, total: { max: 200000 } })
      expect(onlyMax.find(c => c.filterId === 'total')?.displayValue).toBe('Hasta $2,000')

      const both = chipsSchema.activeChips({ ...defaults, total: { min: 50000, max: 200000 } })
      expect(both.find(c => c.filterId === 'total')?.displayValue).toBe('$500 — $2,000')
    })

    it('formats numeric-range plain values', () => {
      const defaults = chipsSchema.defaults()

      const onlyMin = chipsSchema.activeChips({ ...defaults, quantity: { min: 5 } })
      expect(onlyMin.find(c => c.filterId === 'quantity')?.displayValue).toBe('Desde 5')

      const both = chipsSchema.activeChips({ ...defaults, quantity: { min: 5, max: 20 } })
      expect(both.find(c => c.filterId === 'quantity')?.displayValue).toBe('5 — 20')
    })

    it('formats date-range without includeNull', () => {
      const defaults = chipsSchema.defaults()

      const range = chipsSchema.activeChips({
        ...defaults,
        confirmedAt: {
          from: '2026-05-18T06:00:00.000Z',
          to: '2026-05-25T05:59:59.999Z',
        },
      })
      expect(range.find(c => c.filterId === 'confirmedAt')?.displayValue).toMatch(/^\d{2}\/\d{2}\/2026 — \d{2}\/\d{2}\/2026$/)

      const sameDay = chipsSchema.activeChips({
        ...defaults,
        confirmedAt: {
          from: '2026-05-20T12:00:00.000Z',
          to: '2026-05-20T12:00:00.000Z',
        },
      })
      const sameDayValue = sameDay.find(c => c.filterId === 'confirmedAt')?.displayValue ?? ''
      expect(sameDayValue).not.toContain(' — ')
      expect(sameDayValue).toMatch(/^\d{2}\/\d{2}\/2026$/)

      const onlyFrom = chipsSchema.activeChips({
        ...defaults,
        confirmedAt: { from: '2026-05-20T12:00:00.000Z' },
      })
      expect(onlyFrom.find(c => c.filterId === 'confirmedAt')?.displayValue).toMatch(/^Desde \d{2}\/\d{2}\/2026$/)

      const onlyTo = chipsSchema.activeChips({
        ...defaults,
        confirmedAt: { to: '2026-05-20T12:00:00.000Z' },
      })
      expect(onlyTo.find(c => c.filterId === 'confirmedAt')?.displayValue).toMatch(/^Hasta \d{2}\/\d{2}\/2026$/)
    })

    it('formats date-range includeNull label and suffix', () => {
      const defaults = chipsSchema.defaults()

      const onlyIncludeNull = chipsSchema.activeChips({
        ...defaults,
        dueDateIncludeNull: true,
      })
      expect(onlyIncludeNull.find(c => c.filterId === 'dueDate')?.displayValue).toBe('Incluir ventas sin vencimiento')

      const withFrom = chipsSchema.activeChips({
        ...defaults,
        dueDate: { from: '2026-05-20T12:00:00.000Z' },
        dueDateIncludeNull: true,
      })
      expect(withFrom.find(c => c.filterId === 'dueDate')?.displayValue).toMatch(/ \+ incluir ventas sin vencimiento$/)
    })
  })
})
