/**
 * customers-bulk-actions T1: the generic browser half of an authenticated file download — the name
 * from `Content-Disposition` (sanitized, with the extension forced) and the save through a temporary
 * anchor whose object URL is revoked shortly after.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseContentDispositionFileName, saveBlobAsFile } from '../downloadFile'

describe('parseContentDispositionFileName', () => {
  const FALLBACK = 'clientes-2026-11-27.csv'

  it('reads the quoted filename', () => {
    expect(
      parseContentDispositionFileName('attachment; filename="clientes-2026-11-27.csv"', FALLBACK, '.csv'),
    ).toBe('clientes-2026-11-27.csv')
  })

  it('prefers the RFC 5987 filename* and decodes it', () => {
    expect(
      parseContentDispositionFileName(
        `attachment; filename="x.zip"; filename*=UTF-8''estados%20de%20cuenta.zip`,
        'f.zip',
        '.zip',
      ),
    ).toBe('estados de cuenta.zip')
  })

  it('reads a bare filename', () => {
    expect(parseContentDispositionFileName('attachment; filename=export.csv', FALLBACK, '.csv')).toBe('export.csv')
  })

  it('falls back without the header or without a filename', () => {
    expect(parseContentDispositionFileName(null, FALLBACK, '.csv')).toBe(FALLBACK)
    expect(parseContentDispositionFileName(undefined, FALLBACK, '.csv')).toBe(FALLBACK)
    expect(parseContentDispositionFileName('', FALLBACK, '.csv')).toBe(FALLBACK)
    expect(parseContentDispositionFileName('attachment', FALLBACK, '.csv')).toBe(FALLBACK)
  })

  it('strips paths and reserved characters and forces the extension', () => {
    expect(parseContentDispositionFileName('attachment; filename="../../etc/pa:ss"', FALLBACK, '.csv')).toBe(
      'pass.csv',
    )
    expect(parseContentDispositionFileName('attachment; filename="..."', FALLBACK, '.csv')).toBe(FALLBACK)
    expect(parseContentDispositionFileName('attachment; filename="reporte.ZIP"', 'f.zip', '.zip')).toBe(
      'reporte.zip',
    )
  })
})

describe('saveBlobAsFile', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('clicks a detached anchor with the name and revokes the URL later', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:1')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    saveBlobAsFile(new Blob(['a']), 'clientes.csv')

    expect(click).toHaveBeenCalledTimes(1)
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('clientes.csv')
    expect(anchor.isConnected).toBe(false)
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:1')
  })
})
