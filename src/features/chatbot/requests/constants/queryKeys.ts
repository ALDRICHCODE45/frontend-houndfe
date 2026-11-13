import type {
  ChatbotRequestAuditParams,
  ChatbotRequestCustomerParams,
  ChatbotRequestGroupsFilters,
  ChatbotRequestHistoryParams,
} from '../interfaces/chatbot-request.types'

/**
 * Tenant-scoped keys: a branch switch never reuses another branch's requests. Everything lives
 * under `all(tenant)`, so one invalidation after a command refreshes groups, counts and detail.
 * Cursors are page params of the infinite queries, never part of a key.
 */
export const chatbotRequestKeys = {
  all: (tenantId: string) => ['chatbot-requests', tenantId] as const,
  groups: (tenantId: string, filters: ChatbotRequestGroupsFilters) =>
    ['chatbot-requests', tenantId, 'groups', filters] as const,
  byCustomer: (
    tenantId: string,
    customerKey: string,
    params: Omit<ChatbotRequestCustomerParams, 'customerKey' | 'cursor'>,
  ) => ['chatbot-requests', tenantId, 'by-customer', customerKey, params] as const,
  counts: (tenantId: string) => ['chatbot-requests', tenantId, 'counts'] as const,
  history: (tenantId: string, filters: Omit<ChatbotRequestHistoryParams, 'cursor'>) =>
    ['chatbot-requests', tenantId, 'history', filters] as const,
  detail: (tenantId: string, id: string) => ['chatbot-requests', tenantId, 'detail', id] as const,
  audit: (tenantId: string, id: string, params: Omit<ChatbotRequestAuditParams, 'cursor'> = {}) =>
    ['chatbot-requests', tenantId, 'audit', id, params] as const,
  mergeCandidates: (tenantId: string, id: string) =>
    ['chatbot-requests', tenantId, 'merge-candidates', id] as const,
  assignableUsers: (tenantId: string) => ['chatbot-requests', tenantId, 'assignable-users'] as const,
  zoneImpact: (tenantId: string, id: string) => ['chatbot-requests', tenantId, 'zone-impact', id] as const,
  schedulingSlots: (tenantId: string, id: string) =>
    ['chatbot-requests', tenantId, 'scheduling-slots', id] as const,
  /** The loaded thread of one request (latest page + older + polled newer, merged by `seq`). */
  conversation: (tenantId: string, id: string) => ['chatbot-requests', tenantId, 'conversation', id] as const,
}

/**
 * Media blobs live outside `chatbotRequestKeys.all(tenant)` on purpose: a command invalidating the
 * whole feature must not re-download every file. Still tenant-scoped.
 */
export const chatbotMediaKeys = {
  all: (tenantId: string) => ['chatbot-media', tenantId] as const,
  file: (tenantId: string, mediaId: string) => ['chatbot-media', tenantId, mediaId] as const,
}
