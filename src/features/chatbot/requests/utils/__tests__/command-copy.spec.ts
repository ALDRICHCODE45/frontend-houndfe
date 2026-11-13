import { describe, expect, it } from 'vitest'
import { axiosError } from '../../composables/__tests__/withQuery'
import { readRequestError } from '../requestErrors'
import { commandFieldErrors, commandNotice, commandSuccessToast, isStateChangingError } from '../command-copy'

const read = (status: number, data: Record<string, unknown> = {}) => readRequestError(axiosError(status, data))

describe('commandNotice — typed conflicts shown in the rail', () => {
  it('names who took the request, from current.claimedBy, with «Actualizar»', () => {
    const notice = commandNotice(
      read(409, {
        code: 'REQUEST_CLAIMED_BY_OTHER',
        current: { version: 5, status: 'IN_PROGRESS', claimedBy: { id: 'u-2', displayName: 'Ana López' } },
      }),
    )!
    expect(notice.title).toBe('Ana López ya tomó esta solicitud')
    expect(notice.detail).toContain('No se aplicó tu acción')
    expect(notice.actions).toEqual(['refresh'])
    expect(notice.technical).toBe('409 REQUEST_CLAIMED_BY_OTHER')
  })

  it('falls back to «Otra persona» when the body carries no holder', () => {
    const notice = commandNotice(read(409, { code: 'REQUEST_CLAIMED_BY_OTHER' }))!
    expect(notice.title).toBe('Otra persona ya tomó esta solicitud')
  })

  it('VERSION_CONFLICT says the request moved to the new version', () => {
    const notice = commandNotice(read(409, { code: 'VERSION_CONFLICT', current: { version: 5 } }))!
    expect(notice.title).toBe('La solicitud cambió mientras la mirabas')
    expect(notice.detail).toContain('versión 5')
    expect(notice.actions).toEqual(['refresh'])
  })

  it('VERSION_CONFLICT on a merge target says the request that stays changed, not this one', () => {
    const notice = commandNotice(
      read(409, { code: 'VERSION_CONFLICT', intoRequestId: 'req-9', current: { version: 7 } }),
    )!
    expect(notice.title).toBe('La solicitud que se queda cambió')
    expect(notice.detail).toBe(
      'La solicitud con la que ibas a unirla cambió mientras la mirabas. No se unió nada; revisa los candidatos y vuelve a intentarlo.',
    )
    expect(notice.detail).not.toContain('versión')
    expect(notice.actions).toEqual(['refresh'])
  })

  it('REQUEST_CLOSED says it can no longer be changed', () => {
    const notice = commandNotice(read(409, { code: 'REQUEST_CLOSED' }))!
    expect(notice.title).toBe('Esta solicitud ya se cerró')
    expect(notice.actions).toEqual(['refresh'])
  })

  it('ZONE_SET_CHANGED shows the new impact and offers to confirm with it', () => {
    const notice = commandNotice(
      read(409, { code: 'ZONE_SET_CHANGED', current: { zoneImpact: { requests: 5, customers: 4, setVersion: 8 } } }),
    )!
    expect(notice.title).toBe('Cambiaron los clientes de este código postal')
    expect(notice.detail).toContain('Esto resolverá 5 solicitudes de 4 clientes')
    expect(notice.actions).toEqual(['reconfirm'])
  })

  it('NOT_ASSIGNEE is a 403 with «Entendido» only', () => {
    const notice = commandNotice(read(403, { code: 'NOT_ASSIGNEE', current: { version: 3 } }))!
    expect(notice.title).toBe('Solo quien la atiende puede hacerlo')
    expect(notice.actions).toEqual(['dismiss'])
    expect(notice.technical).toBe('403 NOT_ASSIGNEE')
  })

  it('other typed state errors ask to refresh with the shared copy', () => {
    for (const [status, code] of [
      [409, 'IDEMPOTENCY_CONFLICT'],
      [409, 'CANCEL_NOT_ALLOWED'],
      [422, 'ACTION_NOT_ALLOWED'],
      [409, 'MERGE_NOT_ALLOWED'],
      [404, 'NOT_FOUND'],
    ] as const) {
      const notice = commandNotice(read(status, { code }))!
      expect(notice.actions).toEqual(['refresh'])
      expect(notice.detail.length).toBeGreaterThan(10)
    }
  })

  it('a missing permission is dismissable', () => {
    const notice = commandNotice(read(403, { code: 'INSUFFICIENT_PERMISSIONS' }))!
    expect(notice.title).toBe('No tienes permiso para hacer esto')
    expect(notice.actions).toEqual(['dismiss'])
  })

  it('network and 5xx failures offer a retry of the same attempt', () => {
    const offline = commandNotice(readRequestError(new Error('Network Error')))!
    expect(offline.title).toBe('No se pudo confirmar la acción')
    expect(offline.actions).toEqual(['retry', 'dismiss'])
    expect(commandNotice(read(500, { code: 'INTERNAL_ERROR' }))!.actions).toEqual(['retry', 'dismiss'])
  })

  it('has no notice when the failure only belongs to fields', () => {
    expect(commandNotice(read(422, { code: 'USER_NOT_ASSIGNABLE' }))).toBeNull()
    expect(commandNotice(read(422, { code: 'CUSTOMER_PHONE_MISMATCH' }))).toBeNull()
    expect(
      commandNotice(
        read(400, {
          code: 'VALIDATION_ERROR',
          message: [{ property: 'note', constraints: { maxLength: 'note must be shorter' } }],
        }),
      ),
    ).toBeNull()
  })

  it('an unmapped 400 stays a dismissable notice', () => {
    const notice = commandNotice(read(400, { code: 'VALIDATION_ERROR', message: 'bad body' }))!
    expect(notice.actions).toEqual(['dismiss'])
  })
})

