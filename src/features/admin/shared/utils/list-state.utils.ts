/** Shared copy and error mapping for the admin list screens (S10 states). */

type ApiErrorLike = {
  response?: { data?: { message?: unknown } }
  message?: string
}

/**
 * Human-readable message for a failed list request: the backend
 * `response.data.message` (string or first of an array), then `error.message`,
 * then the Spanish fallback.
 */
export function resolveListErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiErrorLike | null | undefined
  const backendMessage = err?.response?.data?.message
  if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage
  if (Array.isArray(backendMessage) && typeof backendMessage[0] === 'string') return backendMessage[0]
  if (typeof err?.message === 'string' && err.message.trim()) return err.message
  return fallback
}

/** Title of the no-match state: `Ningún resultado para «term»`. */
export function noMatchTitleFor(term: string): string {
  const trimmed = term.trim()
  return trimmed ? `Ningún resultado para «${trimmed}»` : 'Ningún resultado'
}
