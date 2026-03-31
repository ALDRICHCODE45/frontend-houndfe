export const AUTH_SESSION_EXPIRED_EVENT = 'hound:auth-session-expired'

export type SessionExpiredReason = 'missing-refresh-token' | 'refresh-failed'

export function emitSessionExpired(reason: SessionExpiredReason) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent<SessionExpiredReason>(AUTH_SESSION_EXPIRED_EVENT, {
      detail: reason,
    }),
  )
}

export function onSessionExpired(handler: (reason: SessionExpiredReason) => void) {
  if (typeof window === 'undefined') {
    return () => undefined
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<SessionExpiredReason>
    handler(customEvent.detail)
  }

  window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener)

  return () => {
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener)
  }
}
