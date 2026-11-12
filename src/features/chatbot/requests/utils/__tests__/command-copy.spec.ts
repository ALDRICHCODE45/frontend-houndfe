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
