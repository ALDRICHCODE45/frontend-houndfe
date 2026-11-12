import { describe, expect, it } from 'vitest'
import { applyErrorMessage, readSettingsError, saveNotice } from '../settingsErrors'
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
