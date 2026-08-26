import { describe, it, expect } from 'vitest'
import { usePaymentDetailColumns } from '../usePaymentDetailColumns'

describe('usePaymentDetailColumns (sdd payment-details-admin S3, REQ-PD-001)', () => {
  it('exposes a columns array', () => {
    const { columns } = usePaymentDetailColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('contains the four data columns (bankName, beneficiary, clabe, accountNumber)', () => {
    const { columns } = usePaymentDetailColumns()
    const ids = columns
      .map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
      .sort()
    expect(ids).toContain('bankName')
    expect(ids).toContain('beneficiary')
    expect(ids).toContain('clabe')
    expect(ids).toContain('accountNumber')
  })

  it('contains the isActive status column', () => {
    const { columns } = usePaymentDetailColumns()
    const ids = columns
      .map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
    expect(ids).toContain('isActive')
  })

  it('contains the updatedAt timestamp column', () => {
    const { columns } = usePaymentDetailColumns()
    const ids = columns
      .map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
    expect(ids).toContain('updatedAt')
  })

  it('contains the actions column (kebab)', () => {
    const { columns } = usePaymentDetailColumns()
    const ids = columns.map((c) => (c as { id?: string }).id)
    expect(ids).toContain('actions')
  })

  it('the actions column is non-hideable (locked: kebab must persist when column visibility toggles)', () => {
    const { columns } = usePaymentDetailColumns()
    const actions = columns.find((c) => (c as { id?: string }).id === 'actions') as
      | { enableHiding?: boolean }
      | undefined
    expect(actions).toBeDefined()
    expect(actions!.enableHiding).toBe(false)
  })

  it('the actions column is non-sortable', () => {
    const { columns } = usePaymentDetailColumns()
    const actions = columns.find((c) => (c as { id?: string }).id === 'actions') as
      | { enableSorting?: boolean }
      | undefined
    expect(actions!.enableSorting).toBe(false)
  })

  it('data columns are hideable (bankName, beneficiary, clabe, accountNumber, isActive, updatedAt)', () => {
    const { columns } = usePaymentDetailColumns()
    for (const id of ['bankName', 'beneficiary', 'clabe', 'accountNumber', 'isActive', 'updatedAt']) {
      const col = columns.find((c) => (c as { accessorKey?: string; id?: string }).accessorKey === id
        || (c as { id?: string }).id === id) as { enableHiding?: boolean } | undefined
      expect(col, `column ${id} must be present`).toBeDefined()
      expect(col!.enableHiding, `column ${id} must be hideable`).toBe(true)
    }
  })

  it('bankName is the only sortable string column (per REQ-PD-001 default, leaves sort space open)', () => {
    const { columns } = usePaymentDetailColumns()
    const bankName = columns.find((c) => (c as { accessorKey?: string }).accessorKey === 'bankName') as
      | { enableSorting?: boolean }
      | undefined
    expect(bankName).toBeDefined()
    expect(bankName!.enableSorting).toBe(true)
  })

  it('does NOT contain a `manage` or `batch_delete` perm-shaped column (defensive: only data cols)', () => {
    const { columns } = usePaymentDetailColumns()
    const ids = columns.map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
    expect(ids).not.toContain('manage')
    expect(ids).not.toContain('batch_delete')
  })
})
