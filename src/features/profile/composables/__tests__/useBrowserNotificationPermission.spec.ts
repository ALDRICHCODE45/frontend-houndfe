import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withQuery } from './withQuery'
import { useBrowserNotificationPermission } from '../useBrowserNotificationPermission'

type Permission = 'default' | 'granted' | 'denied'

/** Stand-in for the global `Notification`, with a settable permission. */
function stubNotification(permission: Permission, requestResult: Permission = permission) {
  const requestPermission = vi.fn(async () => {
    FakeNotification.permission = requestResult
    return requestResult
  })
  const FakeNotification = { permission, requestPermission }
  vi.stubGlobal('Notification', FakeNotification)
  return { FakeNotification, requestPermission }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useBrowserNotificationPermission', () => {
  it.each<Permission>(['default', 'granted', 'denied'])('reads the current permission: %s', (permission) => {
    stubNotification(permission)
    const { result } = withQuery(() => useBrowserNotificationPermission())

    expect(result.supported.value).toBe(true)
    expect(result.state.value).toBe(permission)
  })

  it('reports an unsupported browser when there is no Notification API', () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = withQuery(() => useBrowserNotificationPermission())

    expect(result.supported.value).toBe(false)
    expect(result.state.value).toBe('unsupported')
  })

  it('request() asks the browser and adopts the answer', async () => {
    const { requestPermission } = stubNotification('default', 'granted')
    const { result } = withQuery(() => useBrowserNotificationPermission())

    await result.request()

    expect(requestPermission).toHaveBeenCalledTimes(1)
    expect(result.state.value).toBe('granted')
  })

  it('request() keeps «default» when the user dismisses the prompt', async () => {
    stubNotification('default', 'default')
    const { result } = withQuery(() => useBrowserNotificationPermission())

    await result.request()

    expect(result.state.value).toBe('default')
  })

  it('request() adopts «denied»', async () => {
    stubNotification('default', 'denied')
    const { result } = withQuery(() => useBrowserNotificationPermission())

    await result.request()

    expect(result.state.value).toBe('denied')
  })

  it('request() re-reads the real permission when the browser call throws', async () => {
    const { FakeNotification, requestPermission } = stubNotification('default')
    requestPermission.mockImplementation(async () => {
      FakeNotification.permission = 'denied'
      throw new Error('blocked')
    })
    const { result } = withQuery(() => useBrowserNotificationPermission())

    await expect(result.request()).resolves.toBeUndefined()

    expect(result.state.value).toBe('denied')
  })

  it('request() is a no-op in an unsupported browser', async () => {
    vi.stubGlobal('Notification', undefined)
    const { result } = withQuery(() => useBrowserNotificationPermission())

    await expect(result.request()).resolves.toBeUndefined()

    expect(result.state.value).toBe('unsupported')
  })

  it('picks up a change made in the browser settings when the window regains focus', () => {
    const { FakeNotification } = stubNotification('denied')
    const { result, wrapper } = withQuery(() => useBrowserNotificationPermission())
    expect(result.state.value).toBe('denied')

    FakeNotification.permission = 'granted'
    window.dispatchEvent(new Event('focus'))
    expect(result.state.value).toBe('granted')

    wrapper.unmount()
    FakeNotification.permission = 'denied'
    window.dispatchEvent(new Event('focus'))
    expect(result.state.value).toBe('granted')
  })
})
