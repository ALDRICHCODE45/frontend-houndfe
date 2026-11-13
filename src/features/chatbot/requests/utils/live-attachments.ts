/**
 * Client-side checks of a staff attachment (handoff 20 §3b) so a bad file never starts an upload:
 * JPEG, PNG, WebP or PDF, at most 10 MB. The server decides the type from the file's bytes, so
 * `413` / `415` can still come back and use the same copy.
 */
import { formatBytes } from './conversation-format'

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const ATTACH_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
export const CAPTION_MAX = 1024
export const TEXT_MAX = 4096

export type AttachmentKind = 'IMAGE' | 'DOCUMENT'

export type AttachmentCheck =
  | { ok: true; kind: AttachmentKind }
  | { ok: false; reason: 'TYPE' | 'SIZE' | 'EMPTY'; message: string }

const MIME_KIND: Record<string, AttachmentKind> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'application/pdf': 'DOCUMENT',
}
const EXTENSION_KIND: Record<string, AttachmentKind> = {
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  png: 'IMAGE',
  webp: 'IMAGE',
  pdf: 'DOCUMENT',
}

export const attachmentTypeMessage = (name: string) =>
  `No se puede enviar ${name}. Solo imágenes (JPG, PNG, WebP) y PDF.`

function kindOf(file: File): AttachmentKind | null {
  if (file.type) return MIME_KIND[file.type.toLowerCase()] ?? null
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_KIND[extension] ?? null
}

export function validateAttachment(file: File): AttachmentCheck {
  const kind = kindOf(file)
  if (!kind) return { ok: false, reason: 'TYPE', message: attachmentTypeMessage(file.name) }
  if (file.size <= 0) return { ok: false, reason: 'EMPTY', message: `${file.name} está vacío.` }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      ok: false,
      reason: 'SIZE',
      message: `${file.name} pesa ${formatBytes(file.size)}. El máximo es 10 MB.`,
    }
  }
  return { ok: true, kind }
}

/** Copy of the server's answer to the upload; `null` for any other status. */
export function attachmentErrorFor(status: number | null, name: string): string | null {
  if (status === 413) return `${name} pesa más de 10 MB. El máximo es 10 MB.`
  if (status === 415) return attachmentTypeMessage(name)
  return null
}
