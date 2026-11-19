/**
 * T4/T5 API layer — close, closings list/detail, PDF blob, handover recipients
 * and the new session list filters (houndfe-backend
 * docs/frontend-handoff/25-cash-redesign.md §1, §2, §3, §5, §6).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cashApi } from '../cash.api'
import { http } from '@/core/shared/api/http'
import { csvParamsSerializer } from '@/core/shared/api/paramsSerializer'
import { CLOSING, CLOSING_ITEM } from '../../closing/__tests__/closingFixtures'

vi.mock('@/core/shared/api/http', () => ({
  http: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const SESSION_ID = '5b0c2a64-6f1e-4d8a-9a43-0e4c1c6f9d21'

beforeEach(() => {
  vi.mocked(http.get).mockReset()
  vi.mocked(http.post).mockReset()
})

describe('cashApi.listSessions — status / drawerOpen (§2)', () => {
  it('forwards status as an array (comma list on the wire) and drawerOpen as a boolean', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], page: 1, limit: 1, total: 0 } })

    await cashApi.listSessions({
      status: ['OPEN', 'COUNTING', 'SUBMITTED', 'OPEN'],
      drawerOpen: true,
      limit: 1,
    })

    const config = vi.mocked(http.get).mock.calls[0]?.[1] as { params: Record<string, unknown> }
    expect(config.params).toEqual({
      limit: 1,
      status: ['OPEN', 'COUNTING', 'SUBMITTED'],
      drawerOpen: true,
    })
    // The shared serializer turns the array into the comma list the backend accepts.
    expect(decodeURIComponent(csvParamsSerializer(config.params))).toBe(
      'limit=1&status=OPEN,COUNTING,SUBMITTED&drawerOpen=true',
    )
  })

  it('sends drawerOpen=false and drops an empty status list', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: { items: [], page: 1, limit: 25, total: 0 } })

    await cashApi.listSessions({ status: [], drawerOpen: false })

    expect(http.get).toHaveBeenCalledWith('/cash-sessions', { params: { drawerOpen: false } })
  })
})

describe('cashApi.closeSession (§5)', () => {
  it('POSTs /cash-sessions/:id/close with the trimmed notes and the Idempotency-Key', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: CLOSING })

    const result = await cashApi.closeSession(
      SESSION_ID,
      { notes: '  Cierre sin novedad  ' },
      'close-key-1',
    )

    expect(http.post).toHaveBeenCalledWith(
      `/cash-sessions/${SESSION_ID}/close`,
      { notes: 'Cierre sin novedad' },
      { headers: { 'Idempotency-Key': 'close-key-1' } },
    )
    expect(result).toEqual(CLOSING)
  })

  it('sends an empty body when there are no notes (never null, never blank)', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: CLOSING })

    await cashApi.closeSession(SESSION_ID, {}, 'k1')
    await cashApi.closeSession(SESSION_ID, { notes: '   ' }, 'k2')

    expect(vi.mocked(http.post).mock.calls[0]?.[1]).toEqual({})
    expect(vi.mocked(http.post).mock.calls[1]?.[1]).toEqual({})
  })

  it('drops any key other than notes', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: CLOSING })

    await cashApi.closeSession(
      SESSION_ID,
      { notes: 'ok', tenantId: 'leak', closedByUserId: 'leak' } as never,
      'k3',
    )

    expect(vi.mocked(http.post).mock.calls[0]?.[1]).toEqual({ notes: 'ok' })
  })

  it('rejects notes longer than 2000 characters before any request', async () => {
    await expect(cashApi.closeSession(SESSION_ID, { notes: 'x'.repeat(2001) }, 'k4')).rejects.toThrow(
      RangeError,
    )
    expect(http.post).not.toHaveBeenCalled()
  })
})

describe('cashApi closings (§3, §6)', () => {
  it('lists closings with only the documented filters', async () => {
    const page = { items: [{ ...CLOSING_ITEM, sessionId: SESSION_ID }], page: 2, limit: 10, total: 11 }
    vi.mocked(http.get).mockResolvedValue({ data: page })

    const result = await cashApi.listClosings({
      page: 2,
      limit: 10,
      registerId: 'r-1',
      cashierUserId: 'c-1',
      from: '2026-11-01T06:00:00.000Z',
      to: '2026-11-02T06:00:00.000Z',
      tenantId: 'leak',
      status: ['CLOSED'],
    } as never)

    expect(http.get).toHaveBeenCalledWith('/cash-closings', {
      params: {
        page: 2,
        limit: 10,
        registerId: 'r-1',
        cashierUserId: 'c-1',
        from: '2026-11-01T06:00:00.000Z',
        to: '2026-11-02T06:00:00.000Z',
      },
    })
    expect(result).toEqual(page)
  })

  it('reads one closing document untouched', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: CLOSING })

    const result = await cashApi.getClosing(CLOSING.id)

    expect(http.get).toHaveBeenCalledWith(`/cash-closings/${CLOSING.id}`)
    expect(result).toEqual(CLOSING)
  })

  it('fetches the PDF as a Blob through the authenticated client (no public URL)', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    vi.mocked(http.get).mockResolvedValue({ data: blob })
    const controller = new AbortController()

    const result = await cashApi.getClosingPdf(CLOSING.id, { signal: controller.signal })

    expect(http.get).toHaveBeenCalledWith(`/cash-closings/${CLOSING.id}/pdf`, {
      responseType: 'blob',
      signal: controller.signal,
    })
    expect(result).toBe(blob)
  })

  it('omits the signal when none is given', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: new Blob(['x']) })

    await cashApi.getClosingPdf(CLOSING.id)

    expect(http.get).toHaveBeenCalledWith(`/cash-closings/${CLOSING.id}/pdf`, {
      responseType: 'blob',
    })
  })
})

describe('cashApi.listHandoverRecipients (§1)', () => {
  it('GETs /cash-handovers/recipients with only kind and returns the items', async () => {
    const items = [{ userId: 'u-1', displayName: 'Beatriz Admin', roleName: 'Administrador' }]
    vi.mocked(http.get).mockResolvedValue({ data: { items } })

    const result = await cashApi.listHandoverRecipients('WITHDRAWAL')

    expect(http.get).toHaveBeenCalledWith('/cash-handovers/recipients', {
      params: { kind: 'WITHDRAWAL' },
    })
    expect(result).toEqual(items)
  })
})
