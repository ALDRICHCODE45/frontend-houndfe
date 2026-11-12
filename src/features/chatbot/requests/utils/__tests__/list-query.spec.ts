import { describe, expect, it } from 'vitest'
import {
  clearListFilters,
  customerStatusOf,
  groupsFiltersOf,
  hasActiveFilters,
  historyFiltersOf,
  LIST_QUERY_KEYS,
  mergeListQuery,
  parseListQuery,
  SEARCH_MAX_LENGTH,
  toggleListChip,
  listQueryOf,
  type RequestsListState,
} from '../list-query'

const base: RequestsListState = {
  tab: 'open',
  q: '',
  mine: false,
  unassigned: false,
  overdue: false,
  windowClosingSoon: false,
  subtype: null,
}
const state = (patch: Partial<RequestsListState> = {}): RequestsListState => ({ ...base, ...patch })

describe('parseListQuery — the URL is the state', () => {
  it('an empty query is the open tab with no filter', () => {
    expect(parseListQuery({})).toEqual(base)
  })

  it('reads the tab, search, chips and subtype', () => {
    expect(
      parseListQuery({ tab: 'resolved', q: ' Ana ', mine: '1', overdue: '1', window: '1', subtype: 'RESTOCK' }),
    ).toEqual(state({ tab: 'resolved', q: 'Ana', mine: true, overdue: true, windowClosingSoon: true, subtype: 'RESTOCK' }))
  })

  it('an unknown tab or subtype falls back instead of reaching the API', () => {
    expect(parseListQuery({ tab: 'nope', subtype: 'HACK' })).toEqual(base)
  })

  it('takes the first value of a repeated key and ignores a non-1 chip value', () => {
    expect(parseListQuery({ tab: ['scheduled', 'open'], mine: '0', overdue: ['1', '0'] })).toEqual(
      state({ tab: 'scheduled', overdue: true }),
    )
  })

  it('cuts the search at 100 characters', () => {
    expect(parseListQuery({ q: 'x'.repeat(250) }).q).toHaveLength(SEARCH_MAX_LENGTH)
  })

  it('mine wins over unassigned when both arrive (the API takes one assignee)', () => {
    const parsed = parseListQuery({ mine: '1', unassigned: '1' })
    expect(parsed.mine).toBe(true)
    expect(parsed.unassigned).toBe(false)
  })
})

describe('listQueryOf / mergeListQuery', () => {
  it('writes only what differs from the default', () => {
    expect(listQueryOf(base)).toEqual({})
    expect(listQueryOf(state({ tab: 'cancelled', q: 'S-000012', unassigned: true, subtype: 'COMPLAINT' }))).toEqual({
      tab: 'cancelled',
      q: 'S-000012',
      unassigned: '1',
      subtype: 'COMPLAINT',
    })
  })

  it('round-trips through parseListQuery', () => {
    const s = state({ tab: 'scheduled', q: 'Luis', mine: true, windowClosingSoon: true, subtype: 'DELIVERY_ZONE' })
    expect(parseListQuery(listQueryOf(s))).toEqual(s)
  })

  it('keeps unrelated keys of the current query and replaces ours', () => {
    const merged = mergeListQuery({ foo: 'bar', tab: 'resolved', mine: '1' }, state({ overdue: true }))
    expect(merged).toEqual({ foo: 'bar', overdue: '1' })
  })

  it('exposes the keys it owns', () => {
    expect([...LIST_QUERY_KEYS].sort()).toEqual(['mine', 'overdue', 'q', 'subtype', 'tab', 'unassigned', 'window'])
  })
})

describe('groupsFiltersOf — tab and chips become GET /groups params', () => {
  it.each([
    ['open', 'open'],
    ['scheduled', 'scheduled'],
    ['resolved', 'resolved'],
    ['cancelled', 'cancelled'],
  ] as const)('tab %s → status %s', (tab, status) => {
    expect(groupsFiltersOf(state({ tab })).status).toBe(status)
  })

  it('no filter sends only the status', () => {
    expect(groupsFiltersOf(base)).toEqual({ status: 'open' })
  })

  it('Mías → assignee me, Sin responsable → unassigned', () => {
    expect(groupsFiltersOf(state({ mine: true })).assignee).toBe('me')
    expect(groupsFiltersOf(state({ unassigned: true })).assignee).toBe('unassigned')
  })

  it('Vencidas and Ventana por cerrar → overdue / windowClosingSoon true; off sends nothing', () => {
    expect(groupsFiltersOf(state({ overdue: true, windowClosingSoon: true }))).toEqual({
      status: 'open',
      overdue: true,
      windowClosingSoon: true,
    })
    expect(groupsFiltersOf(base)).not.toHaveProperty('overdue')
  })

  it('sends the trimmed search and the subtype; a blank search is not sent', () => {
    expect(groupsFiltersOf(state({ q: '  Ana  ', subtype: 'RESTOCK' }))).toEqual({
      status: 'open',
      q: 'Ana',
      subtype: 'RESTOCK',
    })
    expect(groupsFiltersOf(state({ q: '   ' }))).not.toHaveProperty('q')
  })
})

describe('historyFiltersOf / customerStatusOf', () => {
  it('the history only takes the subtype (the endpoint has no search or chips)', () => {
    expect(historyFiltersOf(state({ tab: 'history', q: 'x', mine: true, subtype: 'RESTOCK' }))).toEqual({
      subtype: 'RESTOCK',
    })
    expect(historyFiltersOf(state({ tab: 'history' }))).toEqual({})
  })

  it('«Ver las N restantes» asks for the tab status; scheduled reads the open ones', () => {
    expect(customerStatusOf('open')).toBe('open')
    expect(customerStatusOf('scheduled')).toBe('open')
    expect(customerStatusOf('resolved')).toBe('resolved')
    expect(customerStatusOf('cancelled')).toBe('cancelled')
  })
})

describe('clearListFilters', () => {
  it('«Quitar filtros» clears search, chips and subtype but keeps the tab', () => {
    const cleared = clearListFilters(
      state({ tab: 'resolved', q: 'Ana', mine: true, overdue: true, windowClosingSoon: true, subtype: 'RESTOCK' }),
    )
    expect(cleared).toEqual(state({ tab: 'resolved' }))
    expect(hasActiveFilters(cleared)).toBe(false)
  })
})

describe('toggleListChip / hasActiveFilters', () => {
  it('turning Mías on turns Sin responsable off and the other way round', () => {
    const mine = toggleListChip(state({ unassigned: true }), 'mine')
    expect(mine).toMatchObject({ mine: true, unassigned: false })
    expect(toggleListChip(mine, 'unassigned')).toMatchObject({ mine: false, unassigned: true })
  })

  it('toggles an independent chip on and off', () => {
    const on = toggleListChip(base, 'overdue')
    expect(on.overdue).toBe(true)
    expect(toggleListChip(on, 'overdue').overdue).toBe(false)
  })

  it('the tab alone is not a filter; search, a chip or a subtype is', () => {
    expect(hasActiveFilters(state({ tab: 'resolved' }))).toBe(false)
    expect(hasActiveFilters(state({ q: ' ' }))).toBe(false)
    expect(hasActiveFilters(state({ q: 'a' }))).toBe(true)
    expect(hasActiveFilters(state({ windowClosingSoon: true }))).toBe(true)
    expect(hasActiveFilters(state({ subtype: 'COMPLAINT' }))).toBe(true)
  })
})
