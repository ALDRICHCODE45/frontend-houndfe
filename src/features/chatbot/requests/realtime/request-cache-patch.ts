/**
 * Pure cache edits for the realtime `request.*` events (handoff 17 §3.1).
 *
 * The row of an event is the same row `GET /chatbot-requests/groups` returns, so a held row is
 * replaced by it when its `version` is greater than or equal to the held one (equal must apply:
 * the SLA sweep, `link-customer` and unread counts change a row without a new version). What a row
 * does not carry (group aggregates, order, rows a list never loaded) is not guessed: those lists
 * are reported as «refetch».
 */
import type { InfiniteData } from '@tanstack/vue-query'
import type {
  ChatbotRequestDetail,
  ChatbotRequestGroup,
  ChatbotRequestGroupsFilters,
  ChatbotRequestGroupsPage,
  ChatbotRequestRow,
  ChatbotRequestRowsPage,
} from '../interfaces/chatbot-request.types'

export type GroupsCache = InfiniteData<ChatbotRequestGroupsPage, string | undefined>
export type RowsCache = InfiniteData<ChatbotRequestRowsPage, string | undefined>

export interface Patched<T> {
  data: T
  /** The edit is not enough to be right: read the list again. */
  refetch: boolean
}

/** The slice of a list's filters the matcher understands (groups filters, or by-customer params). */
export type ListFilters = Pick<
  ChatbotRequestGroupsFilters,
  'status' | 'subtype' | 'assignee' | 'overdue' | 'windowClosingSoon' | 'q'
>

export const isOpen = (row: Pick<ChatbotRequestRow, 'status'>) => row.status === 'NEW' || row.status === 'IN_PROGRESS'

/** The stream's row, as far as the cache needs it. */
export function isRequestRow(value: unknown): value is ChatbotRequestRow {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.version === 'number' &&
    typeof r.customerKey === 'string' &&
    typeof r.status === 'string'
  )
}

/**
 * Does `row` belong in a list with these filters? `null` = cannot tell from the row alone (the
 * «Agendadas» tab, an unknown user for `assignee=me`): a row already held stays, a new one refetches.
 */
export function rowMatches(row: ChatbotRequestRow, filters: ListFilters, userId: string | null): boolean | null {
  let unknown = false
  const check = (verdict: boolean | null) => {
    if (verdict === null) unknown = true
    return verdict !== false
  }
  const status = filters.status ?? 'open'
  const results: Array<boolean | null> = []
  if (status === 'open') results.push(isOpen(row))
  else if (status === 'resolved') results.push(row.status === 'RESOLVED')
  else if (status === 'cancelled') results.push(row.status === 'CANCELLED')
  else results.push(isOpen(row) ? null : false) // scheduled: depends on the booking rules of the server
  if (filters.subtype) results.push(row.subtype === filters.subtype)
  if (filters.assignee) {
    const wanted = filters.assignee
    if (wanted === 'me') results.push(userId === null ? null : row.assignee?.id === userId)
    else if (wanted === 'unassigned' || wanted === 'none') results.push(row.assignee === null)
    else results.push(row.assignee?.id === wanted)
  }
  if (filters.overdue === true) results.push(row.overdueAt !== null)
  if (filters.windowClosingSoon === true) results.push(row.windowClosingSoon === true)
  if (filters.q) results.push(null) // the server searches folio, name and phone: not decidable here
  for (const verdict of results) if (!check(verdict)) return false
  return unknown ? null : true
}

/** Fields a group's open count, overdue count and `mostUrgentAt` (hence its place) are computed from. */
export function aggregatesChanged(held: ChatbotRequestRow, next: ChatbotRequestRow): boolean {
  return (
    isOpen(held) !== isOpen(next) ||
    held.customerKey !== next.customerKey ||
    (held.overdueAt === null) !== (next.overdueAt === null) ||
    held.overdueAt !== next.overdueAt ||
    held.claimDeadlineAt !== next.claimDeadlineAt ||
    held.resolveDeadlineAt !== next.resolveDeadlineAt ||
    held.closedAt !== next.closedAt ||
    held.scheduledFor !== next.scheduledFor
  )
}

