import { describe, expect, it } from 'vitest'
import { axiosError } from '../../composables/__tests__/withQuery'
import { liveErrorNotice, readLiveError } from '../live-errors'

describe('readLiveError — what the live 409s carry beyond the envelope', () => {
  it('WINDOW_CLOSED: templateAllowed and the window close time', () => {
    const error = readLiveError(
      axiosError(409, {
        statusCode: 409,
        code: 'WINDOW_CLOSED',
        templateAllowed: true,
        whatsappWindowClosesAt: '2026-11-13T15:00:00.000Z',
      }),
    )
    expect(error.code).toBe('WINDOW_CLOSED')
    expect(error.templateAllowed).toBe(true)
    expect(error.windowClosesAt).toBe('2026-11-13T15:00:00.000Z')
    expect(error.retryable).toBe(false)
  })

  it('SESSION_NOT_ACTIVE and STALE_EPOCH carry sessionState / currentEpoch', () => {
    expect(readLiveError(axiosError(409, { code: 'SESSION_NOT_ACTIVE', sessionState: 'STARTING' })).sessionState).toBe(
      'STARTING',
    )
    expect(readLiveError(axiosError(409, { code: 'STALE_EPOCH', currentEpoch: 4 })).currentEpoch).toBe(4)
  })

  it('ignores values of the wrong type and a body with none', () => {
    const error = readLiveError(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: 'yes' }))
    expect(error.templateAllowed).toBeNull()
    expect(error.sessionState).toBeNull()
    expect(error.currentEpoch).toBeNull()
  })

  it('a network error or a 5xx is retryable with the same key; a 4xx is not', () => {
    expect(readLiveError(new Error('network')).retryable).toBe(true)
    expect(readLiveError(axiosError(503)).retryable).toBe(true)
    expect(readLiveError(axiosError(409, { code: 'STALE_EPOCH' })).retryable).toBe(false)
  })
})

describe('liveErrorNotice — es-MX copy of the contract errors', () => {
  it('WINDOW_CLOSED does not promise the draft stayed in the box (it may be in the «Texto no enviado» note)', () => {
    const notice = liveErrorNotice(readLiveError(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true, whatsappWindowClosesAt: null })))
    expect(notice.detail).not.toContain('se conservó')
  })

  const notice = (status: number, body: Record<string, unknown>, fileName?: string) =>
    liveErrorNotice(readLiveError(axiosError(status, body)), { fileName })

  it('WINDOW_CLOSED says the message was not sent', () => {
    const n = notice(409, { code: 'WINDOW_CLOSED', templateAllowed: true })
    expect(n.title).toBe('La ventana de 24 h está cerrada')
    expect(n.detail).toContain('no se envió')
  })

  it('STALE_EPOCH and NOT_ASSIGNEE refetch, and STALE_EPOCH does not promise where the draft is', () => {
    const stale = notice(409, { code: 'STALE_EPOCH', currentEpoch: 4 })
    expect(stale.title).toBe('La conversación cambió')
    expect(stale.detail).not.toContain('sigue en el cuadro')
    expect(stale.detail).toContain('Texto no enviado')
    expect(stale.refetch).toBe(true)
    const other = notice(403, { code: 'NOT_ASSIGNEE' })
    expect(other.title).toBe('Ya no la atiendes tú')
    expect(other.refetch).toBe(true)
  })

  it('SESSION_NOT_ACTIVE depends on the session state', () => {
    const starting = notice(409, { code: 'SESSION_NOT_ACTIVE', sessionState: 'STARTING' })
    expect(starting.title).toBe('La conversación todavía no está activa')
    expect(starting.refetch).toBe(true)
    const ended = notice(409, { code: 'SESSION_NOT_ACTIVE', sessionState: 'ENDED' })
    expect(ended.title).toBe('La conversación ya no está activa')
    expect(ended.detail).not.toContain('sigue en el cuadro')
  })

  it('template errors', () => {
    expect(notice(409, { code: 'WINDOW_OPEN' }).title).toBe('La ventana sigue abierta')
    expect(notice(422, { code: 'TEMPLATE_NOT_CONFIGURED' }).title).toBe('No hay plantilla configurada')
    expect(notice(409, { code: 'TEMPLATE_ALREADY_SENT' }).title).toBe('La plantilla ya se envió')
  })

  it('media errors name the file', () => {
    expect(notice(413, { code: 'MEDIA_TOO_LARGE' }, 'foto.jpg').detail).toContain('foto.jpg pesa más de 10 MB')
    expect(notice(415, { code: 'MEDIA_TYPE_NOT_ALLOWED' }, 'v.mp4').detail).toContain('Solo imágenes (JPG, PNG, WebP) y PDF')
    expect(notice(404, { code: 'MEDIA_NOT_FOUND' }).detail).toContain('Súbelo de nuevo')
    expect(notice(422, { code: 'MEDIA_PURGED' }).detail).toContain('Súbelo de nuevo')
    expect(notice(422, { code: 'MEDIA_TYPE_MISMATCH' }).title).toBe('El archivo no coincide con el tipo')
  })

  it('network and 5xx say a retry is safe', () => {
    const n = liveErrorNotice(readLiveError(new Error('x')), {})
    expect(n.title).toBe('No se pudo confirmar el envío')
    expect(n.detail).toContain('una sola vez')
  })

  it('anything else falls back to the shared inbox copy', () => {
    expect(notice(409, { code: 'IDEMPOTENCY_CONFLICT' }).detail).toContain('no coincide')
  })
})
