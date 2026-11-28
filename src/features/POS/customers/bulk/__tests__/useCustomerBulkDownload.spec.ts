/**
 * customers-bulk-actions T1 (S3, handoff 33 «Flujo sugerido»): one bulk download at a time — the
 * file is saved only after the whole Blob arrives; «Cancelar» aborts and shows nothing; 404 offers
 * «Reintentar sin ellos»; 429 waits retryAfterSeconds before the retry is enabled; TOO_LARGE / EMPTY
 * refetch the table.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { CustomerBulkSelection } from '../customerBulkSelection'

const bulkExportCustomers = vi.fn()
const bulkCustomerStatements = vi.fn()
vi.mock('../../api/customer.api', () => ({
  customerApi: {
    bulkExportCustomers: (...args: unknown[]) => bulkExportCustomers(...args),
    bulkCustomerStatements: (...args: unknown[]) => bulkCustomerStatements(...args),
  },
}))
const saveBlobAsFile = vi.fn()
vi.mock('@/core/shared/utils/downloadFile', () => ({
  saveBlobAsFile: (...args: unknown[]) => saveBlobAsFile(...args),
}))

const { useCustomerBulkDownload } = await import('../useCustomerBulkDownload')

const httpError = (status: number, data: unknown) => ({ response: { status, data } })
const RANGE = { from: '2026-11-01', to: '2026-12-01' }

function setup(initial: CustomerBulkSelection | null = { mode: 'ids', customerIds: ['a', 'b', 'c'] }) {
  const selection = ref<CustomerBulkSelection | null>(initial)
  const removeIds = vi.fn((ids: string[]) => {
    const current = selection.value
    if (current?.mode === 'ids') {
      selection.value = { mode: 'ids', customerIds: current.customerIds.filter((id) => !ids.includes(id)) }
    }
  })
  const refetch = vi.fn()
  const onSaved = vi.fn()
  const scope = effectScope()
  const download = scope.run(() =>
    useCustomerBulkDownload({
      selection: () => selection.value,
      sort: () => ({ sortBy: 'createdAt', sortOrder: 'desc' }),
      removeIds,
      refetch,
      onSaved,
    }),
  )!
  return { selection, removeIds, refetch, onSaved, download, scope }
}

beforeEach(() => {
  bulkExportCustomers.mockReset()
  bulkCustomerStatements.mockReset()
  saveBlobAsFile.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('useCustomerBulkDownload — success', () => {
  it('exports the CSV with the selection and the table sort, then saves it with the server name', async () => {
    const blob = new Blob(['x'])
    bulkExportCustomers.mockResolvedValue({ blob, fileName: 'clientes-2026-11-27.csv' })
    const { download, onSaved } = setup()

    await download.start({ kind: 'csv' })

    expect(bulkExportCustomers).toHaveBeenCalledWith(
      { selection: { mode: 'ids', customerIds: ['a', 'b', 'c'] }, sortBy: 'createdAt', sortOrder: 'desc' },
      { signal: expect.any(AbortSignal) },
    )
    expect(saveBlobAsFile).toHaveBeenCalledWith(blob, 'clientes-2026-11-27.csv')
    expect(onSaved).toHaveBeenCalledWith('clientes-2026-11-27.csv', 'csv')
    expect(download.isRunning.value).toBe(false)
    expect(download.error.value).toBeNull()
  })

  it('downloads the statements ZIP with from/to', async () => {
    bulkCustomerStatements.mockResolvedValue({ blob: new Blob(['PK']), fileName: 'e.zip' })
    const { download } = setup()
    await download.start({ kind: 'statements', range: RANGE })
    expect(bulkCustomerStatements).toHaveBeenCalledWith(
      { selection: { mode: 'ids', customerIds: ['a', 'b', 'c'] }, ...RANGE },
      { signal: expect.any(AbortSignal) },
    )
    expect(saveBlobAsFile).toHaveBeenCalledWith(expect.any(Blob), 'e.zip')
  })

  it('never starts without a selection or with an invalid period, nor twice at once', async () => {
    const { download, selection } = setup()
    await download.start({ kind: 'statements', range: { from: '2026-11-01', to: '' } })
    expect(bulkCustomerStatements).not.toHaveBeenCalled()

    let resolve!: (value: unknown) => void
    bulkExportCustomers.mockReturnValue(new Promise((r) => (resolve = r)))
    const first = download.start({ kind: 'csv' })
    expect(download.isRunning.value).toBe(true)
    await download.start({ kind: 'csv' })
    expect(bulkExportCustomers).toHaveBeenCalledTimes(1)
    resolve({ blob: new Blob(['x']), fileName: 'a.csv' })
    await first

    selection.value = null
    await download.start({ kind: 'csv' })
    expect(bulkExportCustomers).toHaveBeenCalledTimes(1)
  })
})

describe('useCustomerBulkDownload — cancel', () => {
  it('«Cancelar» aborts the request; nothing is saved and no error shows', async () => {
    let signal!: AbortSignal
    bulkCustomerStatements.mockImplementation(
      (_body: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal = options.signal
          signal.addEventListener('abort', () => reject(new Error('canceled')))
        }),
    )
    const { download } = setup()
    const run = download.start({ kind: 'statements', range: RANGE })
    expect(download.isRunning.value).toBe(true)

    download.cancel()
    await run

    expect(signal.aborted).toBe(true)
    expect(download.isRunning.value).toBe(false)
    expect(download.error.value).toBeNull()
    expect(saveBlobAsFile).not.toHaveBeenCalled()
  })

  it('aborts when its scope is disposed', () => {
    let signal!: AbortSignal
    bulkExportCustomers.mockImplementation((_b: unknown, options: { signal: AbortSignal }) => {
      signal = options.signal
      return new Promise(() => {})
    })
    const { download, scope } = setup()
    void download.start({ kind: 'csv' })
    scope.stop()
    expect(signal.aborted).toBe(true)
  })
})

describe('useCustomerBulkDownload — errors', () => {
  it('404 → offers «Reintentar sin ellos»: removes the missing ids and runs again', async () => {
    bulkExportCustomers.mockRejectedValueOnce(
      httpError(404, { code: 'BULK_CUSTOMERS_NOT_FOUND', details: { missingIds: ['b'] } }),
    )
    bulkExportCustomers.mockResolvedValueOnce({ blob: new Blob(['x']), fileName: 'c.csv' })
    const { download, removeIds } = setup()

    await download.start({ kind: 'csv' })
    expect(download.error.value).toMatchObject({ code: 'BULK_CUSTOMERS_NOT_FOUND', missingIds: ['b'] })
    expect(download.canRetryWithoutMissing.value).toBe(true)

    await download.retryWithoutMissing()
    expect(removeIds).toHaveBeenCalledWith(['b'])
    expect(bulkExportCustomers).toHaveBeenLastCalledWith(
      expect.objectContaining({ selection: { mode: 'ids', customerIds: ['a', 'c'] } }),
      expect.anything(),
    )
    expect(download.error.value).toBeNull()
    expect(saveBlobAsFile).toHaveBeenCalledTimes(1)
  })

  it('404 where every customer is missing offers no retry', async () => {
    bulkExportCustomers.mockRejectedValueOnce(
      httpError(404, { code: 'BULK_CUSTOMERS_NOT_FOUND', details: { missingIds: ['a', 'b', 'c'] } }),
    )
    const { download } = setup()
    await download.start({ kind: 'csv' })
    expect(download.canRetryWithoutMissing.value).toBe(false)
  })

  it('429 → the retry waits retryAfterSeconds, then is enabled', async () => {
    vi.useFakeTimers()
    bulkCustomerStatements.mockRejectedValueOnce(
      httpError(429, { code: 'BULK_EXPORT_BUSY', details: { retryAfterSeconds: 3 } }),
    )
    bulkCustomerStatements.mockResolvedValueOnce({ blob: new Blob(['PK']), fileName: 'e.zip' })
    const { download } = setup()

    await download.start({ kind: 'statements', range: RANGE })
    expect(download.retryIn.value).toBe(3)
    expect(download.error.value?.message).toBe('Hay otra descarga en curso; reintenta en 3 s.')
    expect(download.canRetry.value).toBe(false)

    vi.advanceTimersByTime(2_000)
    expect(download.retryIn.value).toBe(1)
    expect(download.error.value?.message).toBe('Hay otra descarga en curso; reintenta en 1 s.')
    vi.advanceTimersByTime(1_000)
    expect(download.retryIn.value).toBe(0)
    expect(download.canRetry.value).toBe(true)

    await download.retry()
    expect(bulkCustomerStatements).toHaveBeenCalledTimes(2)
    expect(bulkCustomerStatements.mock.calls[1]![0]).toMatchObject(RANGE)
    expect(saveBlobAsFile).toHaveBeenCalledTimes(1)
  })

  it('503 → «La descarga tardó demasiado; prueba con menos clientes»', async () => {
    bulkCustomerStatements.mockRejectedValueOnce(httpError(503, { code: 'BULK_EXPORT_TIMEOUT' }))
    const { download } = setup()
    await download.start({ kind: 'statements', range: RANGE })
    expect(download.error.value?.message).toBe('La descarga tardó demasiado; prueba con menos clientes.')
    expect(download.canRetry.value).toBe(false)
  })

  it('TOO_LARGE / EMPTY → explain and refetch the table', async () => {
    bulkCustomerStatements.mockRejectedValueOnce(
      httpError(400, { code: 'BULK_SELECTION_TOO_LARGE', details: { count: 60, max: 50 } }),
    )
    bulkCustomerStatements.mockRejectedValueOnce(httpError(400, { code: 'BULK_SELECTION_EMPTY' }))
    const { download, refetch } = setup()
    await download.start({ kind: 'statements', range: RANGE })
    expect(refetch).toHaveBeenCalledTimes(1)
    await download.start({ kind: 'statements', range: RANGE })
    expect(refetch).toHaveBeenCalledTimes(2)
    expect(download.error.value?.code).toBe('BULK_SELECTION_EMPTY')
  })

  it('PDF_GENERATION_FAILED offers a plain retry', async () => {
    bulkCustomerStatements.mockRejectedValueOnce(httpError(500, { code: 'PDF_GENERATION_FAILED' }))
    const { download } = setup()
    await download.start({ kind: 'statements', range: RANGE })
    expect(download.canRetry.value).toBe(true)
  })
})
