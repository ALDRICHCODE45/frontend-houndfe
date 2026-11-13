import { describe, expect, it } from 'vitest'
import {
  deniedActionReason,
  isStaleCustomerKeyError,
  readRequestError,
  requestErrorMessage,
} from '../requestErrors'

function axiosError(status: number, data: Record<string, unknown>) {
  return { response: { status, data } }
}

describe('readRequestError', () => {
  it('keeps the shared envelope (status, code, message, fieldErrors)', () => {
    const error = readRequestError(axiosError(409, { statusCode: 409, code: 'REQUEST_CLOSED', message: 'x' }))
    expect(error).toMatchObject({ status: 409, code: 'REQUEST_CLOSED', message: 'x', fieldErrors: {} })
  })

  it('exposes current (version, status, claimedBy)', () => {
    const error = readRequestError(
      axiosError(409, {
        code: 'REQUEST_CLAIMED_BY_OTHER',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: { id: 'u1', displayName: 'Luis' } },
      }),
    )
    expect(error.current).toEqual({
      version: 5,
      status: 'IN_PROGRESS',
      claimedBy: { id: 'u1', displayName: 'Luis' },
    })
    expect(error.zoneImpact).toBeNull()
  })

  it('exposes current.zoneImpact on ZONE_SET_CHANGED', () => {
    const error = readRequestError(
      axiosError(409, {
        code: 'ZONE_SET_CHANGED',
        current: { version: 3, status: 'NEW', claimedBy: null, zoneImpact: { requests: 5, customers: 4, setVersion: 8 } },
      }),
    )
    expect(error.current?.zoneImpact).toEqual({ requests: 5, customers: 4, setVersion: 8 })
    expect(error.zoneImpact).toEqual({ requests: 5, customers: 4, setVersion: 8 })
  })

  it('exposes intoRequestId of a target-side merge 409', () => {
    const error = readRequestError(
      axiosError(409, { code: 'VERSION_CONFLICT', current: { version: 9 }, intoRequestId: 'req-9' }),
    )
    expect(error.intoRequestId).toBe('req-9')
  })

  it('has current null when the body has none (permission 403, bad key 400, network)', () => {
    expect(readRequestError(axiosError(403, { code: 'INSUFFICIENT_PERMISSIONS' })).current).toBeNull()
    expect(readRequestError(new Error('Network Error')).current).toBeNull()
    expect(readRequestError(new Error('Network Error')).status).toBeNull()
    expect(readRequestError(undefined).current).toBeNull()
  })

  it('ignores a malformed current instead of throwing', () => {
    const error = readRequestError(
      axiosError(409, {
        code: 'VERSION_CONFLICT',
        current: { version: 'x', status: 7, claimedBy: 'Luis', zoneImpact: { requests: 'a' } },
      }),
    )
    expect(error.current).toEqual({})
    expect(readRequestError(axiosError(409, { code: 'VERSION_CONFLICT', current: 'oops' })).current).toBeNull()
  })
})

