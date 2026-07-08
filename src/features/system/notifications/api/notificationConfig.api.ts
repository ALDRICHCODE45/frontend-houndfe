// notificationConfig.api.ts — HTTP client for /notification-config.
//
// Two endpoints: GET (read) and PUT (full-overwrite). The PUT body is the
// 3-key whitelisted DTO — `toPutBody` from the mapper layer is the ONLY
// way to build it. The error mapping (codes → Spanish copy) lives in the
// pure mappers module and is reused by the mutation composable.

import { http } from '@/core/shared/api/http'
import type {
  NotificationConfigPutBody,
  NotificationConfigResponse,
} from '../interfaces/notification-config.types'

/**
 * Read the current tenant's notification config.
 *
 * The backend may return the never-configured defaults
 * `{ enabled:false, recipients:[], enabledActions:[] }` instead of 404 —
 * callers MUST treat that as a normal hydration, not an error (spec REQ-3).
 */
async function get(): Promise<NotificationConfigResponse> {
  const { data } = await http.get<NotificationConfigResponse>('/notification-config')
  return data
}

/**
 * Full-overwrite PUT. The body MUST be built with `toPutBody` from the
 * mapper layer — anything else is a bug. The backend DTO uses
 * `forbidNonWhitelisted` so any extra key is rejected.
 */
async function update(body: NotificationConfigPutBody): Promise<NotificationConfigResponse> {
  const { data } = await http.put<NotificationConfigResponse>('/notification-config', body)
  return data
}

export const notificationConfigApi = {
  get,
  update,
}
