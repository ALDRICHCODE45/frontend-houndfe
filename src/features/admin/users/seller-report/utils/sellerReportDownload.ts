/**
 * sellerReportDownload.ts — the download half of the seller sales report.
 *
 * Why a module:
 *   - The PDF is produced by the backend (`GET …/report/pdf`), not by the
 *     browser. This module therefore owns only what the browser must still get
 *     right: refusing anything that is not a real PDF, turning a
 *     `Content-Disposition` header into a safe file name, normalizing a binary
 *     error body so the existing failure contract can read it, and handing the
 *     bytes to the browser through a temporary anchor.
 *   - Nothing here reads the JSON snapshot, renders a document or recalculates a
 *     metric: the PDF is an independent, fresh server snapshot.
 */

/** The only media type a report PDF may declare. */
export const SELLER_REPORT_PDF_MIME = 'application/pdf'

/** The PDF magic prefix (`%PDF-`), the last line of defence against JSON/HTML. */
export const SELLER_REPORT_PDF_SIGNATURE = '%PDF-'

/** Safe name used whenever the header is missing, empty or unusable. */
export const SELLER_REPORT_PDF_FALLBACK_FILE_NAME = 'reporte-ventas.pdf'

/**
 * Grace period before the object URL is revoked. Revoking in the same tick can
 * abort the save in some engines, so the URL outlives the click by a moment.
 */
export const SELLER_REPORT_PDF_REVOKE_GRACE_MS = 1_000

/** Upper bound on an error blob we are willing to read and parse. */
export const SELLER_REPORT_PDF_MAX_ERROR_BYTES = 64 * 1024

/** Upper bound on the sanitized base name, before the `.pdf` extension. */
export const SELLER_REPORT_PDF_MAX_FILE_NAME_LENGTH = 100

const PDF_EXTENSION = '.pdf'
const DISPOSITION_FILENAME_STAR_PATTERN = /filename\*\s*=\s*([^;]+)/i
const DISPOSITION_FILENAME_QUOTED_PATTERN = /filename\s*=\s*"([^"]*)"/i
const DISPOSITION_FILENAME_BARE_PATTERN = /filename\s*=\s*([^;]+)/i
/** Punctuation Windows forbids in a file name (path separators included). */
const RESERVED_FILE_NAME_CHARACTERS = '<>:"/\\|?*'

/**
 * Drop every character that must never reach the save location: control
 * characters and reserved punctuation. A code-point scan keeps the intent
 * explicit instead of hiding raw control characters inside a regex literal.
 */
function stripUnsafeFileNameCharacters(value: string): string {
  let safe = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    const isControl = code <= 0x1f || code === 0x7f
    if (isControl || RESERVED_FILE_NAME_CHARACTERS.includes(character)) continue
    safe += character
  }
  return safe
}

/**
 * `true` only for a Blob that is a real PDF: an absent media type is tolerated
 * (some transports omit it), but a declared non-PDF type is not, and the bytes
 * must start with `%PDF-`.
 *
 * Browser-compatible: it uses only `Blob.type`, `Blob.slice()` and
 * `ArrayBuffer` — no Node-only API.
 */
export async function isSellerReportPdfBlob(blob: Blob, signal?: AbortSignal): Promise<boolean> {
  // The caller moved on: the bytes must not be treated as a downloadable PDF.
  if (signal?.aborted) return false

  const declaredType = blob.type.split(';')[0]?.trim().toLowerCase() ?? ''
  if (declaredType !== '' && declaredType !== SELLER_REPORT_PDF_MIME) return false

  const bytes = new Uint8Array(
    await blob.slice(0, SELLER_REPORT_PDF_SIGNATURE.length).arrayBuffer(),
  )
  if (bytes.length !== SELLER_REPORT_PDF_SIGNATURE.length) return false

  let signature = ''
  for (const byte of bytes) signature += String.fromCharCode(byte)
  return signature === SELLER_REPORT_PDF_SIGNATURE
}

function decodeHeaderComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** Sanitize a candidate file name, or return the safe fallback. */
export function sanitizeSellerReportPdfFileName(raw: string | null | undefined): string {
  if (!raw) return SELLER_REPORT_PDF_FALLBACK_FILE_NAME

  // Strip every path component first: a hostile header must not steer the
  // download into another directory on any platform.
  const basename = raw.replace(/\\/g, '/').split('/').pop() ?? ''
  const cleaned = stripUnsafeFileNameCharacters(basename).replace(/^\.+/, '').trim()
  if (cleaned === '') return SELLER_REPORT_PDF_FALLBACK_FILE_NAME

  const withoutExtension = cleaned.toLowerCase().endsWith(PDF_EXTENSION)
    ? cleaned.slice(0, -PDF_EXTENSION.length)
    : cleaned
  const limited = withoutExtension
    .slice(0, SELLER_REPORT_PDF_MAX_FILE_NAME_LENGTH)
    .replace(/^\.+/, '')
    .trim()
  if (limited === '') return SELLER_REPORT_PDF_FALLBACK_FILE_NAME

  return `${limited}${PDF_EXTENSION}`
}

/**
 * Turn a `Content-Disposition` header into a safe file name.
 *
 * Prefers the RFC 5987 `filename*` form (percent-encoded UTF-8), then a quoted
 * `filename`, then a bare token. Whatever it finds is decoded defensively and
 * sanitized; a missing, empty or unusable header yields the fallback name.
 */
export function parseSellerReportPdfFileName(header: string | null | undefined): string {
  if (typeof header !== 'string' || header.trim() === '') {
    return SELLER_REPORT_PDF_FALLBACK_FILE_NAME
  }

  const encoded = DISPOSITION_FILENAME_STAR_PATTERN.exec(header)
  if (encoded?.[1]) {
    // `charset'lang'value`: drop the two metadata segments and decode the rest.
    const segments = encoded[1].split("'")
    const value = segments.length >= 3 ? segments.slice(2).join("'") : encoded[1]
    return sanitizeSellerReportPdfFileName(decodeHeaderComponent(value))
  }

  const quoted = DISPOSITION_FILENAME_QUOTED_PATTERN.exec(header)
  if (quoted?.[1]) return sanitizeSellerReportPdfFileName(quoted[1])

  const bare = DISPOSITION_FILENAME_BARE_PATTERN.exec(header)
  if (bare?.[1]) return sanitizeSellerReportPdfFileName(bare[1].trim())

  return SELLER_REPORT_PDF_FALLBACK_FILE_NAME
}

function responseOf(error: unknown): { status?: unknown; data?: unknown } | null {
  if (typeof error !== 'object' || error === null) return null
  const response = (error as { response?: unknown }).response
  if (typeof response !== 'object' || response === null) return null
  return response as { status?: unknown; data?: unknown }
}

/**
 * Normalize a rejected blob request so the shared failure parser can read it.
 *
 * With `responseType: 'blob'` a domain error arrives as a JSON body inside a
 * Blob. Reading it is strictly bounded (size, then `JSON.parse`) and completely
 * defensive: a non-Blob body, an oversized blob, invalid JSON or a non-object
 * payload returns the ORIGINAL error untouched, so nothing is coerced into a
 * domain failure.
 */
export async function normalizeSellerReportPdfError(
  error: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  // A cancelled run must not spend work parsing a body it will discard.
  if (signal?.aborted) return error

  const response = responseOf(error)
  const data = response?.data
  if (!(data instanceof Blob)) return error
  if (data.size > SELLER_REPORT_PDF_MAX_ERROR_BYTES) return error

  try {
    const parsed: unknown = JSON.parse(await data.text())
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return error
    return { response: { ...response, data: parsed } }
  } catch {
    return error
  }
}

/**
 * Hand validated PDF bytes to the browser.
 *
 * The bytes travel through a temporary, hidden anchor with a `download`
 * attribute — never `window.open`, never a navigation of the current page. The
 * anchor is detached immediately; the object URL is revoked after a short grace
 * period so the save has time to start, and never leaks.
 */
export function triggerSellerReportPdfDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), SELLER_REPORT_PDF_REVOKE_GRACE_MS)
}
