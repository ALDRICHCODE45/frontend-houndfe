/** T23: readiness GET and the refused publish that carries the same checklist (handoff 05). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { http } from '@/core/shared/api/http'
import { editorialContractApi as api, EditorialContractApiError } from '../editorial-contract.api'

const R = `ev2-sha256-${'a'.repeat(64)}`
const newerR = `ev2-sha256-${'b'.repeat(64)}`
const item = { scope: 'definition', definitionCode: 'measure.net_mass', variantId: null, sectionCode: 'contenido-empaque',
  problem: 'REQUIRED_MISSING', message: 'Falta el peso neto.' }
const readiness = { ready: false, cycle: 1, draftRevision: 4, vocabularyRevision: R, items: [item], bySection: { 'contenido-empaque': 1 } }
const adapter = vi.fn<AxiosAdapter>()
const originalAdapter = http.defaults.adapter
function respond(data: unknown, headers: Record<string, string> = { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': R }) {
  adapter.mockImplementationOnce(async config => ({ config, data, status: 200, statusText: 'ok',
    headers: new AxiosHeaders(headers) }))
}
function reject(status: number, data: unknown) {
  adapter.mockImplementationOnce(async config => {
    throw new AxiosError('x', 'ERR_BAD_RESPONSE', config, undefined, { config, data, status, statusText: 'x', headers: new AxiosHeaders() })
  })
}
async function failureOf(promise: Promise<unknown>) {
  try { await promise } catch (error) { return error as EditorialContractApiError }
  throw new Error('expected a failure')
}
beforeEach(() => { adapter.mockReset(); http.defaults.adapter = adapter })
afterEach(() => { http.defaults.adapter = originalAdapter })

describe('getReadiness', () => {
  it('GETs …/draft/readiness with exactly the vocabulary header and decodes the snapshot', async () => {
    respond(readiness)
    expect(await api.getReadiness('p/1', R)).toEqual(readiness)
    const config = adapter.mock.calls[0]![0]
    expect(config.method).toBe('get')
    expect(config.url).toBe('/products/p%2F1/editorial/draft/readiness')
    const headers = AxiosHeaders.from(config.headers)
    expect(headers.get('Editorial-Vocabulary-Revision')).toBe(R)
    for (const name of ['Idempotency-Key', 'Editorial-Care-Confirmation', 'Editorial-Adoption']) expect(headers.has(name)).toBe(false)
    expect(config.data).toBeUndefined()
  })
  it('refuses a response for another vocabulary or without the contract header', async () => {
    respond({ ...readiness, vocabularyRevision: newerR }, { 'Editorial-Contract-Version': '2', 'Editorial-Vocabulary-Revision': newerR })
    expect((await failureOf(api.getReadiness('p', R))).status).toBe(200)
    respond(readiness, { 'Editorial-Vocabulary-Revision': R })
    expect((await failureOf(api.getReadiness('p', R))).envelope).toBeNull()
  })
  it('keeps VOCABULARY_CHANGED as a code', async () => {
    reject(409, { statusCode: 409, error: 'VOCABULARY_CHANGED' })
    expect((await failureOf(api.getReadiness('p', R))).code).toBe('VOCABULARY_CHANGED')
  })
})

describe('a refused publish', () => {
  const body = { expectedCycle: 1, expectedRevision: 4 }
  it('carries the readiness items and bySection on a 400 MALFORMED', async () => {
    reject(400, { statusCode: 400, error: 'MALFORMED', items: [item], bySection: { 'contenido-empaque': 1 } })
    const error = await failureOf(api.publish('p', body, 'k', R, null))
    expect(error.code).toBe('MALFORMED')
    expect(error.readiness).toEqual({ items: [item], bySection: { 'contenido-empaque': 1 } })
  })
  it('has no readiness on a plain 400 (care confirmation missing or forbidden)', async () => {
    reject(400, { statusCode: 400, error: 'MALFORMED' })
    const error = await failureOf(api.publish('p', body, 'k', R, null))
    expect(error.code).toBe('MALFORMED')
    expect(error.readiness).toBeNull()
  })
  it('sends the care confirmation only when given', async () => {
    respond({ contractVersion: 2, vocabularyRevision: R, state: { cycle: 1, draft: null, published: null } })
    await api.publish('p', body, 'k', R, null)
    expect(AxiosHeaders.from(adapter.mock.calls[0]![0].headers).has('Editorial-Care-Confirmation')).toBe(false)
  })
})
