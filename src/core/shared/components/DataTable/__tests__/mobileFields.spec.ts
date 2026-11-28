import { describe, expect, it } from 'vitest'
import type { TableColumn } from '../../../types/table.types'
import { hasMobileFields, resolveMobileRow, sortOptionValue, findSortOption } from '../mobileFields'

// mobile-tables T3 (S4): the column meta that drives the mobile rows (A) and cards (B).
type Sale = { id: string; folio: string; customer: string; total: number; debt: number; status: string }
const sale: Sale = { id: 's1', folio: 'V-10482', customer: 'Rodrigo Salinas Cantú', total: 124500, debt: 0, status: 'PAID' }
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

const columns: TableColumn<Sale>[] = [
  { id: 'select', header: 'Selección' },
  {
    accessorKey: 'folio',
    header: 'Venta',
    meta: { mobile: [{ role: 'lead', icon: 'i-lucide-receipt' }, { role: 'primary' }] },
  },
  { accessorKey: 'customer', header: 'Cliente', meta: { mobile: { role: 'secondary' } } },
  {
    accessorKey: 'total',
    header: 'Total',
    meta: {
      mobile: [
        { role: 'figure', value: row => money(row.total) },
        { role: 'stat', label: 'Total', value: row => money(row.total) },
      ],
    },
  },
  {
    accessorKey: 'debt',
    header: 'Saldo',
    meta: {
      mobile: [
        { role: 'figureNote', value: row => (row.debt > 0 ? `Saldo ${money(row.debt)}` : null), tone: () => 'warning' },
        { role: 'stat', value: row => money(row.debt), tone: row => (row.debt > 0 ? 'warning' : 'muted'), note: () => 'al día' },
      ],
    },
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    meta: { mobile: { role: 'status', value: () => 'Pagada', tone: () => 'success' } },
  },
  { id: 'actions', header: 'Acciones' },
]

describe('resolveMobileRow — roles from column meta', () => {
  it('maps every role to its field, with the accessor value as the default text', () => {
    const model = resolveMobileRow(columns, sale, 0)
    expect(model.lead).toMatchObject({ id: 'folio', icon: 'i-lucide-receipt', text: 'V-10482' })
    expect(model.primary).toMatchObject({ id: 'folio', text: 'V-10482' })
    expect(model.secondary.map(field => field.text)).toEqual(['Rodrigo Salinas Cantú'])
    expect(model.figure).toMatchObject({ id: 'total', text: '$1245.00' })
    // A field whose value is null is not shown at all.
    expect(model.figureNote).toBeUndefined()
    expect(model.status).toEqual([expect.objectContaining({ text: 'Pagada', tone: 'success' })])
  })

  it('gives stats their caption (the column label by default), tone and note', () => {
    const model = resolveMobileRow(columns, sale, 0)
    expect(model.stats).toEqual([
      expect.objectContaining({ id: 'total', label: 'Total', text: '$1245.00' }),
      expect.objectContaining({ id: 'debt', label: 'Saldo', text: '$0.00', tone: 'muted', note: 'al día' }),
    ])
  })

  it('reads a tone per row', () => {
    const model = resolveMobileRow(columns, { ...sale, debt: 50000 }, 0)
    expect(model.figureNote).toMatchObject({ text: 'Saldo $500.00', tone: 'warning' })
  })

  it('drops hidden columns from the card fields when visibility is honoured, never the primary', () => {
    const visibility = { folio: false, debt: false, status: false }
    const model = resolveMobileRow(columns, sale, 0, { visibility, honourVisibility: true })
    expect(model.primary?.text).toBe('V-10482')
    expect(model.stats.map(field => field.id)).toEqual(['total'])
    expect(model.status).toEqual([])
    // Rows (A) keep their fixed anatomy whatever the desktop visibility says.
    expect(resolveMobileRow(columns, sale, 0, { visibility }).status).toHaveLength(1)
  })

  it('falls back to the first data column as the name when no column declares a mobile role', () => {
    const plain: TableColumn<Sale>[] = [
      { id: 'select', header: 'Selección' },
      { accessorKey: 'customer', header: 'Cliente' },
      { accessorKey: 'folio', header: 'Venta' },
    ]
    expect(hasMobileFields(plain)).toBe(false)
    expect(hasMobileFields(columns)).toBe(true)
    const model = resolveMobileRow(plain, sale, 0)
    expect(model.primary?.text).toBe('Rodrigo Salinas Cantú')
    expect(model.secondary).toEqual([])
  })

  it('uses accessorFn when the column has one', () => {
    const fn: TableColumn<Sale>[] = [
      { id: 'who', accessorFn: row => row.customer.toUpperCase(), header: 'Cliente', meta: { mobile: { role: 'primary' } } },
    ]
    expect(resolveMobileRow(fn, sale, 0).primary?.text).toBe('RODRIGO SALINAS CANTÚ')
  })
})

describe('sort options', () => {
  const options = [
    { label: 'Más recientes', value: 'confirmedAt:desc' },
    { label: 'Total mayor a menor', value: 'totalCents:desc' },
  ]
  it('turns the sorting state into an option value and back', () => {
    expect(sortOptionValue([{ id: 'totalCents', desc: true }])).toBe('totalCents:desc')
    expect(sortOptionValue([])).toBeUndefined()
    expect(findSortOption(options, [{ id: 'totalCents', desc: true }])?.label).toBe('Total mayor a menor')
    expect(findSortOption(options, [{ id: 'folio', desc: false }])).toBeUndefined()
  })
})
