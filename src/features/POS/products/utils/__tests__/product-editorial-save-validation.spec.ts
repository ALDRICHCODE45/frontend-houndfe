import { describe, expect, it } from 'vitest'
import { validateEditorialSave } from '../product-editorial-save-validation'
import { decodeEditorialDocument } from '../product-editorial-document'
import type { EditorialDocument } from '../../interfaces/product-editorial.types'

const document = (): EditorialDocument => ({
  commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [],
})

describe('fresh editorial save validation', () => {
  it.each([
    ['commercialTitle', 200], ['description', 20000],
  ] as const)('counts %s by Unicode code points without changing history', (field, limit) => {
    const input = { ...document(), [field]: '😀'.repeat(limit) }
    expect(validateEditorialSave(input).valid).toBe(true)
    input[field] += '😀'
    expect(validateEditorialSave(input)).toEqual({ valid: false, reason: 'limits' })
    expect(decodeEditorialDocument(input).readable).toBe(true)
    expect(input[field]).toBe('😀'.repeat(limit + 1))
  })

  it.each([['mediaRefs', 20], ['values', 200]] as const)('caps %s only on fresh saves', (field, limit) => {
    const input = { ...document(), familyCode: 'family' }
    if (field === 'mediaRefs') input.mediaRefs = Array.from({ length: limit }, (_, i) => ` private:${i} `)
    else input.values = Array.from({ length: limit }, (_, i) => ({
      code: `c${i}`, owner: 'product', variantId: null, type: 'text', value: ' exact ',
    }))
    expect(validateEditorialSave(input).valid).toBe(true)
    if (field === 'mediaRefs') input.mediaRefs.push('one-more')
    else input.values.push({ code: 'extra', owner: 'product', variantId: null, type: 'boolean', value: false })
    expect(validateEditorialSave(input)).toEqual({ valid: false, reason: 'limits' })
    expect(decodeEditorialDocument(input).readable).toBe(true)
  })

  it.each([
    { commercialTitle: null },
    { ...document(), values: [{ code: 'x', owner: 'product', variantId: null, type: 'boolean', value: true }] },
    { ...document(), mediaRefs: ['same', 'same'] },
    { ...document(), familyCode: 'f', values: [
      { code: 'x', owner: 'product', variantId: null, type: 'text', value: 'a' },
      { code: 'x', owner: 'product', variantId: null, type: 'text', value: 'b' },
    ] },
    { ...document(), familyCode: 'f', values: [{ code: 'x', owner: 'product', variantId: null, type: 'number', value: Infinity, unit: null }] },
  ])('reuses structural history checks', (input) => {
    expect(validateEditorialSave(input)).toEqual({ valid: false, reason: 'structure' })
  })

  it('does not pretend to validate vocabulary or archived/context membership or normalize media', () => {
    const input = { ...document(), commercialTitle: '  exact  ', mediaRefs: [' private-ref '] }
    expect(validateEditorialSave(input)).toEqual({ valid: true, document: input })
    expect(validateEditorialSave(input)).toHaveProperty('document', input)
  })
})
