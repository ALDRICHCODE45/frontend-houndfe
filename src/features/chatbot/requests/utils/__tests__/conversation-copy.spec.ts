import { describe, expect, it } from 'vitest'
import { axiosError } from '../../composables/__tests__/withQuery'
import { conversationErrorMessage, MEDIA_PURGED_COPY, mediaErrorMessage } from '../conversation-copy'

describe('mediaErrorMessage', () => {
  it('410 is the retention copy', () => {
    expect(MEDIA_PURGED_COPY).toBe('Este archivo ya no está disponible (se elimina a los 12 meses)')
    expect(mediaErrorMessage(axiosError(410, { code: 'MEDIA_PURGED' }))).toBe(MEDIA_PURGED_COPY)
  })

  it('maps 403, 404 and 503 to their own copy and anything else to a retry copy', () => {
    expect(mediaErrorMessage(axiosError(403))).toContain('permiso')
    expect(mediaErrorMessage(axiosError(404, { code: 'MEDIA_NOT_FOUND' }))).toContain('No encontramos')
    expect(mediaErrorMessage(axiosError(503, { code: 'MEDIA_STORAGE_FAILED' }))).toContain('inténtalo de nuevo')
    expect(mediaErrorMessage(new Error('network'))).toContain('inténtalo de nuevo')
  })
})

describe('conversationErrorMessage', () => {
  it('403 says the role cannot read it; others are a generic read-only reassurance', () => {
    expect(conversationErrorMessage(axiosError(403))).toContain('permiso')
    expect(conversationErrorMessage(axiosError(500))).toContain('No pudimos cargar la conversación')
  })
})
