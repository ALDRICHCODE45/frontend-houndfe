import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { http } from '@/core/shared/api/http'
import { editorialApi, EditorialApiError } from '../product-editorial.api'
import { editorialQueryKeys } from '../../constants/product-editorial-query-keys'

const document = {
  commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [],
}
const state = {
  cycle: 1, draft: { revision: 1, basePublishedRevision: null, document }, published: null,
}
const adapter = vi.fn<AxiosAdapter>()
const originalAdapter = http.defaults.adapter

function respond(data: unknown, status = 200) {
  adapter.mockImplementationOnce(async (config) => ({
    config, data, status, statusText: 'synthetic', headers: new AxiosHeaders({ 'Cache-Control': 'no-store' }),
  }))
}

function reject(status: number, data: unknown) {
  adapter.mockImplementationOnce(async (config) => {
    throw new AxiosError('unsafe backend message', 'ERR_BAD_RESPONSE', config, undefined, {
      config, data, status, statusText: 'synthetic', headers: new AxiosHeaders(),
    })
  })
}

beforeEach(() => {
  adapter.mockReset()
  http.defaults.adapter = adapter
})
afterEach(() => { http.defaults.adapter = originalAdapter })

describe('closed editorial HTTP transport', () => {
  it('unwraps GET state and retains malformed stored documents, without warnings or blanks', async () => {
    const history = { ...state, draft: { ...state.draft, document: {} } }
    respond(history)
    await expect(editorialApi.getState('p/1')).resolves.toEqual(history)
    const config = adapter.mock.calls[0]![0]
    expect(config.url).toBe('/products/p%2F1/editorial')
    expect(config.method).toBe('get')
    // Response no-store does not replace the shared authenticated GET request policy.
    expect(config.headers.get('Cache-Control')).toBe('no-cache')
    expect(config.headers.get('Pragma')).toBe('no-cache')
    expect(config.headers.has('Idempotency-Key')).toBe(false)
  })

  it.each([
    { variants: [] },
    { variants: [{ id: 'z', name: 'Same' }, { id: 'a', name: 'Same' }, { id: 'b', name: 'Alpha' }] },
  ])('unwraps complete context without flags, sorting, query or body: %j', async (context) => {
    respond(context)
    await expect(editorialApi.getContext('p/1')).resolves.toEqual(context)
    const config = adapter.mock.calls[0]![0]
    expect(config.url).toBe('/products/p%2F1/editorial/context')
    expect(config.method).toBe('get')
    expect(config.params).toBeUndefined()
    expect(config.data).toBeUndefined()
    expect(config.headers.has('Idempotency-Key')).toBe(false)
  })

  it('uses the same safe read envelope for context failures', async () => {
    reject(403, { statusCode: 403, error: 'FORBIDDEN', message: 'unsafe' })
    await expect(editorialApi.getContext('p')).rejects.toMatchObject({
      status: 403, code: 'FORBIDDEN', envelope: { statusCode: 403, error: 'FORBIDDEN' },
    })
  })

  it('scopes context keys by tenant, authenticated scope and product independently of state', () => {
    const scope = { tenantId: 't', authScope: 'u' }
    const key = editorialQueryKeys.context(scope, 'p')
    expect(key).toEqual(['product-editorial', 't', 'u', 'context', 'p'])
    expect(key).not.toEqual(editorialQueryKeys.state(scope, 'p'))
    expect(key).not.toEqual(editorialQueryKeys.context({ ...scope, tenantId: 'other' }, 'p'))
    expect(key).not.toEqual(editorialQueryKeys.context({ ...scope, authScope: 'other' }, 'p'))
    expect(key).not.toEqual(editorialQueryKeys.context(scope, 'other'))
  })

  it('initializes with nullable cycle, unwraps the 201 body and optional warnings', async () => {
    const warnings = [{ code: 'ARCHIVED_OPTION', familyId: 'f', definitionId: 'd',
      owner: 'product', variantId: null, optionCode: 'old' }]
    respond({ ...state, warnings }, 201)
    await expect(editorialApi.initialize('p', { expectedCycle: null }, ' key '))
      .resolves.toEqual({ ...state, warnings })
    const config = adapter.mock.calls[0]![0]
    expect(config.url).toBe('/products/p/editorial/draft/initialize')
    expect(config.method).toBe('post')
    expect(JSON.parse(config.data)).toEqual({ expectedCycle: null })
    expect(config.headers.get('Idempotency-Key')).toBe(' key ')
  })

  it('preserves cycle, draft and Published revisions/documents independently', async () => {
    const history = { cycle: 5, draft: { revision: 7, basePublishedRevision: 3, document: {} },
      published: { revision: 4, document: { ...document, commercialTitle: '😀'.repeat(201) } } }
    respond(history)
    await expect(editorialApi.getState('p')).resolves.toEqual(history)
    respond({ cycle: null, draft: null, published: null })
    await expect(editorialApi.getState('new')).resolves.toEqual({
      cycle: null, draft: null, published: null,
    })
  })

  it.each([' ', 'x'.repeat(200)])('passes an explicit key unchanged on repeated initializes', async (key) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      respond(state, 201)
      const result = await editorialApi.initialize('p', { expectedCycle: 1 }, key)
      expect(result).toEqual(state)
      expect(result).not.toHaveProperty('warnings')
      const config = adapter.mock.calls[attempt]![0]
      expect(config.method).toBe('post')
      expect(config.data).toBe('{"expectedCycle":1}')
      expect(config.headers.get('Idempotency-Key')).toBe(key)
    }
  })

  it('repeated caller retransmissions keep method, serialized body and key identical', async () => {
    const body = { expectedCycle: 1, expectedRevision: 1, document }
    respond(state)
    respond(state)
    await expect(editorialApi.save('p', body, 'same-key')).resolves.toEqual(state)
    await editorialApi.save('p', body, 'same-key')
    expect(adapter).toHaveBeenCalledTimes(2)
    const first = adapter.mock.calls[0]![0]
    const second = adapter.mock.calls[1]![0]
    expect(first.method).toBe('put')
    expect(first.url).toBe('/products/p/editorial/draft')
    expect(first.data).toBe(JSON.stringify(body))
    expect(second.method).toBe(first.method)
    expect(second.data).toBe(first.data)
    expect(second.headers.get('Idempotency-Key')).toBe(first.headers.get('Idempotency-Key'))
    expect(body.document).toBe(document)
  })

  it('preserves vocabulary labels, discriminants and server order without client sorting', async () => {
    const vocabulary = { families: [{ id: 'f', code: 'z', label: 'BE label', bindings: [] }],
      definitions: [
        { id: 'n', code: 'z', label: 'Number', type: 'number', units: [
          { code: null, label: null, sortOrder: 0 }, { code: 'kg', label: 'Kilograms', sortOrder: 1 },
        ] },
        { id: 'm', code: 'a', label: 'Multi', type: 'multi', options: [] },
      ] }
    respond(vocabulary)
    await expect(editorialApi.getVocabulary()).resolves.toEqual(vocabulary)
    expect(adapter.mock.calls[0]![0].url).toBe('/catalog-editorial/vocabulary')
  })

  it.each([
    [400, 'MALFORMED'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'], [409, 'CONFLICT'], [500, 'INTERNAL_ERROR'],
  ])('preserves editorial envelope %i %s without leaking raw messages', async (statusCode, error) => {
    reject(statusCode as number, { statusCode, error })
    await expect(editorialApi.getState('p')).rejects.toMatchObject({
      status: statusCode, code: error, envelope: { statusCode, error },
    })
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it.each([
    [413, { message: 'unsafe framework detail' }], [400, { statusCode: 400, error: 'Bad Request' }],
    [500, '<html>unsafe</html>'], [409, { statusCode: 400, error: 'MALFORMED' }],
  ])('uses a safe fallback for unknown/framework bodies %i', async (status, body) => {
    reject(status, body)
    const error = await editorialApi.save('p', {
      expectedCycle: 1, expectedRevision: 1, document,
    }, 'k').catch((error: unknown) => error)
    expect(error).toBeInstanceOf(EditorialApiError)
    expect(error).toMatchObject({ status, code: 'UNKNOWN', envelope: null })
    expect((error as Error).message).not.toContain('unsafe')
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('does not invent network retries', async () => {
    adapter.mockRejectedValueOnce(new AxiosError('unsafe network detail', 'ERR_NETWORK'))
    await expect(editorialApi.getVocabulary()).rejects.toMatchObject({
      status: null, code: 'UNKNOWN', envelope: null,
    })
    expect(adapter).toHaveBeenCalledTimes(1)
  })
})
