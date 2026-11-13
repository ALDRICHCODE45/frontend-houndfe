import { describe, expect, it } from 'vitest'
import { ATTACH_ACCEPT, MAX_ATTACHMENT_BYTES, attachmentErrorFor, validateAttachment } from '../live-attachments'

const file = (name: string, type: string, size = 1000) => {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('validateAttachment — client checks before any upload', () => {
  it('accepts JPEG, PNG and WebP as images and PDF as a document', () => {
    expect(validateAttachment(file('a.jpg', 'image/jpeg'))).toEqual({ ok: true, kind: 'IMAGE' })
    expect(validateAttachment(file('a.png', 'image/png'))).toEqual({ ok: true, kind: 'IMAGE' })
    expect(validateAttachment(file('a.webp', 'image/webp'))).toEqual({ ok: true, kind: 'IMAGE' })
    expect(validateAttachment(file('a.pdf', 'application/pdf'))).toEqual({ ok: true, kind: 'DOCUMENT' })
  })

  it('accepts exactly 10 MB and refuses one byte more, saying the size and the limit', () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(10 * 1024 * 1024)
    expect(validateAttachment(file('a.jpg', 'image/jpeg', MAX_ATTACHMENT_BYTES))).toEqual({ ok: true, kind: 'IMAGE' })
    const big = validateAttachment(file('foto-original.jpg', 'image/jpeg', 14.2 * 1024 * 1024))
    expect(big).toEqual({
      ok: false,
      reason: 'SIZE',
      message: 'foto-original.jpg pesa 14.2 MB. El máximo es 10 MB.',
    })
  })

  it('refuses video, audio and anything else, naming the allowed types', () => {
    const video = validateAttachment(file('empaque-bolsa.mp4', 'video/mp4'))
    expect(video).toEqual({
      ok: false,
      reason: 'TYPE',
      message: 'No se puede enviar empaque-bolsa.mp4. Solo imágenes (JPG, PNG, WebP) y PDF.',
    })
    expect(validateAttachment(file('a.gif', 'image/gif')).ok).toBe(false)
    expect(validateAttachment(file('a.ogg', 'audio/ogg')).ok).toBe(false)
  })

  it('falls back to the extension when the browser gives no type', () => {
    expect(validateAttachment(file('a.PDF', ''))).toEqual({ ok: true, kind: 'DOCUMENT' })
    expect(validateAttachment(file('a.jpeg', ''))).toEqual({ ok: true, kind: 'IMAGE' })
    expect(validateAttachment(file('a.exe', '')).ok).toBe(false)
  })

  it('refuses an empty file', () => {
    const result = validateAttachment(file('vacio.pdf', 'application/pdf', 0))
    expect(result.ok).toBe(false)
  })

  it('offers the same list to the file picker', () => {
    expect(ATTACH_ACCEPT).toBe('image/jpeg,image/png,image/webp,application/pdf')
  })
})

describe('attachmentErrorFor — the server says no (the bytes decide the type)', () => {
  it('413 and 415 reuse the client copy', () => {
    expect(attachmentErrorFor(413, 'foto.jpg')).toBe('foto.jpg pesa más de 10 MB. El máximo es 10 MB.')
    expect(attachmentErrorFor(415, 'foto.jpg')).toBe('No se puede enviar foto.jpg. Solo imágenes (JPG, PNG, WebP) y PDF.')
    expect(attachmentErrorFor(500, 'foto.jpg')).toBeNull()
  })
})