describe('commandFieldErrors — 400/422 under the field', () => {
  it('maps validation-pipe properties to the form fields in es-MX', () => {
    const errors = commandFieldErrors(
      read(400, {
        code: 'VALIDATION_ERROR',
        message: [
          { property: 'note', constraints: { isNotEmpty: 'note should not be empty' } },
          { property: 'restockDays', constraints: { max: 'restockDays must not be greater than 365' } },
          { property: 'unknownProp', constraints: { x: 'ignored' } },
        ],
      }),
    )
    expect(errors).toEqual({
      note: 'Revisa este campo.',
      restockDays: 'Revisa este campo.',
    })
  })

  it('USER_NOT_ASSIGNABLE lands on the assignee, CUSTOMER_PHONE_MISMATCH on the customer', () => {
    expect(commandFieldErrors(read(422, { code: 'USER_NOT_ASSIGNABLE' }))).toEqual({
      toUserId: 'Esa persona no puede atender solicitudes en esta sucursal. Elige a otra.',
    })
    expect(commandFieldErrors(read(422, { code: 'CUSTOMER_PHONE_MISMATCH' }))).toEqual({
      customerId: 'El teléfono de ese cliente no coincide con el de la solicitud.',
    })
  })

  it('is empty for conflicts and network failures', () => {
    expect(commandFieldErrors(read(409, { code: 'VERSION_CONFLICT' }))).toEqual({})
    expect(commandFieldErrors(readRequestError(new Error('Network Error')))).toEqual({})
  })
})

describe('isStateChangingError — refetch after these', () => {
  it('is true for the codes that mean the request moved', () => {
    for (const code of [
      'VERSION_CONFLICT',
      'REQUEST_CLAIMED_BY_OTHER',
      'REQUEST_CLOSED',
      'CANCEL_NOT_ALLOWED',
      'IDEMPOTENCY_CONFLICT',
      'MERGE_NOT_ALLOWED',
      'ZONE_SET_CHANGED',
      'NOT_ASSIGNEE',
      'ACTION_NOT_ALLOWED',
      'NOT_FOUND',
    ]) {
      expect(isStateChangingError(read(409, { code }))).toBe(true)
    }
  })

  it('is false for field, permission, network and server errors', () => {
    for (const code of ['VALIDATION_ERROR', 'USER_NOT_ASSIGNABLE', 'CUSTOMER_PHONE_MISMATCH', 'INSUFFICIENT_PERMISSIONS']) {
      expect(isStateChangingError(read(422, { code }))).toBe(false)
    }
    expect(isStateChangingError(readRequestError(new Error('Network Error')))).toBe(false)
    expect(isStateChangingError(read(500, { code: 'INTERNAL_ERROR' }))).toBe(false)
  })
})

