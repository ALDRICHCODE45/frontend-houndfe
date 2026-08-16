/**
 * WU-A — usePendingApprovalsColumns specs (REQ-3)
 *
 * Pinned:
 *  - Column order: [colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones]
 *  - Headers:
 *      colaborador → "Colaborador"
 *      tipo        → "Tipo"
 *      fechas      → "Fechas"
 *      dias        → "Días"
 *      motivo      → "Motivo"
 *      estado      → "Estado"
 *      solicitada  → "Solicitada"
 *      acciones    → (header hidden — actions column)
 *  - 7 data columns: `enableHiding: true`
 *  - acciones: `enableHiding: false` + `enableSorting: false` + right-aligned
 *  - All columns: explicit `enableSorting: false` (sorting deferred per design)
 *
 * RED — written before usePendingApprovalsColumns production code.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePendingApprovalsColumns } from '../usePendingApprovalsColumns'

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
  if (typeof h === 'string') return h
  if (typeof h === 'function') return (h as () => string)()
  return ''
}

describe('usePendingApprovalsColumns — column order & headers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('orders columns as [colaborador, tipo, fechas, dias, motivo, estado, solicitada, acciones]', () => {
    const { columns } = usePendingApprovalsColumns()
    const ids = columns.value.map((col) => getId(col as ColumnLike))
    expect(ids).toEqual([
      'colaborador',
      'tipo',
      'fechas',
      'dias',
      'motivo',
      'estado',
      'solicitada',
      'acciones',
    ])
  })

  it('uses header "Colaborador" for the colaborador column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'colaborador') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Colaborador')
  })

  it('uses header "Tipo" for the tipo column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'tipo') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Tipo')
  })

  it('uses header "Fechas" for the fechas column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'fechas') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Fechas')
  })

  it('uses header "Días" for the dias column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'dias') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Días')
  })

  it('uses header "Motivo" for the motivo column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'motivo') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Motivo')
  })

  it('uses header "Estado" for the estado column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'estado') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Estado')
  })

  it('uses header "Solicitada" for the solicitada column', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'solicitada') as ColumnLike
    expect(col).toBeDefined()
    expect(headerText(col!)).toBe('Solicitada')
  })
})

describe('usePendingApprovalsColumns — enableHiding (REQ-3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marks all 7 data columns as hideable (enableHiding: true)', () => {
    const { columns } = usePendingApprovalsColumns()
    const dataIds = [
      'colaborador',
      'tipo',
      'fechas',
      'dias',
      'motivo',
      'estado',
      'solicitada',
    ]
    for (const id of dataIds) {
      const col = columns.value.find((c) => getId(c as ColumnLike) === id) as ColumnLike
      expect(col, `missing column ${id}`).toBeDefined()
      expect(col!.enableHiding, `${id} must be hideable`).toBe(true)
    }
  })

  it('marks the acciones column as non-hideable (enableHiding: false)', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'acciones') as ColumnLike
    expect(col).toBeDefined()
    expect(col!.enableHiding).toBe(false)
  })
})

describe('usePendingApprovalsColumns — enableSorting (REQ-3, sorting deferred)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marks every column with explicit enableSorting: false', () => {
    const { columns } = usePendingApprovalsColumns()
    expect(columns.value.length).toBe(8)
    for (const col of columns.value) {
      const c = col as ColumnLike
      expect(c.enableSorting, `${getId(c)} must be non-sortable`).toBe(false)
    }
  })
})

describe('usePendingApprovalsColumns — acciones right-alignment (REQ-3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('marks the acciones column with non-hideable + non-sortable + text-right td', () => {
    const { columns } = usePendingApprovalsColumns()
    const col = columns.value.find((c) => getId(c as ColumnLike) === 'acciones') as ColumnLike
    expect(col).toBeDefined()
    expect(col!.enableSorting).toBe(false)
    expect(col!.enableHiding).toBe(false)
    expect(col!.meta?.class?.td).toBe('text-right')
  })
})