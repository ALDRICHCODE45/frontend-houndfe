import type { AxiosError } from 'axios'

export interface DomainApiError {
  statusCode?: number
  /**
   * Domain error CODE (e.g. `TIME_OFF_INVALID_TRANSITION`,
   * `TIME_OFF_INVALID_DATE_RANGE`, `SAT_KEY_NOT_FOUND`).
   * Also matches Nest class-validator envelopes which use `'Bad Request'`.
   */
  error?: string
  /**
   * Domain envelope message (single string). NOTE: Nest class-validator
   * envelopes send `message: string[]` — callers that want array-safe
   * handling should route through {@link normalizeApiError}, which
   * accepts `unknown` and joins arrays. The type stays `string` here
   * to preserve back-compat with the existing POS consumers that
   * call `.toLowerCase()` on `response.message`.
   */
  message?: string
  timestamp?: string
}

export interface NormalizedApiError {
  message: string
  /**
   * Domain error code (when the backend sends one). Used by callers
   * to dispatch on `TIME_OFF_INVALID_TRANSITION` etc.
   */
  code?: string
}

/** Shared voseo fallback used when no domain code nor caller fallback applies.
 *  Re-used by feature modules (e.g. {@link resolveDomainErrorMessage}) so the
 *  defensive string stays in ONE place. */
export const DEFAULT_FALLBACK = 'No pudimos completar la operación. Reintentá.'

function sanitizeFallback(fallback: string | undefined): string {
  if (typeof fallback !== 'string') return DEFAULT_FALLBACK
  const trimmed = fallback.trim()
  return trimmed.length > 0 ? fallback : DEFAULT_FALLBACK
}

/**
 * Pure, defensive normalizer for API errors. Handles BOTH backend
 * envelope shapes:
 *
 *   1. Domain:  { statusCode, error (CODE), message: string, timestamp }
 *   2. Nest:    { statusCode: 400, message: string[], error: 'Bad Request' }
 *
 * Contract:
 *   - NEVER throws. Returns `{ message: fallback }` on any malformed input.
 *   - Always returns a non-empty `message`.
 *   - Exposes the backend `error` code (when present and a non-empty
 *     string) so consumers can map specific cases like the 409
 *     `TIME_OFF_INVALID_TRANSITION`.
 *   - Joins Nest `string[]` messages with a single space so the UI
 *     never shows `[object Object]` or a raw array. (Validator
 *     messages are already complete sentences — joining with `'. '`
 *     would create `..` artifacts.)
 *   - Filters out non-string entries from `string[]` messages before
 *     joining, so a malformed payload still produces a sensible string.
 */
export function normalizeApiError(
  err: unknown,
  fallback?: string,
): NormalizedApiError {
  const safeFallback = sanitizeFallback(fallback)

  // null / undefined / non-object → fallback only
  if (err === null || err === undefined || typeof err !== 'object') {
    return { message: safeFallback }
  }

  const errObj = err as Record<string, unknown>

  // Find a backend envelope. The contract ONLY trusts `response.data`
  // (axios shape) — never the top-level `err.message`, which is usually
  // a low-level string like 'Network Error' or 'Request failed' that
  // would be confusing to surface to end users.
  const response = errObj.response as Record<string, unknown> | undefined
  const rawData = response?.data
  const data: Record<string, unknown> | undefined =
    rawData !== null && rawData !== undefined && typeof rawData === 'object'
      ? (rawData as Record<string, unknown>)
      : undefined

  // No backend envelope (network failure, non-Axios error, malformed
  // payload) → safe fallback only.
  if (data === undefined) {
    return { message: safeFallback }
  }

  // ── extract code (must be a non-empty trimmed string) ──
  const rawCode = data.error
  let code: string | undefined
  if (typeof rawCode === 'string' && rawCode.trim().length > 0) {
    code = rawCode
  }

  // ── extract message (string | string[] | anything else) ──
  const rawMessage = data.message
  let message: string | undefined

  if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
    message = rawMessage
  } else if (Array.isArray(rawMessage)) {
    const parts = rawMessage.filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.trim().length > 0,
    )
    if (parts.length > 0) {
      // Nest class-validator messages are already complete sentences
      // (most end with '.') — join with a single space to avoid
      // double-period artifacts.
      message = parts.join(' ')
    }
  }

  if (message !== undefined) {
    return code !== undefined ? { message, code } : { message }
  }

  // envelope present but no usable message → keep the code if any
  return code !== undefined
    ? { message: safeFallback, code }
    : { message: safeFallback }
}

/**
 * Back-compat wrapper. Existing POS callers pass `AxiosError<DomainApiError>`
 * and rely on getting back a single string for the toast `description:`.
 *
 * Delegates to {@link normalizeApiError} and returns its `.message`,
 * preserving the original `(error, fallback?) → string` signature so
 * the 5 POS files / 9 call-sites stay green.
 */
export function mapDomainError(
  error: AxiosError<DomainApiError>,
  fallback = DEFAULT_FALLBACK,
): string {
  return normalizeApiError(error, fallback).message
}