describe('commandSuccessToast — es-MX', () => {
  it('claim and release', () => {
    expect(commandSuccessToast('CLAIM', { folio: 'S-000123' })).toEqual({
      title: 'Solicitud tomada',
      description: 'S-000123 ahora está a tu nombre.',
    })
    expect(commandSuccessToast('RELEASE', { folio: 'S-000123' })).toEqual({
      title: 'Solicitud liberada',
      description: 'S-000123 volvió a Nueva.',
    })
  })

  it('reassign names the new assignee', () => {
    expect(commandSuccessToast('REASSIGN', { folio: 'S-1', assignee: 'Luis Ortega' })).toEqual({
      title: 'Solicitud reasignada',
      description: 'Ahora la atiende Luis Ortega.',
    })
  })

  it('cancel tells what the customer will get', () => {
    expect(commandSuccessToast('CANCEL', { folio: 'S-1', reason: 'NOT_ACTIONABLE', customerNote: 'Gracias' }).description).toBe(
      'El bot enviará tu mensaje al cliente.',
    )
    expect(commandSuccessToast('CANCEL', { folio: 'S-1', reason: 'NOT_ACTIONABLE' }).description).toBe(
      'El bot enviará su aviso genérico.',
    )
    expect(commandSuccessToast('CANCEL', { folio: 'S-1', reason: 'DUPLICATE', customerNote: 'no sale' }).description).toBe(
      'S-1 salió de la bandeja.',
    )
  })

  it('resolve mentions the siblings a zone approval closed', () => {
    expect(commandSuccessToast('RESOLVE', { folio: 'S-1' })).toEqual({
      title: 'Solicitud resuelta',
      description: 'S-1 salió de la bandeja.',
    })
    expect(commandSuccessToast('RESOLVE', { folio: 'S-1', siblings: 3 }).description).toBe(
      'También se resolvieron 3 del mismo código postal.',
    )
    expect(commandSuccessToast('RESOLVE', { folio: 'S-1', siblings: 1 }).description).toBe(
      'También se resolvió 1 del mismo código postal.',
    )
  })

  it('merge and link', () => {
    expect(commandSuccessToast('MERGE', { folio: 'S-1', intoFolio: 'S-2' })).toEqual({
      title: 'Solicitudes unidas',
      description: 'S-1 se unió con S-2.',
    })
    expect(commandSuccessToast('LINK_CUSTOMER', { folio: 'S-1', customer: 'Juan Pérez' })).toEqual({
      title: 'Cliente vinculado',
      description: 'Juan Pérez quedó en esta y otras solicitudes del teléfono.',
    })
  })
})

describe('reply and finish copy (T7)', () => {
  it('NOT_ASSIGNEE on a reply names the holder and says there is no override', () => {
    const notice = commandNotice(
      read(403, {
        code: 'NOT_ASSIGNEE',
        current: { version: 4, status: 'IN_PROGRESS', claimedBy: { id: 'u-2', displayName: 'Ana López' } },
      }),
      'REPLY',
    )!
    expect(notice.title).toBe('La atiende Ana López')
    expect(notice.detail).toContain('Solo quien la atiende puede responder')
    expect(notice.detail).not.toContain('permiso de reasignar')
    expect(notice.actions).toEqual(['refresh'])
  })

  it('NOT_ASSIGNEE on another action keeps the reassign hint', () => {
    expect(commandNotice(read(403, { code: 'NOT_ASSIGNEE' }), 'CANCEL')!.detail).toContain('permiso de reasignar')
    expect(commandNotice(read(403, { code: 'NOT_ASSIGNEE' }))!.detail).toContain('permiso de reasignar')
  })

  it('a missing complaint outcome lands on its field, not in a notice', () => {
    const error = read(422, {
      code: 'COMPLAINT_OUTCOME_REQUIRED',
      fieldErrors: [{ path: 'complaintOutcome', code: 'REQUIRED' }],
    })
    expect(commandFieldErrors(error)).toEqual({ complaintOutcome: 'Elige cómo terminó la queja.' })
    expect(commandNotice(error, 'FINISH')).toBeNull()
  })

  it('a missing complaint outcome without fieldErrors still lands on the field', () => {
    const error = read(422, { code: 'COMPLAINT_OUTCOME_REQUIRED' })
    expect(commandFieldErrors(error)).toEqual({ complaintOutcome: 'Elige cómo terminó la queja.' })
  })

  it('400 field errors of text and note point at their fields', () => {
    const error = read(400, {
      code: 'VALIDATION_ERROR',
      fieldErrors: [
        { path: 'text', code: 'TOO_LONG' },
        { path: 'note', code: 'REQUIRED' },
      ],
    })
    expect(Object.keys(commandFieldErrors(error)).sort()).toEqual(['note', 'text'])
  })

  it('SESSION_NOT_ACTIVE and STALE_EPOCH refetch the request', () => {
    expect(isStateChangingError(read(409, { code: 'SESSION_NOT_ACTIVE' }))).toBe(true)
    expect(isStateChangingError(read(409, { code: 'STALE_EPOCH' }))).toBe(true)
    expect(isStateChangingError(read(422, { code: 'COMPLAINT_OUTCOME_REQUIRED' }))).toBe(false)
  })

  it('success toasts', () => {
    expect(commandSuccessToast('REPLY', { folio: 'S-000123' })).toEqual({
      title: 'Respuesta enviada',
      description: 'S-000123 quedó resuelta. El bot se la hará llegar al cliente.',
    })
    expect(commandSuccessToast('FINISH', { folio: 'S-000123' })).toEqual({
      title: 'Conversación finalizada',
      description: 'S-000123 quedó resuelta.',
    })
    expect(commandSuccessToast('FINISH_IDLE', { folio: 'S-000123' }).title).toBe('Conversación finalizada')
  })
})

