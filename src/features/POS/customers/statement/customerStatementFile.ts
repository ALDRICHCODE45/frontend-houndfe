/**
 * customerStatementFile.ts — the browser half of the customer statement PDF (handoff 29).
 *
 * Same approach as the seller report download (`sellerReportDownload.ts`), kept local so the
 * admin feature is not touched: only a complete, real PDF is saved (the backend writes nothing
 * before the PDF is ready, and `%PDF-` is checked here), the name comes from `Content-Disposition`
 * (sanitized, with the documented fallback), a JSON error inside a Blob is read with a size bound,
 * and the bytes are saved through a temporary anchor whose object URL is revoked shortly after.
 */
import type { CustomerStatementRange } from './customerStatementPeriod'

export const CUSTOMER_STATEMENT_PDF_MIME = 'application/pdf'
const PDF_SIGNATURE = '%PDF-'
const PDF_EXTENSION = '.pdf'
const MAX_ERROR_BYTES = 64 * 1024
const MAX_BASE_NAME_LENGTH = 120
const REVOKE_GRACE_MS = 1_000
const RESERVED_CHARACTERS = '<>:"/\\|?*'

const GENERIC_FAILURE = 'No se pudo generar el estado de cuenta.'

export interface CustomerStatementFailure {
  message: string
  /** Only transient failures (500, network, unexpected body) offer «Reintentar». */
  canRetry: boolean
}

/** `estado-de-cuenta-<customerId>-<from>-<to>.pdf`, the name the backend sends. */
export function customerStatementFallbackFileName(
  customerId: string,
  range: CustomerStatementRange,
): string {
  return `estado-de-cuenta-${customerId}-${range.from}-${range.to}${PDF_EXTENSION}`
}

function stripUnsafeCharacters(value: string): string {
  let safe = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code <= 0x1f || code === 0x7f || RESERVED_CHARACTERS.includes(character)) continue
    safe += character
  }
  return safe
}

function sanitize(raw: string, fallback: string): string {
  const basename = raw.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = stripUnsafeCharacters(basename).replace(/^\.+/, '').trim()
  const base = (
    cleaned.toLowerCase().endsWith(PDF_EXTENSION)
      ? cleaned.slice(0, -PDF_EXTENSION.length)
      : cleaned
  )
    .slice(0, MAX_BASE_NAME_LENGTH)
    .replace(/^\.+/, '')
    .trim()
  return base ? `${base}${PDF_EXTENSION}` : fallback
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** File name from `Content-Disposition` (`filename*`, quoted, bare), or the fallback. */
export function parseCustomerStatementFileName(
  header: string | null | undefined,
  fallback: string,
): string {
  if (typeof header !== 'string' || header.trim() === '') return fallback

  const encoded = /filename\*\s*=\s*([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    const segments = encoded.trim().split("'")
    const value = segments.length >= 3 ? segments.slice(2).join("'") : encoded.trim()
    return sanitize(decode(value), fallback)
  }
  const quoted = /filename\s*=\s*"([^"]*)"/i.exec(header)?.[1]
  if (quoted) return sanitize(quoted, fallback)
  const bare = /filename\s*=\s*([^;]+)/i.exec(header)?.[1]
  if (bare) return sanitize(bare.trim(), fallback)
  return fallback
}

/** `true` only for a real PDF: no declared non-PDF type and the bytes start with `%PDF-`. */
export async function isCustomerStatementPdfBlob(blob: Blob): Promise<boolean> {
  const declared = blob.type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (declared !== '' && declared !== CUSTOMER_STATEMENT_PDF_MIME) return false
  const bytes = new Uint8Array(await blob.slice(0, PDF_SIGNATURE.length).arrayBuffer())
  if (bytes.length !== PDF_SIGNATURE.length) return false
  return String.fromCharCode(...bytes) === PDF_SIGNATURE
}

function responseOf(error: unknown): { status?: unknown; data?: unknown } | null {
  if (typeof error !== 'object' || error === null) return null
  const response = (error as { response?: unknown }).response
  return typeof response === 'object' && response !== null
    ? (response as { status?: unknown; data?: unknown })
    : null
}

/**
 * With `responseType: 'blob'` an error body arrives as a Blob. A bounded JSON object is read into
 * `response.data`; anything else returns the original error untouched.
 */
export async function readCustomerStatementBlobError(error: unknown): Promise<unknown> {
  const response = responseOf(error)
  const data = response?.data
  if (!(data instanceof Blob) || data.size > MAX_ERROR_BYTES) return error
  try {
    const parsed: unknown = JSON.parse(await data.text())
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return error
    return { response: { ...response, data: parsed } }
  } catch {
    return error
  }
}

/** Handoff 29 §2: one message per documented failure. */
export function customerStatementErrorMessage(error: unknown): CustomerStatementFailure {
  const response = responseOf(error)
  const status = typeof response?.status === 'number' ? response.status : undefined
  const code = (response?.data as { error?: unknown } | undefined)?.error
  if (status === 400) {
    return { message: 'Revisa el periodo: debe ser de 1 a 366 días.', canRetry: false }
  }
  if (status === 404 || code === 'CUSTOMER_NOT_FOUND') {
    return { message: 'El cliente ya no existe.', canRetry: false }
  }
  if (status === 403) {
    return { message: 'No tienes permiso para descargar el estado de cuenta.', canRetry: false }
  }
  return { message: GENERIC_FAILURE, canRetry: true }
}

/** Save validated PDF bytes through a hidden, detached anchor; the URL is revoked shortly after. */
export function saveCustomerStatementPdf(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), REVOKE_GRACE_MS)
}
