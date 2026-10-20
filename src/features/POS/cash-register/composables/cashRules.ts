/**
 * Pure, UI-side cash-register rules.
 *
 * Everything here is a side-effect-free projection over values already returned
 * by the backend. The backend stays authoritative; these helpers only decide
 * what the UI is allowed to *look at* and how entry is validated before a
 * command is sent.
 *
 * Hard contract rules enforced here (see backend `cash-register-closing.md`):
 *   - Blind windows never render expected/difference/movements, even if a
 *     malformed or stale payload still carries them.
 *   - Absence of `expectedCashCents`/`differenceCents` is `null`, never `0`.
 *   - The blind count form is built from the FROZEN `requiredChannels`
 *     identities, never from the live payment catalog.
 *   - A blank channel is not a counted zero; an explicit `0` is.
 *   - `denominations`, when supplied, must sum exactly to the `CASH` line.
 *   - Session status and drawer release are two independent facts.
 *   - Custody discovery is a hint: an unreleased source drawer blocks only the
 *     SAME register, and a received FLOAT amount (not the declared one) is the
 *     opening fund.
 *   - The two differences are distinct and are never merged.
 */
import type { CashCountPayload, CashSession, CashSessionDetail } from '../interfaces/cash.types'
import type { CountChannel } from '../utils/cash-input'
import { integerCents, pesosToCents } from '../utils/cash-input'

export type CashMethod = CountChannel['method']
export type CashStatus = CashSession['status']
export type CashHandover = CashSessionDetail['handovers'][number]
export type CashCountLine = { channelKey: string; amountCents: number }

export const CASH_CHANNEL_KEY = 'CASH'

/** Only the owner's frozen blind window exposes the identity-only channel list. */
export function requiredChannelIdentities(
  detail: CashSessionDetail | null | undefined,
): CountChannel[] {
  if (!detail) return []
  const { session, requiredChannels } = detail
  if (!session || session.blind !== true || session.status !== 'COUNTING') return []
  if (!Array.isArray(requiredChannels)) return []
  return requiredChannels.map(({ channelKey, channelLabel, method }) => ({
    channelKey,
    channelLabel,
    method,
  }))
}

/**
 * Blind-safe session facts. When the window is blind, `expectedCashCents` and
 * `differenceCents` are DROPPED (absent), never coerced to `0`; an absent value
 * in a visible window also reads as `null`.
 */
export function cashSessionFacts(session: CashSession | null | undefined): {
  status: CashStatus | null
  blind: boolean
  openingCents: number | null
  frozenAt: string | null
  drawerReleasedAt: string | null
  expectedCashCents: number | null
  differenceCents: number | null
  expectedVisible: boolean
} {
  if (!session) {
    return {
      status: null,
      blind: false,
      openingCents: null,
      frozenAt: null,
      drawerReleasedAt: null,
      expectedCashCents: null,
      differenceCents: null,
      expectedVisible: false,
    }
  }
  const blind = session.blind === true
  const expectedCashCents = blind ? undefined : session.expectedCashCents
  const differenceCents = blind ? undefined : session.differenceCents
  return {
    status: session.status,
    blind,
    openingCents: session.openingCents,
    frozenAt: session.frozenAt ?? null,
    drawerReleasedAt: session.drawerReleasedAt ?? null,
    expectedCashCents: typeof expectedCashCents === 'number' ? expectedCashCents : null,
    differenceCents: typeof differenceCents === 'number' ? differenceCents : null,
    expectedVisible: !blind && typeof expectedCashCents === 'number',
  }
}

/**
 * Blind-safe detail projection. A blind session NEVER exposes movements or the
 * channel snapshot, even when a malformed cached payload still carries them.
 */
export function blindSafeDetail(
  detail: CashSessionDetail | null | undefined,
): CashSessionDetail | null {
  if (!detail) return null
  if (detail.session?.blind !== true) return detail
  return {
    ...detail,
    movements: [],
    counts: detail.counts ?? [],
    handovers: detail.handovers ?? [],
    channelSnapshot: null,
  }
}

export function isCashSessionWritable(session: CashSession | null | undefined): boolean {
  return session?.status === 'OPEN'
}

/** Blanks are never zero; an explicit `0` is a valid counted zero. */
export function countEntryErrors(
  channels: readonly CountChannel[],
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  return countEntryErrorsWith(
    channels,
    values,
    'Ingresa el importe contado (el cero debe ser explícito).',
    'Importe inválido: solo enteros en centavos, sin decimales.',
    (value) => integerCents(value),
  )
}

