/**
 * Chatbot settings transport on the shared axios `http` (handoff 16 at 8c12ae09).
 *
 * The tenant and the actor come from the JWT, never from the path or the body. The `PUT` body and the
 * apply body are picked by an explicit allow-list: the server answers `400` to any unknown field
 * (`version` and `recompute` included), so nothing that is not named here reaches the wire. Responses are
 * parsed at the boundary (unknown fields stripped; a drift in the known ones throws).
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
  const wire: ChatbotSettingsPutBody = {
    expectedVersion: body.expectedVersion,
    openingHours: deepCopy(body.openingHours),
    closedDates: deepCopy(body.closedDates),
    slas: deepCopy(body.slas),
    windowWarningMinutes: body.windowWarningMinutes,
    templateName: body.templateName,
    templateCostText: body.templateCostText,
    enabledSubtypes: deepCopy(body.enabledSubtypes),
    receiptCloseMarginMinutes: body.receiptCloseMarginMinutes,
    scheduling: deepCopy(body.scheduling),
  }
  if (body.branchOpeningHours) wire.branchOpeningHours = deepCopy(body.branchOpeningHours)
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
