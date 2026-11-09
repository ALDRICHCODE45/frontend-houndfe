import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { http } from '@/core/shared/api/http'
import { editorialContractApi as api, EditorialContractApiError } from '../editorial-contract.api'

const R = `ev2-sha256-${'a'.repeat(64)}`
const newerR = `ev2-sha256-${'b'.repeat(64)}`
const document = { schemaVersion: 2 as const, commercialTitle: null, description: null,
  mediaRefs: [], familyCode: null, values: [], facts: [] }
const state = { contractVersion: 2, vocabularyRevision: R,
  state: { cycle: 4, draft: null, published: { revision: 2, document }, warnings: [] } }
const vocabulary = { contractVersion: 2, vocabularyRevision: R,
  vocabulary: { semanticsVersion: 'editorial-production-1', families: [], definitions: [] } }
const context = { variants: [{ id: 'z', name: 'Same' }, { id: 'a', name: 'Alpha' }, { id: '', name: '' }] }
const body = { expectedCycle: 9007199254740992, expectedRevision: 2147483648 }
const key = ' exact key '
const adapter = vi.fn<AxiosAdapter>()
const originalAdapter = http.defaults.adapter
const semanticHeaders = () => ({ 'eDiToRiAl-CoNtRaCt-VeRsIoN': '2', 'EDITORIAL-VOCABULARY-REVISION': R })
function respond(data: unknown = state, status = 200, headers: Record<string, unknown> = semanticHeaders()) {
  adapter.mockImplementationOnce(async config => ({ config, data, status, statusText: 'synthetic',
    headers: new AxiosHeaders(headers as ConstructorParameters<typeof AxiosHeaders>[0]) }))
}
function reject(status: number, data: unknown) {
  adapter.mockImplementationOnce(async config => {
    throw new AxiosError('unsafe transport detail', 'ERR_BAD_RESPONSE', config, undefined,
      { config, data, status, statusText: 'unsafe', headers: new AxiosHeaders() })
  })
}
beforeEach(() => { adapter.mockReset(); http.defaults.adapter = adapter })
afterEach(() => { http.defaults.adapter = originalAdapter })
const calls = [
  { operation: 'vocabulary', method: 'get', path: '/catalog-editorial/vocabulary', status: 200,
    data: vocabulary, invoke: (signal?: AbortSignal) => api.getVocabulary(signal), pinned: false },
  { operation: 'state', method: 'get', path: '/products/p%2F1/editorial', status: 200,
    data: state, invoke: (signal?: AbortSignal) => api.getState('p/1', R, signal), pinned: true },
  { operation: 'context', method: 'get', path: '/products/p%2F1/editorial/context', status: 200,
    data: context, invoke: (signal?: AbortSignal) => api.getContext('p/1', signal), pinned: false },
  { operation: 'initialize', method: 'post', path: '/products/p%2F1/editorial/draft/initialize', status: 201,
    data: state, invoke: (signal?: AbortSignal) => api.initialize('p/1', { expectedCycle: null }, key, R, signal),
    body: { expectedCycle: null }, pinned: true },
  { operation: 'save', method: 'put', path: '/products/p%2F1/editorial/draft', status: 200,
    data: state, invoke: (signal?: AbortSignal) => api.save('p/1', { ...body, document }, key, R, signal),
    body: { ...body, document }, pinned: true },
  { operation: 'publish', method: 'post', path: '/products/p%2F1/editorial/draft/publish', status: 200,
    data: state, invoke: (signal?: AbortSignal) => api.publish('p/1', body, key, R, 'review-v1', signal), body, pinned: true },
  { operation: 'discard', method: 'post', path: '/products/p%2F1/editorial/draft/discard', status: 200,
    data: state, invoke: (signal?: AbortSignal) => api.discard('p/1', body, key, R, signal), body, pinned: true },
  // «Despublicar» (handoff 07 §6): the same transition body, never a care header even for Cuidado.
  { operation: 'unpublish', method: 'post', path: '/products/p%2F1/editorial/published/unpublish', status: 200,
    data: state, invoke: (signal?: AbortSignal) => api.unpublish('p/1', body, key, R, signal), body, pinned: true },
]
it.each(calls)('$operation uses exact wire contract and detached complete response', async operation => {
  respond(operation.data, operation.status, operation.operation === 'context' ? {} : semanticHeaders())
  const signal = new AbortController().signal
  const result = await operation.invoke(signal)
  expect(result).toEqual(operation.data)
  expect(result).not.toBe(operation.data)
  if ('state' in result) expect(result.state.published?.document).not.toBe(document)
  if ('variants' in result) expect(result.variants[0]).not.toBe(context.variants[0])
  const config = adapter.mock.calls[0]![0]
  expect(config.signal).toBe(signal)
  expect(config.method).toBe(operation.method)
  expect(config.url).toBe(operation.path)
  expect(config.params).toBeUndefined()
  expect(config.data).toBe(operation.body ? JSON.stringify(operation.body) : undefined)
  expect(config.headers.get('Editorial-Vocabulary-Revision')).toBe(operation.pinned ? R : undefined)
  expect(config.headers.get('Idempotency-Key')).toBe(operation.body ? key : undefined)
  expect(config.headers.get('Editorial-Care-Confirmation')).toBe(operation.operation === 'publish' ? 'review-v1' : undefined)
  for (const header of ['Editorial-Contract-Version', 'Editorial-Adoption']) expect(config.headers.has(header)).toBe(false)
  if (operation.method === 'get') {
    expect(config.headers.get('Cache-Control')).toBe('no-cache')
    expect(config.headers.get('Pragma')).toBe('no-cache')
  }
  expect(adapter).toHaveBeenCalledTimes(1)
})
const unknownFailure = { code: 'UNKNOWN', envelope: null }
it.each([
  {}, { 'Editorial-Contract-Version': '2' }, { 'Editorial-Vocabulary-Revision': R },
  ...[' 2', '2 ', '2,2', ['2'], '02', '3', '\n2'].map(value => ({ ...semanticHeaders(), 'eDiToRiAl-CoNtRaCt-VeRsIoN': value })),
  ...['', R.toUpperCase(), `${R} `, `\n${R}`, `${R},${R}`, [R], newerR].map(value => ({
    ...semanticHeaders(), 'EDITORIAL-VOCABULARY-REVISION': value,
  })),
])('rejects missing/malformed/list/mismatched semantic headers: %j', async headers => {
  respond(state, 200, headers)
  await expect(api.getState('p', R)).rejects.toMatchObject({ ...unknownFailure, status: 200 })
})
it.each(calls)('$operation rejects wrong status and unreadable body with actual status', async operation => {
  respond(operation.data, 202)
  await expect(operation.invoke()).rejects.toMatchObject({ ...unknownFailure, status: 202 })
  respond({ unsafe: 'raw secret' }, operation.status)
  await expect(operation.invoke()).rejects.toMatchObject({ ...unknownFailure, status: operation.status })
})
it.each([
  { ...state, vocabularyRevision: newerR },
  { ...state, vocabularyRevision: `${R}\n` },
  { ...state, state: { ...state.state, published: { revision: 2, document: { ...document, schemaVersion: 1 } } } },
  { ...state, extra: true }, null, [],
])('rejects malformed primitive/envelope or body revision: %j', async data => {
  respond(data)
  await expect(api.getState('p', R)).rejects.toMatchObject({ ...unknownFailure, status: 200 })
})
it.each(calls.filter(operation => operation.pinned))('$operation pins receipt to original request R', async operation => {
  respond({ ...state, vocabularyRevision: newerR }, operation.status, {
    'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': newerR,
  })
  await expect(operation.invoke()).rejects.toMatchObject({ ...unknownFailure, status: operation.status })
})
it.each([
  { variants: [], pagination: null }, { variants: [{ id: 'a', name: 'b', sku: 'x' }] },
  { variants: [{ id: '\ud800', name: 'b' }] }, { variants: 'bad' },
])('context is closed scalar JSON without fresh domain rules: %j', async data => {
  respond(data, 200, {})
  await expect(api.getContext('p')).rejects.toMatchObject({ ...unknownFailure, status: 200 })
})
it.each([
  [400, 'MALFORMED'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'],
  [409, 'CONFLICT'], [409, 'VOCABULARY_CHANGED'], [409, 'EDITORIAL_STATE_UNREADABLE'],
  [500, 'EDITORIAL_VOCABULARY_UNREPRESENTABLE'], [500, 'INTERNAL_ERROR'],
] as const)('recognizes only exact %i/%s, without semantic error headers', async (statusCode, error) => {
  reject(statusCode, { statusCode, error })
  await expect(api.getVocabulary()).rejects.toMatchObject({ status: statusCode, code: error,
    envelope: { statusCode, error }, message: 'Editorial request failed' })
  expect(adapter).toHaveBeenCalledTimes(1)
})
it.each([
  [409, { statusCode: 400, error: 'MALFORMED' }],
  [400, { statusCode: 400, error: 'CONFLICT' }],
  [409, { statusCode: 409, error: 'CONFLICT', message: 'unsafe' }],
  [406, { statusCode: 406, error: 'UNSUPPORTED' }], [413, { message: 'unsafe' }],
  [500, '<html>unsafe</html>'], [400, ['MALFORMED']],
  [409, Object.defineProperty({ statusCode: 409, error: 'CONFLICT' }, 'extra', { value: 'unsafe' })],
  [409, { statusCode: 409, error: 'CONFLICT', [Symbol('extra')]: 'unsafe' }],
  [409, Object.create({ statusCode: 409, error: 'CONFLICT' })],
])('sanitizes non-envelope %i failures', async (status, data) => {
  reject(status as number, data)
  const error = await api.save('p', { ...body, document }, key, R).catch((error: unknown) => error)
  expect(error).toBeInstanceOf(EditorialContractApiError)
  expect(error).toMatchObject({ ...unknownFailure, status, message: 'Editorial request failed' })
  expect(JSON.stringify(error)).not.toContain('unsafe')
  expect(adapter).toHaveBeenCalledTimes(1)
})
it('network errors have no invented status or retry', async () => {
  adapter.mockRejectedValueOnce(new AxiosError('unsafe network', 'ERR_NETWORK'))
  await expect(api.getVocabulary()).rejects.toMatchObject({ ...unknownFailure, status: null })
  expect(adapter).toHaveBeenCalledTimes(1)
})
it.each([
  ['initialize', null], ['save', null], ['discard', null], ['publish', null], ['publish', 'review-v1'], ['unpublish', null],
] as const)('frozen %s/%s retransmission survives newer read', async (action, confirmation) => {
  const initialize = Object.freeze({ expectedCycle: null })
  const transition = Object.freeze({ ...body })
  const save = Object.freeze({ ...body, document })
  const invoke = () => action === 'initialize' ? api.initialize('p', initialize, key, R)
    : action === 'save' ? api.save('p', save, key, R)
      : action === 'publish' ? api.publish('p', transition, key, R, confirmation)
        : action === 'unpublish' ? api.unpublish('p', transition, key, R) : api.discard('p', transition, key, R)
  const status = action === 'initialize' ? 201 : 200
  respond(state, status)
  await expect(invoke()).resolves.toEqual(state)
  respond({ ...vocabulary, vocabularyRevision: newerR }, 200, {
    'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': newerR,
  })
  await api.getVocabulary()
  respond(state, status)
  await expect(invoke()).resolves.toEqual(state)
  expect(adapter).toHaveBeenCalledTimes(3)
  const first = adapter.mock.calls[0]![0]
  const replay = adapter.mock.calls[2]![0]
  expect(replay.data).toBe(first.data)
  expect(replay.headers.toJSON()).toEqual(first.headers.toJSON())
  expect(replay.headers.get('Editorial-Vocabulary-Revision')).toBe(R)
  expect(replay.headers.get('Idempotency-Key')).toBe(key)
  expect(replay.headers.get('Editorial-Care-Confirmation')).toBe(confirmation ?? undefined)
})
it('passes cancellation signal and never infers success from an aborted response', async () => {
  const controller = new AbortController()
  adapter.mockImplementationOnce(async config => {
    expect(config.signal).toBe(controller.signal)
    controller.abort()
    return { config, data: state, status: 200, statusText: 'synthetic', headers: new AxiosHeaders(semanticHeaders()) }
  })
  await expect(api.getState('p', R, controller.signal)).rejects.toMatchObject({ ...unknownFailure, status: null })
  expect(adapter).toHaveBeenCalledTimes(1)
})
