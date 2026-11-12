/**
 * Chatbot settings transport on the shared axios `http` (handoff 16 at 8c12ae09).
 *
 * The tenant and the actor come from the JWT, never from the path or the body. The `PUT` is a full
 * replacement, so the body is the draft minus exactly the read-only keys (`version`, `recompute`,
 * `updatedBy`, `updatedAt`: the server answers `400` to them); every other key, known or not, goes back
 * unchanged. The apply body is picked by an allow-list. Responses are parsed at the boundary (unknown
 * keys kept; a drift in a known key or an unknown enumerated value throws).
 */
import { http } from '@/core/shared/api/http'
import { deepCopy } from '../utils/deepCopy'
import {
  chatbotApplyResultSchema,
  chatbotSettingsSavedSchema,
  chatbotSettingsSchema,
  type ChatbotApplyBody,
  type ChatbotApplyResult,
  type ChatbotSettings,
  type ChatbotSettingsPutBody,
  type ChatbotSettingsSaved,
  READ_ONLY_SETTINGS_KEYS,
} from '../interfaces/chatbot-settings.types'

const BASE = '/chatbot-settings'

export interface ChatbotSettingsReadOptions {
  signal?: AbortSignal
}

async function get(options: ChatbotSettingsReadOptions = {}): Promise<ChatbotSettings> {
  const { data } = await http.get(BASE, options.signal ? { signal: options.signal } : undefined)
  return chatbotSettingsSchema.parse(data)
}

/** Full replacement plus the edited version. `branchOpeningHours` is accepted and ignored by the server; sent only when present. */
async function put(body: ChatbotSettingsPutBody): Promise<ChatbotSettingsSaved> {
  const wire: Record<string, unknown> = deepCopy(body)
  for (const key of READ_ONLY_SETTINGS_KEYS) delete wire[key]
  if (!wire.branchOpeningHours) delete wire.branchOpeningHours
  const { data } = await http.put(BASE, wire)
  return chatbotSettingsSavedSchema.parse(data)
}

/** `dryRun` writes nothing; `expectedVersion` is the version of THIS branch the user saw. Both optional. */
async function applyToAllBranches(body: ChatbotApplyBody): Promise<ChatbotApplyResult> {
  const wire: ChatbotApplyBody = {}
  if (body.dryRun !== undefined) wire.dryRun = body.dryRun
  if (body.expectedVersion !== undefined) wire.expectedVersion = body.expectedVersion
  const { data } = await http.post(`${BASE}/apply-to-all-tenants`, wire)
  return chatbotApplyResultSchema.parse(data)
}

export const chatbotSettingsApi = { get, put, applyToAllBranches }
