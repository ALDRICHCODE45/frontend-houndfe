import { describe, expect, it } from 'vitest'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES } from '../../interfaces/editorial-production-codes'
import { EDITORIAL_LONG_TEXT_CODES, isEditorialLongText } from '../editorial-long-text'

// The vocabulary has no maxLength or text kind, so long text is decided by
// definition code (never by label): the four texts written as paragraphs today.
describe('editorial long text', () => {
  it('is exactly ingredients, composition, usage instructions, clinical analysis, manufacturer care and regulatory warnings', () => {
    expect([...EDITORIAL_LONG_TEXT_CODES].sort()).toEqual(['text.clinical_analysis', 'text.composition', 'text.ingredients', 'text.instructions', 'text.manufacturer_care', 'text.regulatory_warnings'])
    for (const code of EDITORIAL_LONG_TEXT_CODES) expect(EDITORIAL_PRODUCTION_DEFINITION_CODES).toContain(code)
  })

  it('answers by the code of a text definition', () => {
    expect(isEditorialLongText({ code: 'text.ingredients', type: 'text' })).toBe(true)
    expect(isEditorialLongText({ code: 'text.protein_origin', type: 'text' })).toBe(false)
    expect(isEditorialLongText({ code: 'text.concentration', type: 'text' })).toBe(false)
    expect(isEditorialLongText({ code: 'text.ingredients', type: 'single' })).toBe(false)
  })
})