/**
 * Same blind-count rules as `countEntryErrors`, but the money entry is read in
 * PESOS (exact conversion, ≤ 2 decimals). The blank/invalid copy is unit-correct
 * for the money UI; the returned errors are keyed by frozen channel.
 */
export function countEntryErrorsPesos(
  channels: readonly CountChannel[],
  values: Readonly<Record<string, string>>,
): Record<string, string> {
  return countEntryErrorsWith(
    channels,
    values,
    'Ingresa el importe contado en pesos (el cero debe ser explícito).',
    'Importe inválido: usa pesos con hasta dos decimales.',
    (value) => pesosToCents(value),
  )
}

function countEntryErrorsWith(
  channels: readonly CountChannel[],
  values: Readonly<Record<string, string>>,
  blankMessage: string,
  invalidMessage: string,
  parse: (value: string) => number,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const { channelKey } of channels) {
    const raw = values[channelKey]
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      errors[channelKey] = blankMessage
      continue
    }
    try {
      parse(String(raw).trim())
    } catch {
      errors[channelKey] = invalidMessage
    }
  }
  return errors
}

/** Build the count body from the frozen channels, or `null` when entry is invalid. */
export function buildCountPayload(
  channels: readonly CountChannel[],
  values: Readonly<Record<string, string>>,
  notes?: string,
  denominations?: readonly { denominationCents: number; quantity: number }[],
): CashCountPayload | null {
  return buildCountPayloadFrom(
    channels,
    values,
    countEntryErrors(channels, values),
    (value) => integerCents(value),
    notes,
    denominations,
  )
}

/**
 * Pesos money variant of `buildCountPayload`: the frozen channel values are read
 * in PESOS and converted once, exactly, to integer cents. Denominations are
 * already integer cents (their money min/bounds are unchanged) and pass through.
 */
export function buildCountPayloadPesos(
  channels: readonly CountChannel[],
  values: Readonly<Record<string, string>>,
  notes?: string,
  denominations?: readonly { denominationCents: number; quantity: number }[],
): CashCountPayload | null {
  return buildCountPayloadFrom(
    channels,
    values,
    countEntryErrorsPesos(channels, values),
    (value) => pesosToCents(value),
    notes,
    denominations,
  )
}

function buildCountPayloadFrom(
  channels: readonly CountChannel[],
  values: Readonly<Record<string, string>>,
  entryErrors: Record<string, string>,
  parse: (value: string) => number,
  notes?: string,
  denominations?: readonly { denominationCents: number; quantity: number }[],
): CashCountPayload | null {
  if (!channels.length) return null
  if (Object.keys(entryErrors).length > 0) return null
  const lines: CashCountLine[] = channels.map(({ channelKey }) => ({
    channelKey,
    amountCents: parse(String(values[channelKey]).trim()),
  }))
  const trimmedNotes = notes?.trim()
  const payload: CashCountPayload = {
    lines,
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
  }
  if (denominations && denominations.length > 0) {
    payload.denominations = denominations.map((row) => ({
      denominationCents: row.denominationCents,
      quantity: row.quantity,
    }))
  }
  return payload
}

export function sumDenominations(
  rows: readonly { denominationCents: number; quantity: number }[],
): number {
  return rows.reduce((total, row) => total + row.denominationCents * row.quantity, 0)
}

/**
 * Denominations are optional. When supplied they must sum EXACTLY to the `CASH`
 * line (`CASH_DENOMINATION_SUM_MISMATCH`).
 */
export function denominationError(
  rows: readonly { denominationCents: number; quantity: number }[],
  cashCents: number | null,
): string | null {
  if (rows.length === 0) return null
  if (cashCents === null) return 'Declara primero el total de Efectivo (CASH).'
  if (sumDenominations(rows) !== cashCents) {
    return 'El detalle de denominaciones debe sumar exactamente el total de Efectivo.'
  }
  return null
}

export interface CashComparisonView {
  expectedCents: number | null
  declaredCents: number | null
  verifiedCents: number | null
  declarationDifferenceCents: number | null
  verificationDifferenceCents: number | null
  verifiedVsExpectedDifferenceCents: number | null
  requiresDeclarationNotes: boolean
  requiresVerificationNotes: boolean
  hasDiscrepancy: boolean
  notesRequired: boolean
}

/**
 * Session identity snapshot used to scope sensitive caches and stale async work.
 *
 * The backend keys visibility on the AUTHENTICATED principal (the same session
 * detail is a blind owner projection for the cashier but a wider audit
 * projection for an audit reader), so cache slots and in-flight guards must be
 * scoped by tenant, user AND the permission generation — never by tenant alone.
 * There is no auth counter for that, so the generation is derived
 * deterministically from the existing `permissionCodes`.
 */
