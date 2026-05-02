import { describe, expect, it, vi } from 'vitest'
import {
  AUTH_SESSION_EXPIRED_EVENT,
  emitSessionExpired,
  onSessionExpired,
} from '../session-events'

describe('session-events', () => {
  it('dispatches tenant-required reason', () => {
    const handler = vi.fn()
    const unsubscribe = onSessionExpired(handler)

    emitSessionExpired('tenant-required')

    expect(handler).toHaveBeenCalledWith('tenant-required')
    expect(handler).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('dispatches custom event name', () => {
    const listener = vi.fn()
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener)

    emitSessionExpired('tenant-required')

    expect(listener).toHaveBeenCalledTimes(1)
    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener)
  })
})
