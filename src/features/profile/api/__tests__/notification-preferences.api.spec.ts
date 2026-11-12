/**
 * Notification preferences transport (handoff 13 §3): GET and PATCH /me/notification-preferences
 * on the shared axios `http`. Pins the exact URL, that a PATCH carries only the flags named
 * (the backend answers 400 to an empty body or an unknown field) and that nothing else is sent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { notificationPreferencesApi } from '../notification-preferences.api'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), patch: vi.fn() } }))

const get = vi.mocked(http.get)
const patch = vi.mocked(http.patch)

beforeEach(() => {
  get.mockReset()
  patch.mockReset()
})

describe('notificationPreferencesApi', () => {
  it('get: GET /me/notification-preferences and unwraps the body, forwarding the signal', async () => {
    get.mockResolvedValue({ data: { emailEnabled: true, soundEnabled: false } })
    const signal = new AbortController().signal

    const result = await notificationPreferencesApi.get({ signal })

    expect(get).toHaveBeenCalledWith('/me/notification-preferences', { signal })
    expect(result).toEqual({ emailEnabled: true, soundEnabled: false })
  })

  it('patch: PATCH only the flag asked for and returns the full object', async () => {
    patch.mockResolvedValue({ data: { emailEnabled: true, soundEnabled: false } })

    const result = await notificationPreferencesApi.patch({ soundEnabled: false })

    expect(patch).toHaveBeenCalledWith('/me/notification-preferences', { soundEnabled: false })
    expect(result).toEqual({ emailEnabled: true, soundEnabled: false })
  })

  it('patch: drops unknown fields so they never reach the wire', async () => {
    patch.mockResolvedValue({ data: { emailEnabled: false, soundEnabled: true } })

    await notificationPreferencesApi.patch({
      emailEnabled: false,
      // @ts-expect-error unknown fields must never reach the wire
      browserEnabled: true,
    })

    expect(patch).toHaveBeenCalledWith('/me/notification-preferences', { emailEnabled: false })
  })

  it('patch: refuses an empty body instead of sending a request the backend rejects', async () => {
    await expect(notificationPreferencesApi.patch({})).rejects.toThrow()
    expect(patch).not.toHaveBeenCalled()
  })
})
