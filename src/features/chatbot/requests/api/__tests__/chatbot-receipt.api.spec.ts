/**
 * Transfer receipt files (GET /sales/:id/receipts/:receiptId/file|preview): streamed by the API
 * behind the Bearer token, so they are fetched as a Blob through the shared `http`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { chatbotReceiptApi, receiptFilePath } from '../chatbot-receipt.api'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn() } }))

const get = vi.mocked(http.get)

beforeEach(() => get.mockReset())

describe('receiptFilePath', () => {
  it('accepts only the API-relative file and preview paths the backend sends', () => {
    expect(receiptFilePath('/sales/s-1/receipts/r-1/file')).toBe('/sales/s-1/receipts/r-1/file')
    expect(receiptFilePath(' /sales/s-1/receipts/r-1/preview ')).toBe('/sales/s-1/receipts/r-1/preview')
  })

  it('rejects anything else, so the Bearer token never leaves for another path or host', () => {
    for (const value of [
      null,
      undefined,
      '',
      'https://evil.example.com/sales/s-1/receipts/r-1/file',
      '//evil.example.com/sales/s-1/receipts/r-1/file',
      '/sales/s-1/receipts/r-1/file?x=1',
      '/sales/s-1/receipts/r-1/other',
      '/sales/../users/receipts/r-1/file',
      '/users/me',
      'javascript:alert(1)',
    ]) {
      expect(receiptFilePath(value)).toBeNull()
    }
  })
})

describe('chatbotReceiptApi.getFile', () => {
  it('GETs the path as a blob with the signal and returns the Blob', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    get.mockResolvedValue({ data: blob })
    const signal = new AbortController().signal

    const result = await chatbotReceiptApi.getFile('/sales/s-1/receipts/r-1/file', { signal })

    expect(result).toBe(blob)
    expect(get).toHaveBeenCalledWith('/sales/s-1/receipts/r-1/file', { responseType: 'blob', signal })
  })
})
