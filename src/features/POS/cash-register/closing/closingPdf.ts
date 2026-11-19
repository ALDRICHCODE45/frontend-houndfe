/**
 * Corte PDF in the browser. The bytes always come from the authenticated client
 * (`cashApi.getClosingPdf`, `Cache-Control: no-store` is the server's); they are
 * handed to the browser through a temporary object URL that is always revoked.
 */

/** A viewing tab needs the URL alive while it loads the document. */
export const CLOSING_PDF_VIEW_REVOKE_MS = 60_000
/** A download only needs the URL until the save starts. */
export const CLOSING_PDF_DOWNLOAD_REVOKE_MS = 1_000
const MAX_ERROR_BYTES = 64 * 1024

/** `corte-caja-<folio>.pdf`, sanitized like the backend (`[A-Za-z0-9_-]`, fallback id). */
export function closingPdfFileName(folio: string, fallbackId = ''): string {
  const safe = folio.replace(/[^A-Za-z0-9_-]/g, '') || fallbackId.replace(/[^A-Za-z0-9_-]/g, '')
  return `corte-caja-${safe || 'corte'}.pdf`
}

/** Save through a hidden anchor (never a navigation of the current page). */
export function downloadClosingPdf(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), CLOSING_PDF_DOWNLOAD_REVOKE_MS)
}

/**
 * Show the PDF in a tab opened synchronously on the click (so it is not a
 * blocked popup). Without that tab, it falls back to a download.
 */
export function showClosingPdf(
  blob: Blob,
  tab: Window | null,
  fileName: string,
): 'tab' | 'download' {
  if (!tab || tab.closed) {
    downloadClosingPdf(blob, fileName)
    return 'download'
  }
  const url = URL.createObjectURL(blob)
  try {
    tab.opener = null
  } catch {
    // Some browsers make `opener` read-only on cross-context windows.
  }
  tab.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), CLOSING_PDF_VIEW_REVOKE_MS)
  return 'tab'
}

/**
 * With `responseType: 'blob'` an error envelope arrives inside a Blob. Read it
 * (bounded) so the copy mapper can switch on `error`; anything else returns the
 * original error untouched.
 */
export async function normalizeBlobError(error: unknown): Promise<unknown> {
  if (!error || typeof error !== 'object') return error
  const response = (error as { response?: Record<string, unknown> }).response
  const data = response?.data
  if (!(data instanceof Blob) || data.size > MAX_ERROR_BYTES) return error
  try {
    const parsed: unknown = JSON.parse(await data.text())
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return error
    return { response: { ...response, data: parsed } }
  } catch {
    return error
  }
}
