import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { suppliersApi } from '../suppliers.api'

vi.mock('@/core/shared/api/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const supplier = {
  id: '22222222-2222-4222-8222-222222222222',
  displayName: 'Distribuidora del Centro', termsText: null, status: 'ACTIVE' as const,
  version: 1, createdAt: '2026-11-02T00:00:00.000Z', updatedAt: '2026-11-02T00:00:00.000Z',
}

describe('supplier transport', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lists with cursor filters and abort signal, without actor fields or invented totals', async () => {
    const signal = new AbortController().signal
    const page = { items: [supplier], nextCursor: 'next-page' }
    vi.mocked(http.get).mockResolvedValue({ data: page })
    const input = { search: 'Centro', status: 'ALL' as const, cursor: 'previous', limit: 25, tenantId: 'ignored' }
    expect(await suppliersApi.list(input, signal)).toEqual(page)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/procurement/suppliers', {
      params: { search: 'Centro', status: 'ALL', cursor: 'previous', limit: 25 }, signal,
    })
  })

  it('reads one supplier without a mutation key', async () => {
    vi.mocked(http.get).mockResolvedValue({ data: supplier })
    const signal = new AbortController().signal
    expect(await suppliersApi.get(supplier.id, signal)).toEqual(supplier)
    expect(http.get).toHaveBeenCalledExactlyOnceWith('/procurement/suppliers/' + supplier.id, { signal })
  })

  it('creates with explicit null terms and the caller-owned key, excluding injected fields', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: supplier })
    const input = { displayName: supplier.displayName, termsText: null, status: 'ACTIVE' as const, actorId: 'ignored' }
    expect(await suppliersApi.create(input, 'create-attempt')).toEqual(supplier)
    expect(http.post).toHaveBeenCalledExactlyOnceWith('/procurement/suppliers', {
      displayName: supplier.displayName, termsText: null, status: 'ACTIVE',
    }, { headers: { 'Idempotency-Key': 'create-attempt' } })
  })

  it('patches CAS and explicit null without turning omitted fields into changes', async () => {
    vi.mocked(http.patch).mockResolvedValue({ data: { ...supplier, version: 2 } })
    const input = { expectedVersion: 1, changes: { termsText: null, tenantId: 'ignored' }, actorId: 'ignored' }
    expect(await suppliersApi.update(supplier.id, input, 'edit-attempt')).toEqual({ ...supplier, version: 2 })
    expect(http.patch).toHaveBeenCalledExactlyOnceWith('/procurement/suppliers/' + supplier.id,
      { expectedVersion: 1, changes: { termsText: null } },
      { headers: { 'Idempotency-Key': 'edit-attempt' } })
  })

  it.each(['ARCHIVED', 'ACTIVE'] as const)('changes status to %s using PATCH, not DELETE', async status => {
    vi.mocked(http.patch).mockResolvedValue({ data: { ...supplier, status, version: 2 } })
    await suppliersApi.update(supplier.id, { expectedVersion: 1, changes: { status } }, 'state-attempt')
    expect(http.patch).toHaveBeenCalledExactlyOnceWith('/procurement/suppliers/' + supplier.id,
      { expectedVersion: 1, changes: { status } },
      { headers: { 'Idempotency-Key': 'state-attempt' } })
  })

  it('deletes with a closed CAS body and caller key, returning void on 204', async () => {
    vi.mocked(http.delete).mockResolvedValue({ status: 204, data: '' })
    const input = { expectedVersion: 3, actorId: 'ignored' }
    expect(await suppliersApi.delete('id/encoded', input, 'delete-attempt')).toBeUndefined()
    expect(http.delete).toHaveBeenCalledExactlyOnceWith('/procurement/suppliers/id%2Fencoded', {
      data: { expectedVersion: 3 }, headers: { 'Idempotency-Key': 'delete-attempt' },
    })
  })

  it('propagates an uncertain transport result without generating a retry', async () => {
    const error = new Error('Network unavailable')
    vi.mocked(http.post).mockRejectedValue(error)
    await expect(suppliersApi.create({
      displayName: supplier.displayName, termsText: null, status: 'ACTIVE',
    }, 'same-attempt')).rejects.toBe(error)
    expect(http.post).toHaveBeenCalledTimes(1)
  })
})
