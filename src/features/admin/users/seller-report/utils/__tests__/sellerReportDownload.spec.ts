// sellerReportDownload.spec.ts — PDF response validation, safe disposition
// parsing, bounded error-blob normalization and the browser download handoff.
//
// Mutation-sensitive: accepting a JSON/HTML body as a PDF, trusting the raw
// Content-Disposition file name, reading an unbounded error blob, coercing a
// non-JSON error blob into a domain failure, revoking the object URL before the
// browser can start the download, or leaking the anchor fails at least one test.

import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  SELLER_REPORT_PDF_FALLBACK_FILE_NAME,
  SELLER_REPORT_PDF_MAX_ERROR_BYTES,
  SELLER_REPORT_PDF_MAX_FILE_NAME_LENGTH,
  SELLER_REPORT_PDF_MIME,
  SELLER_REPORT_PDF_REVOKE_GRACE_MS,
  isSellerReportPdfBlob,
  normalizeSellerReportPdfError,
  parseSellerReportPdfFileName,
  triggerSellerReportPdfDownload,
} from '../sellerReportDownload'

function pdfBlob(...chunks: BlobPart[]): Blob {
  return new Blob(['%PDF-1.7\n', ...chunks], { type: SELLER_REPORT_PDF_MIME })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isSellerReportPdfBlob — mime and signature', () => {
  it('accepts a real PDF by mime and magic signature', async () => {
    await expect(isSellerReportPdfBlob(pdfBlob('trailer'))).resolves.toBe(true)
  })

  it('accepts a PDF whose mime type was not set by the transport', async () => {
    await expect(isSellerReportPdfBlob(new Blob(['%PDF-1.4']))).resolves.toBe(true)
  })

  it('rejects a JSON error body even when it is a 200', async () => {
    const json = new Blob([JSON.stringify({ error: 'SELLER_NOT_FOUND' })], {
      type: 'application/json',
    })
    await expect(isSellerReportPdfBlob(json)).resolves.toBe(false)
  })

  it('rejects a body whose bytes are not a PDF signature', async () => {
    const html = new Blob(['<html>error</html>'], { type: 'text/html' })
    await expect(isSellerReportPdfBlob(html)).resolves.toBe(false)
    // A mismatched mime is rejected even if the signature prefix is present.
    const mislabeled = new Blob(['%PDF-1.7'], { type: 'application/octet-stream' })
    await expect(isSellerReportPdfBlob(mislabeled)).resolves.toBe(false)
  })

  it('never accepts a PDF once the signal has been aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(isSellerReportPdfBlob(pdfBlob(), controller.signal)).resolves.toBe(false)
  })
})

describe('parseSellerReportPdfFileName — safe disposition handling', () => {
  it('reads a quoted filename from the disposition header', () => {
    expect(parseSellerReportPdfFileName('attachment; filename="reporte-ana.pdf"')).toBe(
      'reporte-ana.pdf',
    )
  })

  it('decodes an RFC 5987 encoded filename', () => {
    expect(
      parseSellerReportPdfFileName("attachment; filename*=UTF-8''reporte%20de%20ventas.pdf"),
    ).toBe('reporte de ventas.pdf')
  })

  it('falls back to a safe name when the header is missing or empty', () => {
    expect(parseSellerReportPdfFileName(null)).toBe(SELLER_REPORT_PDF_FALLBACK_FILE_NAME)
    expect(parseSellerReportPdfFileName(undefined)).toBe(SELLER_REPORT_PDF_FALLBACK_FILE_NAME)
    expect(parseSellerReportPdfFileName('')).toBe(SELLER_REPORT_PDF_FALLBACK_FILE_NAME)
    expect(parseSellerReportPdfFileName('attachment')).toBe(SELLER_REPORT_PDF_FALLBACK_FILE_NAME)
  })

  it('strips every path component so the header cannot steer the save location', () => {
    expect(parseSellerReportPdfFileName('attachment; filename="../../etc/passwd.pdf"')).toBe(
      'passwd.pdf',
    )
    expect(parseSellerReportPdfFileName('attachment; filename="C:\\Windows\\evil.pdf"')).toBe(
      'evil.pdf',
    )
  })

  it('removes control characters, path separators and unsafe punctuation', () => {
    expect(parseSellerReportPdfFileName('attachment; filename="a\u0000b\t.pdf"')).toBe('ab.pdf')
    expect(parseSellerReportPdfFileName('attachment; filename="re:port?.pdf"')).toBe('report.pdf')
  })

  it('caps an over-long filename and keeps a single .pdf extension', () => {
    const long = `${'a'.repeat(400)}.pdf`
    const parsed = parseSellerReportPdfFileName(`attachment; filename="${long}"`)
    expect(parsed.length).toBeLessThanOrEqual(SELLER_REPORT_PDF_MAX_FILE_NAME_LENGTH + 4)
    expect(parsed.endsWith('.pdf')).toBe(true)
  })

  it('adds the .pdf extension when the header omitted it and never returns a dotfile', () => {
    expect(parseSellerReportPdfFileName('attachment; filename="reporte"')).toBe('reporte.pdf')
    expect(parseSellerReportPdfFileName('attachment; filename="..."')).toBe(
      SELLER_REPORT_PDF_FALLBACK_FILE_NAME,
    )
  })
})

