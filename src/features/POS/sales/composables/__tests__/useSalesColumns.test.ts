import { describe, it, expect } from 'vitest'
import { useSalesColumns } from '../useSalesColumns'

describe('useSalesColumns', () => {
  const keyOf = (column: unknown) => {
    const typed = column as { id?: string; accessorKey?: string }
    return typed.id ?? typed.accessorKey
  }

  it('returns all expected columns in order', () => {
    const { columns } = useSalesColumns()

    expect(columns).toHaveLength(12)
    expect(columns.map((column) => keyOf(column))).toEqual([
      'select',
      'venta',
      'confirmedAt',
      'customer',
      'paymentStatus',
      'totalCents',
      'debtCents',
      'deliveryStatus',
      'cashier',
      'seller',
      'channel',
      'invoice',
    ])
  })

  it('keeps non-sortable fixed columns disabled for sorting', () => {
    const { columns } = useSalesColumns()
    const channel = columns.find((column) => keyOf(column) === 'channel')
    const invoice = columns.find((column) => keyOf(column) === 'invoice')

    expect(channel?.enableSorting).toBe(false)
    expect(invoice?.enableSorting).toBe(false)
  })
})
