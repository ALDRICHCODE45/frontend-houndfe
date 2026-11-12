/**
 * Inbox list state ⇄ URL ⇄ API params (chatbot-requests-inbox S2, T2.U2).
 *
 * The URL query is the single source of truth: tab, search, the four chips and the subtype are
 * read from it (`parseListQuery`) and written back without defaults (`listQueryOf`). Only the
 * params named in `groupsFiltersOf` / `historyFiltersOf` ever reach the API.
 */
import type {
  ChatbotRequestCustomerParams,
  ChatbotRequestGroupsFilters,
  ChatbotRequestHistoryParams,
  ChatbotRequestSubtype,
} from '../interfaces/chatbot-request.types'
import { SUBTYPE_LABELS } from './requestLabels'

export type RequestsListTab = 'open' | 'scheduled' | 'resolved' | 'cancelled' | 'history'

export type RequestsListChip = 'mine' | 'unassigned' | 'overdue' | 'windowClosingSoon'

export interface RequestsListState {
  tab: RequestsListTab
  /** Folio, customer name or phone digits; at most {@link SEARCH_MAX_LENGTH} characters. */
  q: string
  /** `assignee=me`. */
  mine: boolean
  /** `assignee=unassigned`; never together with `mine` (the API takes one assignee). */
  unassigned: boolean
  overdue: boolean
  windowClosingSoon: boolean
  subtype: ChatbotRequestSubtype | null
}

export const SEARCH_MAX_LENGTH = 100

export const LIST_TABS: ReadonlyArray<{ id: RequestsListTab; label: string }> = [
  { id: 'open', label: 'Abiertas' },
  { id: 'scheduled', label: 'Agendadas' },
  { id: 'resolved', label: 'Resueltas · 7 días' },
  { id: 'cancelled', label: 'Canceladas · 7 días' },
  { id: 'history', label: 'Historial' },
]

/** Query params of this screen; any other param of the URL is left alone. */
export const LIST_QUERY_KEYS = ['tab', 'q', 'mine', 'unassigned', 'overdue', 'window', 'subtype'] as const

const TABS: ReadonlySet<string> = new Set(LIST_TABS.map((entry) => entry.id))

function firstValue(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : null
}

const isOn = (value: unknown) => firstValue(value) === '1'

export function parseListQuery(query: Record<string, unknown>): RequestsListState {
  const tab = firstValue(query.tab)
  const subtype = firstValue(query.subtype)
  const mine = isOn(query.mine)
  return {
    tab: tab && TABS.has(tab) ? (tab as RequestsListTab) : 'open',
    q: (firstValue(query.q) ?? '').trim().slice(0, SEARCH_MAX_LENGTH),
    mine,
    unassigned: !mine && isOn(query.unassigned),
    overdue: isOn(query.overdue),
    windowClosingSoon: isOn(query.window),
    subtype: subtype && subtype in SUBTYPE_LABELS ? (subtype as ChatbotRequestSubtype) : null,
  }
}

/** The state as URL query, with every default left out. */
export function listQueryOf(state: RequestsListState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.tab !== 'open') query.tab = state.tab
  const q = state.q.trim().slice(0, SEARCH_MAX_LENGTH)
  if (q) query.q = q
  if (state.mine) query.mine = '1'
  if (state.unassigned) query.unassigned = '1'
  if (state.overdue) query.overdue = '1'
  if (state.windowClosingSoon) query.window = '1'
  if (state.subtype) query.subtype = state.subtype
  return query
}

/** The current URL query with this screen's params replaced by the new state. */
export function mergeListQuery(
  current: Record<string, unknown>,
  state: RequestsListState,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current }
  for (const param of LIST_QUERY_KEYS) delete merged[param]
  return { ...merged, ...listQueryOf(state) }
}

/** Params of `GET /chatbot-requests/groups` (the cursor and limit belong to the composable). */
export function groupsFiltersOf(state: RequestsListState): ChatbotRequestGroupsFilters {
  const filters: ChatbotRequestGroupsFilters = {
    status: state.tab === 'history' ? 'open' : state.tab,
  }
  if (state.mine) filters.assignee = 'me'
  else if (state.unassigned) filters.assignee = 'unassigned'
  if (state.overdue) filters.overdue = true
  if (state.windowClosingSoon) filters.windowClosingSoon = true
  const q = state.q.trim().slice(0, SEARCH_MAX_LENGTH)
  if (q) filters.q = q
  if (state.subtype) filters.subtype = state.subtype
  return filters
}

/** `GET /chatbot-requests/history` has no search and no chips: only the subtype. */
export function historyFiltersOf(
  state: RequestsListState,
): Omit<ChatbotRequestHistoryParams, 'cursor' | 'limit'> {
  return state.subtype ? { subtype: state.subtype } : {}
}

/** Status of `?customerKey=` for a tab (it has no `scheduled`: those are open requests). */
export function customerStatusOf(tab: RequestsListTab): ChatbotRequestCustomerParams['status'] {
  if (tab === 'resolved' || tab === 'cancelled') return tab
  return 'open'
}

/** Mías and Sin responsable exclude each other; the other chips are independent. */
export function toggleListChip(state: RequestsListState, chip: RequestsListChip): RequestsListState {
  const next = { ...state, [chip]: !state[chip] }
  if (chip === 'mine' && next.mine) next.unassigned = false
  if (chip === 'unassigned' && next.unassigned) next.mine = false
  return next
}

/** «Quitar filtros»: search, chips and subtype off; the tab stays. */
export function clearListFilters(state: RequestsListState): RequestsListState {
  return {
    ...state,
    q: '',
    mine: false,
    unassigned: false,
    overdue: false,
    windowClosingSoon: false,
    subtype: null,
  }
}

/** Search, a chip or a subtype (the tab is not a filter). */
export function hasActiveFilters(state: RequestsListState): boolean {
  return (
    state.q.trim() !== '' ||
    state.mine ||
    state.unassigned ||
    state.overdue ||
    state.windowClosingSoon ||
    state.subtype !== null
  )
}
