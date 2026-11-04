import { describe, expect, it } from 'vitest'
import { useCustomerColumns } from '../useCustomerColumns'

type Column = { id?: string; accessorKey?: string; enableSorting?: boolean; meta?: { class?: { th?: string; td?: string } } }

describe('useCustomerColumns', () => {
  const columns = useCustomerColumns().columns as Column[]
  const keyOf = (column: Column) => column.id ?? column.accessorKey

  it('orders the columns by job: name first, contact, price list, then the ⋮ column last', () => {
    expect(columns.map(keyOf)).toEqual(['fullName', 'email', 'phone', 'globalPriceListName', 'actions'])
    expect(columns.length).toBeLessThanOrEqual(8)
  })

  it('keeps no selection column: nothing in the list acts on a selection', () => {
    expect(columns.find((column) => column.id === 'select')).toBeUndefined()
  })

  it('keeps the data columns sortable by accessorKey with plain string headers', () => {
    for (const key of ['fullName', 'email', 'phone', 'globalPriceListName']) {
      const column = columns.find((candidate) => candidate.accessorKey === key)
      expect(column).toBeDefined()
      expect(typeof (column as { header?: unknown }).header).toBe('string')
    }
  })

  it('keeps the actions column last, 64px wide, non-sortable and non-hideable', () => {
    const actions = columns[columns.length - 1]!
    expect(actions.id).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect((actions as { enableHiding?: boolean }).enableHiding).toBe(false)
    expect(actions.meta?.class?.th).toContain('w-16')
    expect(actions.meta?.class?.td).toContain('w-16')
    expect(actions.meta?.class?.td).toContain('text-right')
  })
})
