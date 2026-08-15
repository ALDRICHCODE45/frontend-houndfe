/**
 * WU-A — useEmployeeColumns specs (REQ-5, REQ-9)
 *
 * Pinned:
 *  - Column order: colaborador, cargo, departamento, jefedirecto, fechaIngreso,
 *                  modalidad, estado, actions
 *  - Headers (string form): 'Colaborador', 'Cargo', 'Departamento',
 *                            'Jefe directo', 'Fecha de ingreso', 'Modalidad', 'Estado'
 *  - 7 data columns: `enableHiding: true`
 *  - actions column: `enableHiding: false`, `enableSorting: false`, right-aligned
 *  - All columns: explicit `enableSorting: false` (no SortableHeader)
 *  - NO salary column
 *
 * RED — written before any production change to useEmployeeColumns.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: () => false,
  }),
}))

import { useEmployeeColumns } from '../useEmployeeColumns'

type ColumnLike = {
  id?: string
  accessorKey?: string
  header?: unknown
  enableHiding?: boolean
  enableSorting?: boolean
  meta?: { class?: { td?: string } }
}

function getId(col: ColumnLike): string {
  return col.id ?? col.accessorKey ?? ''
}

function headerText(col: ColumnLike): string {
  const h = col.header
  return typeof h === 'string' ? h : (h as () => string)()
}

describe('useEmployeeColumns — column order & headers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('orders columns as [colaborador, cargo, departamento, jefedirecto, fechaIngreso, modalidad, estado, actions]', () => {
    const { columns } = useEmployeeColumns()
    const ids = columns.value.map((col) => getId(col as ColumnLike))
    expect(ids).toEqual([
      'colaborador',
      'cargo',
      'departamento',
      'jefedirecto',
      'fechaIngreso',
      'modalidad',
      'estado',
      'actions',
    ])
  })

  it('uses header "Colaborador" for the colaborador column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'colaborador') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Colaborador')
  })

  it('uses header "Cargo" for the cargo column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'cargo') as ColumnLike
    expect(col!.header).toBe('Cargo')
  })

  it('uses header "Departamento" for the departamento column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'departamento') as ColumnLike
    expect(col!.header).toBe('Departamento')
  })

  it('uses header "Jefe directo" for the jefedirecto column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'jefedirecto') as ColumnLike
    expect(headerText(col!)).toBe('Jefe directo')
  })

  it('uses header "Fecha de ingreso" for the fechaIngreso column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'fechaIngreso') as ColumnLike
    expect(col!.header).toBe('Fecha de ingreso')
  })

  it('uses header "Modalidad" for the modalidad column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'modalidad') as ColumnLike
    expect(col!.header).toBe('Modalidad')
  })

  it('uses header "Estado" for the estado column', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'estado') as ColumnLike
    expect(col!.header).toBe('Estado')
  })
})

describe('useEmployeeColumns — enableHiding (REQ-5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marks all 7 data columns as hideable (enableHiding: true)', () => {
    const { columns } = useEmployeeColumns()
    const dataIds = ['colaborador', 'cargo', 'departamento', 'jefedirecto', 'fechaIngreso', 'modalidad', 'estado']
    for (const id of dataIds) {
      const col = columns.value.find((c) => getId(c as ColumnLike) === id) as ColumnLike
      expect(col, `missing column ${id}`).toBeDefined()
      expect(col!.enableHiding, `${id} must be hideable`).toBe(true)
    }
  })

  it('marks the actions column as non-hideable (enableHiding: false)', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'actions') as ColumnLike
    expect(col).toBeDefined()
    expect(col!.enableHiding).toBe(false)
  })
})

describe('useEmployeeColumns — enableSorting (REQ-9)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marks every column with explicit enableSorting: false', () => {
    const { columns } = useEmployeeColumns()
    expect(columns.value.length).toBe(8)
    for (const col of columns.value) {
      const c = col as ColumnLike
      expect(c.enableSorting, `${getId(c)} must be non-sortable`).toBe(false)
    }
  })

  it('marks actions column with non-sortable AND non-hideable AND right-aligned', () => {
    const { columns } = useEmployeeColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'actions') as ColumnLike
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
    expect(col!.meta?.class?.td).toBe('text-right')
  })
})

describe('useEmployeeColumns — invariants (REQ-10)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not include a salary column', () => {
    const { columns } = useEmployeeColumns()
    const ids = columns.value.map((col) => getId(col as ColumnLike))
    expect(ids).not.toContain('salario')
  })
})