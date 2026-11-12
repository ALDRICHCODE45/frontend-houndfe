import type {
  ChatbotRequestCounts,
  ChatbotRequestGroup,
  ChatbotRequestRow,
} from '../chatbot-request.types'

/** A NEW restock row with the final v1.3 shape; override what a test cares about. */
export function makeRow(overrides: Partial<ChatbotRequestRow> = {}): ChatbotRequestRow {
  return {
    id: 'req-1',
    folio: 'S-000001',
    customerKey: 'k1.abc',
    kind: 'DECISION',
    subtype: 'RESTOCK',
    status: 'NEW',
    displayStatus: 'NEW',
    summary: 'Croquetas 15 kg',
    assignee: null,
    createdAt: '2026-11-11T17:00:00.000Z',
    claimDeadlineAt: '2026-11-11T18:00:00.000Z',
    resolveDeadlineAt: null,
    overdueAt: null,
    slaPaused: false,
    slaResumesAt: null,
    whatsappWindowClosesAt: null,
    unreadCustomerMessages: 0,
    scheduledFor: null,
    requiresTemplateAtStart: false,
    needsReschedule: false,
    liveSession: null,
    closedAt: null,
    resolvedBy: null,
    version: 1,
    cancelReason: null,
    staffCancelReason: null,
    mergedInto: null,
    slaLevel: 'OK',
    allowedActions: ['CLAIM'],
    deniedActions: [],
    ...overrides,
  }
}

export function makeGroup(
  key: string,
  rows: ChatbotRequestRow[] = [makeRow({ customerKey: key })],
): ChatbotRequestGroup {
  return {
    customerKey: key,
    customer: { id: null, displayName: null, phone: '55 **** 5678', isTrusted: false },
    mostUrgentAt: null,
    openCount: rows.length,
    requests: rows,
    moreRequests: 0,
  }
}

export const countsFixture: ChatbotRequestCounts = {
  new: 7,
  inProgress: 4,
  mine: 2,
  overdue: 1,
  windowClosingSoon: 3,
  scheduled: 0,
  needsReschedule: 0,
  resolved7d: 12,
  cancelled7d: 5,
  openGroups: 9,
}
