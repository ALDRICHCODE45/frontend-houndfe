import { describe, expect, it } from 'vitest'
import { decodeEditorialDocument } from '../product-editorial-document'
import { editorialQueryKeys } from '../../constants/product-editorial-query-keys'

const empty = {
  commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [],
}
const assignment = { code: 'color', owner: 'product', variantId: null }

describe('historical editorial document decoding', () => {
  it('reads the complete empty document without fabricating keys', () => {
    expect(decodeEditorialDocument(empty)).toEqual({ readable: true, document: empty })
  })

  it.each([{}, null, [], { ...empty, extra: true }, { ...empty, description: undefined }])(
    'retains unreadable history verbatim: %j', (raw) => {
      expect(decodeEditorialDocument(raw)).toEqual({ readable: false, raw })
    },
  )

  it('keeps oversized history, media references and assignment order intact', () => {
    const document = {
      ...empty, commercialTitle: '😀'.repeat(201), description: 'x'.repeat(20_001),
      mediaRefs: Array.from({ length: 21 }, (_, i) => `private:${i}`), familyCode: 'family',
      values: Array.from({ length: 201 }, (_, i) => ({
        ...assignment, code: `field:${i}`, type: 'text', value: 'historical',
      })),
    }
    const result = decodeEditorialDocument(document)
    expect(result).toEqual({ readable: true, document })
    if (result.readable) expect(result.document).toBe(document)
  })

  it.each([
    { type: 'text', value: 'hello' }, { type: 'boolean', value: false },
    { type: 'number', value: 1.5, unit: null }, { type: 'number', value: -2, unit: 'kg' },
    { type: 'single', value: 'blue' }, { type: 'multi', value: ['blue', 'red'] },
  ])('reads discriminated assignment %j', (value) => {
    const document = { ...empty, familyCode: 'family', values: [{ ...assignment, ...value }] }
    expect(decodeEditorialDocument(document)).toEqual({ readable: true, document })
  })

  it.each([
    { type: 'text', value: true }, { type: 'boolean', value: 'false' },
    { type: 'number', value: 1 }, { type: 'number', value: Infinity, unit: null },
    { type: 'single', value: ['blue'] }, { type: 'multi', value: ['blue', 'blue'] },
    { type: 'text', value: 'x', unit: null }, { type: 'unknown', value: 'x' },
  ])('does not reinterpret malformed assignment %j', (value) => {
    const raw = { ...empty, familyCode: 'family', values: [{ ...assignment, ...value }] }
    expect(decodeEditorialDocument(raw)).toEqual({ readable: false, raw })
  })

  it('rejects duplicate references/tuples and null family assignments structurally', () => {
    const value = { ...assignment, type: 'text', value: 'x' }
    for (const raw of [
      { ...empty, mediaRefs: ['a', 'a'] },
      { ...empty, values: [value] },
      { ...empty, familyCode: 'f', values: [value, value] },
      { ...empty, familyCode: 'f', values: [{ ...value, variantId: 'variant' }] },
    ]) expect(decodeEditorialDocument(raw)).toEqual({ readable: false, raw })
  })

  it('preserves orphaned sellable values without inferring qualified variants', () => {
    const document = { ...empty, familyCode: 'archived-family', values: [
      { ...assignment, owner: 'sellable', variantId: 'orphan', type: 'single', value: 'archived' },
    ] }
    expect(decodeEditorialDocument(document)).toEqual({ readable: true, document })
  })
})

describe('editorial query identity', () => {
  it('separates product, tenant, authenticated scope, and vocabulary', () => {
    const scope = { tenantId: 't', authScope: 'session-a' }
    const key = editorialQueryKeys.state(scope, 'p')
    expect(key).toEqual(editorialQueryKeys.state({ ...scope }, 'p'))
    expect(key).not.toEqual(editorialQueryKeys.state(scope, 'other'))
    expect(key).not.toEqual(editorialQueryKeys.state({ ...scope, tenantId: 'other' }, 'p'))
    expect(key).not.toEqual(editorialQueryKeys.state({ ...scope, authScope: 'session-b' }, 'p'))
    expect(editorialQueryKeys.vocabulary(scope)).not.toEqual(key)
    expect(editorialQueryKeys.vocabulary(scope)).not.toEqual(
      editorialQueryKeys.vocabulary({ ...scope, authScope: 'session-b' }),
    )
  })
})
