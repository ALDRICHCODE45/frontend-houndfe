import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { deferred, withQuery } from './withQuery'
import { profileKeys } from '../../constants/queryKeys'
import type { NotificationPreferences } from '../../interfaces/profile.types'

vi.mock('../../api/notification-preferences.api', () => ({
  notificationPreferencesApi: { get: vi.fn(), patch: vi.fn() },
}))

const auth = vi.hoisted(() => ({ userId: 'user-1' as string | null }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get user() {
      return auth.userId ? { id: auth.userId, name: 'Laura Méndez', email: 'laura@ejemplo.mx' } : null
    },
  }),
}))

import { notificationPreferencesApi } from '../../api/notification-preferences.api'
import { useNotificationPreferences } from '../useNotificationPreferences'

const get = vi.mocked(notificationPreferencesApi.get)
const patch = vi.mocked(notificationPreferencesApi.patch)

const BOTH_ON: NotificationPreferences = { emailEnabled: true, soundEnabled: true }

beforeEach(() => {
  get.mockReset()
  patch.mockReset()
  auth.userId = 'user-1'
  get.mockResolvedValue({ ...BOTH_ON })
})

describe('useNotificationPreferences — read', () => {
  it('loads the preferences under a per-person key (they are the same in every sucursal)', async () => {
    const { result, client } = withQuery(() => useNotificationPreferences())
    expect(result.isLoading.value).toBe(true)
    await flushPromises()

    expect(get).toHaveBeenCalledWith({ signal: expect.anything() })
    expect(result.preferences.value).toEqual(BOTH_ON)
    expect(result.isLoading.value).toBe(false)
    expect(result.isError.value).toBe(false)
    expect(client.getQueryData(profileKeys.notificationPreferences('user-1'))).toEqual(BOTH_ON)
  })

  it('does not fire without a signed-in user', async () => {
    auth.userId = null
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    expect(get).not.toHaveBeenCalled()
    expect(result.preferences.value).toBeNull()
  })

  it('exposes a load failure and retries it on refetch', async () => {
    get.mockRejectedValueOnce(new Error('HTTP 500'))
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    expect(result.isError.value).toBe(true)
    expect(result.preferences.value).toBeNull()

    await result.refetch()
    await flushPromises()

    expect(get).toHaveBeenCalledTimes(2)
    expect(result.isError.value).toBe(false)
    expect(result.preferences.value).toEqual(BOTH_ON)
  })
})

describe('useNotificationPreferences — toggle', () => {
  it('PATCHes only the toggled field, flips optimistically and clears the saving flag on success', async () => {
    const request = deferred<NotificationPreferences>()
    patch.mockReturnValue(request.promise)
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    const pending = result.toggle('soundEnabled')

    expect(patch).toHaveBeenCalledWith({ soundEnabled: false })
    expect(result.preferences.value).toEqual({ emailEnabled: true, soundEnabled: false })
    expect(result.saving.soundEnabled).toBe(true)
    expect(result.saving.emailEnabled).toBe(false)

    request.resolve({ emailEnabled: true, soundEnabled: false })
    await pending

    expect(result.saving.soundEnabled).toBe(false)
    expect(result.failed.soundEnabled).toBe(false)
    expect(result.preferences.value).toEqual({ emailEnabled: true, soundEnabled: false })
  })

  it('toggles back on from off (the new value is always the opposite of the current one)', async () => {
    get.mockResolvedValue({ emailEnabled: false, soundEnabled: true })
    patch.mockResolvedValue({ emailEnabled: true, soundEnabled: true })
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    await result.toggle('emailEnabled')

    expect(patch).toHaveBeenCalledWith({ emailEnabled: true })
    expect(result.preferences.value).toEqual({ emailEnabled: true, soundEnabled: true })
  })

  it('rolls back and flags only that row when the PATCH fails', async () => {
    patch.mockRejectedValue(new Error('HTTP 500'))
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    await result.toggle('emailEnabled')

    expect(result.preferences.value).toEqual(BOTH_ON)
    expect(result.failed.emailEnabled).toBe(true)
    expect(result.failed.soundEnabled).toBe(false)
    expect(result.saving.emailEnabled).toBe(false)
  })

  it('clears the failure flag when the row is tried again', async () => {
    patch.mockRejectedValueOnce(new Error('HTTP 500'))
    patch.mockResolvedValueOnce({ emailEnabled: false, soundEnabled: true })
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    await result.toggle('emailEnabled')
    expect(result.failed.emailEnabled).toBe(true)

    const retry = result.toggle('emailEnabled')
    expect(result.failed.emailEnabled).toBe(false)
    await retry

    expect(patch).toHaveBeenCalledTimes(2)
    expect(patch).toHaveBeenLastCalledWith({ emailEnabled: false })
    expect(result.preferences.value).toEqual({ emailEnabled: false, soundEnabled: true })
  })

  it('ignores a second click on a row that is still saving', async () => {
    const request = deferred<NotificationPreferences>()
    patch.mockReturnValue(request.promise)
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    const first = result.toggle('soundEnabled')
    await result.toggle('soundEnabled')

    expect(patch).toHaveBeenCalledTimes(1)

    request.resolve({ emailEnabled: true, soundEnabled: false })
    await first
  })

  it('keeps the rows independent: one failing never rolls back the other', async () => {
    const email = deferred<NotificationPreferences>()
    const sound = deferred<NotificationPreferences>()
    patch.mockImplementation((body) =>
      'emailEnabled' in body ? email.promise : sound.promise,
    )
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    const emailToggle = result.toggle('emailEnabled')
    const soundToggle = result.toggle('soundEnabled')
    expect(patch).toHaveBeenNthCalledWith(1, { emailEnabled: false })
    expect(patch).toHaveBeenNthCalledWith(2, { soundEnabled: false })
    expect(result.preferences.value).toEqual({ emailEnabled: false, soundEnabled: false })

    // The sound PATCH lands first, with the server's (older) view of email.
    sound.resolve({ emailEnabled: true, soundEnabled: false })
    await soundToggle
    expect(result.preferences.value).toEqual({ emailEnabled: false, soundEnabled: false })

    email.reject(new Error('HTTP 500'))
    await emailToggle

    expect(result.preferences.value).toEqual({ emailEnabled: true, soundEnabled: false })
    expect(result.failed.emailEnabled).toBe(true)
    expect(result.failed.soundEnabled).toBe(false)
  })

  it('does nothing while the preferences have not loaded', async () => {
    get.mockRejectedValue(new Error('HTTP 500'))
    const { result } = withQuery(() => useNotificationPreferences())
    await flushPromises()

    await result.toggle('soundEnabled')

    expect(patch).not.toHaveBeenCalled()
  })
})