describe('normalizeSellerReportPdfError — bounded blob JSON parsing', () => {
  it('turns a JSON error blob into a response-shaped object the failure parser reads', async () => {
    const error = {
      response: {
        status: 422,
        data: new Blob(
          [
            JSON.stringify({
              statusCode: 422,
              error: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED',
              rowLimit: 1000,
              rowCount: 1500,
            }),
          ],
          { type: 'application/json' },
        ),
      },
    }

    const normalized = await normalizeSellerReportPdfError(error)
    const data = (normalized as { response: { data: { error?: string } } }).response.data
    expect(data.error).toBe('SELLER_REPORT_ROW_LIMIT_EXCEEDED')
    expect((normalized as { response: { status: number } }).response.status).toBe(422)
  })

  it('returns the original error when the blob body is not valid JSON', async () => {
    const error = { response: { status: 500, data: new Blob(['boom'], { type: 'text/plain' }) } }
    await expect(normalizeSellerReportPdfError(error)).resolves.toBe(error)
  })

  it('returns the original error for a non-blob body (no parsing, no coercion)', async () => {
    const error = { response: { status: 404, data: { error: 'SELLER_NOT_FOUND' } } }
    await expect(normalizeSellerReportPdfError(error)).resolves.toBe(error)
  })

  it('refuses to read an oversized error blob', async () => {
    const huge = new Blob(['x'.repeat(SELLER_REPORT_PDF_MAX_ERROR_BYTES + 1)], {
      type: 'application/json',
    })
    const error = { response: { status: 500, data: huge } }
    await expect(normalizeSellerReportPdfError(error)).resolves.toBe(error)
  })

  it('skips the blob parse once the signal has been aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const error = {
      response: {
        status: 422,
        data: new Blob([JSON.stringify({ error: 'SELLER_REPORT_ROW_LIMIT_EXCEEDED' })], {
          type: 'application/json',
        }),
      },
    }
    await expect(normalizeSellerReportPdfError(error, controller.signal)).resolves.toBe(error)
  })

  it('returns the original error for anything that is not an axios-like failure', async () => {
    const plain = new Error('Network Error')
    await expect(normalizeSellerReportPdfError(plain)).resolves.toBe(plain)
    await expect(normalizeSellerReportPdfError(undefined)).resolves.toBeUndefined()
  })
})

describe('triggerSellerReportPdfDownload — safe anchor handoff', () => {
  it('downloads through a temporary anchor and revokes the object URL after a grace period', () => {
    vi.useFakeTimers()
    try {
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report')
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => undefined)
      const blob = pdfBlob()

      const { href, download } = captureAnchor(blob, 'reporte-ana.pdf')

      expect(createObjectURL).toHaveBeenCalledWith(blob)
      expect(href).toBe('blob:report')
      expect(download).toBe('reporte-ana.pdf')
      expect(click).toHaveBeenCalledTimes(1)
      // The anchor is removed immediately; the URL is not revoked prematurely.
      expect(document.querySelector('a')).toBeNull()
      expect(revokeObjectURL).not.toHaveBeenCalled()

      vi.advanceTimersByTime(SELLER_REPORT_PDF_REVOKE_GRACE_MS)
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')
    } finally {
      vi.useRealTimers()
    }
  })
})

/** Spy on `document.createElement('a')` to observe the anchor before removal. */
function captureAnchor(blob: Blob, fileName: string) {
  const realCreateElement = document.createElement.bind(document)
  let anchor: HTMLAnchorElement | null = null
  const createElement = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
      const element = realCreateElement(tagName, options)
      if (tagName === 'a') anchor = element as HTMLAnchorElement
      return element
    })

  triggerSellerReportPdfDownload(blob, fileName)

  const captured = anchor as HTMLAnchorElement | null
  createElement.mockRestore()
  return { href: captured?.href ?? '', download: captured?.download ?? '' }
}
