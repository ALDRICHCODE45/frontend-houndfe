/** Pure tests for the editorial-live request audit, with stub requests/responses. */
import { describe, expect, it } from 'vitest'
import type { Request, Response } from '@playwright/test'

import { backendPath, installNetworkAudit, isPublicationPath, tenantTraces, type AuditablePage } from '../support/network-audit'

const BASE = 'http://127.0.0.1:8082/api/v1'

describe('tenantTraces', () => {
  const shape = (patch: Partial<Parameters<typeof tenantTraces>[0]> = {}) => ({ method: 'GET', url: `${BASE}/products/p1/editorial`, headerNames: ['authorization', 'accept'], body: null, ...patch })

  it('is empty for a clean editorial request', () => expect(tenantTraces(shape())).toEqual([]))
  it('flags tenant header names in any case, never their values', () => {
    expect(tenantTraces(shape({ headerNames: ['X-Tenant-Id', 'authorization'] }))).toEqual(['header:x-tenant-id'])
  })
  it('flags tenant query parameter names', () => {
    expect(tenantTraces(shape({ url: `${BASE}/products/p1?tenantId=secret&x=1&tenant=2` }))).toEqual(['query:tenantId', 'query:tenant'])
  })
  it('flags top-level JSON body keys only', () => {
    expect(tenantTraces(shape({ body: JSON.stringify({ tenantId: 't', document: { tenantNote: 'x' } }) }))).toEqual(['body:tenantId'])
    expect(tenantTraces(shape({ body: 'not json tenantId' }))).toEqual([])
  })
  it('does not treat a tenants resource path as an override', () => {
    expect(tenantTraces(shape({ url: `${BASE}/admin/tenants` }))).toEqual([])
  })
  it('never includes a value', () => {
    expect(tenantTraces(shape({ url: `${BASE}/p?tenant=live-token-secret` })).join()).not.toContain('live-token-secret')
  })
})

describe('backendPath / isPublicationPath', () => {
  it('strips the base path and query', () => {
    expect(backendPath(`${BASE}/products/p1/editorial?x=1`, BASE)).toBe('/products/p1/editorial')
    expect(backendPath(`${BASE}`, BASE)).toBe('/')
  })
  it('ignores other origins and paths outside the base', () => {
    expect(backendPath('http://127.0.0.1:4191/src/main.ts', BASE)).toBeNull()
    expect(backendPath('http://127.0.0.1:8082/api/v10/x', BASE)).toBeNull()
    expect(backendPath('garbage', BASE)).toBeNull()
  })
  it('matches only publication endpoints', () => {
    expect(isPublicationPath('/products/p1/editorial/draft/publish')).toBe(true)
    expect(isPublicationPath('/products/p1/editorial/published/unpublish')).toBe(true)
    expect(isPublicationPath('/products/p1/editorial/draft')).toBe(false)
    expect(isPublicationPath('/products/p1/editorial/draft/discard')).toBe(false)
  })
})

describe('installNetworkAudit', () => {
  function stubPage() {
    const listeners: Record<string, ((arg: unknown) => void)[]> = { request: [], response: [] }
    const page: AuditablePage = {
      on: (event: string, listener: (arg: never) => void) => { listeners[event]!.push(listener as (arg: unknown) => void) },
      off: (event: string, listener: (arg: never) => void) => { listeners[event] = listeners[event]!.filter(l => l !== listener) },
    } as AuditablePage
    return { page, listeners, emit: (event: string, arg: unknown) => listeners[event]!.forEach(l => l(arg)) }
  }
  const request = (method: string, url: string, headers: Record<string, string> = {}, body: string | null = null) => ({
    method: () => method, url: () => url, headers: () => headers, allHeaders: () => Promise.resolve(headers), postData: () => body,
  }) as unknown as Request
  const response = (req: Request, status: number) => ({ request: () => req, status: () => status }) as unknown as Response

  it('logs backend exchanges with statuses, flags tenant traces and publications, ignores frontend assets', async () => {
    const { page, listeners, emit } = stubPage()
    const audit = installNetworkAudit(page, BASE)
    const put = request('PUT', `${BASE}/products/p1/editorial/draft`, { authorization: 'Bearer live-token' }, JSON.stringify({ expectedCycle: 1 }))
    const bad = request('GET', `${BASE}/products/p1?tenantId=t`, { 'x-tenant-id': 't' })
    const publish = request('POST', `${BASE}/products/p1/editorial/draft/publish`)
    const asset = request('GET', 'http://127.0.0.1:4191/src/main.ts')
    for (const req of [put, bad, publish, asset]) emit('request', req)
    emit('response', response(put, 200))
    emit('response', response(bad, 403))
    await audit.dispose()
    expect(audit.exchanges()).toEqual([
      { method: 'PUT', path: '/products/p1/editorial/draft', status: 200 },
      { method: 'GET', path: '/products/p1', status: 403 },
      { method: 'POST', path: '/products/p1/editorial/draft/publish', status: null },
    ])
    expect(audit.tenantViolations()).toEqual(['GET /products/p1: query:tenantId', 'GET /products/p1: header:x-tenant-id'])
    expect(audit.publicationAttempts()).toEqual(['POST /products/p1/editorial/draft/publish'])
    expect(JSON.stringify([audit.exchanges(), audit.tenantViolations()])).not.toContain('live-token')
    expect(listeners.request).toHaveLength(0)
    expect(listeners.response).toHaveLength(0)
  })

  it('falls back to request.headers() when allHeaders() fails', async () => {
    const { page, emit } = stubPage()
    const audit = installNetworkAudit(page, BASE)
    const req = { ...request('GET', `${BASE}/x`, { 'X-Tenant': 't' }), allHeaders: () => Promise.reject(new Error('closed')) } as unknown as Request
    emit('request', req)
    await audit.dispose()
    expect(audit.tenantViolations()).toEqual(['GET /x: header:x-tenant'])
  })
})
