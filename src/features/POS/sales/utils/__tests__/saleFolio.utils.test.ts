import { describe, it, expect } from 'vitest'
import { extractFolioNumber } from '../saleFolio.utils'

describe('saleFolio.utils', () => {
  it('extracts sequential number from folio and prefixes it with #', () => {
    expect(extractFolioNumber('A-202605-000012')).toBe('#12')
  })

  it('removes leading zeros from folio sequence', () => {
    expect(extractFolioNumber('A-202605-000001')).toBe('#1')
  })

  it('returns fallback #0 when folio format is invalid', () => {
    expect(extractFolioNumber('BAD-FOLIO')).toBe('#0')
  })
})