describe('requestErrorMessage (es-MX, switches on code, never on message)', () => {
  const cases: Array<[string, number]> = [
    ['VERSION_CONFLICT', 409],
    ['REQUEST_CLAIMED_BY_OTHER', 409],
    ['REQUEST_CLOSED', 409],
    ['CANCEL_NOT_ALLOWED', 422],
    ['IDEMPOTENCY_CONFLICT', 409],
    ['MERGE_NOT_ALLOWED', 422],
    ['ZONE_SET_CHANGED', 409],
    ['NOT_ASSIGNEE', 403],
    ['INSUFFICIENT_PERMISSIONS', 403],
    ['ACTION_NOT_ALLOWED', 422],
    ['USER_NOT_ASSIGNABLE', 422],
    ['CUSTOMER_PHONE_MISMATCH', 422],
    ['VALIDATION_ERROR', 400],
    ['NOT_FOUND', 404],
  ]

  it.each(cases)('has copy for %s that ignores the backend message', (code, status) => {
    const message = requestErrorMessage(axiosError(status, { code, message: 'ENGLISH BACKEND TEXT' }))
    expect(message.length).toBeGreaterThan(10)
    expect(message).not.toContain('ENGLISH')
    expect(message).not.toContain(code)
  })

  it('has distinct copy for each typed code', () => {
    const messages = cases.map(([code, status]) => requestErrorMessage(axiosError(status, { code })))
    expect(new Set(messages).size).toBe(cases.length)
  })

  it('REQUEST_CLAIMED_BY_OTHER names the holder from current', () => {
    const message = requestErrorMessage(
      axiosError(409, {
        code: 'REQUEST_CLAIMED_BY_OTHER',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: { id: 'u', displayName: 'Luis Ortega' } },
      }),
    )
    expect(message).toContain('Luis Ortega')
    expect(message).toContain('ya tomó')
  })

  it('REQUEST_CLAIMED_BY_OTHER without a holder still reads well', () => {
    const message = requestErrorMessage(axiosError(409, { code: 'REQUEST_CLAIMED_BY_OTHER' }))
    expect(message).toContain('Otra persona')
    expect(message).not.toContain('undefined')
    expect(message).not.toContain('null')
  })

  it('ZONE_SET_CHANGED shows the new impact from current.zoneImpact', () => {
    const message = requestErrorMessage(
      axiosError(409, {
        code: 'ZONE_SET_CHANGED',
        current: { zoneImpact: { requests: 5, customers: 4, setVersion: 8 } },
      }),
    )
    expect(message).toContain('5 solicitudes')
    expect(message).toContain('4 clientes')
  })

  it('ZONE_SET_CHANGED singular and without impact', () => {
    expect(
      requestErrorMessage(
        axiosError(409, { code: 'ZONE_SET_CHANGED', current: { zoneImpact: { requests: 1, customers: 1, setVersion: 2 } } }),
      ),
    ).toContain('1 solicitud de 1 cliente')
    expect(requestErrorMessage(axiosError(409, { code: 'ZONE_SET_CHANGED' }))).toContain('código postal')
  })

  it('falls back by status for unknown codes, network and 5xx', () => {
    expect(requestErrorMessage(new Error('Network Error'))).toContain('conectar')
    expect(requestErrorMessage(axiosError(500, { code: 'INTERNAL_ERROR' }))).toContain('Reintenta')
    expect(requestErrorMessage(axiosError(401, {}))).toContain('sesión')
    expect(requestErrorMessage(axiosError(403, { code: 'FORBIDDEN' }))).toContain('sucursal')
    expect(requestErrorMessage(axiosError(400, { code: 'RANGE_TOO_LARGE' }))).toContain('92 días')
    expect(requestErrorMessage(axiosError(418, { code: 'SOMETHING_NEW' }))).toContain('No se pudo')
  })

  it('accepts an already-read error', () => {
    const read = readRequestError(axiosError(409, { code: 'REQUEST_CLOSED' }))
    expect(requestErrorMessage(read)).toBe(requestErrorMessage(axiosError(409, { code: 'REQUEST_CLOSED' })))
  })
})

describe('isStaleCustomerKeyError', () => {
  it('is a 400 VALIDATION_ERROR (stale token or cursor: reload, never retry)', () => {
    expect(isStaleCustomerKeyError(axiosError(400, { code: 'VALIDATION_ERROR' }))).toBe(true)
  })

  it('is not any other error', () => {
    expect(isStaleCustomerKeyError(axiosError(400, { code: 'RANGE_TOO_LARGE' }))).toBe(false)
    expect(isStaleCustomerKeyError(axiosError(404, { code: 'NOT_FOUND' }))).toBe(false)
    expect(isStaleCustomerKeyError(axiosError(409, { code: 'VALIDATION_ERROR' }))).toBe(false)
    expect(isStaleCustomerKeyError(new Error('Network Error'))).toBe(false)
  })
})

describe('deniedActionReason (why a button is missing)', () => {
  it('INSUFFICIENT_PERMISSIONS', () => {
    expect(deniedActionReason('INSUFFICIENT_PERMISSIONS')).toBe('No tienes permiso para hacerlo.')
  })

  it('REQUEST_CLAIMED_BY_OTHER reads «La atiende X»', () => {
    expect(deniedActionReason('REQUEST_CLAIMED_BY_OTHER', { id: 'u', displayName: 'Luis Ortega' })).toBe(
      'La atiende Luis Ortega.',
    )
  })

  it('REQUEST_CLAIMED_BY_OTHER without an assignee does not print undefined', () => {
    expect(deniedActionReason('REQUEST_CLAIMED_BY_OTHER', null)).toBe('La atiende otra persona.')
    expect(deniedActionReason('REQUEST_CLAIMED_BY_OTHER')).toBe('La atiende otra persona.')
  })

  it('NOT_ASSIGNEE and CANCEL_NOT_ALLOWED', () => {
    expect(deniedActionReason('NOT_ASSIGNEE')).toBe('Solo quien la atiende puede hacerlo.')
    expect(deniedActionReason('CANCEL_NOT_ALLOWED')).toBe('Esta solicitud no se puede cancelar.')
  })
})

