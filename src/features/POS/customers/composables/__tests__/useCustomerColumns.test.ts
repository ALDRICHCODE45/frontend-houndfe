import { describe, expect, it } from 'vitest'
import { columnLabel } from '@/core/shared/components/DataTable/columnLayout.utils'
import {
  CUSTOMERS_DEFAULT_COLUMN_VISIBILITY,
  CUSTOMERS_MONEY_COLUMN_IDS,
  formatPetMatchHint,
  useCustomerColumns,
} from '../useCustomerColumns'

type Column = {
  id?: string
  accessorKey?: string
  size?: number
  enableSorting?: boolean
  enableHiding?: boolean
  meta?: { primary?: boolean; class?: { th?: string; td?: string } }
}

const keyOf = (column: Column) => column.id ?? column.accessorKey

describe('useCustomerColumns (customers-module T6)', () => {
  const columns = useCustomerColumns({ canReadSales: true }).columns as Column[]

  it('shows 7 data columns by default plus ⋮: Cliente, Deuda, Vencido desde, Última compra, Total comprado, Mascotas, Lista de precios', () => {
    const visible = columns.filter((column) => CUSTOMERS_DEFAULT_COLUMN_VISIBILITY[keyOf(column)!] !== false)
    expect(visible.map(keyOf)).toEqual([
      'name',
      'openDebt',
      'oldestOverdue',
      'lastPurchaseAt',
      'totalSold',
      'pets',
      'priceList',
      'actions',
    ])
    expect(visible.map((column) => columnLabel(column as never))).toEqual([
      'Cliente',
      'Deuda',
      'Vencido desde',
      'Última compra',
      'Total comprado',
      'Mascotas',
      'Lista de precios',
      'Acciones',
    ])
  })

  it('keeps Correo, Colonia y ciudad, RFC, Alta, Compras, Ticket promedio and De confianza in «Columnas»', () => {
    const hidden = columns.filter((column) => CUSTOMERS_DEFAULT_COLUMN_VISIBILITY[keyOf(column)!] === false)
    expect(hidden.map((column) => columnLabel(column as never))).toEqual([
      'Correo',
      'Colonia y ciudad',
      'RFC',
      'Alta',
      'Compras',
      'Ticket promedio',
      'De confianza',
    ])
  })

  it('makes sortable only what GET /customers/listing can order by, with the column id as sortBy', () => {
    const sortable = columns.filter((column) => column.enableSorting).map(keyOf)
    expect(sortable).toEqual([
      'name',
      'openDebt',
      'oldestOverdue',
      'lastPurchaseAt',
      'totalSold',
      'createdAt',
      'salesCount',
      'averageTicket',
    ])
    for (const column of columns) expect(typeof column.enableSorting).toBe('boolean')
  })

  it('keeps the name as the primary, always-visible column and the ⋮ column last', () => {
    const name = columns[0]!
    expect(name.meta?.primary).toBe(true)
    expect(name.enableHiding).toBe(false)
    const actions = columns[columns.length - 1]!
    expect(actions.id).toBe('actions')
    expect(actions.enableSorting).toBe(false)
    expect(actions.enableHiding).toBe(false)
    expect(actions.meta?.class?.td).toContain('text-right')
  })

  it('has no selection column: nothing acts on a selection yet (bulk actions are «Después»)', () => {
    expect(columns.find((column) => column.id === 'select')).toBeUndefined()
  })

  it('without read:Sale drops every money and purchase column', () => {
    const limited = (useCustomerColumns({ canReadSales: false }).columns as Column[]).map(keyOf)
    expect(CUSTOMERS_MONEY_COLUMN_IDS).toEqual([
      'openDebt',
      'oldestOverdue',
      'lastPurchaseAt',
      'totalSold',
      'salesCount',
      'averageTicket',
    ])
    for (const id of CUSTOMERS_MONEY_COLUMN_IDS) expect(limited).not.toContain(id)
    expect(limited).toEqual(['name', 'pets', 'priceList', 'email', 'location', 'rfc', 'createdAt', 'isTrusted', 'actions'])
  })

  it('formats the pet-match hint «Bruno (mascota de Ana Pérez)» only when a pet matched', () => {
    expect(formatPetMatchHint({ fullName: 'Ana Pérez', matchedPetName: 'Bruno' })).toBe('Bruno (mascota de Ana Pérez)')
    expect(formatPetMatchHint({ fullName: 'Ana Pérez', matchedPetName: null })).toBeNull()
    expect(formatPetMatchHint({ fullName: 'Ana Pérez' })).toBeNull()
  })
})
