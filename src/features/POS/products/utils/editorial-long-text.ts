import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialProductionDefinitionCode } from '../interfaces/editorial-production-codes'

/** Text definitions written as paragraphs; every other text is one line. The vocabulary carries
 * no maxLength or text kind, so the rule lives here, by definition code (never by label). */
export const EDITORIAL_LONG_TEXT_CODES: readonly EditorialProductionDefinitionCode[] = Object.freeze([
  'text.ingredients',
  'text.composition',
  'text.instructions',
  'text.clinical_analysis',
  'text.manufacturer_care',
  'text.regulatory_warnings',
])

export function isEditorialLongText(definition: Pick<EditorialDefinition, 'code' | 'type'>): boolean {
  return definition.type === 'text' && EDITORIAL_LONG_TEXT_CODES.some(code => code === definition.code)
}
