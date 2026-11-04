import { describe, it, expect } from 'vitest'
import { usePaymentMethodColumns } from '../usePaymentMethodColumns'

const keyOf = (column: { accessorKey?: unknown; id?: string }) =>
  (column.accessorKey as string | undefined) ?? column.id

describe('usePaymentMethodColumns (sdd custom-payment-methods S2A, REQ-PM-001)', () => {
  it('orders columns by job: name, status, category, date, then the ⋮ column', () => {
    const { columns } = usePaymentMethodColumns()
    expect(columns.map(keyOf)).toEqual(['name', 'isActive', 'category', 'updatedAt', 'actions'])
    expect(columns.length).toBeLessThanOrEqual(8)
  })

  it('folds the subtitle under the name instead of a column of its own', () => {
    const { columns } = usePaymentMethodColumns()
    expect(columns.map(keyOf)).not.toContain('subtitle')
  })

  it('contains the isActive status column right after the name, non-sortable (REQ-PM-001)', () => {
    const { columns } = usePaymentMethodColumns()
    const status = columns[1]!
    expect(keyOf(status)).toBe('isActive')
    expect(status.header).toBe('Estado')
    expect(status.enableSorting).toBe(false)
  })

  it('sorts by name and category, and keeps the date quiet', () => {
    const { columns } = usePaymentMethodColumns()
    const byKey = (key: string) => columns.find((column) => keyOf(column) === key)!
    expect(byKey('name').enableSorting).toBe(true)
    expect(byKey('category').enableSorting).toBe(true)
    expect(byKey('updatedAt').enableSorting).toBe(false)
  })

  it('makes the actions column last, narrow, non-sortable and non-hideable', () => {
    const { columns } = usePaymentMethodColumns()
    const actions = columns[columns.length - 1]!
    expect(keyOf(actions)).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class).toEqual({ th: 'w-16', td: 'w-16 text-right' })
  })

  it('does NOT contain a `manage` or `batch_delete` perm-shaped column (defensive: only data cols)', () => {
    const { columns } = usePaymentMethodColumns()
    const ids = columns.map(keyOf)
    expect(ids).not.toContain('manage')
    expect(ids).not.toContain('batch_delete')
  })
})
