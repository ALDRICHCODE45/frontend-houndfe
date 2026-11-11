import { describe, expect, it } from 'vitest'
import { useCatalogFilterDraft } from '../useCatalogFilterDraft'

describe('useCatalogFilterDraft', () => {
  it('copies the committed selection on reset and never mutates the source', () => {
    const source = { categoryId: 'c-1', tokens: ['a:1'] }
    const draft = useCatalogFilterDraft()
    draft.reset(source)
    draft.toggleFacet(['b:1'])
    expect(draft.tokens.value).toEqual(['a:1', 'b:1'])
    expect(source.tokens).toEqual(['a:1'])
    expect(draft.isDirty.value).toBe(true)
  })

  it('toggles a category as a single choice and a merged option as a set of tokens', () => {
    const draft = useCatalogFilterDraft()
    draft.reset({ categoryId: null, tokens: [] })
    draft.toggleCategory('c-1')
    expect(draft.categoryId.value).toBe('c-1')
    draft.toggleCategory('c-2')
    expect(draft.categoryId.value).toBe('c-2')
    draft.toggleCategory('c-2')
    expect(draft.categoryId.value).toBeNull()
    draft.toggleFacet(['x:1', 'x:2'])
    draft.toggleFacet(['x:1', 'x:2'])
    expect(draft.tokens.value).toEqual([])
    expect(draft.isDirty.value).toBe(false)
  })

  it('removes a chip and clears everything', () => {
    const draft = useCatalogFilterDraft()
    draft.reset({ categoryId: 'c-1', tokens: ['a:1', 'b:1', 'b:2'] })
    expect(draft.activeCount(2)).toBe(3)
    draft.removeTokens(['b:1', 'b:2'])
    expect(draft.tokens.value).toEqual(['a:1'])
    draft.clear()
    expect(draft.categoryId.value).toBeNull()
    expect(draft.tokens.value).toEqual([])
  })
})
