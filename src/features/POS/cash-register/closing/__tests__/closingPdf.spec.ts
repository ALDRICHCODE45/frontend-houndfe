/**
 * Corte PDF handling: the blob comes from the authenticated client; it is shown
 * through an object URL in a new tab or saved as corte-caja-<folio>.pdf, and the
 * object URL is always revoked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLOSING_PDF_VIEW_REVOKE_MS,
  closingPdfFileName,
  downloadClosingPdf,
  normalizeBlobError,
  showClosingPdf,
} from '../closingPdf'

const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })

beforeEach(() => {
  vi.useFakeTimers()
  URL.createObjectURL = vi.fn(() => 'blob:corte-1')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('closingPdfFileName', () => {
  it('uses the folio, sanitized like the backend', () => {
    expect(closingPdfFileName('CC-2f6d9c1e-8b7a')).toBe('corte-caja-CC-2f6d9c1e-8b7a.pdf')
    expect(closingPdfFileName('CC 1/../x\r\n')).toBe('corte-caja-CC1x.pdf')
    expect(closingPdfFileName('', 'id-1')).toBe('corte-caja-id-1.pdf')
  })
})

describe('downloadClosingPdf', () => {
  it('saves through a hidden anchor and revokes the object URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadClosingPdf(blob, 'corte-caja-CC-1.pdf')

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(click).toHaveBeenCalledTimes(1)
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('corte-caja-CC-1.pdf')
    expect(anchor.href).toBe('blob:corte-1')
    expect(anchor.isConnected).toBe(false)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:corte-1')
    click.mockRestore()
  })
})

describe('showClosingPdf', () => {
  it('points the pre-opened tab at the object URL, then revokes it', () => {
    const tab = { location: { href: '' }, opener: {} as unknown, closed: false } as unknown as Window

    const shown = showClosingPdf(blob, tab, 'corte-caja-CC-1.pdf')

    expect(shown).toBe('tab')
    expect(tab.location.href).toBe('blob:corte-1')
    expect(tab.opener).toBeNull()
    vi.advanceTimersByTime(CLOSING_PDF_VIEW_REVOKE_MS - 1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:corte-1')
  })

  it('falls back to a download when the tab was blocked', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    expect(showClosingPdf(blob, null, 'corte-caja-CC-1.pdf')).toBe('download')

    expect(click).toHaveBeenCalledTimes(1)
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:corte-1')
    click.mockRestore()
  })
})

describe('normalizeBlobError', () => {
  it('reads a JSON error envelope out of a blob body', async () => {
    const body = new Blob([JSON.stringify({ statusCode: 422, error: 'CASH_CLOSING_NOT_FOUND' })], {
      type: 'application/json',
    })
    const normalized = (await normalizeBlobError({ response: { status: 422, data: body } })) as {
      response: { data: { error: string } }
    }
    expect(normalized.response.data.error).toBe('CASH_CLOSING_NOT_FOUND')
  })

  it('returns the original error when the body is not JSON', async () => {
    const error = { response: { status: 500, data: new Blob(['<html>']) } }
    expect(await normalizeBlobError(error)).toBe(error)
    const plain = new Error('Network Error')
    expect(await normalizeBlobError(plain)).toBe(plain)
  })
})
