import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { pageSizeStorageKey, readStoredPageSize, useTablePageSize } from '../useTablePageSize'

function run<T>(fn: () => T): T {
  const scope = effectScope()
  const result = scope.run(fn)!
  return result
}

describe('useTablePageSize', () => {
  beforeEach(() => localStorage.clear())

  it('starts at the default when nothing is stored', () => {
    const { pageSize } = run(() => useTablePageSize({ persistKey: 'orders', defaultPageSize: 10 }))
    expect(pageSize.value).toBe(10)
    expect(localStorage.getItem(pageSizeStorageKey('orders'))).toBeNull()
  })

  it('remembers a chosen size: the next mount starts at it', () => {
    const first = run(() => useTablePageSize({ persistKey: 'orders', defaultPageSize: 10 }))
    first.pageSize.value = 35
    expect(localStorage.getItem(pageSizeStorageKey('orders'))).toBe('35')

    const second = run(() => useTablePageSize({ persistKey: 'orders', defaultPageSize: 10 }))
    expect(second.pageSize.value).toBe(35)
  })

  it.each([['7'], ['500'], ['"abc"'], ['not json'], ['null'], ['-5']])(
    'falls back to the default for an invalid stored value %s',
    (stored) => {
      localStorage.setItem(pageSizeStorageKey('orders'), stored)
      const { pageSize } = run(() => useTablePageSize({ persistKey: 'orders', defaultPageSize: 20 }))
      expect(pageSize.value).toBe(20)
    },
  )

  it('validates against the table options when it has its own', () => {
    localStorage.setItem(pageSizeStorageKey('customers'), '100')
    expect(readStoredPageSize('customers', [20, 50, 100])).toBe(100)
    expect(readStoredPageSize('customers')).toBeUndefined()
  })

  it('never stores a size that is not an option', () => {
    const { pageSize } = run(() => useTablePageSize({ persistKey: 'orders', defaultPageSize: 10 }))
    pageSize.value = 7
    expect(localStorage.getItem(pageSizeStorageKey('orders'))).toBeNull()
  })

  it('keeps each table independent', () => {
    const a = run(() => useTablePageSize({ persistKey: 'a', defaultPageSize: 10 }))
    const b = run(() => useTablePageSize({ persistKey: 'b', defaultPageSize: 10 }))
    a.pageSize.value = 35
    b.pageSize.value = 15
    expect(run(() => useTablePageSize({ persistKey: 'a', defaultPageSize: 10 })).pageSize.value).toBe(35)
    expect(run(() => useTablePageSize({ persistKey: 'b', defaultPageSize: 10 })).pageSize.value).toBe(15)
  })

  it('stays apart from the column layout entry of the same table', () => {
    localStorage.setItem('table-preferences-orders', JSON.stringify({ version: 1 }))
    const { pageSize } = run(() => useTablePageSize({ persistKey: 'orders', defaultPageSize: 10 }))
    pageSize.value = 25
    expect(JSON.parse(localStorage.getItem('table-preferences-orders')!)).toEqual({ version: 1 })
  })
})
