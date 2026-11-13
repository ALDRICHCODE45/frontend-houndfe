/**
 * Chatbot request inbox transport on the shared axios `http` (handoffs 11, 12 and 14).
 *
 * Each method unwraps `{ data }`. Query params and command bodies are picked by an explicit
 * allow-list: the backend answers `400` to any unknown parameter or body field, so nothing that
 * is not named here ever reaches the wire. Every command takes the `Idempotency-Key` from the
 * caller (one key per user attempt, reused only for network retries of that attempt).
 */
import { http } from '@/core/shared/api/http'
import type {
  CancelRequestBody,
  ChatbotRequestAssignableUsersResponse,
  ChatbotRequestAuditPage,
  ChatbotRequestAuditParams,
  ChatbotRequestCommandResponse,
  ChatbotRequestCounts,
  ChatbotRequestCustomerParams,
  ChatbotRequestDetail,
  ChatbotRequestGroupsPage,
  ChatbotRequestGroupsParams,
  ChatbotRequestHistoryParams,
  ChatbotRequestMergeCandidatesResponse,
  ChatbotRequestRowsPage,
  ChatbotRequestZoneImpact,
  ClaimRequestBody,
  FinishRequestBody,
  LinkCustomerRequestBody,
  MergeRequestBody,
  ReassignRequestBody,
  ReleaseRequestBody,
  ReplyRequestBody,
  ResolveRequestAction,
  ResolveRequestBody,
} from '../interfaces/chatbot-request.types'

export interface ChatbotRequestReadOptions {
  /** The executing TanStack query signal — the only read knob forwarded. */
  signal?: AbortSignal
}

const BASE = '/chatbot-requests'
const IDEMPOTENCY_HEADER = 'Idempotency-Key'

const GROUPS_PARAMS = [
  'status',
  'subtype',
  'assignee',
  'overdue',
  'windowClosingSoon',
  'q',
  'cursor',
  'limit',
] as const
/** `?customerKey=` takes the same list filters as `groups` (handoff 14 §15.1) plus its own paging. */
const CUSTOMER_PARAMS = [
  'customerKey',
  'status',
  'subtype',
  'assignee',
  'overdue',
  'windowClosingSoon',
  'q',
  'cursor',
  'limit',
] as const
const HISTORY_PARAMS = ['subtype', 'resolvedBy', 'customerKey', 'from', 'to', 'cursor', 'limit'] as const
const AUDIT_PARAMS = ['cursor', 'limit'] as const

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

/** Keeps only the named keys that carry a value; `false` and `0` are values. */
function pick<T extends object>(source: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const record = source as Record<string, unknown>
  for (const key of keys) {
    if (!isBlank(record[key])) out[key] = record[key]
  }
  return out
}

const path = (id: string, suffix = '') => `${BASE}/${encodeURIComponent(id)}${suffix}`

/** Body fields of every `resolve` action (handoff 12 §2); anything else is a 400. */
const RESOLVE_FIELDS: Record<ResolveRequestAction, readonly string[]> = {
  PROVIDE_RESTOCK_ESTIMATE: ['expectedVersion', 'action', 'restockDays'],
  REPORT_RESTOCK_ESTIMATE_UNAVAILABLE: ['expectedVersion', 'action'],
  PROVIDE_EXPIRATION_TEXT: ['expectedVersion', 'action', 'expirationText'],
  REPORT_EXPIRATION_UNAVAILABLE: ['expectedVersion', 'action'],
  APPROVE_DELIVERY_ZONE: [
    'expectedVersion',
    'action',
    'zoneType',
    'surchargeCents',
    'etaDays',
    'expectedZoneSetVersion',
  ],
  REJECT_DELIVERY_ZONE: ['expectedVersion', 'action', 'expectedZoneSetVersion'],
  CONFIRM_RECEIPT: ['expectedVersion', 'action', 'amountCents'],
  REJECT_RECEIPT: ['expectedVersion', 'action', 'reason', 'customerReason'],
}

function idempotent(key: string) {
  return { headers: { [IDEMPOTENCY_HEADER]: key } }
}

