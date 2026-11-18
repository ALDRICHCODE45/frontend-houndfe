import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { makeNotice, withQuery } from './support'
import { notificationKeys } from '../../constants/queryKeys'

vi.mock('../../api/notifications.api', () => ({
  notificationsApi: { list: vi.fn(), getPreferences: vi.fn() },
}))
vi.mock('../../utils/notification-sound', () => ({ playNotificationSound: vi.fn() }))

import { notificationsApi } from '../../api/notifications.api'
import { playNotificationSound } from '../../utils/notification-sound'
import { useNotificationAlerts } from '../useNotificationAlerts'

const list = vi.mocked(notificationsApi.list)
const getPreferences = vi.mocked(notificationsApi.getPreferences)
const play = vi.mocked(playNotificationSound)

class FakeNotification {
  static permission: NotificationPermission = 'granted'
  static instances: FakeNotification[] = []
  onclick: (() => void) | null = null
  close = vi.fn()
  constructor(
    public title: string,
    public options?: NotificationOptions,
  ) {
    FakeNotification.instances.push(this)
  }
}

function firstNotice(): FakeNotification {
  const notice = FakeNotification.instances[0]
  if (!notice) throw new Error('no browser notification was shown')
  return notice
}

function setup(onOpen?: (path: string) => void) {
  const count = ref<number | null>(2)
  const tenantId = ref('tenant-1')
  const mounted = withQuery(() => useNotificationAlerts({ count, tenantId, onOpen }))
  return { count, tenantId, ...mounted }
}
const hide = () => vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')

beforeEach(() => {
  list.mockReset()
  getPreferences.mockReset()
  play.mockReset()
  FakeNotification.permission = 'granted'
  FakeNotification.instances = []
  vi.stubGlobal('Notification', FakeNotification)
  list.mockResolvedValue({
    items: [makeNotice('new', { title: 'Nueva solicitud', body: 'Queja · S-000124' })],
    nextCursor: null,
  })
  getPreferences.mockResolvedValue({ emailEnabled: true, soundEnabled: true })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useNotificationAlerts — browser notification', () => {
  it('shows it when the tab is hidden, permission is granted and the count went up', async () => {
    hide()
    const { count } = setup()
    await flushPromises()

    count.value = 3
    await flushPromises()

    expect(list).toHaveBeenCalledWith({ limit: 1, unread: true }, expect.anything())
    expect(FakeNotification.instances).toHaveLength(1)
    expect(firstNotice().title).toBe('Nueva solicitud')
    expect(firstNotice().options).toMatchObject({ body: 'Queja · S-000124', tag: 'new' })
  })

  it('stays silent while the tab is visible (no browser notice, no sound, no extra reads)', async () => {
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(FakeNotification.instances).toHaveLength(0)
    expect(play).not.toHaveBeenCalled()
    expect(getPreferences).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
  })

  it.each(['default', 'denied'] as const)('shows nothing when the permission is %s', async (permission) => {
    FakeNotification.permission = permission
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(FakeNotification.instances).toHaveLength(0)
  })

  it('does not alert on the first value, on a drop, or on the same count', async () => {
    hide()
    const { count } = setup()
    await flushPromises()
    expect(FakeNotification.instances).toHaveLength(0)

    count.value = 1
    await flushPromises()
    count.value = 1
    await flushPromises()
    expect(FakeNotification.instances).toHaveLength(0)
    expect(play).not.toHaveBeenCalled()
  })

  it('does not alert when the count appears after being unknown (first load of a branch)', async () => {
    hide()
    const { count, tenantId } = setup()
    count.value = null
    tenantId.value = 'tenant-2'
    await flushPromises()
    count.value = 5
    await flushPromises()

    expect(FakeNotification.instances).toHaveLength(0)
  })

  it('falls back to generic text when the newest notice cannot be read', async () => {
    list.mockRejectedValue(new Error('boom'))
    hide()
    const { count } = setup()
    count.value = 4
    await flushPromises()

    expect(firstNotice().title).toBe('Nueva notificación')
    expect(firstNotice().options?.body).toBe('Tienes 4 avisos sin leer')
  })

  it('clicking it focuses the window and opens the request', async () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const onOpen = vi.fn()
    hide()
    const { count } = setup(onOpen)
    count.value = 3
    await flushPromises()

    firstNotice().onclick?.()
    expect(focus).toHaveBeenCalled()
    expect(onOpen).toHaveBeenCalledWith('/chatbot/solicitudes/req-new')
    expect(firstNotice().close).toHaveBeenCalled()
  })

  it('a SALE_HOLD_REVIEW notice shows its copy and opens the sale detail', async () => {
    vi.spyOn(window, 'focus').mockImplementation(() => {})
    list.mockResolvedValue({
      items: [
        makeNotice('hold', {
          type: 'SALE_HOLD_REVIEW',
          title: 'Apartado vencido: revisa la venta',
          body: 'Venta W-000042 · Comprobante pendiente de revisar',
          requestId: null,
          saleId: 'sale-42',
        }),
      ],
      nextCursor: null,
    })
    const onOpen = vi.fn()
    hide()
    const { count } = setup(onOpen)
    count.value = 3
    await flushPromises()

    expect(firstNotice().title).toBe('Apartado vencido: revisa la venta')
    expect(firstNotice().options?.body).toBe('Venta W-000042 · Comprobante pendiente de revisar')
    firstNotice().onclick?.()
    expect(onOpen).toHaveBeenCalledWith('/pos/ventas/sale-42')
  })

  it('clicking a notice with neither request nor sale only focuses the window', async () => {
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    list.mockResolvedValue({ items: [makeNotice('none', { requestId: null, saleId: null })], nextCursor: null })
    const onOpen = vi.fn()
    hide()
    const { count } = setup(onOpen)
    count.value = 3
    await flushPromises()

    firstNotice().onclick?.()
    expect(focus).toHaveBeenCalled()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does not throw when the browser has no Notification API', async () => {
    vi.unstubAllGlobals()
    vi.stubGlobal('Notification', undefined)
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(getPreferences).toHaveBeenCalled()
  })
})

describe('useNotificationAlerts — sound', () => {
  it('plays only when the server preference soundEnabled is true', async () => {
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(getPreferences).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('is silent with soundEnabled false, but the browser notice still shows', async () => {
    getPreferences.mockResolvedValue({ emailEnabled: true, soundEnabled: false })
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(play).not.toHaveBeenCalled()
    expect(FakeNotification.instances).toHaveLength(1)
  })

  it('is silent when the preference cannot be read', async () => {
    getPreferences.mockRejectedValue(new Error('boom'))
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(play).not.toHaveBeenCalled()
  })

  it('does not depend on the browser permission', async () => {
    FakeNotification.permission = 'denied'
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()

    expect(FakeNotification.instances).toHaveLength(0)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('reads the preference fresh each time (a change in /perfil applies at once)', async () => {
    hide()
    const { count } = setup()
    count.value = 3
    await flushPromises()
    count.value = 4
    await flushPromises()

    expect(getPreferences).toHaveBeenCalledTimes(2)
  })
})

describe('useNotificationAlerts — list freshness', () => {
  it('invalidates the lists when the count goes up, visible or not', async () => {
    const { count, client } = setup()
    const spy = vi.spyOn(client, 'invalidateQueries')
    count.value = 3
    await flushPromises()

    expect(spy).toHaveBeenCalledWith({ queryKey: notificationKeys.lists('tenant-1') })
  })
})
