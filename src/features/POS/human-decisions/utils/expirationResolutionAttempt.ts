/**
 * EXPIRATION WU2 — pure resolution-attempt identity for EXPIRATION decisions.
 *
 * `prepareExpirationDecisionResolutionAttempt` turns operator input into the
 * exact WU1 `ExpirationDecisionResolvePayload` plus a stable
 * `resolutionRequestId`, so a caller may safely retry one logical attempt on an
 * ambiguous failure without creating a second backend effect.
 *
 * Fixed order for the positive branch: validate/normalize text FIRST (WU1
 * `validateExpirationText`), and only then generate a UUID. Failures are the
 * validator's value-free discriminated `{ ok:false, reason }` and never echo the
 * rejected text.
 *
 * Payloads are rebuilt from an explicit whitelist (never spread from the input or
 * a previous payload), so structurally extended callers cannot leak extra keys.
 * The previous UUID is reused only when `decisionId`, `action`,
 * `expectedVersion` and (for positive) the normalized text still match.
 *
 * Deliberately out of scope: automatic retries, persistence, UUID format
 * validation and version policy (the caller owns those).
 */
import type { ExpirationDecisionResolvePayload } from '../interfaces/expiration-decision.types'
import { validateExpirationText, type ExpirationTextValidationReason } from './expirationText'

/** Discriminated operator input; the negative variant carries no text. */
export type ExpirationDecisionResolutionInput =
  | {
      action: 'PROVIDE_EXPIRATION_TEXT'
      expirationText: string
      expectedVersion: number
    }
  | {
      action: 'REPORT_EXPIRATION_UNAVAILABLE'
      expectedVersion: number
    }

/** A decision id bound to the exact payload a caller sends once per attempt. */
export interface ExpirationDecisionResolutionAttempt {
  decisionId: string
  payload: ExpirationDecisionResolvePayload
}

/** Value-free failure reasons come straight from the WU1 validator. */
export type PrepareExpirationDecisionResolutionAttemptResult =
  | { ok: true; attempt: ExpirationDecisionResolutionAttempt }
  | { ok: false; reason: ExpirationTextValidationReason }

/**
 * Returns the previous `resolutionRequestId` when the prior attempt belongs to the
 * same decision and its payload satisfies `matches`; otherwise `null`.
 */
function reusedRequestId(
  previousAttempt: ExpirationDecisionResolutionAttempt | null,
  decisionId: string,
  matches: (payload: ExpirationDecisionResolvePayload) => boolean,
): string | null {
  if (previousAttempt === null) return null
  if (previousAttempt.decisionId !== decisionId) return null
  return matches(previousAttempt.payload) ? previousAttempt.payload.resolutionRequestId : null
}

/**
 * Prepare one idempotent EXPIRATION resolution attempt. Pure; never mutates its
 * arguments. Positive text is validated before `generateId` can be called, and
 * `generateId` runs at most once.
 */
export function prepareExpirationDecisionResolutionAttempt(
  decisionId: string,
  input: ExpirationDecisionResolutionInput,
  previousAttempt: ExpirationDecisionResolutionAttempt | null = null,
  generateId: () => string = () => crypto.randomUUID(),
): PrepareExpirationDecisionResolutionAttemptResult {
  if (input.action === 'REPORT_EXPIRATION_UNAVAILABLE') {
    const reused = reusedRequestId(
      previousAttempt,
      decisionId,
      (payload) =>
        payload.action === 'REPORT_EXPIRATION_UNAVAILABLE' &&
        payload.expectedVersion === input.expectedVersion,
    )
    const payload: ExpirationDecisionResolvePayload = {
      action: 'REPORT_EXPIRATION_UNAVAILABLE',
      expectedVersion: input.expectedVersion,
      resolutionRequestId: reused ?? generateId(),
    }
    return { ok: true, attempt: { decisionId, payload } }
  }

  const validated = validateExpirationText(input.expirationText)
  if (!validated.ok) return { ok: false, reason: validated.reason }

  const reused = reusedRequestId(
    previousAttempt,
    decisionId,
    (payload) =>
      payload.action === 'PROVIDE_EXPIRATION_TEXT' &&
      payload.expirationText === validated.value &&
      payload.expectedVersion === input.expectedVersion,
  )
  const payload: ExpirationDecisionResolvePayload = {
    action: 'PROVIDE_EXPIRATION_TEXT',
    expirationText: validated.value,
    expectedVersion: input.expectedVersion,
    resolutionRequestId: reused ?? generateId(),
  }
  return { ok: true, attempt: { decisionId, payload } }
}