async function command(
  url: string,
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<ChatbotRequestCommandResponse> {
  const { data } = await http.post<ChatbotRequestCommandResponse>(url, body, idempotent(idempotencyKey))
  return data
}

export const chatbotRequestApi = {
  // ─── Reads ────────────────────────────────────────────────────────────────

  /** GET /chatbot-requests/groups — one cursor page of customer groups. */
  async listGroups(
    params: ChatbotRequestGroupsParams = {},
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestGroupsPage> {
    const { data } = await http.get<ChatbotRequestGroupsPage>(`${BASE}/groups`, {
      params: pick(params, GROUPS_PARAMS),
      signal: options?.signal,
    })
    return data
  },

  /** GET /chatbot-requests?customerKey= — the rows a group could not show («Ver las N restantes»). */
  async listByCustomer(
    params: ChatbotRequestCustomerParams,
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestRowsPage> {
    const { data } = await http.get<ChatbotRequestRowsPage>(BASE, {
      params: pick(params, CUSTOMER_PARAMS),
      signal: options?.signal,
    })
    return data
  },

  /** GET /chatbot-requests/counts */
  async getCounts(options?: ChatbotRequestReadOptions): Promise<ChatbotRequestCounts> {
    const { data } = await http.get<ChatbotRequestCounts>(`${BASE}/counts`, { signal: options?.signal })
    return data
  },

  /** GET /chatbot-requests/history — closed more than 7 days ago, newest first. */
  async listHistory(
    params: ChatbotRequestHistoryParams = {},
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestRowsPage> {
    const { data } = await http.get<ChatbotRequestRowsPage>(`${BASE}/history`, {
      params: pick(params, HISTORY_PARAMS),
      signal: options?.signal,
    })
    return data
  },

  /** GET /chatbot-requests/:id */
  async getDetail(id: string, options?: ChatbotRequestReadOptions): Promise<ChatbotRequestDetail> {
    const { data } = await http.get<ChatbotRequestDetail>(path(id), { signal: options?.signal })
    return data
  },

  /** GET /chatbot-requests/:id/audit — events beyond the 20 of the detail. */
  async listAudit(
    id: string,
    params: ChatbotRequestAuditParams = {},
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestAuditPage> {
    const { data } = await http.get<ChatbotRequestAuditPage>(path(id, '/audit'), {
      params: pick(params, AUDIT_PARAMS),
      signal: options?.signal,
    })
    return data
  },

  /** GET /chatbot-requests/:id/merge-candidates — needs `update:ChatbotRequest` too. */
  async listMergeCandidates(
    id: string,
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestMergeCandidatesResponse> {
    const { data } = await http.get<ChatbotRequestMergeCandidatesResponse>(path(id, '/merge-candidates'), {
      signal: options?.signal,
    })
    return data
  },

  /** GET /chatbot-requests/assignable-users — needs `update:ChatbotRequestAssignment`. */
  async listAssignableUsers(
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestAssignableUsersResponse> {
    const { data } = await http.get<ChatbotRequestAssignableUsersResponse>(`${BASE}/assignable-users`, {
      signal: options?.signal,
    })
    return data
  },

  /** GET /chatbot-requests/:id/zone-impact — before confirming a zone approval. */
  async getZoneImpact(
    id: string,
    options?: ChatbotRequestReadOptions,
  ): Promise<ChatbotRequestZoneImpact> {
    const { data } = await http.get<ChatbotRequestZoneImpact>(path(id, '/zone-impact'), {
      signal: options?.signal,
    })
    return data
  },

  // ─── Commands (each answers a small 200 `{request}`) ──────────────────────

  claim(id: string, body: ClaimRequestBody, idempotencyKey: string) {
    return command(path(id, '/claim'), pick(body, ['expectedVersion']), idempotencyKey)
  },

  release(id: string, body: ReleaseRequestBody, idempotencyKey: string) {
    return command(path(id, '/release'), pick(body, ['expectedVersion']), idempotencyKey)
  },

  reassign(id: string, body: ReassignRequestBody, idempotencyKey: string) {
    return command(path(id, '/reassign'), pick(body, ['expectedVersion', 'toUserId', 'note']), idempotencyKey)
  },

  /** `customerNote` is never sent with `DUPLICATE`; blank optional notes are left out (1..500 chars). */
  cancel(id: string, body: CancelRequestBody, idempotencyKey: string) {
    const fields = body.reason === 'DUPLICATE' ? ['expectedVersion', 'reason', 'note'] : ['expectedVersion', 'reason', 'note', 'customerNote']
    return command(path(id, '/cancel'), pick(body, fields), idempotencyKey)
  },

  merge(id: string, body: MergeRequestBody, idempotencyKey: string) {
    return command(
      path(id, '/merge'),
      pick(body, ['expectedVersion', 'intoRequestId', 'intoExpectedVersion']),
      idempotencyKey,
    )
  },

  linkCustomer(id: string, body: LinkCustomerRequestBody, idempotencyKey: string) {
    return command(path(id, '/link-customer'), pick(body, ['expectedVersion', 'customerId']), idempotencyKey)
  },

  /** Answers a clarification and closes it (handoff 19): exactly `{expectedVersion, text}`. */
  reply(id: string, body: ReplyRequestBody, idempotencyKey: string) {
    return command(path(id, '/reply'), pick(body, ['expectedVersion', 'text']), idempotencyKey)
  },

  /** Ends a live conversation (handoff 20 §4); `complaintOutcome` goes only when the caller set it. */
  finish(id: string, body: FinishRequestBody, idempotencyKey: string) {
    return command(path(id, '/finish'), pick(body, ['expectedVersion', 'note', 'complaintOutcome']), idempotencyKey)
  },

  /** Flat body of the action; never `resolutionRequestId` (the backend derives it from the key). */
  resolve(id: string, body: ResolveRequestBody, idempotencyKey: string) {
    const fields = RESOLVE_FIELDS[body.action] ?? ['expectedVersion', 'action']
    return command(path(id, '/resolve'), pick(body, fields), idempotencyKey)
  },
}
