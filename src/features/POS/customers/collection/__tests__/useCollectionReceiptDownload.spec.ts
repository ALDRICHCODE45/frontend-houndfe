/**
 * «Cobrar todo» T1 (S2; handoff 30 §7): «Imprimir comprobante» (ticket) and «Descargar A4» save
 * the validated PDF under the backend name; a failure maps to Spanish copy.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getReceiptPdf = vi.fn()
vi.mock('../collection.api', () => ({
  customerCollectionApi: { getReceiptPdf: (...args: unknown[]) => getReceiptPdf(...args) },
}))
const savePdf = vi.fn()
vi.mock('@/features/POS/customers/statement/customerStatementFile', () => ({
  saveCustomerStatementPdf: (...args: unknown[]) => savePdf(...args),
}))

const { useCollectionReceiptDownload } = await import('../useCollectionReceiptDownload')

beforeEach(() => {
  getReceiptPdf.mockReset()
  savePdf.mockReset()
})

describe('useCollectionReceiptDownload', () => {
  it('downloads the ticket and saves it with the backend file name', async () => {
    const blob = new Blob(['%PDF-'])
    getReceiptPdf.mockResolvedValue({ blob, fileName: 'comprobante-cobro-col-1.pdf' })
    const receipt = useCollectionReceiptDownload(() => 'col-1')
    expect(await receipt.download('ticket')).toBe(true)
    expect(getReceiptPdf).toHaveBeenCalledWith('col-1', 'ticket')
    expect(savePdf).toHaveBeenCalledWith(blob, 'comprobante-cobro-col-1.pdf')
  })

  it('downloads the A4 format', async () => {
    getReceiptPdf.mockResolvedValue({ blob: new Blob(['%PDF-']), fileName: 'x.pdf' })
    const receipt = useCollectionReceiptDownload(() => 'col-1')
    await receipt.download('a4')
    expect(getReceiptPdf).toHaveBeenCalledWith('col-1', 'a4')
  })

  it('maps a failure to Spanish copy and saves nothing', async () => {
    getReceiptPdf.mockRejectedValue({
      response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } },
    })
    const receipt = useCollectionReceiptDownload(() => 'col-1')
    expect(await receipt.download('ticket')).toBe(false)
    expect(savePdf).not.toHaveBeenCalled()
    expect(receipt.error.value).toContain('No se pudo generar el comprobante')
  })

  it('ignores a second click while one download runs', async () => {
    getReceiptPdf.mockReturnValue(new Promise(() => {}))
    const receipt = useCollectionReceiptDownload(() => 'col-1')
    void receipt.download('ticket')
    expect(receipt.downloading.value).toBe('ticket')
    expect(await receipt.download('a4')).toBe(false)
    expect(getReceiptPdf).toHaveBeenCalledTimes(1)
  })
})
