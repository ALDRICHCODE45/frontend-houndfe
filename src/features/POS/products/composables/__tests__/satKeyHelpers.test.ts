/**
 * Pure-helper tests for SatKeySelect — zero mocks.
 *
 * The component and composable in this feature rely on these helpers for
 * the option label format, the current-key merge, and the search-state
 * derivation. Testing them directly (no vue, no network) keeps the TDD
 * loop tight and the helpers reusable.
 *
 * Requirements covered: R3 (label format, v-model key-only), R4
 * (distinct states), R5 (total-count hint), R6 (edit-mode hydration).
 */
import { describe, it, expect } from 'vitest'
import {
  formatSatKeyLabel,
  buildSatKeyOptions,
  mergeCurrentKeyOption,
  deriveSearchState,
} from '../useSatKeySearch'
// The composable re-exports the pure helpers for ergonomic single-import
// consumption. The test exercises them through that public surface.

describe('formatSatKeyLabel', () => {
  it('joins key and description with an em-dash separator', () => {
    expect(formatSatKeyLabel('12345678', 'Servicios')).toBe('12345678 — Servicios')
  })

  it('preserves the key exactly as provided (8 digits or any string)', () => {
    expect(formatSatKeyLabel('00000001', 'Medicamentos')).toBe('00000001 — Medicamentos')
  })

  it('returns a description-only fallback when key is empty', () => {
    expect(formatSatKeyLabel('', 'Algo')).toBe('Algo')
  })
})

describe('buildSatKeyOptions', () => {
  it('maps each SatKey to { value: key, label: "key — description" }', () => {
    const options = buildSatKeyOptions([
      { key: '12345678', description: 'Servicios' },
      { key: '87654321', description: 'Comida' },
    ])

    expect(options).toEqual([
      { value: '12345678', label: '12345678 — Servicios' },
      { value: '87654321', label: '87654321 — Comida' },
    ])
  })

  it('returns an empty array for an empty items list', () => {
    expect(buildSatKeyOptions([])).toEqual([])
  })
})

describe('mergeCurrentKeyOption', () => {
  it('prepends the current option when missing from results', () => {
    const result = mergeCurrentKeyOption(
      [{ value: '11111111', label: '11111111 — Foo' }],
      { value: '99999999', label: '99999999 — Bar' },
    )

    expect(result).toEqual([
      { value: '99999999', label: '99999999 — Bar' },
      { value: '11111111', label: '11111111 — Foo' },
    ])
  })

  it('keeps order unchanged when the current key is already in results', () => {
    const result = mergeCurrentKeyOption(
      [
        { value: '11111111', label: '11111111 — Foo' },
        { value: '99999999', label: '99999999 — Bar' },
      ],
      { value: '99999999', label: '99999999 — Bar' },
    )

    expect(result).toEqual([
      { value: '11111111', label: '11111111 — Foo' },
      { value: '99999999', label: '99999999 — Bar' },
    ])
  })

  it('returns the original options when the current is null', () => {
    const options = [{ value: '1', label: '1 — a' }]
    expect(mergeCurrentKeyOption(options, null)).toBe(options)
  })
})

describe('deriveSearchState', () => {
  it('returns "idle" when the search term is empty or whitespace', () => {
    expect(deriveSearchState({ term: '', isLoading: false, items: [] })).toBe('idle')
    expect(deriveSearchState({ term: '   ', isLoading: false, items: [] })).toBe('idle')
  })

  it('returns "loading" when fetching with a valid term', () => {
    expect(deriveSearchState({ term: '12', isLoading: true, items: [] })).toBe('loading')
  })

  it('returns "no-matches" when the term is valid and items is empty', () => {
    expect(deriveSearchState({ term: 'zzzzz', isLoading: false, items: [] })).toBe('no-matches')
  })

  it('returns "results" when there are items to render', () => {
    expect(
      deriveSearchState({
        term: '12',
        isLoading: false,
        items: [{ key: '12345678', description: 'X' }],
      }),
    ).toBe('results')
  })

  it('prioritizes "loading" over "no-matches" when a request is in-flight', () => {
    expect(deriveSearchState({ term: 'ab', isLoading: true, items: [] })).toBe('loading')
  })
})
