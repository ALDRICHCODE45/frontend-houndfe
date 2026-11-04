/**
 * Products list columns: contract guard for the shared list pattern.
 *
 * `useProductColumns` is a side-effect-free factory, so no mount is needed.
 * The order follows the pattern: name (with the SKU under it) first, status
 * second, then what decides the next action, money right-aligned, ⋮ last.
 * The `type` column is hideable (visible by default).
 */

import { describe, it, expect } from 'vitest'
import * as productColumnsModule from '../useProductColumns'
import { useProductColumns } from '../useProductColumns'

type ColumnLike = { id?: string; accessorKey?: string; enableHiding?: boolean }

describe('useProductColumns contract', () => {
  it('orders columns by job: name, status, type, category, brand, price, stock, actions', () => {
    const { columns } = useProductColumns()

    const ids = columns.map((col) => {
      const typed = col as ColumnLike
      return typed.id ?? typed.accessorKey
    })

    expect(ids).toEqual([
      'name',
      'status',
      'type',
      'categoryName',
      'brandName',
      'priceCents',
      'quantity',
      'actions',
    ])
  })

  it('stays within the 8-column limit of the list pattern', () => {
    expect(useProductColumns().columns.length).toBeLessThanOrEqual(8)
  })

  it('actions is non-hideable; type is hideable (enableHiding)', () => {
    const { columns } = useProductColumns()
    const byId = (id: string) => columns.find((col) => (col as ColumnLike).id === id)

    expect(byId('type')?.enableHiding).toBe(true)
    expect(byId('actions')?.enableHiding).toBe(false)
  })

  it('right-aligns the money and stock columns', () => {
    const { columns } = useProductColumns()
    for (const key of ['priceCents', 'quantity']) {
      const column = columns.find((col) => (col as ColumnLike).accessorKey === key)
      expect(column?.meta?.class?.td).toContain('text-right')
    }
  })

  it('does NOT export a defaultColumnVisibility (all columns visible by default)', () => {
    expect((productColumnsModule as Record<string, unknown>)['defaultColumnVisibility']).toBeUndefined()
  })
})
