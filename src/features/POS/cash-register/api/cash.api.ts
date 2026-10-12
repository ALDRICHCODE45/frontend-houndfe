/**
 * S1 subset — REST client for the POS cash register.
 *
 * Routes, envelopes, status codes and idempotency rules come from the
 * authoritative backend contract
 * `houndfe-backend/.tmp/cash-register-closing/docs/cash-register-closing.md`
 * and the frontend handoff `docs/cash-register-frontend-handoff.md`.
 *
 * Conventions mirror `src/features/POS/sales/api/sale.api.ts`:
 *   - single named `cashApi` object (not individual exports);
 *   - every method unwraps `{ data }`; responses are plain JSON documents with
 *     no `data`/`result`/`payload` wrapper key;
 *   - command methods take an explicit `Idempotency-Key`; the client never
 *     generates a key and never retries automatically.
 *
 * Request bodies are rebuilt from an explicit whitelist, so a caller cannot
 * leak `tenantId`, actor/receipt-actor fields, or a pre-submission
 * `expectedCents`/`differenceCents` oracle into the transport.
 *
 * Out of S1 scope: sales binding (`cashSessionId`) and closing/PDF.
 */

import { http } from '@/core/shared/api/http'
import type {
  CashAnnotationNotesPayload,
  CashCountPayload,
  CashCustody,
  CashCustodyParams,
  CashDeclareResponse,
  CashDeclarationNotesResponse,
  CashDrawerReleaseResponse,
  CashHandover,
  CashHandoverDeclarationPayload,
  CashHandoverReceivePayload,
  CashMovementPayload,
  CashMovementResponse,
  CashRegister,
  CashRegisterCreatePayload,
  CashRegisterListResponse,
  CashRegisterUpdatePayload,
  CashSessionDetail,
  CashSessionListParams,
  CashSessionListResponse,
  CashSessionOpenedResponse,
  CashStartCountResponse,
  CashVerifyResponse,
} from '../interfaces/cash.types'

// ─── Money guards ────────────────────────────────────────────────────────────

/** Persisted PostgreSQL `Int` upper bound; overflow is rejected, never wrapped. */
const MAX_CENTS = 2147483647

function assertCents(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new RangeError(`${field} must be an integer between 0 and ${MAX_CENTS} cents`)
  }
}

function assertQuantity(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new RangeError(`denominations.quantity must be an integer between 0 and ${MAX_CENTS}`)
  }
}

// ─── Whitelisted request builders ────────────────────────────────────────────

function idempotencyConfig(key: string) {
  return { headers: { 'Idempotency-Key': key } }
}

function registerCreateBody(payload: CashRegisterCreatePayload): CashRegisterCreatePayload {
  return { name: payload.name }
}

function registerUpdateBody(payload: CashRegisterUpdatePayload): CashRegisterUpdatePayload {
  const body: CashRegisterUpdatePayload = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.isActive !== undefined) body.isActive = payload.isActive
  return body
}

/** Only the documented list filters; `tenantId`/`recipientUserId` never travel. */
function sessionListParams(params: CashSessionListParams): CashSessionListParams {
  const query: CashSessionListParams = {}
  if (params.page !== undefined) query.page = params.page
  if (params.limit !== undefined) query.limit = params.limit
  if (params.registerId !== undefined) query.registerId = params.registerId
  if (params.from !== undefined) query.from = params.from
  if (params.to !== undefined) query.to = params.to
  if (params.cashierUserId !== undefined) query.cashierUserId = params.cashierUserId
  if (params.pendingOnly !== undefined) query.pendingOnly = params.pendingOnly
  return query
}

/** Custody discovery accepts only `page`/`limit`; the recipient comes from the JWT. */
function custodyParams(params: CashCustodyParams): CashCustodyParams {
  const query: CashCustodyParams = {}
  if (params.page !== undefined) query.page = params.page
  if (params.limit !== undefined) query.limit = params.limit
  return query
}

