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

  // REQ-13: the 9 columns the backend can sort by declare enableSorting: true
  // so UTable renders a live sort control; the other 4 declare it explicitly
  // false so no dead control appears on a column the backend cannot order by.
  it('enables sorting on exactly the nine backend-sortable columns', () => {
    const { columns } = useSalesColumns()

    const sortable = columns
      .filter((column) => column.enableSorting === true)
      .map((column) => keyOf(column))

    expect(sortable).toEqual([
      'venta',
      'confirmedAt',
      'customer',
      'paymentStatus',
      'totalCents',
      'debtCents',
      'deliveryStatus',
      'cashier',
      'seller',
    ])
  })

  it('declares enableSorting explicitly on every column so none inherits the default', () => {
    const { columns } = useSalesColumns()

    const undeclared = columns
      .filter((column) => typeof column.enableSorting !== 'boolean')
      .map((column) => keyOf(column))

    expect(undeclared).toEqual([])
  })

  it('marks the presentational columns as non-sortable', () => {
    const { columns } = useSalesColumns()

    const nonSortable = columns
      .filter((column) => column.enableSorting === false)
      .map((column) => keyOf(column))

    expect(nonSortable).toEqual([
      'select',
      'paymentMethods',
      'dueDate',
      'channel',
      'invoice',
    ])
  })
})
