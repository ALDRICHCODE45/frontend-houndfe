import { describe, it, expect } from 'vitest'
import {
  PROMOTION_TYPE_LABELS,
  PROMOTION_METHOD_LABELS,
  PROMOTION_STATUS_LABELS,
  PROMOTION_STATUS_COLORS,
  DAY_OF_WEEK_LABELS,
} from '../promotion.types'

describe('PROMOTION_TYPE_LABELS', () => {
  it('maps PRODUCT_DISCOUNT to correct label', () => {
    expect(PROMOTION_TYPE_LABELS['PRODUCT_DISCOUNT']).toBe('Descuento en productos')
  })

  it('maps ORDER_DISCOUNT to correct label', () => {
    expect(PROMOTION_TYPE_LABELS['ORDER_DISCOUNT']).toBe('Descuento en el pedido')
  })

  it('maps BUY_X_GET_Y to correct label', () => {
    expect(PROMOTION_TYPE_LABELS['BUY_X_GET_Y']).toBe('2x1, 3x2 o similares')
  })

  it('maps ADVANCED to correct label', () => {
    expect(PROMOTION_TYPE_LABELS['ADVANCED']).toBe('Promoción avanzada')
  })
})

describe('PROMOTION_STATUS_LABELS', () => {
  it('maps ACTIVE to correct label', () => {
    expect(PROMOTION_STATUS_LABELS['ACTIVE']).toBe('Activa')
  })

  it('maps SCHEDULED to correct label', () => {
    expect(PROMOTION_STATUS_LABELS['SCHEDULED']).toBe('Programada')
  })

  it('maps ENDED to correct label', () => {
    expect(PROMOTION_STATUS_LABELS['ENDED']).toBe('Finalizada')
  })
})

describe('PROMOTION_STATUS_COLORS', () => {
  it('maps ACTIVE to green', () => {
    expect(PROMOTION_STATUS_COLORS['ACTIVE']).toBe('green')
  })

  it('maps SCHEDULED to blue', () => {
    expect(PROMOTION_STATUS_COLORS['SCHEDULED']).toBe('blue')
  })

  it('maps ENDED to gray', () => {
    expect(PROMOTION_STATUS_COLORS['ENDED']).toBe('gray')
  })
})

describe('PROMOTION_METHOD_LABELS', () => {
  it('maps AUTOMATIC to correct label', () => {
    expect(PROMOTION_METHOD_LABELS['AUTOMATIC']).toBe('Automático')
  })

  it('maps MANUAL to correct label', () => {
    expect(PROMOTION_METHOD_LABELS['MANUAL']).toBe('Manual')
  })
})

describe('DAY_OF_WEEK_LABELS', () => {
  it('maps MONDAY to correct label', () => {
    expect(DAY_OF_WEEK_LABELS['MONDAY']).toBe('Lunes')
  })

  it('maps SUNDAY to correct label', () => {
    expect(DAY_OF_WEEK_LABELS['SUNDAY']).toBe('Domingo')
  })

  it('has all 7 days mapped', () => {
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    days.forEach((day) => {
      expect(DAY_OF_WEEK_LABELS[day as keyof typeof DAY_OF_WEEK_LABELS]).toBeDefined()
    })
  })
})
