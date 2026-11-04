import { describe, it, expect } from 'vitest'
import { defaultColumnVisibility, useSalesColumns } from '../useSalesColumns'

describe('useSalesColumns', () => {
  const keyOf = (column: unknown) => {
    const typed = column as { id?: string; accessorKey?: string }
    return typed.id ?? typed.accessorKey
  }

  it('returns all expected columns in order', () => {
    const { columns } = useSalesColumns()

    expect(columns).toHaveLength(15)
    expect(columns.map((column) => keyOf(column))).toEqual([
      'select',
      'venta',
      'customer',
      'paymentStatus',
      'deliveryStatus',
      'paymentMethods',
      'totalCents',
      'debtCents',
      'confirmedAt',
      'dueDate',
      'cashier',
      'seller',
      'channel',
      'invoice',
      'actions',
    ])
  })

  it('shows at most eight columns by default, with the row menu last', () => {
    const { columns } = useSalesColumns()
    const visible = columns
      .map((column) => keyOf(column) as string)
      .filter((key) => key !== 'select' && defaultColumnVisibility[key] !== false)

    expect(visible).toEqual([
      'venta',
      'customer',
      'paymentStatus',
      'deliveryStatus',
      'totalCents',
      'debtCents',
      'confirmedAt',
      'actions',
    ])
    expect(visible.length).toBeLessThanOrEqual(8)
    expect(defaultColumnVisibility.paymentMethods).toBe(false)
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

  // The backend confirmed-sales endpoint only accepts sortBy values
  // confirmedAt | totalCents | createdAt (see list-sales-query.dto.ts).
  // createdAt is not a visible column (the USelect shortcut offers it), so
  // exactly the two visible backend-sortable columns declare
  // enableSorting: true and get a live sort control; every other column is
  // explicitly false so no dead control appears on a column the backend
  // cannot order by (sorting by them returns a 400).
  it('enables sorting on exactly the two visible backend-sortable columns', () => {
    const { columns } = useSalesColumns()

    const sortable = columns
      .filter((column) => column.enableSorting === true)
      .map((column) => keyOf(column))

    expect(sortable).toEqual([
      'totalCents',
      'confirmedAt',
    ])
  })

  it('declares enableSorting explicitly on every column so none inherits the default', () => {
    const { columns } = useSalesColumns()

    const undeclared = columns
      .filter((column) => typeof column.enableSorting !== 'boolean')
      .map((column) => keyOf(column))

    expect(undeclared).toEqual([])
  })

  it('marks the non-backend-sortable columns as non-sortable', () => {
    const { columns } = useSalesColumns()

    const nonSortable = columns
      .filter((column) => column.enableSorting === false)
      .map((column) => keyOf(column))

    expect(nonSortable).toEqual([
      'select',
      'venta',
      'customer',
      'paymentStatus',
      'deliveryStatus',
      'paymentMethods',
      'debtCents',
      'dueDate',
      'cashier',
      'seller',
      'channel',
      'invoice',
      'actions',
    ])
  })
})
