import { describe, expect, it } from 'vitest'
import {
  countEditorialReadinessFields, decodeEditorialReadiness, editorialPublicationStatus, editorialReadinessSectionCounts, isEditorialNoDraftReadiness, isEditorialReadinessCurrent,
} from '../editorial-contract-readiness'
import { document, R, state } from '../../__tests__/editorial-contract-fixtures'
import type { EditorialReadinessItem } from '../../interfaces/editorial-contract-readiness.types'

const item = (patch: Record<string, unknown> = {}) => ({ scope: 'definition', definitionCode: 'measure.net_mass', variantId: null,
  sectionCode: 'contenido-empaque', problem: 'REQUIRED_MISSING', message: 'Falta el peso neto.', ...patch })
const readiness = (patch: Record<string, unknown> = {}) => ({ ready: false, cycle: 2, draftRevision: 3, vocabularyRevision: R,
  items: [item()], bySection: { 'contenido-empaque': 1 }, ...patch })

describe('decodeEditorialReadiness', () => {
  it('reads the handoff example and a ready draft', () => {
    expect(decodeEditorialReadiness(readiness())).toEqual(readiness())
    expect(decodeEditorialReadiness(readiness({ ready: true, items: [], bySection: {} }))?.ready).toBe(true)
  })
  it('keeps an unknown problem code: problem is an open string', () => {
    expect(decodeEditorialReadiness(readiness({ items: [item({ problem: 'SOMETHING_NEW', message: 'Algo nuevo.' })] }))?.items[0]?.problem).toBe('SOMETHING_NEW')
  })
  it.each(['variant', 'product', 'care'])('accepts the %s scope', scope => {
    expect(decodeEditorialReadiness(readiness({ items: [item({ scope, definitionCode: null, sectionCode: null })], bySection: {} }))).not.toBeNull()
  })
  it.each([
    ['an unknown scope', { items: [item({ scope: 'media' })] }],
    ['a missing message', { items: [{ ...item(), message: undefined }] }],
    ['a blank message', { items: [item({ message: '  ' })] }],
    ['a negative section count', { bySection: { x: -1 } }],
    ['an extra key', { extra: 1 }],
    ['ready with items', { ready: true }],
    ['a bad vocabulary revision', { vocabularyRevision: 'r1' }],
  ])('rejects %s', (_label, patch) => {
    expect(decodeEditorialReadiness(readiness(patch))).toBeNull()
  })
  it('reads «no saved draft»', () => {
    const none = decodeEditorialReadiness(readiness({ draftRevision: null, items: [item({ scope: 'product', definitionCode: null, sectionCode: null, problem: 'NO_DRAFT', message: 'Todavía no hay un borrador guardado.' })], bySection: {} }))!
    expect(isEditorialNoDraftReadiness(none)).toBe(true)
    expect(isEditorialNoDraftReadiness(decodeEditorialReadiness(readiness())!)).toBe(false)
  })
})

describe('isEditorialReadinessCurrent', () => {
  const decoded = decodeEditorialReadiness(readiness())!
  it('is current for the saved draft it evaluated', () => {
    expect(isEditorialReadinessCurrent(decoded, state(document(), 3), R)).toBe(true)
  })
  it('is stale for another revision, cycle or vocabulary', () => {
    expect(isEditorialReadinessCurrent(decoded, state(document(), 4), R)).toBe(false)
    expect(isEditorialReadinessCurrent(decoded, { ...state(document(), 3), cycle: 9 }, R)).toBe(false)
    expect(isEditorialReadinessCurrent(decoded, state(document(), 3), `ev2-sha256-${'b'.repeat(64)}`)).toBe(false)
  })
})

describe('editorialPublicationStatus', () => {
  const published = (doc = document()) => ({ revision: 2, document: doc })
  it('is nothing before any draft or publication', () => {
    expect(editorialPublicationStatus({ cycle: null, draft: null, published: null }, null)).toBeNull()
  })
  it('is «Borrador» with nothing published', () => {
    expect(editorialPublicationStatus(state(), null)).toEqual({ kind: 'draft', label: 'Borrador' })
  })
  it('is «Publicado» with no draft, with the date only when this session saw it', () => {
    const current = { cycle: 2, draft: null, published: published() }
    expect(editorialPublicationStatus(current, null)).toEqual({ kind: 'published', label: 'Publicado' })
    expect(editorialPublicationStatus(current, new Date(2026, 10, 4, 13, 40))).toEqual({ kind: 'published', label: 'Publicado · 4 nov' })
  })
  it('is «Publicado» when the draft equals the published document, whatever the key order', () => {
    const doc = document()
    const reordered = Object.fromEntries(Object.entries(doc).reverse()) as typeof doc
    expect(editorialPublicationStatus({ ...state(doc), published: published(reordered) }, null)?.kind).toBe('published')
  })
  it('is «Cambios sin publicar» when the draft differs', () => {
    expect(editorialPublicationStatus({ ...state({ ...document(), commercialTitle: 'Otro' }), published: published() }, null))
      .toEqual({ kind: 'changes', label: 'Cambios sin publicar' })
  })
})

describe('readiness field counts', () => {
  const items = (): EditorialReadinessItem[] => [item(), item({ problem: 'EVIDENCE_REQUIRED', message: 'Agrega de dónde sale este dato.' }), item({ variantId: 'v2' }),
    item({ definitionCode: 'food.ingredients', sectionCode: 'nutricion' }),
    item({ scope: 'care', definitionCode: null, sectionCode: null }), item({ scope: 'product', definitionCode: null, sectionCode: null })] as EditorialReadinessItem[]
  it('counts one field per (scope, definitionCode, variantId); items with no datum count once each', () => {
    expect(countEditorialReadinessFields(items())).toBe(5)
    expect(countEditorialReadinessFields([])).toBe(0)
  })
  it('per section counts distinct fields, not items', () => {
    expect(editorialReadinessSectionCounts(items())).toEqual({ 'contenido-empaque': 2, nutricion: 1 })
  })
})