interface Found {
  row: ChatbotRequestRow
  groupKey: string
}

function findInGroups(data: GroupsCache, id: string): Found | null {
  for (const page of data.pages) {
    for (const group of page.items) {
      const row = group.requests.find((r) => r.id === id)
      if (row) return { row, groupKey: group.customerKey }
    }
  }
  return null
}

function mapGroups(data: GroupsCache, edit: (group: ChatbotRequestGroup) => ChatbotRequestGroup | null): GroupsCache {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.flatMap((group) => {
        const next = edit(group)
        return next ? [next] : []
      }),
    })),
  }
}

/** Applies one `request.*` row to a cached `groups` list. */
export function patchGroups(
  data: GroupsCache,
  row: ChatbotRequestRow,
  previousCustomerKey: string | null,
  filters: ListFilters,
  userId: string | null,
): Patched<GroupsCache> {
  const verdict = rowMatches(row, filters, userId)
  const found = findInGroups(data, row.id)
  if (!found) return { data, refetch: verdict !== false }
  if (row.version < found.row.version) return { data, refetch: false }

  if (verdict === false || previousCustomerKey !== null || row.customerKey !== found.groupKey) {
    // Left the view, or moved to another customer: out of this group; a refetch places it.
    const next = mapGroups(data, (group) => {
      if (group.customerKey !== found.groupKey) return group
      const requests = group.requests.filter((r) => r.id !== row.id)
      return requests.length === 0 ? null : { ...group, requests }
    })
    return { data: next, refetch: true }
  }

  const next = mapGroups(data, (group) =>
    group.customerKey !== found.groupKey
      ? group
      : { ...group, requests: group.requests.map((r) => (r.id === row.id ? row : r)) },
  )
  return { data: next, refetch: aggregatesChanged(found.row, row) }
}

/** Applies one `request.*` row to a cached `?customerKey=` list. */
export function patchCustomerRows(
  data: RowsCache,
  row: ChatbotRequestRow,
  customerKey: string,
  params: ListFilters,
  userId: string | null,
): Patched<RowsCache> {
  const verdict = rowMatches(row, params, userId)
  let held: ChatbotRequestRow | undefined
  for (const page of data.pages) held ??= page.items.find((r) => r.id === row.id)
  if (!held) return { data, refetch: row.customerKey === customerKey && verdict !== false }
  if (row.version < held.version) return { data, refetch: false }

  const stays = verdict !== false && row.customerKey === customerKey
  const next: RowsCache = {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: stays ? page.items.map((r) => (r.id === row.id ? row : r)) : page.items.filter((r) => r.id !== row.id),
    })),
  }
  return { data: next, refetch: false }
}

/** `{...held, ...row}`: the row's fields over the detail, keeping audit, decision, customer card… */
export function mergeRowIntoDetail(held: ChatbotRequestDetail, row: ChatbotRequestRow): ChatbotRequestDetail {
  // `customer` on a row is the group-header card of history rows; the detail's own card is richer.
  return { ...held, ...row, customer: held.customer }
}

/** «Otras solicitudes abiertas» of a detail: the same request, patched or dropped once closed. */
export function patchOtherOpen(
  detail: ChatbotRequestDetail,
  row: ChatbotRequestRow,
): ChatbotRequestDetail | null {
  const held = detail.otherOpenRequests.find((r) => r.id === row.id)
  if (!held || row.version < held.version) return null
  return {
    ...detail,
    otherOpenRequests: isOpen(row)
      ? detail.otherOpenRequests.map((r) => (r.id === row.id ? row : r))
      : detail.otherOpenRequests.filter((r) => r.id !== row.id),
  }
}
