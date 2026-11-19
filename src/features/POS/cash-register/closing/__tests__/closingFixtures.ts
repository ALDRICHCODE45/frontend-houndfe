/**
 * Fictitious, contract-shaped fixtures for the close + corte specs
 * (houndfe-backend docs/frontend-handoff/25-cash-redesign.md §5/§6).
 */
import type {
  CashClosing,
  CashClosingListItem,
  CashSession,
  CashSessionDetail,
} from '../../interfaces/cash.types'

export const ME = 'super-1'
export const CASHIER = 'cashier-1'
export const RECEIVER = 'receiver-1'

export function makeSession(overrides: Partial<CashSession> = {}): CashSession {
  return {
    id: '5b0c2a64-6f1e-4d8a-9a43-0e4c1c6f9d21',
    tenantId: 't-1',
    registerId: 'r-1',
    status: 'SUBMITTED',
    cashierUserId: CASHIER,
    openingCents: 100000,
    frozenAt: '2026-11-05T22:00:00.000Z',
    drawerReleasedAt: '2026-11-05T22:30:00.000Z',
    blind: false,
    expectedCashCents: 150000,
    differenceCents: 0,
    openedAt: '2026-11-05T14:00:00.000Z',
    closedAt: null,
    cashierDisplayName: 'Ana Cajera',
    ...overrides,
  }
}

