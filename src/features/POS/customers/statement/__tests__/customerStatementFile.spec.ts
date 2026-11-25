/**
 * Sales history backend data T4 (S1, handoff 29 §1-§2): the statement file name comes from
 * `Content-Disposition` (fallback `estado-de-cuenta-<customerId>-<from>-<to>.pdf`), only a real PDF
 * is saved, and each documented failure has its own message.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  customerStatementErrorMessage,
  customerStatementFallbackFileName,
  isCustomerStatementPdfBlob,
  parseCustomerStatementFileName,
  readCustomerStatementBlobError,
  saveCustomerStatementPdf,
} from '../customerStatementFile'

const RANGE = { from: '2026-11-01', to: '2026-12-01' }
const FALLBACK = 'estado-de-cuenta-c-1-2026-11-01-2026-12-01.pdf'

describe('customer statement file name', () => {
  it('builds the fallback from the customer and the half-open range', () => {
    expect(customerStatementFallbackFileName('c-1', RANGE)).toBe(FALLBACK)
  })

  it('uses the quoted filename the backend sends', () => {
    expect(
      parseCustomerStatementFileName(
        'attachment; filename="estado-de-cuenta-abc-2026-11-01-2026-12-01.pdf"',
        FALLBACK,
      ),
    ).toBe('estado-de-cuenta-abc-2026-11-01-2026-12-01.pdf')
  })

  it('prefers the RFC 5987 form and accepts a bare token', () => {
    expect(
      parseCustomerStatementFileName(
        'attachment; filename="x.pdf"; filename*=UTF-8\'\'estado%20de%20cuenta.pdf',
        FALLBACK,
      ),
    ).toBe('estado de cuenta.pdf')
    expect(parseCustomerStatementFileName('attachment; filename=cuenta.pdf', FALLBACK)).toBe(
      'cuenta.pdf',
    )
  })

  it('falls back when the header is missing, empty or unusable', () => {
    expect(parseCustomerStatementFileName(undefined, FALLBACK)).toBe(FALLBACK)
    expect(parseCustomerStatementFileName('', FALLBACK)).toBe(FALLBACK)
    expect(parseCustomerStatementFileName('attachment', FALLBACK)).toBe(FALLBACK)
    expect(parseCustomerStatementFileName('attachment; filename="..."', FALLBACK)).toBe(FALLBACK)
  })

  it('strips paths and reserved characters and keeps the .pdf extension', () => {
    expect(
      parseCustomerStatementFileName('attachment; filename="../../etc/pass:wd"', FALLBACK),
    ).toBe('passwd.pdf')
  })
})

describe('customer statement PDF check', () => {
  it('accepts a real PDF and refuses JSON, HTML or a fake PDF', async () => {
    await expect(
      isCustomerStatementPdfBlob(new Blob(['%PDF-1.7 body'], { type: 'application/pdf' })),
    ).resolves.toBe(true)
    await expect(isCustomerStatementPdfBlob(new Blob(['%PDF-1.4']))).resolves.toBe(true)
    await expect(
      isCustomerStatementPdfBlob(new Blob(['{"error":"x"}'], { type: 'application/json' })),
    ).resolves.toBe(false)
    await expect(
      isCustomerStatementPdfBlob(new Blob(['not a pdf'], { type: 'application/pdf' })),
    ).resolves.toBe(false)
  })
})

describe('customer statement blob errors', () => {
  it('reads a JSON error body out of a Blob', async () => {
    const body = { statusCode: 404, error: 'CUSTOMER_NOT_FOUND', message: 'CUSTOMER_NOT_FOUND' }
    const error = {
      response: {
        status: 404,
        data: new Blob([JSON.stringify(body)], { type: 'application/json' }),
      },
    }
    await expect(readCustomerStatementBlobError(error)).resolves.toEqual({
      response: { status: 404, data: body },
    })
  })

  it('returns the original error for a non-JSON or non-Blob body', async () => {
    const html = { response: { status: 500, data: new Blob(['<html>'], { type: 'text/html' }) } }
    await expect(readCustomerStatementBlobError(html)).resolves.toBe(html)
    const network = new Error('Network Error')
    await expect(readCustomerStatementBlobError(network)).resolves.toBe(network)
  })
})

describe('customer statement error messages', () => {
  it('400 asks to check the period, without retry', () => {
    expect(customerStatementErrorMessage({ response: { status: 400, data: {} } })).toEqual({
      message: 'Revisa el periodo: debe ser de 1 a 366 días.',
      canRetry: false,
    })
  })

  it('404 CUSTOMER_NOT_FOUND says the customer no longer exists', () => {
    expect(
      customerStatementErrorMessage({
        response: { status: 404, data: { error: 'CUSTOMER_NOT_FOUND' } },
      }),
    ).toEqual({ message: 'El cliente ya no existe.', canRetry: false })
  })

  it('403 says there is no permission', () => {
    expect(customerStatementErrorMessage({ response: { status: 403, data: {} } })).toEqual({
      message: 'No tienes permiso para descargar el estado de cuenta.',
      canRetry: false,
    })
  })

  it('500 PDF_GENERATION_FAILED, a network error or a non-PDF body can be retried', () => {
    const generic = { message: 'No se pudo generar el estado de cuenta.', canRetry: true }
    expect(
      customerStatementErrorMessage({
        response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } },
      }),
    ).toEqual(generic)
    expect(customerStatementErrorMessage(new Error('Network Error'))).toEqual(generic)
    expect(customerStatementErrorMessage(new Error('CUSTOMER_STATEMENT_NON_PDF_BODY'))).toEqual(
      generic,
    )
  })
})

describe('customer statement save', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('saves through a temporary anchor with the file name and revokes the URL later', () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:statement')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const clicks: HTMLAnchorElement[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this)
    })

    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    saveCustomerStatementPdf(blob, 'cuenta.pdf')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicks).toHaveLength(1)
    expect(clicks[0]!.download).toBe('cuenta.pdf')
    expect(clicks[0]!.isConnected).toBe(false)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:statement')
    click.mockRestore()
  })
})