describe('codes of the reply, finish and live conversation (T7a)', () => {
  const GENERIC = 'No se pudo completar la acción. Intenta de nuevo.'
  const cases: Array<[number, string, RegExp]> = [
    [422, 'COMPLAINT_OUTCOME_REQUIRED', /queja/i],
    [409, 'SESSION_NOT_ACTIVE', /conversación/i],
    [409, 'STALE_EPOCH', /cambió/i],
    [409, 'WINDOW_CLOSED', /24 h/],
    [409, 'WINDOW_OPEN', /24 h/],
    [422, 'TEMPLATE_NOT_CONFIGURED', /plantilla/i],
    [409, 'TEMPLATE_ALREADY_SENT', /plantilla/i],
    [404, 'MEDIA_NOT_FOUND', /archivo/i],
    [422, 'MEDIA_PURGED', /archivo/i],
    [422, 'MEDIA_TYPE_MISMATCH', /archivo/i],
    [409, 'IDEMPOTENCY_CONFLICT', /acción/i],
  ]

  it.each(cases)('%i %s has its own es-MX copy', (status, code, pattern) => {
    const message = requestErrorMessage(axiosError(status, { statusCode: status, code }))
    expect(message).not.toBe(GENERIC)
    expect(message).toMatch(pattern)
    expect(message).not.toContain(code)
  })

  it('reads the 422 fieldErrors [{path, code}] of a missing complaint outcome', () => {
    const error = readRequestError(
      axiosError(422, {
        statusCode: 422,
        code: 'COMPLAINT_OUTCOME_REQUIRED',
        message: 'x',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: null },
        fieldErrors: [{ path: 'complaintOutcome', code: 'REQUIRED' }],
      }),
    )
    expect(error.fieldErrors.complaintOutcome).toEqual(['REQUIRED'])
    expect(error.current?.version).toBe(5)
  })
})

describe('scheduled conversations (handoff 21)', () => {
  const TZ = 'America/Mexico_City'

  it('SCHEDULED_TOO_EARLY denies CLAIM with «Disponible desde HH:MM» from claimableAt, in the given zone', () => {
    expect(deniedActionReason('SCHEDULED_TOO_EARLY', null, { claimableAt: '2026-11-14T15:55:00.000Z', timeZone: TZ })).toBe(
      'Disponible desde 09:55',
    )
  })

  it('SCHEDULED_TOO_EARLY without a usable claimableAt stays honest, never «Invalid Date»', () => {
    expect(deniedActionReason('SCHEDULED_TOO_EARLY')).toBe('Todavía no se puede atender: la conversación está agendada.')
    expect(deniedActionReason('SCHEDULED_TOO_EARLY', null, { claimableAt: 'nope' })).toBe(
      'Todavía no se puede atender: la conversación está agendada.',
    )
  })

  it('readRequestError keeps claimableAt and the fresh slots of a SLOT_UNAVAILABLE 409', () => {
    const slots = [{ startsAt: '2026-11-14T16:00:00.000Z', withinWindow: true, available: true }]
    const early = readRequestError(axiosError(409, { code: 'SCHEDULED_TOO_EARLY', claimableAt: '2026-11-14T15:55:00.000Z' }))
    expect(early.claimableAt).toBe('2026-11-14T15:55:00.000Z')
    const taken = readRequestError(
      axiosError(409, { code: 'SLOT_UNAVAILABLE', slots, timeZone: TZ, whatsappWindowClosesAt: '2026-11-14T03:10:00.000Z' }),
    )
    expect(taken.slotsUpdate).toEqual({ slots, timeZone: TZ, whatsappWindowClosesAt: '2026-11-14T03:10:00.000Z' })
    expect(readRequestError(axiosError(409, { code: 'VERSION_CONFLICT' })).slotsUpdate).toBeNull()
    expect(readRequestError(axiosError(409, { code: 'VERSION_CONFLICT' })).claimableAt).toBeNull()
  })

  it('malformed slots in the body are dropped, not trusted', () => {
    const error = readRequestError(axiosError(409, { code: 'SLOT_UNAVAILABLE', slots: [{ startsAt: 5 }, 'x'] }))
    expect(error.slotsUpdate?.slots).toEqual([])
  })

  const cases: Array<[number, string, RegExp]> = [
    [409, 'SLOT_UNAVAILABLE', /horario/i],
    [409, 'RESCHEDULE_NOT_ALLOWED', /reagendar/i],
    [409, 'NOT_SCHEDULED', /agendada/i],
    [422, 'SCHEDULING_DISABLED', /agend/i],
    [409, 'SCHEDULED_TOO_EARLY', /todavía/i],
  ]
  it.each(cases)('%s %s has its own es-MX copy', (status, code, pattern) => {
    const message = requestErrorMessage(axiosError(status, { code }))
    expect(message).toMatch(pattern)
    expect(message).not.toBe('No se pudo completar la acción. Intenta de nuevo.')
  })

  it('SCHEDULED_TOO_EARLY on a claim names the time when the body carries claimableAt', () => {
    const error = readRequestError(axiosError(409, { code: 'SCHEDULED_TOO_EARLY', claimableAt: '2026-11-14T15:55:00.000Z' }))
    expect(requestErrorMessage(error, { timeZone: TZ })).toContain('09:55')
  })
})
