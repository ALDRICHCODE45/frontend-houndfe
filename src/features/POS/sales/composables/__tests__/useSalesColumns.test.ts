import { describe, it, expect } from 'vitest'
import { defaultColumnVisibility, useSalesColumns } from '../useSalesColumns'

describe('useSalesColumns', () => {
  const keyOf = (column: unknown) => {
    const typed = column as { id?: string; accessorKey?: string }
    return typed.id ?? typed.accessorKey
  }

  it('returns all expected columns in order', () => {
    const { columns } = useSalesColumns()

    expect(columns).toHaveLength(14)
    expect(columns.map((column) => keyOf(column))).toEqual([
      'select',
      'venta',
      'confirmedAt',
      'customer',
      'paymentStatus',
      'paymentMethods',
      'totalCents',
      'debtCents',
      'dueDate',
      'deliveryStatus',
      'cashier',
      'seller',
      'channel',
      'invoice',
    ])
  })

  it('defines Vence column as non-sortable and hidden by default', () => {
    const { columns } = useSalesColumns()
    const dueDate = columns.find((column) => keyOf(column) === 'dueDate')

    expect(dueDate).toBeDefined()
    expect(defaultColumnVisibility.dueDate).toBe(false)
    expect(dueDate?.enableSorting).toBe(false)
  })

  it('keeps non-sortable fixed columns disabled for sorting', () => {
    const { columns } = useSalesColumns()
    const channel = columns.find((column) => keyOf(column) === 'channel')
    const invoice = columns.find((column) => keyOf(column) === 'invoice')

    expect(channel?.enableSorting).toBe(false)
    expect(invoice?.enableSorting).toBe(false)
  })
})
