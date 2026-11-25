/**
 * Sales history backend data T4 (S1): one statement download at a time, a range checked before
 * any request, the file saved only after a complete PDF arrives, and the documented failures
 * turned into their messages.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef, type EffectScope } from 'vue'

const getStatementPdf = vi.fn()
vi.mock('../../api/customer.api', () => ({
  customerApi: { getStatementPdf: (...args: unknown[]) => getStatementPdf(...args) },
}))
const save = vi.fn()
vi.mock('../customerStatementFile', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveCustomerStatementPdf: (...args: unknown[]) => save(...args),
}))

const { useCustomerStatementDownload } = await import('../useCustomerStatementDownload')

const RANGE = { from: '2026-11-01', to: '2026-12-01' }
const PDF = { blob: new Blob(['%PDF-1.7']), fileName: 'cuenta.pdf' }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let scope: EffectScope
const customerId = shallowRef<string | undefined>('c-1')
function setup() {
  scope = effectScope()
  return scope.run(() => useCustomerStatementDownload(() => customerId.value))!
}

beforeEach(() => {
  getStatementPdf.mockReset()
  save.mockReset()
  customerId.value = 'c-1'
})
afterEach(() => scope?.stop())

describe('useCustomerStatementDownload', () => {
  it('downloads the PDF for the customer and range and saves it with the server name', async () => {
    getStatementPdf.mockResolvedValue(PDF)
    const download = setup()
    await expect(download.download(RANGE)).resolves.toBe(true)
    expect(getStatementPdf).toHaveBeenCalledWith('c-1', RANGE, {
      signal: expect.any(AbortSignal),
    })
    expect(save).toHaveBeenCalledWith(PDF.blob, 'cuenta.pdf')
    expect(download.error.value).toBeNull()
  })

  it('rejects an invalid range before calling the backend', async () => {
    const download = setup()
    await expect(download.download({ from: '2026-11-10', to: '2026-11-01' })).resolves.toBe(false)
    await expect(download.download({ from: '2026-01-01', to: '2027-01-03' })).resolves.toBe(false)
    await expect(download.download({ from: '2026-11-01', to: '' })).resolves.toBe(false)
    expect(getStatementPdf).not.toHaveBeenCalled()
  })

  it('is busy while downloading and ignores a second click', async () => {
    const pending = deferred<typeof PDF>()
    getStatementPdf.mockReturnValue(pending.promise)
    const download = setup()
    const first = download.download(RANGE)
    expect(download.isDownloading.value).toBe(true)
    await expect(download.download(RANGE)).resolves.toBe(false)
    expect(getStatementPdf).toHaveBeenCalledTimes(1)
    pending.resolve(PDF)
    await first
    expect(download.isDownloading.value).toBe(false)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      { response: { status: 400, data: {} } },
      'Revisa el periodo: debe ser de 1 a 366 días.',
      false,
    ],
    [
      { response: { status: 404, data: { error: 'CUSTOMER_NOT_FOUND' } } },
      'El cliente ya no existe.',
      false,
    ],
    [
      { response: { status: 500, data: { error: 'PDF_GENERATION_FAILED' } } },
      'No se pudo generar el estado de cuenta.',
      true,
    ],
    [new Error('Network Error'), 'No se pudo generar el estado de cuenta.', true],
  ])('maps a failure to its message and saves nothing (%#)', async (failure, message, canRetry) => {
    getStatementPdf.mockRejectedValue(failure)
    const download = setup()
    await expect(download.download(RANGE)).resolves.toBe(false)
    expect(download.error.value).toEqual({ message, canRetry })
    expect(download.isDownloading.value).toBe(false)
    expect(save).not.toHaveBeenCalled()
  })

  it('clears the previous error when a new download starts', async () => {
    getStatementPdf.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(PDF)
    const download = setup()
    await download.download(RANGE)
    expect(download.error.value).not.toBeNull()
    await download.download(RANGE)
    expect(download.error.value).toBeNull()
  })

  it('a customer change mid-download aborts it and saves nothing', async () => {
    const pending = deferred<typeof PDF>()
    getStatementPdf.mockReturnValue(pending.promise)
    const download = setup()
    const run = download.download(RANGE)
    const signal = getStatementPdf.mock.calls[0]![2].signal as AbortSignal
    customerId.value = 'c-2'
    await nextTick()
    expect(signal.aborted).toBe(true)
    pending.resolve(PDF)
    await expect(run).resolves.toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(download.isDownloading.value).toBe(false)
  })
})
