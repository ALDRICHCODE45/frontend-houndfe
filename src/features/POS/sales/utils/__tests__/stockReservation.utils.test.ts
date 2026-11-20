import { describe, expect, it } from 'vitest'
import type { Sale, SaleItem } from '../../interfaces/sale.types'
import {
  reservedForBackorderChargeMessage,
  reservedForBackorderWarningMessage,
  stockWarningsOf,
  withoutStockWarnings,
} from '../stockReservation.utils'

const item = (id: string, stockWarning?: SaleItem['stockWarning']): SaleItem => ({
  id,
  productId: `p-${id}`,
  variantId: null,
  productName: `Producto ${id}`,
  variantName: null,
  quantity: 1,
  unitPriceCents: 100,
  unitPriceCurrency: 'MXN',
  ...(stockWarning ? { stockWarning } : {}),
})

const sale = (items: SaleItem[]): Sale => ({
  id: 'sale-1',
  userId: 'u',
  status: 'DRAFT',
  items,
  createdAt: 'x',
  updatedAt: 'x',
})

const warning = { code: 'STOCK_RESERVED_FOR_BACKORDER', available: 2, reserved: 3 } as const

describe('reservedForBackorderWarningMessage', () => {
  it('says how many units are held and how many can be sold, without «sin stock»', () => {
    const message = reservedForBackorderWarningMessage(2, 3)
    expect(message).toBe('Hay 3 unidades apartadas para pedidos por reposición; solo puedes vender 2.')
    expect(message).not.toMatch(/sin stock|insuficiente|agotado/i)
  })

  it('agrees in number for a single unit', () => {
    expect(reservedForBackorderWarningMessage(0, 1)).toBe(
      'Hay 1 unidad apartada para pedidos por reposición; solo puedes vender 0.',
    )
  })
})

describe('reservedForBackorderChargeMessage', () => {
  it('names both figures, says the sale stays open and is distinct from the confirm-time stock error', () => {
    const message = reservedForBackorderChargeMessage(2, 3)
    expect(message).toContain('3 unidades apartadas para pedidos por reposición')
    expect(message).toContain('solo puedes vender 2')
    expect(message).toContain('La venta sigue abierta')
    expect(message).not.toMatch(/sin stock|insuficiente/i)
  })

  it('has a generic text when the server sends no figures', () => {
    expect(reservedForBackorderChargeMessage(undefined, undefined)).toContain('apartadas para pedidos por reposición')
  })
})

describe('stockWarningsOf / withoutStockWarnings', () => {
  it('lists the warning of each touched line, with the line', () => {
    const result = stockWarningsOf(sale([item('a'), item('b', warning)]))
    expect(result).toEqual([{ item: expect.objectContaining({ id: 'b' }), available: 2, reserved: 3 }])
  })

  it('ignores lines without a warning and unknown warning codes', () => {
    expect(stockWarningsOf(sale([item('a')]))).toEqual([])
    const other = { code: 'OTHER', available: 1, reserved: 1 } as unknown as SaleItem['stockWarning']
    expect(stockWarningsOf(sale([item('a', other)]))).toEqual([])
  })

  it('drops the warning key from every line, keeping the rest', () => {
    const stripped = withoutStockWarnings(sale([item('a'), item('b', warning)]))
    expect(stripped.items.every((line) => !('stockWarning' in line))).toBe(true)
    expect(stripped.items[1]).toMatchObject({ id: 'b', productName: 'Producto b' })
  })

  it('returns the very same sale when there is nothing to strip', () => {
    const clean = sale([item('a')])
    expect(withoutStockWarnings(clean)).toBe(clean)
  })
})
