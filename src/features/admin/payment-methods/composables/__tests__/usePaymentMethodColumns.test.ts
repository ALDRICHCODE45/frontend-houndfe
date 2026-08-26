import { describe, it, expect } from 'vitest'
import { usePaymentMethodColumns } from '../usePaymentMethodColumns'

describe('usePaymentMethodColumns (sdd custom-payment-methods S2A, REQ-PM-001)', () => {
  it('exposes a columns array', () => {
    const { columns } = usePaymentMethodColumns()
    expect(Array.isArray(columns)).toBe(true)
    expect(columns.length).toBeGreaterThan(0)
  })

  it('contains the four data columns (name, category, subtitle, updatedAt)', () => {
    const { columns } = usePaymentMethodColumns()
    const ids = columns
      .map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
    expect(ids).toContain('name')
    expect(ids).toContain('category')
    expect(ids).toContain('subtitle')
    expect(ids).toContain('updatedAt')
  })

  it('contains the isActive status column', () => {
    const { columns } = usePaymentMethodColumns()
    const ids = columns
      .map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
    expect(ids).toContain('isActive')
  })

  it('contains the actions column (kebab)', () => {
    const { columns } = usePaymentMethodColumns()
    const ids = columns.map((c) => (c as { id?: string }).id)
    expect(ids).toContain('actions')
  })

  it('the actions column is non-hideable (locked: kebab must persist when column visibility toggles)', () => {
    const { columns } = usePaymentMethodColumns()
    const actions = columns.find((c) => (c as { id?: string }).id === 'actions') as
      | { enableHiding?: boolean }
      | undefined
    expect(actions).toBeDefined()
    expect(actions!.enableHiding).toBe(false)
  })

  it('the actions column is non-sortable', () => {
    const { columns } = usePaymentMethodColumns()
    const actions = columns.find((c) => (c as { id?: string }).id === 'actions') as
      | { enableSorting?: boolean }
      | undefined
    expect(actions!.enableSorting).toBe(false)
  })

  it('the isActive column uses createSimpleHeader (non-sortable, per REQ-PM-001)', () => {
    const { columns } = usePaymentMethodColumns()
    const isActive = columns.find(
      (c) => (c as { id?: string }).id === 'isActive',
    ) as { header?: unknown; enableSorting?: boolean } | undefined
    expect(isActive).toBeDefined()
    // createSimpleHeader returns a function with a stable string label.
    const headerFn = isActive!.header as unknown
    expect(typeof headerFn).toBe('function')
    expect((headerFn as () => string)()).toBe('Estado')
    expect(isActive!.enableSorting).toBe(false)
  })

  it('data columns are hideable (name, category, subtitle, isActive, updatedAt)', () => {
    const { columns } = usePaymentMethodColumns()
    for (const id of ['name', 'category', 'subtitle', 'isActive', 'updatedAt']) {
      const col = columns.find((c) => (c as { accessorKey?: string; id?: string }).accessorKey === id
        || (c as { id?: string }).id === id) as { enableHiding?: boolean } | undefined
      expect(col, `column ${id} must be present`).toBeDefined()
      expect(col!.enableHiding, `column ${id} must be hideable`).toBe(true)
    }
  })

  it('does NOT contain a `manage` or `batch_delete` perm-shaped column (defensive: only data cols)', () => {
    const { columns } = usePaymentMethodColumns()
    const ids = columns.map((c) => (c as { accessorKey?: string; id?: string }).accessorKey ?? (c as { id?: string }).id)
    expect(ids).not.toContain('manage')
    expect(ids).not.toContain('batch_delete')
  })
})