import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialFamily } from '../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentEditingRow } from './editorial-contract-document-editing'
import type { EditorialFactsEditingState } from './editorial-contract-facts-editing'
import { buildEditorialAttributeTable, isEditorialRowComplete, type EditorialAttributeTable, type EditorialTableCell,
  type EditorialTableRow, type EditorialTableSubject } from './editorial-attribute-table'

/** One card of the family's data: a vocabulary section, or a fallback for data with none. */
export type EditorialContentSection = {
  /** DOM id of the card, the HfSectionNav target. */
  id: string
  /** The vocabulary section code; null for the «Otros datos» and «Datos» fallbacks. */
  code: string | null
  label: string
  rows: EditorialTableRow[]
  /** Fields still to answer, across every presentation (the table's row-completeness rule). */
  missing: number
  /** Some field of the section is answered per presentation. */
  perPresentation: boolean
}
export type EditorialContentSections = { table: EditorialAttributeTable; sections: EditorialContentSection[]; missing: number }

// Fallback names of the FE, never a vocabulary label: data with no known section, or a family with no sections.
const OTHER = 'Otros datos'
const ALL = 'Datos'
const domId = (code: string | null, fallback: string) => `editorial-section-${code === null ? `-${fallback}` : code.replace(/[^\w-]/g, '_')}`

/**
 * The family's data grouped into the sections of the vocabulary (L75). Sections follow their
 * sortOrder, and the data inside one its sectionSortOrder, then the table's label order. Data with
 * no known section closes in «Otros datos»; a family with no sections at all has one «Datos».
 * A section with no data is not shown. Counts reuse the table: a field is complete once each of
 * its presentations has a value or an explicit special answer.
 */
export function buildEditorialContentSections(input: {
  family: EditorialFamily | null
  definitions: readonly EditorialDefinition[]
  values: readonly EditorialAssignmentEditingRow[]
  subjects: readonly EditorialTableSubject[]
  facts?: EditorialFactsEditingState
}): EditorialContentSections {
  const table = buildEditorialAttributeTable(input)
  const family = input.family
  if (!family) return { table, sections: [], missing: 0 }
  const declared = [...(family.sections ?? [])].sort((left, right) => left.sortOrder - right.sortOrder)
  const known = new Set(declared.map(section => section.code))
  const order = (row: EditorialTableRow) => row.sectionSortOrder ?? Number.POSITIVE_INFINITY
  const byOrder = (rows: EditorialTableRow[]) => rows.map((row, index) => ({ row, index }))
    .sort((left, right) => order(left.row) - order(right.row) || left.index - right.index).map(entry => entry.row)
  const make = (code: string | null, label: string, rows: EditorialTableRow[], fallback = ''): EditorialContentSection => ({
    id: domId(code, fallback), code, label, rows,
    missing: rows.filter(row => !isEditorialRowComplete(row)).length,
    perPresentation: rows.some(row => row.owner === 'sellable'),
  })
  const sections: EditorialContentSection[] = []
  if (!declared.length) {
    if (table.rows.length) sections.push(make(null, ALL, byOrder(table.rows), 'all'))
  } else {
    for (const section of declared) {
      const rows = table.rows.filter(row => row.sectionCode === section.code)
      if (rows.length) sections.push(make(section.code, section.label.trim(), byOrder(rows)))
    }
    const rest = table.rows.filter(row => row.sectionCode === null || !known.has(row.sectionCode))
    if (rest.length) sections.push(make(null, OTHER, byOrder(rest), 'other'))
  }
  return { table, sections, missing: sections.reduce((sum, section) => sum + section.missing, 0) }
}

/** The cell a field edits: the product's for product data, else the chosen presentation's. */
export function editorialRowCell(table: Pick<EditorialAttributeTable, 'columns'>, row: Pick<EditorialTableRow, 'cells' | 'owner'>, variantId: string | null): EditorialTableCell | null {
  const index = table.columns.findIndex(column => column.owner === row.owner && (row.owner === 'product' || column.variantId === variantId))
  return index < 0 ? null : row.cells[index] ?? null
}