/** Rebuilds the blind count body: no expected/difference/tenant/actor key survives. */
function countBody(payload: CashCountPayload): CashCountPayload {
  const lines = payload.lines.map(({ channelKey, amountCents }) => {
    assertCents(amountCents, `lines.${channelKey}.amountCents`)
    return { channelKey, amountCents }
  })
  const body: CashCountPayload = { lines }
  if (payload.denominations !== undefined) {
    body.denominations = payload.denominations.map(({ denominationCents, quantity }) => {
      assertCents(denominationCents, 'denominations.denominationCents')
      if (denominationCents === 0)
        throw new RangeError('denominations.denominationCents must be positive')
      assertQuantity(quantity)
      return { denominationCents, quantity }
    })
  }
  if (payload.notes !== undefined) body.notes = payload.notes
  return body
}

function movementBody(payload: CashMovementPayload): CashMovementPayload {
  assertCents(payload.amountCents, 'amountCents')
  return { amountCents: payload.amountCents, reason: payload.reason }
}

function handoverBody(payload: CashHandoverDeclarationPayload): CashHandoverDeclarationPayload {
  assertCents(payload.declaredCents, 'declaredCents')
  const body: CashHandoverDeclarationPayload = {
    handoverKind: payload.handoverKind,
    recipientUserId: payload.recipientUserId,
    declaredCents: payload.declaredCents,
  }
  if (payload.notes !== undefined) body.notes = payload.notes
  return body
}

