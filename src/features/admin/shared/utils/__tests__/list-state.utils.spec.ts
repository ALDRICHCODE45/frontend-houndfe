import { describe, expect, it } from 'vitest'
import { noMatchTitleFor } from '../list-state.utils'

describe('noMatchTitleFor', () => {
  it('names the search term', () => {
    expect(noMatchTitleFor(' caja ')).toBe('Ningún resultado para «caja»')
  })

  it('stays generic without a term', () => {
    expect(noMatchTitleFor('  ')).toBe('Ningún resultado')
  })
})
