import { describe, expect, it } from 'vitest'
import { backorderQueryKeys } from '../query-keys'

// ODD restock-backorder T1: tenant-scoped keys; one prefix refreshes list, count and detail.
describe('backorderQueryKeys', () => {
  it('nests list, count and detail under the tenant prefix', () => {
    const all = backorderQueryKeys.all('t1')
    expect(all).toEqual(['backorders', 't1'])
    const params = { page: 1, limit: 20, status: ['WAITING' as const] }
    expect(backorderQueryKeys.list('t1', params)).toEqual(['backorders', 't1', 'list', params])
    expect(backorderQueryKeys.reservedCount('t1')).toEqual(['backorders', 't1', 'reserved-count'])
    expect(backorderQueryKeys.detail('t1', 'b1')).toEqual(['backorders', 't1', 'detail', 'b1'])
    for (const key of [
      backorderQueryKeys.list('t1', params),
      backorderQueryKeys.reservedCount('t1'),
      backorderQueryKeys.detail('t1', 'b1'),
    ]) {
      expect(key.slice(0, 2)).toEqual([...all])
    }
  })

  it('isolates tenants and params', () => {
    expect(backorderQueryKeys.detail('t2', 'b1')).not.toEqual(backorderQueryKeys.detail('t1', 'b1'))
    expect(backorderQueryKeys.list('t1', { page: 2 })).not.toEqual(backorderQueryKeys.list('t1', { page: 1 }))
  })
})