export interface CashIdentity {
  tenantId: string
  userId: string
  permissionFingerprint: string
  /**
   * The real auth **session lifecycle** generation (`authStorage` advances it on
   * login, logout, tenant switch and clear — and deliberately NOT on a
   * context-preserving token rotation). It separates two sessions that share the
   * same user, tenant and permissions, which tenant/user/permissions alone cannot.
   */
  generation: number
}

/** Deterministic, order-insensitive fingerprint of the permission generation. */
export function cashPermissionFingerprint(codes: readonly string[]): string {
  const unique = Array.from(new Set(codes)).sort()
  let hash = 5381
  for (const code of unique) {
    for (let index = 0; index < code.length; index += 1) {
      hash = (hash * 33 + code.charCodeAt(index)) | 0
    }
    hash = (hash * 33 + 31) | 0
  }
  return `${unique.length}:${(hash >>> 0).toString(36)}`
}

/** True only when both snapshots describe the SAME principal and permission set. */
export function isSameCashIdentity(
  a: CashIdentity | null | undefined,
  b: CashIdentity | null | undefined,
): boolean {
  if (!a || !b) return false
  return (
    a.tenantId === b.tenantId &&
    a.userId === b.userId &&
    a.permissionFingerprint === b.permissionFingerprint &&
    a.generation === b.generation
  )
}

/**
 * Read BOTH comparison shapes (normal and DECLARE fallback) without merging the
 * two differences. The fallback deliberately lacks
 * `declarationDifferenceCents`; it carries a single `differenceCents`.
 */
export function comparisonView(comparison: unknown): CashComparisonView | null {
  if (comparison === null || typeof comparison !== 'object') return null
  const raw = comparison as Record<string, unknown>
  const num = (key: string): number | null => {
    const value = raw[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  }
  const flag = (key: string): boolean => raw[key] === true
  const fallbackDifference = num('differenceCents')
  return {
    expectedCents: num('expectedCents'),
    declaredCents: num('declaredCents'),
    verifiedCents: num('verifiedCents'),
    declarationDifferenceCents: num('declarationDifferenceCents'),
    verificationDifferenceCents: num('verificationDifferenceCents'),
    verifiedVsExpectedDifferenceCents: num('verifiedVsExpectedDifferenceCents'),
    requiresDeclarationNotes: flag('requiresDeclarationNotes'),
    requiresVerificationNotes: flag('requiresVerificationNotes'),
    hasDiscrepancy: flag('hasDiscrepancy'),
    notesRequired: flag('notesRequired'),
    // The fallback single difference belongs to the declaration step.
    ...(fallbackDifference !== null && num('declarationDifferenceCents') === null
      ? { declarationDifferenceCents: fallbackDifference }
      : {}),
  }
}

/** A different authenticated person must verify. */
export function isSelfVerification(
  cashierUserId: string | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  return Boolean(cashierUserId) && cashierUserId === currentUserId
}

/** The receipt actor is the authenticated subject and must be the designated recipient. */
export function canReceiveHandover(
  handover: { receiverUserId?: string | null; receivedAt?: string | null } | null | undefined,
  currentUserId: string | null | undefined,
): boolean {
  if (!handover || !currentUserId) return false
  if (handover.receivedAt) return false
  return handover.receiverUserId === currentUserId
}

/** A received FLOAT may fund an opening only when its RECEIVED amount equals it. */
export function floatOpeningMismatch(
  receivedCents: number | null | undefined,
  openingCents: number | null,
): boolean {
  if (typeof receivedCents !== 'number' || openingCents === null) return false
  return receivedCents !== openingCents
}

/**
 * Same source drawer blocks ONLY the same register until it is released.
 * Discovery itself never reserves the FLOAT.
 */
export function floatSourceDrawerAdvisory(
  float: { sourceRegisterId?: string | null; sourceDrawerReleasedAt?: string | null } | null,
  registerId: string | null,
): { blocked: boolean; message: string } | null {
  if (!float || float.sourceDrawerReleasedAt) return null
  if (registerId && float.sourceRegisterId === registerId) {
    return {
      blocked: true,
      message:
        'La caja de origen todavía no liberó su cajón; no puedes abrir en esa misma caja hasta que lo libere.',
    }
  }
  return {
    blocked: false,
    message: 'La caja de origen sigue sin liberar su cajón: puedes usar el FLOAT en otra caja.',
  }
}
