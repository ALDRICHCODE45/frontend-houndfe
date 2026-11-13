/**
 * Chatbot request transport. Mocks the shared axios `http`; pins exact URLs, the params that are
 * sent (and the ones that never are) and the `Idempotency-Key` header of every command.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { chatbotRequestApi } from '../chatbot-request.api'
import { countsFixture, makeGroup, makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const KEY = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const signal = new AbortController().signal

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('chatbotRequestApi reads', () => {
  it('groups: GET /chatbot-requests/groups with only the known filters and the signal', async () => {
    const page = { items: [makeGroup('k1.a')], nextCursor: 'c2' }
    get.mockResolvedValue({ data: page })

    const result = await chatbotRequestApi.listGroups(
      {
        status: 'open',
        subtype: 'RESTOCK',
        assignee: 'me',
        overdue: true,
        windowClosingSoon: false,
        q: 'S-123',
        cursor: 'c1',
        limit: 25,
        // @ts-expect-error unknown params must never reach the wire
        foo: 'bar',
      },
      { signal },
    )

    expect(result).toBe(page)
    expect(get).toHaveBeenCalledWith('/chatbot-requests/groups', {
      params: {
        status: 'open',
        subtype: 'RESTOCK',
        assignee: 'me',
        overdue: true,
        windowClosingSoon: false,
        q: 'S-123',
        cursor: 'c1',
        limit: 25,
      },
      signal,
    })
  })

  it('groups: drops undefined, null and blank values (a blank q is ignored by the backend anyway)', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } })
    await chatbotRequestApi.listGroups({ status: 'open', q: '  ', cursor: undefined, assignee: '' })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/groups', {
      params: { status: 'open' },
      signal: undefined,
    })
  })

  it('by customer: GET /chatbot-requests with the required customerKey', async () => {
    get.mockResolvedValue({ data: { items: [makeRow()], nextCursor: null } })
    await chatbotRequestApi.listByCustomer(
      { customerKey: 'k1.a', status: 'resolved', cursor: 'c', limit: 50 },
      { signal },
    )
    expect(get).toHaveBeenCalledWith('/chatbot-requests', {
      params: { customerKey: 'k1.a', status: 'resolved', cursor: 'c', limit: 50 },
      signal,
    })
  })

  it('by customer: sends the list filters of groups (handoff 14 §15.1), false included', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } })
    await chatbotRequestApi.listByCustomer({
      customerKey: 'k1.a',
      status: 'open',
      subtype: 'COMPLAINT',
      assignee: 'unassigned',
      overdue: true,
      windowClosingSoon: false,
      q: 'rosa',
      limit: 25,
    })
    expect(get).toHaveBeenCalledWith('/chatbot-requests', {
      params: {
        customerKey: 'k1.a',
        status: 'open',
        subtype: 'COMPLAINT',
        assignee: 'unassigned',
        overdue: true,
        windowClosingSoon: false,
        q: 'rosa',
        limit: 25,
      },
      signal: undefined,
    })
  })

  it('by customer: leaves out blank filters and drops any key it does not know', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } })
    await chatbotRequestApi.listByCustomer({
      customerKey: 'k1.a',
      q: '   ',
      assignee: undefined,
      // @ts-expect-error `resolvedBy` belongs to history, not to ?customerKey=
      resolvedBy: 'u-1',
    })
    expect((get.mock.calls[0]![1] as { params: object }).params).toEqual({ customerKey: 'k1.a' })
  })

  it('counts: GET /chatbot-requests/counts with no params', async () => {
    get.mockResolvedValue({ data: countsFixture })
    expect(await chatbotRequestApi.getCounts({ signal })).toBe(countsFixture)
    expect(get).toHaveBeenCalledWith('/chatbot-requests/counts', { signal })
  })

  it('history: GET /chatbot-requests/history with its own filters, never q', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } })
    await chatbotRequestApi.listHistory(
      {
        subtype: 'COMPLAINT',
        resolvedBy: 'u-1',
        customerKey: 'k1.a',
        from: '2026-10-01',
        to: '2026-10-31',
        cursor: 'c',
        limit: 10,
        // @ts-expect-error history has no free-text search (400 like any unknown parameter)
        q: 'maria',
      },
      { signal },
    )
    expect(get).toHaveBeenCalledWith('/chatbot-requests/history', {
      params: {
        subtype: 'COMPLAINT',
        resolvedBy: 'u-1',
        customerKey: 'k1.a',
        from: '2026-10-01',
        to: '2026-10-31',
        cursor: 'c',
        limit: 10,
      },
      signal,
    })
  })

  it('detail: GET /chatbot-requests/:id', async () => {
    get.mockResolvedValue({ data: { id: 'req-1' } })
    await chatbotRequestApi.getDetail('req-1', { signal })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1', { signal })
  })

  it('audit: GET /chatbot-requests/:id/audit with cursor and limit only', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } })
    await chatbotRequestApi.listAudit('req-1', { cursor: 'c', limit: 20 }, { signal })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1/audit', {
      params: { cursor: 'c', limit: 20 },
      signal,
    })
  })

  it('merge candidates: GET /chatbot-requests/:id/merge-candidates', async () => {
    get.mockResolvedValue({ data: { items: [] } })
    await chatbotRequestApi.listMergeCandidates('req-1', { signal })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1/merge-candidates', { signal })
  })

  it('assignable users: GET /chatbot-requests/assignable-users', async () => {
    get.mockResolvedValue({ data: { items: [{ id: 'u1', displayName: 'Ana' }] } })
    const result = await chatbotRequestApi.listAssignableUsers({ signal })
    expect(result.items).toHaveLength(1)
    expect(get).toHaveBeenCalledWith('/chatbot-requests/assignable-users', { signal })
  })

  it('zone impact: GET /chatbot-requests/:id/zone-impact', async () => {
    get.mockResolvedValue({ data: { requests: 4, customers: 3, setVersion: 7 } })
    expect(await chatbotRequestApi.getZoneImpact('req-1', { signal })).toEqual({
      requests: 4,
      customers: 3,
      setVersion: 7,
    })
    expect(get).toHaveBeenCalledWith('/chatbot-requests/req-1/zone-impact', { signal })
  })
})

describe('chatbotRequestApi commands', () => {
  const summary = { request: { id: 'req-1', version: 2 } }
  const headers = { headers: { 'Idempotency-Key': KEY } }

  beforeEach(() => post.mockResolvedValue({ data: summary }))

  it('claim: POST /:id/claim with the body and the caller-provided Idempotency-Key', async () => {
    expect(await chatbotRequestApi.claim('req-1', { expectedVersion: 1 }, KEY)).toBe(summary)
    expect(post).toHaveBeenCalledWith('/chatbot-requests/req-1/claim', { expectedVersion: 1 }, headers)
  })

  it('release: POST /:id/release', async () => {
    await chatbotRequestApi.release('req-1', { expectedVersion: 2 }, KEY)
    expect(post).toHaveBeenCalledWith('/chatbot-requests/req-1/release', { expectedVersion: 2 }, headers)
  })

  it('reassign: POST /:id/reassign with toUserId and the optional note', async () => {
    await chatbotRequestApi.reassign(
      'req-1',
      { expectedVersion: 2, toUserId: 'u-2', note: 'Cambio de turno' },
      KEY,
    )
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/reassign',
      { expectedVersion: 2, toUserId: 'u-2', note: 'Cambio de turno' },
      headers,
    )
  })

  it('reassign: leaves a blank note out of the body', async () => {
    await chatbotRequestApi.reassign('req-1', { expectedVersion: 2, toUserId: 'u-2', note: '  ' }, KEY)
    expect(post.mock.calls[0]![1]).toEqual({ expectedVersion: 2, toUserId: 'u-2' })
  })

  it('cancel: POST /:id/cancel with reason, note and customerNote', async () => {
    await chatbotRequestApi.cancel(
      'req-1',
      {
        expectedVersion: 1,
        reason: 'NOT_ACTIONABLE',
        note: 'Fuera de giro',
        customerNote: 'Por ahora no podemos ayudarte con eso.',
      },
      KEY,
    )
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/cancel',
      {
        expectedVersion: 1,
        reason: 'NOT_ACTIONABLE',
        note: 'Fuera de giro',
        customerNote: 'Por ahora no podemos ayudarte con eso.',
      },
      headers,
    )
  })

  it('cancel: omits empty optional notes and never sends customerNote with DUPLICATE', async () => {
    await chatbotRequestApi.cancel('req-1', { expectedVersion: 1, reason: 'CUSTOMER_UNREACHABLE', customerNote: '' }, KEY)
    expect(post.mock.calls[0]![1]).toEqual({ expectedVersion: 1, reason: 'CUSTOMER_UNREACHABLE' })

    await chatbotRequestApi.cancel(
      'req-1',
      { expectedVersion: 1, reason: 'DUPLICATE', note: 'Repetida', customerNote: 'hola' },
      KEY,
    )
    expect(post.mock.calls[1]![1]).toEqual({ expectedVersion: 1, reason: 'DUPLICATE', note: 'Repetida' })
  })

  it('merge: POST /:id/merge with intoRequestId and intoExpectedVersion', async () => {
    await chatbotRequestApi.merge(
      'req-1',
      { expectedVersion: 2, intoRequestId: 'req-9', intoExpectedVersion: 4 },
      KEY,
    )
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/merge',
      { expectedVersion: 2, intoRequestId: 'req-9', intoExpectedVersion: 4 },
      headers,
    )
  })

  it('link-customer: POST /:id/link-customer', async () => {
    await chatbotRequestApi.linkCustomer('req-1', { expectedVersion: 1, customerId: 'c-1' }, KEY)
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/link-customer',
      { expectedVersion: 1, customerId: 'c-1' },
      headers,
    )
  })

  it('reply: POST /:id/reply sends exactly {expectedVersion, text} and never type, mediaId or caption', async () => {
    await chatbotRequestApi.reply(
      'req-1',
      {
        expectedVersion: 2,
        text: 'Sí, es apto desde las 8 semanas.',
        // @ts-expect-error the reply takes no media: the backend answers 400 to these
        mediaId: 'm-1',
        type: 'IMAGE',
        caption: 'x',
      },
      KEY,
    )
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/reply',
      { expectedVersion: 2, text: 'Sí, es apto desde las 8 semanas.' },
      headers,
    )
  })

  it('finish: POST /:id/finish sends note and complaintOutcome only when there is one', async () => {
    await chatbotRequestApi.finish(
      'req-1',
      { expectedVersion: 5, note: 'Resuelto por teléfono', complaintOutcome: 'NO_ACTION' },
      KEY,
    )
    expect(post).toHaveBeenLastCalledWith(
      '/chatbot-requests/req-1/finish',
      { expectedVersion: 5, note: 'Resuelto por teléfono', complaintOutcome: 'NO_ACTION' },
      headers,
    )
    await chatbotRequestApi.finish('req-1', { expectedVersion: 5, note: 'Listo' }, KEY)
    expect(post).toHaveBeenLastCalledWith('/chatbot-requests/req-1/finish', { expectedVersion: 5, note: 'Listo' }, headers)
  })

  it('resolve: POST /:id/resolve sends the flat body of the action', async () => {
    await chatbotRequestApi.resolve(
      'req-1',
      { expectedVersion: 1, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 7 },
      KEY,
    )
    expect(post).toHaveBeenCalledWith(
      '/chatbot-requests/req-1/resolve',
      { expectedVersion: 1, action: 'PROVIDE_RESTOCK_ESTIMATE', restockDays: 7 },
      headers,
    )
  })

  it('resolve: never sends resolutionRequestId or fields of another action', async () => {
    await chatbotRequestApi.resolve(
      'req-1',
      {
        expectedVersion: 1,
        action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
        // @ts-expect-error not a field of this action
        restockDays: null,
        resolutionRequestId: 'x',
      },
      KEY,
    )
    expect(post.mock.calls[0]![1]).toEqual({
      expectedVersion: 1,
      action: 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE',
    })
  })

  it('resolve: zone approval carries expectedZoneSetVersion; zone rejection too', async () => {
    await chatbotRequestApi.resolve(
      'req-1',
      {
        expectedVersion: 1,
        action: 'APPROVE_DELIVERY_ZONE',
        zoneType: 'SURCHARGE',
        surchargeCents: 5000,
        etaDays: 3,
        expectedZoneSetVersion: 7,
      },
      KEY,
    )
    expect(post.mock.calls[0]![1]).toEqual({
      expectedVersion: 1,
      action: 'APPROVE_DELIVERY_ZONE',
      zoneType: 'SURCHARGE',
      surchargeCents: 5000,
      etaDays: 3,
      expectedZoneSetVersion: 7,
    })
    await chatbotRequestApi.resolve(
      'req-1',
      { expectedVersion: 1, action: 'REJECT_DELIVERY_ZONE', expectedZoneSetVersion: 7 },
      KEY,
    )
    expect(post.mock.calls[1]![1]).toEqual({
      expectedVersion: 1,
      action: 'REJECT_DELIVERY_ZONE',
      expectedZoneSetVersion: 7,
    })
  })

  it('resolve: receipt confirm and reject bodies', async () => {
    await chatbotRequestApi.resolve('req-1', { expectedVersion: 2, action: 'CONFIRM_RECEIPT', amountCents: 64000 }, KEY)
    expect(post.mock.calls[0]![1]).toEqual({ expectedVersion: 2, action: 'CONFIRM_RECEIPT', amountCents: 64000 })
    await chatbotRequestApi.resolve(
      'req-1',
      {
        expectedVersion: 2,
        action: 'REJECT_RECEIPT',
        reason: 'monto distinto',
        customerReason: 'El monto no coincide, envíanos otro comprobante.',
      },
      KEY,
    )
    expect(post.mock.calls[1]![1]).toEqual({
      expectedVersion: 2,
      action: 'REJECT_RECEIPT',
      reason: 'monto distinto',
      customerReason: 'El monto no coincide, envíanos otro comprobante.',
    })
  })

  it('every command sends the exact key it was given, one header, nothing else', async () => {
    const other = '11111111-2222-4333-8444-555555555555'
    await chatbotRequestApi.claim('r', { expectedVersion: 1 }, other)
    expect(post.mock.calls[0]![2]).toEqual({ headers: { 'Idempotency-Key': other } })
  })

  it('propagates the axios error untouched (typed 409s are read by the error wrapper)', async () => {
    const error = Object.assign(new Error('HTTP 409'), {
      response: { status: 409, data: { code: 'REQUEST_CLOSED' } },
    })
    post.mockImplementationOnce(() => Promise.reject(error))
    const caught = await chatbotRequestApi.claim('r', { expectedVersion: 1 }, KEY).then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(caught).toBe(error)
  })
})