function handoverReceiptBody(payload: CashHandoverReceivePayload): CashHandoverReceivePayload {
  assertCents(payload.receivedCents, 'receivedCents')
  const body: CashHandoverReceivePayload = { receivedCents: payload.receivedCents }
  if (payload.notes !== undefined) body.notes = payload.notes
  return body
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const cashApi = {
  // ── Registers ──────────────────────────────────────────────────────────────

  /** GET /cash-registers — `read:CashRegister`. */
  async listRegisters(): Promise<CashRegister[]> {
    const { data } = await http.get<CashRegisterListResponse>('/cash-registers')
    return data.items
  },

  /** POST /cash-registers — `create:CashRegister`. */
  async createRegister(
    body: CashRegisterCreatePayload,
    idempotencyKey: string,
  ): Promise<CashRegister> {
    const { data } = await http.post<CashRegister>(
      '/cash-registers',
      registerCreateBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /** PATCH /cash-registers/:id — rename / activate, `update:CashRegister`. */
  async updateRegister(
    id: string,
    body: CashRegisterUpdatePayload,
    idempotencyKey: string,
  ): Promise<CashRegister> {
    const { data } = await http.patch<CashRegister>(
      `/cash-registers/${id}`,
      registerUpdateBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  // ── Sessions ───────────────────────────────────────────────────────────────

  /**
   * GET /cash-sessions — own sessions unless `read:CashSessionAudit`. The page
   * envelope is returned untouched.
   */
  async listSessions(params: CashSessionListParams = {}): Promise<CashSessionListResponse> {
    const { data } = await http.get<CashSessionListResponse>('/cash-sessions', {
      params: sessionListParams(params),
    })
    return data
  },

  /**
   * GET /cash-sessions/:id — detail. Blind absence is preserved: absent
   * `expectedCashCents`/`differenceCents` are never coerced to `0`.
   */
  async getSession(id: string): Promise<CashSessionDetail> {
    const { data } = await http.get<CashSessionDetail>(`/cash-sessions/${id}`)
    return data
  },

  /**
   * POST /cash-registers/:id/sessions — open with a confirmed opening fund.
   * `openingConfirmed` must be literally `true`; `openingHandoverId` is the
   * optional received FLOAT.
   */
  async openSession(
    registerId: string,
    body: { openingCents: number; openingConfirmed: true; openingHandoverId?: string },
    idempotencyKey: string,
  ): Promise<CashSessionOpenedResponse> {
    assertCents(body.openingCents, 'openingCents')
    const payload: { openingCents: number; openingConfirmed: true; openingHandoverId?: string } = {
      openingCents: body.openingCents,
      openingConfirmed: body.openingConfirmed,
    }
    if (body.openingHandoverId !== undefined) payload.openingHandoverId = body.openingHandoverId
    const { data } = await http.post<CashSessionOpenedResponse>(
      `/cash-registers/${registerId}/sessions`,
      payload,
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /** POST /cash-sessions/:id/start-count — freeze; `create:CashCount`. */
  async startCount(id: string, idempotencyKey: string): Promise<CashStartCountResponse> {
    const { data } = await http.post<CashStartCountResponse>(
      `/cash-sessions/${id}/start-count`,
      undefined,
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /**
   * POST /cash-sessions/:id/declarations — blind first count. The body is
   * limited to `lines`/`denominations`/`notes`; the response `comparison` is the
   * normal document or the fallback document, unmodified.
   */
  async declare(
    id: string,
    body: CashCountPayload,
    idempotencyKey: string,
  ): Promise<CashDeclareResponse> {
    const { data } = await http.post<CashDeclareResponse>(
      `/cash-sessions/${id}/declarations`,
      countBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /** POST /cash-sessions/:id/declaration-notes — append-only explanation. */
  async appendNotes(
    id: string,
    body: CashAnnotationNotesPayload,
    idempotencyKey: string,
  ): Promise<CashDeclarationNotesResponse> {
    const { data } = await http.post<CashDeclarationNotesResponse>(
      `/cash-sessions/${id}/declaration-notes`,
      { notes: body.notes },
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /** POST /cash-sessions/:id/verifications — independent recount; never a self-verify. */
  async verify(
    id: string,
    body: CashCountPayload,
    idempotencyKey: string,
  ): Promise<CashVerifyResponse> {
    const { data } = await http.post<CashVerifyResponse>(
      `/cash-sessions/${id}/verifications`,
      countBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  // ── Manual movements ───────────────────────────────────────────────────────

  /** POST /cash-sessions/:id/cash-in — `create:CashIn`. */
  async cashIn(
    id: string,
    body: CashMovementPayload,
    idempotencyKey: string,
  ): Promise<CashMovementResponse> {
    const { data } = await http.post<CashMovementResponse>(
      `/cash-sessions/${id}/cash-in`,
      movementBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /** POST /cash-sessions/:id/cash-out — `create:CashOut`. */
  async cashOut(
    id: string,
    body: CashMovementPayload,
    idempotencyKey: string,
  ): Promise<CashMovementResponse> {
    const { data } = await http.post<CashMovementResponse>(
      `/cash-sessions/${id}/cash-out`,
      movementBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  // ── Custody, FLOAT and drawer release ──────────────────────────────────────

  /** POST /cash-sessions/:id/handovers — declare FLOAT or WITHDRAWAL custody. */
  async declareHandover(
    id: string,
    body: CashHandoverDeclarationPayload,
    idempotencyKey: string,
  ): Promise<CashHandover> {
    const { data } = await http.post<CashHandover>(
      `/cash-sessions/${id}/handovers`,
      handoverBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /**
   * POST /cash-handovers/:id/receive — recipient-bound receipt. The actor is the
   * authenticated JWT subject, so only the explicit amount and optional notes
   * travel; a client can never assert another person's receipt.
   */
  async receiveHandover(
    id: string,
    body: CashHandoverReceivePayload,
    idempotencyKey: string,
  ): Promise<CashHandover> {
    const { data } = await http.post<CashHandover>(
      `/cash-handovers/${id}/receive`,
      handoverReceiptBody(body),
      idempotencyConfig(idempotencyKey),
    )
    return data
  },

  /**
   * GET /cash-handovers/custody — recipient's pending handovers and eligible
   * FLOAT. No filters: scope is the JWT tenant plus the authenticated recipient.
   */
  async getCustody(params: CashCustodyParams = {}): Promise<CashCustody> {
    const { data } = await http.get<CashCustody>('/cash-handovers/custody', {
      params: custodyParams(params),
    })
    return data
  },

  /** POST /cash-sessions/:id/release-drawer — separate from the session status. */
  async releaseDrawer(id: string, idempotencyKey: string): Promise<CashDrawerReleaseResponse> {
    const { data } = await http.post<CashDrawerReleaseResponse>(
      `/cash-sessions/${id}/release-drawer`,
      undefined,
      idempotencyConfig(idempotencyKey),
    )
    return data
  },
}
