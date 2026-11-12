import { describe, expect, it } from 'vitest'
import { applyErrorMessage, conflictHeadline, formatSavedBy, readSettingsError, saveNotice } from '../settingsErrors'
import { settingsFixture } from '../../interfaces/__tests__/chatbot-settings.fixture'

const axiosError = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })

describe('readSettingsError', () => {
  it('reads a 409 VERSION_CONFLICT with the current settings', () => {
    const current = settingsFixture({ version: 4 })
    const error = readSettingsError(axiosError(409, { statusCode: 409, code: 'VERSION_CONFLICT', current }))
    expect(error.kind).toBe('conflict')
    expect(error.current).toEqual(current)
  })

  it('a 409 without current (apply-to-all without read permission) is still a conflict', () => {
    const error = readSettingsError(axiosError(409, { statusCode: 409, code: 'VERSION_CONFLICT', message: 'x' }))
    expect(error.kind).toBe('conflict')
    expect(error.current).toBeNull()
  })

  it('ignores a current that does not match the contract', () => {
    const error = readSettingsError(axiosError(409, { code: 'VERSION_CONFLICT', current: { version: 4 } }))
    expect(error.kind).toBe('conflict')
    expect(error.current).toBeNull()
  })

  it('a current with a key this screen does not know is usable and keeps the key', () => {
    const current = { ...settingsFixture({ version: 4 }), futureField: 1 }
    const error = readSettingsError(axiosError(409, { code: 'VERSION_CONFLICT', current }))
    expect(error.kind).toBe('conflict')
    expect(error.current).toEqual(current)
  })

  it('a current with an unknown subtype is not usable', () => {
    const current = settingsFixture({ version: 4 })
    current.slas[0]!.subtype = 'NEW' as never
    const error = readSettingsError(axiosError(409, { code: 'VERSION_CONFLICT', current }))
    expect(error.current).toBeNull()
  })

  it('reads the fieldErrors of a 400 and drops malformed entries', () => {
    const error = readSettingsError(
      axiosError(400, {
        code: 'VALIDATION_ERROR',
        fieldErrors: [
          { path: 'slas[3].resolveMinutes', code: 'MUST_BE_NULL' },
          { path: 5, code: 'X' },
          { code: 'REQUIRED' },
          null,
          { path: 'closedDates[2]', code: 'INVALID_DATE' },
        ],
      }),
    )
    expect(error.kind).toBe('validation')
    expect(error.fieldErrors).toEqual([
      { path: 'slas[3].resolveMinutes', code: 'MUST_BE_NULL' },
      { path: 'closedDates[2]', code: 'INVALID_DATE' },
    ])
  })

  it('a 400 without fieldErrors (or with an empty list) has none', () => {
    expect(readSettingsError(axiosError(400, { code: 'VALIDATION_ERROR' })).fieldErrors).toEqual([])
    expect(readSettingsError(axiosError(400, { fieldErrors: [] })).fieldErrors).toEqual([])
    expect(readSettingsError(axiosError(400, { fieldErrors: 'x' })).fieldErrors).toEqual([])
    expect(readSettingsError(axiosError(500)).fieldErrors).toEqual([])
  })

  it('classifies 400, 401/403, 5xx and network errors', () => {
    expect(readSettingsError(axiosError(400, { code: 'VALIDATION_ERROR', reason: 'INVALID_OPENING_HOURS' })).kind).toBe('validation')
    expect(readSettingsError(axiosError(403, { code: 'INSUFFICIENT_PERMISSIONS' })).kind).toBe('forbidden')
    expect(readSettingsError(axiosError(401, { code: 'UNAUTHORIZED' })).kind).toBe('forbidden')
    expect(readSettingsError(axiosError(500)).kind).toBe('server')
    expect(readSettingsError(new Error('Network Error')).kind).toBe('network')
  })
})

describe('saveNotice', () => {
  it('maps recompute FAILED and PARTIAL to notices and DONE / NOT_NEEDED to none', () => {
    expect(saveNotice('FAILED')).toBe('failed')
    expect(saveNotice('PARTIAL')).toBe('partial')
    expect(saveNotice('DONE')).toBeNull()
    expect(saveNotice('NOT_NEEDED')).toBeNull()
  })
})

describe('applyErrorMessage', () => {
  it('has distinct es-MX copy per kind', () => {
    const messages = (['validation', 'forbidden', 'server', 'network', 'conflict'] as const).map(applyErrorMessage)
    expect(new Set(messages).size).toBe(5)
    expect(messages.every((m) => m.length > 10)).toBe(true)
  })
})

const ANA = { id: 'u1', displayName: 'Ana López' }
const AT = '2026-11-12T16:30:00.000Z' // 10:30 in Mexico City

describe('formatSavedBy', () => {
  it('names the person and the time in the branch zone', () => {
    const text = formatSavedBy(ANA, AT, 'America/Mexico_City')
    expect(text).toMatch(/^Guardado por Ana López · /)
    expect(text).toContain('12 nov 2026')
    expect(text).toContain('10:30')
  })

  it('shows nothing when nobody saved', () => {
    expect(formatSavedBy(null, null, 'America/Mexico_City')).toBeNull()
    expect(formatSavedBy(null, AT, 'America/Mexico_City')).toBeNull()
  })

  it('keeps the name when the time is missing, and survives a bad zone', () => {
    expect(formatSavedBy(ANA, null, 'America/Mexico_City')).toBe('Guardado por Ana López')
    expect(formatSavedBy(ANA, AT, 'Not/AZone')).toMatch(/^Guardado por Ana López · /)
    expect(formatSavedBy(ANA, 'not a date', 'America/Mexico_City')).toBe('Guardado por Ana López')
  })
})

describe('conflictHeadline', () => {
  it('names the other person and the time', () => {
    expect(conflictHeadline(ANA, AT, 'America/Mexico_City')).toBe('Ana López guardó cambios a las 10:30')
  })

  it('says «a la 1:00» for the one o\'clock hour', () => {
    expect(conflictHeadline(ANA, '2026-11-12T19:05:00.000Z', 'America/Mexico_City')).toBe('Ana López guardó cambios a las 13:05')
    expect(conflictHeadline(ANA, '2026-11-12T07:05:00.000Z', 'America/Mexico_City')).toBe('Ana López guardó cambios a la 01:05')
  })

  it('falls back to «otra persona» when current carries no author or time', () => {
    expect(conflictHeadline(null, AT, 'America/Mexico_City')).toBe('Otra persona guardó cambios a las 10:30')
    expect(conflictHeadline(ANA, null, 'America/Mexico_City')).toBe('Ana López guardó cambios antes que tú')
    expect(conflictHeadline(null, null, 'America/Mexico_City')).toBe('Otra persona guardó cambios antes que tú')
    expect(conflictHeadline({ id: 'x', displayName: '  ' }, null, 'America/Mexico_City')).toBe('Otra persona guardó cambios antes que tú')
  })
})
