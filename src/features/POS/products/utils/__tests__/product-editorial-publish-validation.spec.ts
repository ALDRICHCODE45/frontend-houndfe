import { describe, expect, it } from 'vitest'
import type { EditorialDocument, EditorialVocabulary } from '../../interfaces/product-editorial.types'
import { validateEditorialPublish } from '../product-editorial-publish-validation'

const document = (): EditorialDocument => ({ commercialTitle: ' a ', description: null,
  mediaRefs: [], familyCode: null, values: [] })
const vocabulary: EditorialVocabulary = {
  families: [{ id: 'f', code: 'f', label: 'Family', bindings: [
    { definitionId: 'd', definitionCode: 'choice', owner: 'product', sortOrder: 0 },
  ] }],
  definitions: [{ id: 'd', code: 'choice', label: 'Choice', type: 'single', options: [
    { code: 'old', label: 'Old', archived: true, sortOrder: 0 },
  ] }],
}
function check(saved: unknown, published: unknown = null, vocab: unknown = vocabulary, context: unknown = { variants: [] }) {
  const input = { document: saved, publishedDocument: published, vocabulary: vocab, context }
  const before = JSON.stringify(input)
  const result = validateEditorialPublish(input)
  expect(JSON.stringify(input)).toBe(before)
  return result
}
const archived = (): EditorialDocument => ({ ...document(), familyCode: 'f', values: [
  { code: 'choice', owner: 'product', variantId: null, type: 'single', value: 'old' },
] })

describe('saved draft publish blockers', () => {
  it.each([null, '', '   ', ' \n', '\uFEFF\u00A0'])('rejects ECMAScript-empty title %j', commercialTitle => {
    expect(check({ ...document(), commercialTitle })).toMatchObject({ valid: false, issues: [{ code: 'title' }] })
  })
  it('accepts a spaced nonempty title without trimming or mutation', () => {
    const saved = document()
    expect(check(saved)).toEqual({ valid: true, issues: [] })
    expect(saved.commercialTitle).toBe(' a ')
  })
  it('blocks nonempty mediaRefs', () => {
    expect(check({ ...document(), mediaRefs: ['private'] })).toMatchObject({ valid: false, issues: expect.arrayContaining([{ code: 'media' }]) })
  })
  it('conserves an identical archived assignment in current Published', () => {
    expect(check(archived(), archived())).toEqual({ valid: true, issues: [] })
  })
  it('blocks archived assignments present only in the saved draft', () => {
    expect(check(archived(), document())).toEqual({ valid: false, issues: [{ code: 'archived', valueIndex: 0 }] })
  })
  it('does not conserve archived assignments without Published', () => {
    expect(check(archived())).toEqual({ valid: false, issues: [{ code: 'archived', valueIndex: 0 }] })
  })
  it.each([
    { commercialTitle: '😀'.repeat(201) }, { description: '😀'.repeat(20001) },
  ])('reuses fresh-save limits %#', change => {
    expect(check({ ...document(), ...change })).toMatchObject({ valid: false, issues: [{ code: 'limits' }] })
  })
  it.each([
    { mediaRefs: Array.from({ length: 21 }, (_, index) => `media-${index}`) },
    { familyCode: 'f', values: Array.from({ length: 201 }, (_, index) => (
      { code: `text-${index}`, owner: 'product', variantId: null, type: 'text', value: 'x' })) },
  ])('reuses fresh-save count limits for media and values %#', change => {
    expect(check({ ...document(), ...change })).toMatchObject({ valid: false,
      issues: expect.arrayContaining([{ code: 'limits' }]) })
  })
  it('reuses current vocabulary qualification', () => {
    expect(check({ ...archived(), values: [{ ...archived().values[0]!, value: 'missing' }] })).toMatchObject({ valid: false, issues: [{ code: 'option', valueIndex: 0 }] })
  })
  it('fails closed on unavailable metadata', () => {
    expect(check(document(), null, null)).toEqual({ valid: false, issues: [{ code: 'metadata' }] })
  })
  it('does not normalize unreadable saved history', () => {
    expect(check({ broken: true })).toEqual({ valid: false, issues: [{ code: 'structure' }] })
  })
})