describe('scheduled conversations (handoff 21)', () => {
  it('RESCHEDULE_NOT_ALLOWED and NOT_SCHEDULED close the story with «Actualizar» and refetch', () => {
    const claimed = commandNotice(read(409, { code: 'RESCHEDULE_NOT_ALLOWED', current: { version: 3 } }), 'RESCHEDULE')!
    expect(claimed.title).toBe('Ya no se puede reagendar')
    expect(claimed.detail).toContain('No se movió nada')
    expect(claimed.actions).toEqual(['refresh'])
    const notScheduled = commandNotice(read(409, { code: 'NOT_SCHEDULED' }), 'RESCHEDULE')!
    expect(notScheduled.title).toBe('Esta solicitud no está agendada')
    expect(isStateChangingError(read(409, { code: 'RESCHEDULE_NOT_ALLOWED' }))).toBe(true)
    expect(isStateChangingError(read(409, { code: 'NOT_SCHEDULED' }))).toBe(true)
  })

  it('SLOT_UNAVAILABLE says the time was taken and keeps the form (dismiss only, no refetch)', () => {
    const notice = commandNotice(read(409, { code: 'SLOT_UNAVAILABLE' }), 'RESCHEDULE')!
    expect(notice.title).toBe('Ese horario ya no está disponible')
    expect(notice.detail).toContain('lista')
    expect(notice.detail).toContain('Se conserva el horario anterior')
    expect(notice.actions).toEqual(['dismiss'])
    expect(isStateChangingError(read(409, { code: 'SLOT_UNAVAILABLE' }))).toBe(false)
  })

  it('SCHEDULING_DISABLED says scheduling is off in this branch', () => {
    const notice = commandNotice(read(422, { code: 'SCHEDULING_DISABLED' }), 'RESCHEDULE')!
    expect(notice.title).toBe('El agendado está desactivado')
    expect(notice.actions).toEqual(['dismiss'])
  })

  it('a claim that came too early says «Disponible desde HH:MM» and refetches the request', () => {
    const error = read(409, { code: 'SCHEDULED_TOO_EARLY', claimableAt: '2026-11-14T15:55:00.000Z' })
    const notice = commandNotice(error, 'CLAIM', {
      timeZone: 'America/Mexico_City',
      now: new Date('2026-11-14T14:00:00.000Z'),
    })!
    expect(notice.title).toBe('Todavía no se puede atender')
    expect(notice.detail).toContain('Disponible desde 9:55')
    expect(notice.actions).toEqual(['refresh'])
    expect(isStateChangingError(error)).toBe(true)
  })

  it('a 400 on scheduledFor points at the slot choice', () => {
    const error = read(400, { code: 'VALIDATION_ERROR', fieldErrors: [{ path: 'scheduledFor', code: 'INVALID' }] })
    expect(Object.keys(commandFieldErrors(error))).toEqual(['scheduledFor'])
  })

  it('reschedule toast: customer will be told', () => {
    expect(
      commandSuccessToast('RESCHEDULE', {
        folio: 'S-000123',
        scheduledFor: '2026-11-14T16:00:00.000Z',
        timeZone: 'America/Mexico_City',
        customerNoticeExpected: true,
      }),
    ).toEqual({
      title: 'Conversación reagendada',
      description: 'S-000123 quedó para sáb 10:00. Se avisará al cliente de la nueva hora.',
    })
  })

  it('reschedule toast: window closed → the customer will NOT be told, as a warning', () => {
    const toast = commandSuccessToast('RESCHEDULE', {
      folio: 'S-000123',
      scheduledFor: '2026-11-14T16:00:00.000Z',
      timeZone: 'America/Mexico_City',
      customerNoticeExpected: false,
    })
    expect(toast.color).toBe('warning')
    expect(toast.description).toContain('El cliente no recibirá aviso de la nueva hora')
    expect(toast.description).toContain('Avísale por otro medio')
  })

  it('reschedule toast without a customerNotice says nothing about the customer', () => {
    const toast = commandSuccessToast('RESCHEDULE', { folio: 'S-000123' })
    expect(toast.title).toBe('Conversación reagendada')
    expect(toast.description).toBe('S-000123 tiene una nueva hora.')
  })
})
