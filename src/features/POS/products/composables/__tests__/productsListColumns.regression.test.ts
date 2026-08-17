/**
 * Products list columns – non-regression guard for pos-sales-list-redesign
 *
 * R-201: Products list behavior MUST remain unchanged after the Sales list
 * redesign. This file locks the Products columns contract so any accidental
 * future modification is caught immediately.
 *
 * Strategy: Option 2 (pure-function snapshot) — useProductColumns is a
 * side-effect-free factory; no mount needed, no network, no stubs.
 *
 * Intent (product-service-type change): the table gained a `type` column
 * (SERVICE/PRODUCT badge) inserted after `select`, expanding the contract
 * from 9 → 10 columns. The type column is hideable (visible by default). This
 * is a deliberate, recorded change tracked by R-201 — the 9-column guard was
 * retired because the badge is part of the type-aware list (products-list
 * REQ-3/4). The same intent lives in `ProductsView.test.ts`
 * (`data-column-count`).
 */

import { describe, it, expect } from 'vitest'
import * as productColumnsModule from '../useProductColumns'
import { useProductColumns } from '../useProductColumns'

describe('useProductColumns – non-regression guard (R-201)', () => {
  it('returns exactly 10 columns with `type` second (after `select`)', () => {
    const { columns } = useProductColumns()

    const ids = columns.map((col) => {
      const typed = col as { id?: string; accessorKey?: string }
      return typed.id ?? typed.accessorKey
    })

    expect(ids).toEqual([
      'select',
      'type',
      'name',
      'sku',
      'categoryName',
      'brandName',
      'priceCents',
      'quantity',
      'status',
      'actions',
    ])
  })

  it('select and actions are non-hideable; type is hideable (enableHiding)', () => {
    const { columns } = useProductColumns()

    const select = columns.find(
      (col) => (col as { id?: string }).id === 'select',
    )
    const type = columns.find((col) => (col as { id?: string }).id === 'type')
    const actions = columns.find(
      (col) => (col as { id?: string }).id === 'actions',
    )

    // Non-hideable baseline (select + actions). The type badge column is
    // hideable so the user can toggle it in the "Columnas" selector.
    expect(select?.enableHiding).toBe(false)
    expect(type?.enableHiding).toBe(true)
    expect(actions?.enableHiding).toBe(false)
  })

  it('useProductColumns does NOT export a defaultColumnVisibility (Products has no visibility defaults)', () => {
    // Products uses useServerTable without defaultColumnVisibility (all columns visible).
    // If someone accidentally adds a restrictive default, this guard catches it.
    // Using the ESM namespace import to inspect module-level exports.
    expect((productColumnsModule as Record<string, unknown>)['defaultColumnVisibility']).toBeUndefined()
  })

  it('useProductColumns returns currencyFormatter (Intl.NumberFormat) alongside columns', () => {
    // Structural check: the Products composable contract returns both columns AND formatter.
    // This confirms the composable signature is intact and hasn't been refactored away.
    const { columns, currencyFormatter } = useProductColumns()

    expect(columns).toHaveLength(10)
    // currencyFormatter is an Intl.NumberFormat instance using MXN (es-MX),
    // so 1000 must format as "$1,000.00" with comma as thousand separator.
    expect(currencyFormatter.format(1000)).toContain('1,000')
    expect(currencyFormatter.format(1000)).toContain('$')
  })
})