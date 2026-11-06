/**
 * Reader for the four backend error bodies (shipping handoff §0). Callers
 * switch on `code` or `fieldErrors`, never on `message`.
 *
 *   A. Domain:          { statusCode, error: CODE, message, timestamp }
 *   B. Zone filter:     { statusCode, code: CODE, message }
 *   C. Validation pipe: { statusCode: 400, error: 'Bad Request',
 *                         message: [{ property, children, constraints }] }
 *   D. Nest HTTP:       { statusCode, error: 'Bad Request' | 'Not Found' | …, message }
 *
 * Unlike {@link normalizeApiError} it has no fallback copy: absent parts are
 * `null` so each screen picks its own wording. Never throws.
 */
export interface ApiErrorEnvelope {
  /** HTTP status; `null` for network errors and non-HTTP input. */
  status: number | null
  /** Domain CODE from `code` (B) or `error` (A); `null` for Nest names (C, D). */
  code: string | null
  /** Backend message; for C the constraint texts joined with a space. */
  message: string | null
  /** C only: constraint texts by property path (`parent.child`, `days.0.opensAt`). */
  fieldErrors: Record<string, string[]>
}

// Domain codes are SCREAMING_SNAKE_CASE; Nest names ('Bad Request') are not.
const DOMAIN_CODE = /^[A-Z][A-Z0-9_]*$/

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readCode(value: unknown): string | null {
  return typeof value === 'string' && DOMAIN_CODE.test(value) ? value : null
}

function collectFieldErrors(
  entries: unknown[],
  parentPath: string,
  into: Record<string, string[]>,
): void {
  entries.forEach((entry) => {
    const item = asRecord(entry)
    if (!item || typeof item.property !== 'string') return
    const path = parentPath ? `${parentPath}.${item.property}` : item.property
    const constraints = asRecord(item.constraints)
    if (constraints) {
      const texts = Object.values(constraints).filter(
        (text): text is string => typeof text === 'string' && text.trim().length > 0,
      )
      if (texts.length > 0) into[path] = [...(into[path] ?? []), ...texts]
    }
    if (Array.isArray(item.children)) collectFieldErrors(item.children, path, into)
  })
}

export function readApiErrorEnvelope(err: unknown): ApiErrorEnvelope {
  const result: ApiErrorEnvelope = { status: null, code: null, message: null, fieldErrors: {} }

  const response = asRecord(asRecord(err)?.response)
  if (!response) return result

  const data = asRecord(response.data)
  if (typeof response.status === 'number') result.status = response.status
  else if (typeof data?.statusCode === 'number') result.status = data.statusCode
  if (!data) return result

  result.code = readCode(data.code) ?? readCode(data.error)

  const rawMessage = data.message
  if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
    result.message = rawMessage
  } else if (Array.isArray(rawMessage)) {
    collectFieldErrors(rawMessage, '', result.fieldErrors)
    const texts = rawMessage.every((entry) => typeof entry === 'string')
      ? (rawMessage as string[]).filter((text) => text.trim().length > 0)
      : Object.values(result.fieldErrors).flat()
    if (texts.length > 0) result.message = texts.join(' ')
  }

  return result
}
