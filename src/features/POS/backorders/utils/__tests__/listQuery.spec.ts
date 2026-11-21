import { describe, expect, it } from 'vitest'
import {
  clearListFilters,
  hasActiveFilters,
  listParamsOf,
  listQueryOf,
  mergeListQuery,
  parseListQuery,
  setListTab,
} from '../listQuery'

describe('parseListQuery (the URL is the source of truth)', () => {
  it('defaults: En espera, no filters, scheduledAt asc, page 1 of 20', () => {
    expect(parseListQuery({})).toEqual({
      tab: 'WAITING',
      q: '',
      from: '',
      to: '',
      sortBy: 'scheduledAt',
      sortOrder: 'asc',
      page: 1,
      limit: 20,
    })
  })

  it('reads tab, search, dates, sort and paging; first value of repeated params', () => {
    const state = parseListQuery({
      status: 'CONFIRMED',
      q: '  Rosa ',
      from: '2026-11-01',
      to: '2026-11-08',
      sort: 'scheduledAt',
      order: 'desc',
      page: ['3', '4'],
      limit: '50',
    })
    expect(state).toMatchObject({
      tab: 'CONFIRMED',
      q: 'Rosa',
      from: '2026-11-01',
      to: '2026-11-08',
      sortOrder: 'desc',
      page: 3,
      limit: 50,
    })
  })

  it('Apartados sorts by reservedUntil asc unless the URL says otherwise', () => {
    expect(parseListQuery({ status: 'RESERVED' })).toMatchObject({ sortBy: 'reservedUntil', sortOrder: 'asc' })
    expect(parseListQuery({ status: 'RESERVED', order: 'desc' })).toMatchObject({
      sortBy: 'reservedUntil',
      sortOrder: 'desc',
    })
    expect(parseListQuery({ status: 'RESERVED', sort: 'scheduledAt' }).sortBy).toBe('scheduledAt')
  })

  it('reservedUntil only sorts Apartados; other tabs fall back to scheduledAt', () => {
    expect(parseListQuery({ status: 'WAITING', sort: 'reservedUntil' }).sortBy).toBe('scheduledAt')
  })

  it('the tab travels as `status=<STATUS>` (the API\'s name), case-insensitive; legacy `tab` still reads', () => {
    expect(parseListQuery({ status: 'RESERVED' }).tab).toBe('RESERVED')
    expect(parseListQuery({ status: 'cancelled' }).tab).toBe('CANCELLED')
    expect(parseListQuery({ tab: 'expired' }).tab).toBe('EXPIRED')
    expect(parseListQuery({ status: 'RESERVED', tab: 'expired' }).tab).toBe('RESERVED')
    expect(parseListQuery({ status: 'nope', tab: 'expired' }).tab).toBe('EXPIRED')
    expect(parseListQuery({ status: 'WAITING,RESERVED' }).tab).toBe('WAITING')
  })

  it('writes `status=` (never `tab=`) and drops a legacy `tab` from the URL on merge', () => {
    expect(listQueryOf(parseListQuery({ tab: 'reserved' }))).toEqual({ status: 'RESERVED' })
    expect(mergeListQuery({ tab: 'reserved', x: '1' }, parseListQuery({ status: 'EXPIRED' }))).toEqual({
      x: '1',
      status: 'EXPIRED',
    })
  })

  it('ignores invalid values', () => {
    expect(
      parseListQuery({ status: 'NOPE', from: '01/11/2026', to: 'x', sort: 'q', order: 'up', page: '-2', limit: '7' }),
    ).toMatchObject({ tab: 'WAITING', from: '', to: '', sortBy: 'scheduledAt', sortOrder: 'asc', page: 1, limit: 20 })
    expect(parseListQuery({ page: 'abc' }).page).toBe(1)
  })

  it('caps the search at 100 characters', () => {
    expect(parseListQuery({ q: 'x'.repeat(150) }).q).toHaveLength(100)
  })
})

describe('listQueryOf / mergeListQuery', () => {
  it('leaves every default out of the URL', () => {
    expect(listQueryOf(parseListQuery({}))).toEqual({})
    expect(listQueryOf(parseListQuery({ status: 'RESERVED' }))).toEqual({ status: 'RESERVED' })
  })

  it('writes what differs from the tab default', () => {
    const state = { ...parseListQuery({ status: 'RESERVED' }), q: 'Rosa', page: 2, sortOrder: 'desc' as const }
    expect(listQueryOf(state)).toEqual({ status: 'RESERVED', q: 'Rosa', page: '2', order: 'desc' })
  })

  it('keeps the other params of the URL and replaces only its own', () => {
    const merged = mergeListQuery({ utm: 'x', status: 'EXPIRED', q: 'old' }, parseListQuery({ status: 'CANCELLED' }))
    expect(merged).toEqual({ utm: 'x', status: 'CANCELLED' })
  })

  it('round-trips', () => {
    const query = { status: 'CONFIRMED', q: 'Rosa', from: '2026-11-01', to: '2026-11-08', order: 'desc', page: '2', limit: '10' }
    expect(listQueryOf(parseListQuery(query))).toEqual(query)
  })
})

describe('state transitions', () => {
  it('changing the tab resets page and sort to that tab\'s defaults and keeps the filters', () => {
    const state = { ...parseListQuery({ status: 'WAITING', q: 'Rosa', page: '3', order: 'desc' }) }
    expect(setListTab(state, 'RESERVED')).toMatchObject({
      tab: 'RESERVED',
      q: 'Rosa',
      page: 1,
      sortBy: 'reservedUntil',
      sortOrder: 'asc',
    })
  })

  it('clearing filters keeps the tab and drops search, dates and the page', () => {
    const cleared = clearListFilters(parseListQuery({ status: 'EXPIRED', q: 'a', from: '2026-11-01', page: '2' }))
    expect(cleared).toMatchObject({ tab: 'EXPIRED', q: '', from: '', to: '', page: 1 })
    expect(hasActiveFilters(cleared)).toBe(false)
    expect(hasActiveFilters(parseListQuery({ to: '2026-11-08' }))).toBe(true)
  })
})

describe('listParamsOf (S3 params)', () => {
  it('sends the tab as status, sort, paging and the trimmed search', () => {
    expect(listParamsOf(parseListQuery({ status: 'RESERVED', q: 'Rosa', page: '2', limit: '10' }))).toEqual({
      page: 2,
      limit: 10,
      status: ['RESERVED'],
      q: 'Rosa',
      sortBy: 'reservedUntil',
      sortOrder: 'asc',
    })
  })

  it('turns local days into ISO instants with zone: from inclusive, to exclusive (next local midnight)', () => {
    const params = listParamsOf(parseListQuery({ from: '2026-11-01', to: '2026-11-08' }))
    expect(params.from).toBe(new Date(2026, 10, 1).toISOString())
    expect(params.to).toBe(new Date(2026, 10, 9).toISOString())
    expect(params.from).toMatch(/Z$/)
  })

  it('omits what is empty', () => {
    const params = listParamsOf(parseListQuery({}))
    expect(params).toEqual({ page: 1, limit: 20, status: ['WAITING'], sortBy: 'scheduledAt', sortOrder: 'asc' })
  })
})
