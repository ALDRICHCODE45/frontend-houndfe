// notificationConfig.api.spec.ts — RED-first tests for the API client.
//
// Contract under test (per spec REQ-3, REQ-7):
// - get()       → GET  /notification-config → NotificationConfigResponse
// - update(body) → PUT  /notification-config with EXACTLY
//                   { enabled, recipientUserIds, enabledActions } (3 keys, no extras)
// - The mapper layer (`toPutBody`) is the SOLE thing that builds the PUT body,
//   so any caller that sends a body NOT built by `toPutBody` would be wrong.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notificationConfigApi } from '../notificationConfig.api'
import { http } from '@/core/shared/api/http'
import { toPutBody } from '../../utils/notificationConfigMappers'
import type { NotificationConfigResponse } from '../../interfaces/notification-config.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    get: vi.fn(),
    put: vi.fn(),
  },
}))

describe('notificationConfigApi.get', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls GET /notification-config and returns the parsed response', async () => {
    const response: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })

    const result = await notificationConfigApi.get()

    expect(http.get).toHaveBeenCalledWith('/notification-config')
    expect(result).toEqual(response)
  })

  it('returns the never-configured defaults unchanged when backend emits them', async () => {
    const response: NotificationConfigResponse = {
      enabled: false,
      recipients: [],
      enabledActions: [],
    }
    vi.mocked(http.get).mockResolvedValue({ data: response })

    const result = await notificationConfigApi.get()

    expect(result).toEqual(response)
  })
})

describe('notificationConfigApi.update', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls PUT /notification-config with a body built by toPutBody', async () => {
    const backendResponse: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    }
    vi.mocked(http.put).mockResolvedValue({ data: backendResponse })

    const form = {
      enabled: true,
      recipientUserIds: ['u1'],
      enabledActions: ['LOW_STOCK'] as Array<'LOW_STOCK'>,
    }

    await notificationConfigApi.update(toPutBody(form))

    expect(http.put).toHaveBeenCalledTimes(1)
    const [url, body] = vi.mocked(http.put).mock.calls[0]!
    expect(url).toBe('/notification-config')
    // The body MUST be EXACTLY the toPutBody output — the spec forbids
    // extra keys because the backend DTO has `forbidNonWhitelisted`.
    expect(body).toEqual(toPutBody(form))
  })

  it('sends EXACTLY 3 whitelisted keys in the PUT body — no extras, no missing', async () => {
    const backendResponse: NotificationConfigResponse = {
      enabled: false,
      recipients: [],
      enabledActions: [],
    }
    vi.mocked(http.put).mockResolvedValue({ data: backendResponse })

    await notificationConfigApi.update(
      toPutBody({ enabled: false, recipientUserIds: [], enabledActions: [] }),
    )

    const [, body] = vi.mocked(http.put).mock.calls[0]!
    expect(Object.keys(body as object)).toEqual([
      'enabled',
      'recipientUserIds',
      'enabledActions',
    ])
    expect(Object.keys(body as object)).toHaveLength(3)
  })

  it('PUT body never contains the GET view key "recipients" (field asymmetry)', async () => {
    vi.mocked(http.put).mockResolvedValue({
      data: { enabled: false, recipients: [], enabledActions: [] },
    })

    await notificationConfigApi.update(
      toPutBody({ enabled: true, recipientUserIds: ['u1'], enabledActions: ['LOW_STOCK'] }),
    )

    const [, body] = vi.mocked(http.put).mock.calls[0]!
    expect((body as Record<string, unknown>).recipients).toBeUndefined()
    expect((body as Record<string, unknown>).recipientUserIds).toEqual(['u1'])
  })

  it('returns the backend response (used by the mutation to re-hydrate)', async () => {
    const backendResponse: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u9', 'u10'],
      enabledActions: ['LOW_STOCK'],
    }
    vi.mocked(http.put).mockResolvedValue({ data: backendResponse })

    const result = await notificationConfigApi.update(
      toPutBody({ enabled: true, recipientUserIds: ['u9', 'u10'], enabledActions: ['LOW_STOCK'] }),
    )

    expect(result).toEqual(backendResponse)
  })
})
