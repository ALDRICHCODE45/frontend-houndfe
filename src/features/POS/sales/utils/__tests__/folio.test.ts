import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatFolioForBackend } from '../folio'

describe('formatFolioForBackend', () => {
  afterEach(() => vi.useRealTimers())

  it('formats numeric folio with current YYYYMM and 6-digit suffix', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'))
    expect(formatFolioForBackend('16')).toBe('A-202605-000016')
    expect(formatFolioForBackend('#16')).toBe('A-202605-000016')
  })

  it('passes full folio through unchanged', () => {
    expect(formatFolioForBackend('A-202605-000016')).toBe('A-202605-000016')
    expect(formatFolioForBackend('A-202506-000123')).toBe('A-202506-000123')
  })

  it('passes invalid token through and empties blank token', () => {
    expect(formatFolioForBackend('invalid')).toBe('invalid')
    expect(formatFolioForBackend('')).toBe('')
  })
})
