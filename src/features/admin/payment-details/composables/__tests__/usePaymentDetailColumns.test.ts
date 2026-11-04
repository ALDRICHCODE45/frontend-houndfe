import { describe, it, expect } from 'vitest'
import { usePaymentDetailColumns } from '../usePaymentDetailColumns'

const keyOf = (column: { accessorKey?: unknown; id?: string }) =>
  (column.accessorKey as string | undefined) ?? column.id

describe('usePaymentDetailColumns (sdd payment-details-admin S3, REQ-PD-001)', () => {
  it('orders columns by job: bank, status, CLABE, account, date, then the ⋮ column', () => {
    const { columns } = usePaymentDetailColumns()
    expect(columns.map(keyOf)).toEqual([
      'bankName',
      'isActive',
      'clabe',
      'accountNumber',
      'updatedAt',
      'actions',
    ])
    expect(columns.length).toBeLessThanOrEqual(8)
  })

  it('folds the beneficiary under the bank instead of a column of its own', () => {
    const { columns } = usePaymentDetailColumns()
    expect(columns.map(keyOf)).not.toContain('beneficiary')
  })

  it('contains the isActive status column right after the bank, non-sortable', () => {
    const { columns } = usePaymentDetailColumns()
    const status = columns[1]!
    expect(keyOf(status)).toBe('isActive')
    expect(status.header).toBe('Estado')
    expect(status.enableSorting).toBe(false)
  })

  it('bankName is the only sortable column (per REQ-PD-001 default, leaves sort space open)', () => {
    const { columns } = usePaymentDetailColumns()
    const sortable = columns.filter((column) => column.enableSorting).map(keyOf)
    expect(sortable).toEqual(['bankName'])
  })

  it('makes the actions column last, narrow, non-sortable and non-hideable', () => {
    const { columns } = usePaymentDetailColumns()
    const actions = columns[columns.length - 1]!
    expect(keyOf(actions)).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class).toEqual({ th: 'w-16', td: 'w-16 text-right' })
  })

  it('does NOT contain a `manage` or `batch_delete` perm-shaped column (defensive: only data cols)', () => {
    const { columns } = usePaymentDetailColumns()
    const ids = columns.map(keyOf)
    expect(ids).not.toContain('manage')
    expect(ids).not.toContain('batch_delete')
  })
})