/** A session ready to close: declared = expected, verified, all received, all allocated. */
export function makeReadyDetail(overrides: Partial<CashSessionDetail> = {}): CashSessionDetail {
  return {
    session: makeSession(),
    register: { id: 'r-1', name: 'Caja Mostrador 2', isActive: true },
    movements: [],
    counts: [
      {
        id: 'count-d1',
        kind: 'DECLARATION',
        revision: 1,
        actorUserId: CASHIER,
        lines: [
          { channelKey: 'CASH', amountCents: 150000 },
          { channelKey: 'METHOD:CARD_DEBIT', amountCents: 32000 },
        ],
        denominations: null,
        notes: null,
        createdAt: '2026-11-05T22:12:00.000Z',
      },
      {
        id: 'count-v1',
        kind: 'VERIFICATION',
        revision: 1,
        actorUserId: ME,
        lines: [
          { channelKey: 'CASH', amountCents: 150000 },
          { channelKey: 'METHOD:CARD_DEBIT', amountCents: 32000 },
        ],
        denominations: null,
        notes: null,
        createdAt: '2026-11-05T22:18:00.000Z',
      },
    ],
    handovers: [
      {
        id: 'h-1',
        sessionId: 's',
        kind: 'WITHDRAWAL',
        declaredCents: 50000,
        receivedCents: 50000,
        senderUserId: CASHIER,
        receiverUserId: RECEIVER,
        receiptActorUserId: RECEIVER,
        declaredAt: '2026-11-05T22:20:00.000Z',
        receivedAt: '2026-11-05T22:25:00.000Z',
        notes: null,
        receiptNotes: null,
      },
      {
        id: 'h-2',
        sessionId: 's',
        kind: 'FLOAT',
        declaredCents: 100000,
        receivedCents: 100000,
        senderUserId: CASHIER,
        receiverUserId: CASHIER,
        receiptActorUserId: CASHIER,
        declaredAt: '2026-11-05T22:21:00.000Z',
        receivedAt: '2026-11-05T22:22:00.000Z',
        notes: null,
        receiptNotes: null,
      },
    ],
    closing: null,
    channelSnapshot: [
      { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH', expectedCents: 150000 },
      {
        channelKey: 'METHOD:CARD_DEBIT',
        channelLabel: 'Tarjeta de débito',
        method: 'CARD_DEBIT',
        expectedCents: 32000,
      },
    ],
    ...overrides,
  }
}

export const CLOSING: CashClosing = {
  id: '9a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  sessionId: '5b0c2a64-6f1e-4d8a-9a43-0e4c1c6f9d21',
  folio: 'CC-2f6d9c1e-8b7a-4c3d-9e2f-1a0b9c8d7e6f',
  createdAt: '2026-11-05T22:45:30.120Z',
  snapshot: {
    sessionId: '5b0c2a64-6f1e-4d8a-9a43-0e4c1c6f9d21',
    tenantId: 'ced6cc10-a037-4f41-92af-ee69bbb51c8b',
    registerId: 'a1f3e0b2-3c4d-4e5f-8a9b-0c1d2e3f4a5b',
    folio: 'CC-2f6d9c1e-8b7a-4c3d-9e2f-1a0b9c8d7e6f',
    cashierUserId: '7d2e9c10-4b8a-4f6e-9c1d-2a3b4c5d6e7f',
    openingCents: 100000,
    expectedCents: 150000,
    declaredCents: 149500,
    verifiedCents: 149500,
    verifierUserId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
    channels: [
      {
        channelKey: 'CASH',
        channelLabel: 'Efectivo',
        method: 'CASH',
        expectedCents: 150000,
        declaredCents: 149500,
        verifiedCents: 149500,
        differenceCents: -500,
      },
      {
        channelKey: 'METHOD:CARD_DEBIT',
        channelLabel: 'Tarjeta de débito',
        method: 'CARD_DEBIT',
        expectedCents: 32000,
        declaredCents: 32000,
        verifiedCents: 32000,
        differenceCents: 0,
      },
    ],
    handovers: [
      {
        handoverId: 'f5c2d8e3-0b4a-4f7c-9d6e-2a3b4c5d6e7f',
        kind: 'FLOAT',
        declaredCents: 100000,
        receivedCents: 100000,
        senderUserId: '7d2e9c10-4b8a-4f6e-9c1d-2a3b4c5d6e7f',
        receiverUserId: '7d2e9c10-4b8a-4f6e-9c1d-2a3b4c5d6e7f',
        receiptActorUserId: '7d2e9c10-4b8a-4f6e-9c1d-2a3b4c5d6e7f',
        declaredAt: '2026-11-05T22:21:00.000Z',
        receivedAt: '2026-11-05T22:22:00.000Z',
      },
      {
        handoverId: 'e4b1c7d2-9a3f-4e6b-8c5d-1f2a3b4c5d6e',
        kind: 'WITHDRAWAL',
        declaredCents: 49500,
        receivedCents: 49500,
        senderUserId: '7d2e9c10-4b8a-4f6e-9c1d-2a3b4c5d6e7f',
        receiverUserId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
        receiptActorUserId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
        declaredAt: '2026-11-05T22:20:00.000Z',
        receivedAt: '2026-11-05T22:25:00.000Z',
      },
    ],
    countedAt: '2026-11-05T22:12:00.000Z',
    verifiedAt: '2026-11-05T22:18:00.000Z',
    closedAt: '2026-11-05T22:45:30.000Z',
    closedByUserId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
    openedAt: '2026-11-05T14:00:00.000Z',
    registerName: 'Caja Mostrador 2',
    cashierName: 'Ana Cajera',
    verifierName: 'Luis Supervisor',
    closedByName: 'Luis Supervisor',
    declarationNotes: 'Faltan 5 pesos de cambio',
    verificationNotes: null,
    comparison: {
      expectedCents: 150000,
      declaredCents: 149500,
      verifiedCents: 149500,
      declarationDifferenceCents: -500,
      verificationDifferenceCents: 0,
      verifiedVsExpectedDifferenceCents: -500,
      requiresDeclarationNotes: true,
      requiresVerificationNotes: false,
      hasDiscrepancy: true,
    },
    closingNotes: 'Cierre sin novedad',
  },
}

/** `GET /cash-closings` item for {@link CLOSING} (§3.1): current names + declared − expected. */
export const CLOSING_ITEM: CashClosingListItem = {
  id: CLOSING.id,
  sessionId: CLOSING.sessionId,
  folio: CLOSING.folio,
  createdAt: CLOSING.createdAt,
  register: { id: 'a1f3e0b2-3c4d-4e5f-8a9b-0c1d2e3f4a5b', name: 'Caja Mostrador 2' },
  cashier: { userId: '7d2e9c10-4b8a-4f6e-9c1d-2a3b4c5d6e7f', displayName: 'Ana Cajera' },
  differenceCents: -500,
}

/** A 422 axios-shaped rejection with the guard/domain envelope. */
export function cashError(code: string, details: Record<string, unknown> = {}, status = 422) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: {
      status,
      data: { statusCode: status, error: code, message: 'raw backend message', ...details },
    },
  })
}
